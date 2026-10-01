# -*- coding: utf-8 -*-
"""Audience comments: fetch, split by timestamp, filter the rest with a cheap LLM.

Why this matters more than the audio signals: the transcript and every model
in this pipeline is a guess about the video. The comments are the only thing
here produced by humans who actually watched it. When the transcript garbles a
punchline -- and it does -- a hundred people quoting that line at 42:17 is what
survives. The audience does not lie.

Two pools, opposite treatment.

  TIMESTAMPED    Rare (measured: 33-201 of 1000) and the strongest signal in
                 the whole payload. No model ever judges one. Every one is
                 kept, verbatim, and pinned to the line it points at. Two
                 mechanical rules remove some -- a chapter index and an essay
                 -- and nothing else touches them.
  GENERAL        Everything else. No anchor in the video, mostly noise, so a
                 cheap model picks which ones say something about the content
                 and one more call groups them into themes. The model only
                 ever returns IDS -- it never gets a chance to rewrite a word
                 a human wrote.

MEASURED, on four real videos, 1000 comments each (Jay Shetty, Emma Chamberlain,
a relationship podcast, India's Got Latent):

  timestamped comments       33 / 67 / 77 / 201
  naming >3 moments           2 /  3 /  3 /   2      <- chapter indexes
  naming 2-3 moments          2 /  5 /  4 /   2
  longer than 500 chars       2 /  7 /  2 /   0      <- essays, max seen 9800
  busiest 15s moment          3 /  7 /  6 /  16 comments

The last row is the reason for the consensus counting below: sixteen people
pointing at one second is a stronger statement than any four of their texts,
and before this it was silently truncated to four with no count.

Also measured and rejected: a second fetch pass with order=time (500 more
comments) added 2-4 timestamped comments per video, all with 0-1 likes, for
five extra API pages. Relevance-1000 already has them. Not worth it.
"""

import json
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import llm

FETCH_TARGET = 1000
PAGE = 100
MAX_TEXT = 400          # a comment longer than this is trimmed FOR THE LLM only
TRIAGE_BATCH = 60
# Comments shown to the theme grouper, by rank. Kept well under what the model
# can answer about in one go: measured, 80 comments already cost it ~3.6k
# completion tokens, so 200 silently overran the 4k default and the whole
# grouping came back as unparseable half-JSON with no warning.
THEME_INPUT = 150
THEME_MAX_TOKENS = 12000
# Every call on this path answers with ids or a short label, and reasoning is
# switched off (see llm.chat), so these ceilings only have to fit the ANSWER.
# They are generous anyway because the failure they prevent is silent: a
# truncated reply parses to an empty id list, which reads downstream as "this
# batch had nothing worth keeping" rather than as an error. Measured, nine calls
# in one day hit the old ceiling and threw away their whole batch that way.
TRIAGE_MAX_TOKENS = 3000      # ~60 ids and nothing else
SUMMARY_MAX_TOKENS = 6000     # 20 one-line summaries
KEEP_GENERAL = 80       # verbatim general comments carried into the payload

# The only thing that ever removes a timestamped comment for its content. One
# length rule, no model, no judgement: an essay pinned to a single line costs
# the reader real attention, and everything shorter goes in exactly as written
# -- emoji, slang, one word, whatever it is. Measured, this catches 0-7
# comments per video and the longest was 9800 characters.
MAX_COMMENT_CHARS = 500

# A comment naming more moments than this is a chapter index, not a reaction:
# it lists a dozen places and reacts to none of them. Measured, exactly 2-3
# comments per video name more than three, and every one of them was an index.
MAX_TS_PER_COMMENT = 3

# The loudest general comments skip the filter. A model judging "is this about
# the content" will throw away a bare "GOAT" that fifty thousand people agreed
# with, and that agreement is itself the signal -- it says what this audience
# showed up for. Applied BEFORE the junk rules, not after, or the emoji-only
# rule eats them first.
ALWAYS_KEEP_TOP_LIKED = 25

# Replies are engagement too -- a comment with 80 replies started an argument
# -- but they are not agreement the way a like is, so they only ever break a
# tie in ranking. They never decide whether a comment survives.
REPLY_WEIGHT = 0.5

_TS = re.compile(r"(?<![\d:.])(\d{1,3}):([0-5]\d)(?::([0-5]\d))?(?![\d:])")
# "2:03-2:45" and "2:03 to 2:45" are one moment with a length, not two moments.
_RANGE = re.compile(r"(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\s*(?:-|–|—|to|till|until)\s*"
                    r"(\d{1,3}:[0-5]\d(?::[0-5]\d)?)", re.I)
# Numbers shaped like a timestamp that are not one. A clock time gives itself
# away with am/pm; scripture gives itself away with the book name in front.
_CLOCKISH = re.compile(r"^\s*(?:\.\d+)?\s*(?:am|pm|a\.m|p\.m|hrs|hours?)\b", re.I)
_VERSEISH = re.compile(r"(?:john|matthew|mark|luke|acts|romans|psalms?|proverbs|"
                       r"genesis|surah|ayah|verse|chapter|shlok|adhyay|gita)\W*$", re.I)
_EMOJI_ONLY = re.compile(r"^[\W\d_]+$", re.UNICODE)
# Deliberately not matching .in / .co / .me: "amazing.in my opinion" is a
# missing space, not a link, and that shape is everywhere in Hinglish comments.
# Measured against the looser version on 4000 real comments, the two agree
# exactly, so the narrower one costs nothing and cannot eat a real reaction.
_URL = re.compile(r"https?://|www\.|"
                  r"\b[a-z0-9][a-z0-9-]{2,}\.(?:com|net|org|io|be|xyz|shop|site|live)\b",
                  re.I)
# Zero-width and bidi marks. Real comments carry them (measured, around a
# timestamp), they break dedup keys and they are invisible in the payload.
_INVISIBLE = re.compile(r"[​-‏‪-‮⁦-⁩﻿\xad]")

# No duration known means no upper bound on a plausible timestamp, and a
# football score would sail through. Nothing this pipeline processes is longer
# than a few hours, so bound it anyway.
FALLBACK_MAX_S = 5 * 3600


def clean(text):
    """Whitespace and invisible characters only. Never a word.

    Collapsing newlines is not cosmetic: every comment is written on one line
    of the payload, and a comment containing a line break used to split there
    and leave its tail floating in the transcript as if it were spoken."""
    t = unicodedata.normalize("NFC", text or "")
    t = _INVISIBLE.sub("", t)
    return re.sub(r"\s+", " ", t).strip()


def fetch(video_id, api_key, target=FETCH_TARGET, log=print):
    """Top comments by relevance. Relevance, not time: YouTube's own ranking
    already surfaces what the audience engaged with, which is the thing we
    want, and 'newest' would just give us a random slice -- measured, 500 more
    by time added four timestamped comments with no likes between them."""
    out, token, pages = [], None, 0
    while len(out) < target:
        q = {"part": "snippet", "videoId": video_id, "order": "relevance",
             "maxResults": PAGE, "textFormat": "plainText", "key": api_key}
        if token:
            q["pageToken"] = token
        url = "https://www.googleapis.com/youtube/v3/commentThreads?" + \
              urllib.parse.urlencode(q)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                d = json.loads(r.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            if e.code == 403 and "commentsDisabled" in body:
                log("  comments disabled on this video")
                break
            log(f"  comments API HTTP {e.code}: {body}")
            break
        except Exception as e:
            log(f"  comments fetch failed: {e}")
            break
        pages += 1
        for it in d.get("items", []):
            sn = it.get("snippet", {})
            top = sn.get("topLevelComment", {}).get("snippet", {})
            t = clean(top.get("textOriginal") or top.get("textDisplay") or "")
            if t:
                out.append({"text": t,
                            "likes": int(top.get("likeCount") or 0),
                            "replies": int(sn.get("totalReplyCount") or 0)})
        token = d.get("nextPageToken")
        if not token:
            break
    return out[:target], pages


def find_ts(text, dur=None):
    """Timestamps a human typed, in seconds, deduplicated and in order.

    Everything here is about not producing a false one. A wrong timestamp is
    worse than a missing one: it pins a stranger's reaction to a line it does
    not describe, and that reaction then looks like the strongest evidence in
    the document. So a number gets rejected on any doubt --

      out of range   past the end of the video: a score line, a price, a date
      a clock time   "meet at 5:30 pm"
      scripture      "John 3:16", "Surah 2:255"
      a range        "2:03-2:45" is one moment; the second half is its length
    """
    limit = (dur + 5) if dur else FALLBACK_MAX_S
    # Blank out the tail of every range first so it cannot be read as its own
    # moment, keeping the string length identical so the offsets below hold.
    masked = _RANGE.sub(lambda m: m.group(0)[:m.end(1) - m.start(0)]
                        + " " * (len(m.group(0)) - (m.end(1) - m.start(0))), text)
    out = []
    for m in _TS.finditer(masked):
        a, b, c = m.group(1), m.group(2), m.group(3)
        s = (int(a) * 3600 + int(b) * 60 + int(c)) if c else (int(a) * 60 + int(b))
        if s > limit:
            continue
        if _CLOCKISH.match(masked[m.end():m.end() + 8]):
            continue
        if _VERSEISH.search(masked[max(0, m.start() - 12):m.start()]):
            continue
        out.append(s)
    out = sorted(set(out))
    # A comment that opens at 0:00 and then names other moments is a small
    # chapter list; the 0:00 is its heading, not a reaction to the first
    # second. On its own, 0:00 is a real cue and stays.
    if len(out) > 1 and out[0] == 0:
        out = out[1:]
    return out


def _rank(c):
    """Order inside one moment, and inside the general pool.

    Likes first, because that is other humans agreeing. Among the many with
    zero likes -- most of them -- prefer the one that says something over a
    bare "1:46", since both point at the same second but only one tells the
    reader what is there."""
    words = len(re.findall(r"\w{2,}", c["text"]))
    return (-(c["likes"] + REPLY_WEIGHT * c.get("replies", 0)),
            -min(words, 12), -len(c["text"]))


def split(raw, dur=None):
    """-> (timestamped, over-long timestamped, general, stats)

    The split happens BEFORE any filtering, because the two pools deserve
    opposite treatment.

    A timestamped comment is only ever removed for being a chapter index or an
    essay. Nothing else touches it -- no emoji rule, no length minimum, no
    model. "2:03" followed by three crying-laughing faces is pure punctuation
    and digits to a regex and would be swept away as junk, and it is a human
    pointing at the funniest second in the video, which is the most valuable
    thing in this entire payload.

    Duplicates are folded, never dropped. Forty people writing "2:03" is not
    thirty-nine pieces of junk and one comment -- it is forty people agreeing,
    and the count is the signal. The survivor carries `dupes`.
    """
    seen, ts, gen, long_ts = {}, [], [], []
    st = {"empty": 0, "dupe": 0, "index": 0, "promo": 0}
    for c in raw:
        t = clean(c.get("text"))
        if not t:
            st["empty"] += 1
            continue
        rec = {"text": t, "likes": int(c.get("likes") or 0),
               "replies": int(c.get("replies") or 0), "dupes": 0}
        # Key on letters and digits only: the same reaction reposted with a
        # different emoji tail is the same reaction.
        k = re.sub(r"[^\w]+", "", t.lower())[:100] or t[:100]
        if k in seen:
            prev = seen[k]
            prev["dupes"] += 1
            # Keep the strongest copy's text and likes, not the first one seen.
            if _rank(rec) < _rank(prev):
                prev["text"], prev["likes"] = rec["text"], rec["likes"]
                prev["replies"] = max(prev["replies"], rec["replies"])
            st["dupe"] += 1
            continue
        seen[k] = rec
        at = find_ts(t, dur)
        if at:
            if len(at) > MAX_TS_PER_COMMENT:
                st["index"] += 1
                continue
            rec["ts"] = at
            (long_ts if len(t) > MAX_COMMENT_CHARS else ts).append(rec)
        elif _URL.search(t):
            st["promo"] += 1
        elif _EMOJI_ONLY.match(t) or len(t) < 3 or len(t) > MAX_COMMENT_CHARS:
            # Not deleted yet -- the loudest of these are spared in collect(),
            # because a bare emoji with 40k likes is the audience speaking.
            rec["weak"] = True
            gen.append(rec)
        else:
            gen.append(rec)
    for i, c in enumerate(ts + long_ts + gen):
        c["id"] = i
    return ts, long_ts, gen, st


TRIAGE_SYS = (
    "You are filtering YouTube comments for a tool that finds viral moments in "
    "a video. Keep a comment if it says something about the CONTENT: a reaction "
    "to a specific moment, a quote, a joke, praise or criticism of something "
    "specific, or a timestamp. Drop it if it is spam, self-promotion, 'first', "
    "a bare emoji or greeting, a request unrelated to the content, or generic "
    "praise that names nothing ('nice video', 'love you bro'). "
    "Also drop testimonial spam: a comment reviewing or recommending some OTHER "
    "book, course, product, trading service or method, however sincere and "
    "detailed it sounds. It is not about this video. "
    "Reply with ONLY a JSON array of the ids to KEEP, e.g. [1,4,9]. No prose."
)

# The top-liked bypass exists to protect a bare "GOAT" that forty thousand
# people agreed with from a filter asking "is this about the content". It was
# also protecting an advertisement: on a real video a farmed testimonial for a
# get-rich book sat at 5,445 likes and walked straight into the payload as an
# audience theme. So the spared comments get one narrow question -- is this an
# advertisement -- and nothing else is ever asked about them.
PROMO_SYS = (
    "Each line is a highly-liked YouTube comment, written as `id: text`. "
    "Identify ONLY the ones that are advertising: promoting a book, course, "
    "product, service, channel or trading scheme, or a testimonial about "
    "something other than this video, no matter how genuine it sounds. "
    "Everything else -- reactions, jokes, praise, criticism, single words, "
    "emoji -- is NOT advertising. "
    "Reply with ONLY a JSON array of the advertising ids, e.g. [4,9]. "
    "Reply [] if there are none. No prose."
)

SUMMARY_SYS = (
    "Each line is a long YouTube comment that points at one moment of a video, "
    "written as `id: text`. For each, write ONE short sentence, at most 20 "
    "words, saying what the commenter is reacting to. Keep names and quoted "
    "phrases exactly as they appear. Do not add anything that is not in the "
    "comment. Reply with ONLY a JSON object mapping id to sentence, e.g. "
    '{"3": "she describes crying when her father finally called"}. No prose.'
)

THEME_SYS = (
    "Each line is a YouTube comment on one video, written as `id: text`. "
    "Group them by what the commenter is reacting to. Output ONLY JSON: "
    '{"mood":"<one short sentence describing this audience>",'
    '"themes":[{"what":"<short phrase>","ids":[<comment ids in this group>]}]}. '
    "At most 8 themes, biggest group first, and only groups with real weight -- "
    "leave a comment out rather than inventing a theme for it. "
    "Be SPECIFIC. 'People are moved by the part where she cries about her "
    "father' is a theme. 'Authenticity' and 'great content' are not -- they are "
    "buckets that everything falls into and they tell the reader nothing. If a "
    "group is holding more than a third of the comments, it is too broad: split "
    "it into what those people are actually reacting to. "
    "Use ONLY ids from the list. Do not quote, do not rewrite, do not count."
)


def shorten(comments, key, log=print):
    """Compress over-long timestamped comments instead of losing them.

    Measured at 0-7 per video, but when one appears it is usually somebody's
    long account of the exact moment we care about, so dropping it loses real
    evidence and pasting nine thousand characters onto one line buries the
    transcript around it.

    The result is stored separately and rendered as a clearly marked summary,
    never as a quotation. Nothing in this pipeline may present a model's words
    as something a human wrote. If the call fails the comment is dropped,
    which is the safe direction to be wrong in."""
    if not comments:
        return {}, {}

    def build(batch):
        lines = "\n".join('%s: %s' % (c["id"], c["text"][:1200]) for c in batch)
        return [{"role": "system", "content": SUMMARY_SYS},
                {"role": "user", "content": lines}]

    def parse(txt, batch):
        d = llm.parse_json(txt) or {}
        out = []
        for c in batch:
            v = clean(str(d.get(str(c["id"])) or ""))
            if v:
                out.append((c["id"], v[:220]))
        return out

    pairs, stats = llm.map_batches(comments, 20, build, parse, key, log=log,
                                   max_tokens=SUMMARY_MAX_TOKENS)
    return dict(pairs), stats


def triage(comments, key, log=print):
    """Ask a cheap model which comments are about the content.

    A regex cannot do this: 'bhai iske baad wala part' is worth keeping and
    'first' is not, and no keyword list separates them across Hinglish,
    English and transliteration. The model only ever returns IDS TO KEEP -- it
    never sees a chance to rewrite anything, which is the whole safety
    property.

    A batch that fails keeps nothing from that batch, so failure costs recall,
    never correctness."""
    if not comments:
        return [], {}

    def build(batch):
        lines = "\n".join(f'{c["id"]}: {c["text"][:MAX_TEXT]}' for c in batch)
        return [{"role": "system", "content": TRIAGE_SYS},
                {"role": "user", "content": lines}]

    def parse(txt, batch):
        ids = llm.parse_json(txt, default=None)
        if isinstance(ids, dict):
            ids = ids.get("keep") or ids.get("ids")
        if not isinstance(ids, list):
            return []
        ok = {c["id"] for c in batch}
        return [i for i in ids if isinstance(i, int) and i in ok]

    keep_ids, stats = llm.map_batches(comments, TRIAGE_BATCH, build, parse, key,
                                      log=log, max_tokens=TRIAGE_MAX_TOKENS)
    keep = set(keep_ids)
    return [c for c in comments if c["id"] in keep], stats


def drop_promo(comments, key, log=print):
    """One narrow question over the comments that skipped the filter.

    Deliberately not a second opinion on quality -- it can only ever remove an
    advertisement, so a much-loved one-word comment is still safe. If the call
    fails, nothing is removed, which is the safe direction: an ad in the
    audience block is a smaller loss than a real reaction deleted by a
    hiccup."""
    if not comments:
        return comments, {}

    def build(batch):
        lines = "\n".join(f'{c["id"]}: {c["text"][:MAX_TEXT]}' for c in batch)
        return [{"role": "system", "content": PROMO_SYS},
                {"role": "user", "content": lines}]

    def parse(txt, batch):
        ids = llm.parse_json(txt, default=None)
        if isinstance(ids, dict):
            ids = ids.get("ads") or ids.get("ids") or []
        if not isinstance(ids, list):
            return []
        ok = {c["id"] for c in batch}
        return [i for i in ids if isinstance(i, int) and i in ok]

    bad, stats = llm.map_batches(comments, TRIAGE_BATCH, build, parse, key,
                                 log=log, max_tokens=TRIAGE_MAX_TOKENS)
    bad = set(bad)
    if bad:
        log(f"  {len(bad)} advertisement(s) removed from the top-liked comments")
    return [c for c in comments if c["id"] not in bad], stats


def themes(general, key, log=print):
    """One call that GROUPS the untimestamped comments -- it does not describe
    them.

    These have no anchor in the video, so pasting hundreds verbatim burns
    context and invites the reader to hallucinate a location for them. A
    thematic digest carries the same information at a fraction of the size.

    The model returns ids per theme and nothing else. The counts are then
    arithmetic on real comments and the example under each theme is a real
    comment, copied. The previous version asked the model for the count as
    well, so the payload was quoting a number a small model had guessed at as
    if it were data."""
    if not general:
        return {}, {}
    top = sorted(general, key=_rank)[:THEME_INPUT]
    body = "\n".join(f'{c["id"]}: {c["text"][:MAX_TEXT]}' for c in top)
    try:
        # The one call on this path that keeps its reasoning. Everything else
        # here answers with a list of ids and thinks for no benefit, but grouping
        # 150 comments into themes is a genuine judgement, and measured it shows:
        # thinking produced 8 specific themes ("multitasking advice resonated",
        # "habit-change concepts"), not thinking produced 3 broad ones. Those
        # themes are how every finder understands what the video is, and this is
        # ONE call per video against sixteen for triage, so the whole cost of
        # the difference is a few paise.
        txt, usage = llm.chat([{"role": "system", "content": THEME_SYS},
                               {"role": "user", "content": body}], key,
                              max_tokens=THEME_MAX_TOKENS, reasoning=True)
    except Exception as e:
        log(f"  theme grouping failed: {e}", "WARN")
        return {}, {}
    d = llm.parse_json(txt, default={}) or {}
    if not d.get("themes"):
        # Say so. This failed silently for a while and the payload simply had
        # no audience block, which looks exactly like a video nobody commented
        # on. The run continues -- the verbatim comments carry on without it.
        log(f"  theme grouping returned nothing usable ({len(txt or '')} chars)", "WARN")
    by_id = {c["id"]: c for c in top}
    out = []
    for t in (d.get("themes") or [])[:8]:
        members = [by_id[i] for i in (t.get("ids") or [])
                   if isinstance(i, int) and i in by_id]
        what = clean(str(t.get("what") or ""))[:80]
        if not members or not what:
            continue
        best = min(members, key=_rank)
        out.append({"what": what,
                    "n": sum(1 + c["dupes"] for c in members),
                    "quote": best["text"][:200], "likes": best["likes"]})
    out.sort(key=lambda t: -t["n"])
    return ({"mood": clean(str(d.get("mood") or ""))[:200], "themes": out},
            {"cost_usd": round(float(usage.get("cost") or 0), 5)})


def collect(video_id, api_key, or_key, dur=None, log=print):
    raw, pages = fetch(video_id, api_key, log=log)
    if not raw:
        return {"ok": False, "timestamped": [], "general": [], "themes": {},
                "stats": {"raw": 0}}
    ts_raw, long_ts, gen_raw, st = split(raw, dur)
    log(f"  {len(raw)} fetched ({pages} pages), {st['dupe']} duplicates folded, "
        f"{st['promo']} links, {st['index']} chapter-index comments ignored")

    # Normal timestamped comments are finished here. No model sees them,
    # nothing shortens them, nothing reorders what they say.
    ts, sstats = list(ts_raw), {}
    log(f"  {len(ts)} timestamped -- kept in full, no filter")

    # The rare enormous one gets compressed rather than lost, and is marked so
    # nobody downstream can mistake the summary for the commenter's own words.
    if long_ts:
        got, sstats = shorten(long_ts, or_key, log=log)
        for c in long_ts:
            if c["id"] in got:
                c["summary"] = got[c["id"]]
                ts.append(c)
        log(f"  {len(got)}/{len(long_ts)} over-long timestamped summarised "
            f"(${sstats.get('cost_usd', 0)})")
    ts.sort(key=lambda c: (c["ts"][0], _rank(c)))

    # Everything else is ordinary comment noise, and the filter earns its keep
    # there: it is the difference between "bhai iske baad wala part" and
    # "first", which no keyword list separates across three languages. The
    # most-liked handful skip it entirely -- see ALWAYS_KEEP_TOP_LIKED.
    by_rank = sorted(gen_raw, key=_rank)
    spared, pstats = drop_promo(by_rank[:ALWAYS_KEEP_TOP_LIKED], or_key, log=log)
    judged = [c for c in by_rank[ALWAYS_KEEP_TOP_LIKED:] if not c.get("weak")]
    good, tstats = triage(judged, or_key, log=log)
    gen = sorted(spared + good, key=_rank)
    log(f"  general: {len(spared)} top-ranked kept outright, "
        f"{len(good)}/{len(judged)} of the rest passed the filter "
        f"(${tstats.get('cost_usd')})")

    th, hstats = themes(gen, or_key, log=log)
    if th.get("themes"):
        log(f"  {len(th['themes'])} themes over {len(gen)} comments "
            f"(${hstats.get('cost_usd', 0)})")

    cost = round(sum(float(x.get("cost_usd") or 0)
                     for x in (tstats, hstats, sstats, pstats)), 5)
    return {"ok": True, "timestamped": ts, "general": gen[:KEEP_GENERAL],
            "themes": th,
            "stats": {"raw": len(raw), "pages": pages,
                      "duplicates_folded": st["dupe"], "promo_dropped": st["promo"],
                      "chapter_indexes": st["index"], "empty": st["empty"],
                      "timestamped": len(ts),
                      "summarised": sum(1 for c in ts if c.get("summary")),
                      "general_seen": len(gen_raw), "general_kept": len(gen),
                      "top_liked_spared": len(spared),
                      "llm": {"triage": tstats, "themes": hstats,
                              "promo": pstats, "summarise": sstats,
                              "cost_usd": cost}}}
