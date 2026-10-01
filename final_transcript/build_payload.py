# -*- coding: utf-8 -*-
"""
BUILD PAYLOAD -- final LLM-ready script from the transcript alone.

    python build_payload.py --transcript out/CLIP_final.json

Breaks the words into lines and writes a movie-script style payload. No audio
file is downloaded or analysed -- v1 runs on the transcript, YouTube's own
caption-embedded sound tags ([Applause], [Music]), comments, and the replay
heatmap only. The PANNs/SwiftF0/loudness stage that used to add reaction,
pitch and volume tags from the raw audio was moved to
_backup_pro_pipeline/audio_pipeline/ -- it can come back as an optional deep
pass later, but it is not worth its cost (a ClipsCutter download plus two GPU
jobs, capped at 5 concurrent slots) on every run by default.

Two rules the whole file is built on:

DESCRIBE, NEVER INTERPRET. The payload says (fast) and (slow). It never says
(angry) or (sarcastic). A model that guesses emotion is wrong often enough to
poison the clip choice, and the reader on the other end is far better at that
inference than any classifier here -- it has the words.

RELATIVE, NEVER ABSOLUTE. A pace tag is a percentile against this video's own
baseline, which handles the Hinglish problem that a Hindi word and an English
word are not the same unit of speed.

v1 runs no diarization, so that baseline is the whole video rather than one
speaker.
"""

import argparse
import json
import os
import re
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ---- line breaking --------------------------------------------------------
# Punctuation is not available. Tara emits none, and assuming it is there is
# how every naive chunker breaks on this material. Silence is the only honest
# sentence boundary: people pause where thoughts end.
HARD_GAP_S = 0.65         # a pause this long ends a line
MAX_LINE_S = 8.0          # past this the per-line averages stop meaning anything
MAX_LINE_WORDS = 22
MIN_LINE_WORDS = 3        # shorter than this gets merged back, to stop a flood
MIN_LINE_S = 0.9
# Only split a long run at a real breath.
#
# TRIED AND REVERTED: raising this to 0.28s, on the theory that 0.12s is a
# micro-hesitation rather than a sentence boundary. Measured on 4Vz6L8B73i4 it
# made the payload WORSE -- lines starting mid-phrase went from 55.0% to 60.6%.
# The reason is the fallback below: a run longer than ABS_MAX_LINE_S must be
# split, so when no gap clears the bar, `best = n // 2 - 1` splits on a word
# count instead, which is mid-phrase by construction. A higher bar produces more
# of those, not fewer.
#
# So mid-phrase line starts on breathless ASR runs are not fixable here. They are
# handled in the prompts instead, which tell the reader that punctuation is
# invented and a thought can run across lines.
SPLIT_MIN_GAP_S = 0.12
ABS_MAX_LINE_S = 16.0     # a hard ceiling even with no breath to split on
ABS_MAX_LINE_WORDS = 40

PAUSE_MIN_S = 1.20
LONG_GAP_S = 4.00
PAUSE_MAX_S = 30.0

# ---- signal tagging -------------------------------------------------------
# Percentiles of the speaker's own lines. Speed is the only signal left that
# needs no audio file -- it comes straight out of word timestamps.
FAST_P, SLOW_P = 88, 12
MIN_WPM_DELTA = 0.15          # 15% off the speaker's median pace
MIN_LINES_FOR_BASELINE = 8    # below this, percentiles are noise; tag nothing
MIN_WORDS_FOR_WPM = 4         # speed of a 2-word line is meaningless
MAX_TAGS_PER_LINE = 1

# Placing audience signals on a line: exact placement where the timestamp lands.
# If a timestamp lands in a small pause between lines, it snaps to the nearest line.
CMT_MAX_GAP_S = 1.5       # only snap across a tiny pause between adjacent lines
HEAT_MAX_DIST_S = 30.0    # heatmap buckets are ~1% of the video, so coarse

# A comment names at most this many moments before comments.py calls it a
# chapter index; each one it does name gets the comment placed there.
MAX_TS_PER_COMMENT = 3

# Comments shown under one line, and the count that stands in for the rest.
# On a hot moment sixteen people write the same thing; four of their texts say
# everything the reader needs and the number says the rest.
SHOW_PER_LINE = 4
MOMENT_INDEX_MIN = 2      # a moment reaches the index at this many comments
MOMENT_INDEX_MAX = 10

# No diarization in v1, so every line belongs to the same nominal
# speaker and every baseline is computed over the whole video.
ONE_SPEAKER = lambda _line: "SPK1"


def log(m, tag="INFO"):
    print(f"[{tag:<5}] {m}", flush=True)


def ov(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def effective_ends(words):
    """One de-smeared view of where each word really stops.

    Some ASR sources stretch their last emitted word across audio it never
    transcribed. Clamping any word whose duration is far outside this
    transcript's own norm keeps one bad timestamp from corrupting line
    breaking and pause detection downstream."""
    ds = sorted(w["end"] - w["start"] for w in words)
    n = len(ds)
    if n >= 20:
        med = ds[n // 2]
        p95 = ds[min(n - 1, int(n * 0.95))]
        thr = min(2.50, max(1.00, 1.6 * p95))
        keep = max(0.20, med)
    else:
        thr, keep = 2.50, 0.30
    return [w["end"] if (w["end"] - w["start"]) <= thr
            else round(w["start"] + keep, 3) for w in words]


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p / 100.0
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


# How far apart YouTube's own caption tag and another mention of the same
# sound can sit and still count as one event.
ASR_TAG_MATCH_S = 3.0

_TAG_ALIAS = {"applause": "applause", "clapping": "applause",
              "laughter": "laughter", "laughs": "laughter", "laugh": "laughter",
              "cheering": "cheering", "cheers": "cheering",
              "music": "music", "singing": "music",
              "संगीत": "music", "तालियाँ": "applause", "तालियां": "applause",
              "हंसी": "laughter", "हँसी": "laughter"}


def asr_tags_to_events(tags):
    """YouTube's own caption-embedded sound tags ([Applause], [Music]), turned
    into the same event shape a detector would have produced. These come from
    the captions themselves, not from listening to the audio, so they carry
    no duration -- just a position, which is still enough to force a line
    break and veto a false [pause] there."""
    out = []
    for t in tags:
        name = _TAG_ALIAS.get(t["tag"], t["tag"])
        out.append({"start": t["start"], "end": t["end"], "tags": [name],
                    "seconds": None, "source": "youtube"})
    out.sort(key=lambda e: e["start"])
    return out


# ============================================================ LINE BREAKING

def split_runs(words, speakers, events):
    """Cut the word stream where a line must not continue.

    Two hard boundaries:
      speaker change   two people never share a line
      a real pause     HARD_GAP_S of silence is where a thought ended
    A YouTube sound tag ([Applause], [Music]) also forces a break, so it
    never gets folded into the middle of a spoken line.
    """
    bounds = set()
    for i in range(len(words) - 1):
        if speakers and speakers[i] != speakers[i + 1]:
            bounds.add(i)
        elif (words[i + 1]["start"] - words[i]["eff"]) >= HARD_GAP_S:
            bounds.add(i)
    for e in events:
        for i in range(len(words) - 1):
            if words[i]["eff"] <= e["start"] and e["end"] <= words[i + 1]["start"] + 0.5:
                bounds.add(i)
                break
    runs, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        if i in bounds:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    return runs


def split_long(run):
    """Break an over-long run at its biggest internal breath.

    A 30-second line is useless twice over: nobody can cut video on it, and
    averaging speed across it flattens every spike that made the moment
    worth finding. Recursive, always at the largest gap nearest the middle,
    so the halves stay balanced instead of shaving one word off the end."""
    span, n = run[-1]["eff"] - run[0]["start"], len(run)
    if span <= MAX_LINE_S and n <= MAX_LINE_WORDS:
        return [run]
    best, best_score = None, -1.0
    mid = (run[0]["start"] + run[-1]["eff"]) / 2.0
    for i in range(len(run) - 1):
        gap = run[i + 1]["start"] - run[i]["eff"]
        if gap < SPLIT_MIN_GAP_S:
            continue
        centre = 1.0 - abs(run[i]["eff"] - mid) / max(run[-1]["eff"] - run[0]["start"], 1e-6)
        score = gap * (0.5 + centre)
        if score > best_score:
            best, best_score = i, score
    if best is None:
        # No breath anywhere in it. Somebody is talking flat out, and cutting
        # mid-phrase on a word count produces lines starting with "में" that
        # read as broken. A long line is the lesser harm, up to a hard ceiling.
        if span <= ABS_MAX_LINE_S and n <= ABS_MAX_LINE_WORDS:
            return [run]
        best = n // 2 - 1
    return split_long(run[:best + 1]) + split_long(run[best + 1:])


def merge_short(lines, speakers_of):
    """Fold a stray one- or two-word line back into its neighbour.

    Without this, every 'हाँ' and 'okay' becomes its own numbered line and the
    payload reads like a stutter. Only merges into the previous line, and only
    when the speaker matches, so a real one-word answer from someone else keeps
    its own line."""
    out = []
    for l in lines:
        short = len(l) < MIN_LINE_WORDS and (l[-1]["eff"] - l[0]["start"]) < MIN_LINE_S
        if (out and short and speakers_of(out[-1]) == speakers_of(l)
                and (l[0]["start"] - out[-1][-1]["eff"]) < HARD_GAP_S):
            out[-1].extend(l)
        else:
            out.append(list(l))
    return out


# ============================================================ SIGNALS PER LINE

def line_metrics(line):
    span = max(line[-1]["eff"] - line[0]["start"], 1e-6)
    speak = sum(w["eff"] - w["start"] for w in line)
    wpm = 60.0 * len(line) / max(speak, 0.2) if len(line) >= MIN_WORDS_FOR_WPM else None
    return {"span": span, "wpm": wpm}


def build_tags(lines, metrics, speakers_of):
    """Turn word-per-minute into (fast)/(slow), per speaker, only where a
    line is a real distance from that speaker's own median pace.

    A speaker with fewer than MIN_LINES_FOR_BASELINE lines gets no tags at
    all -- percentiles over five samples are noise, and a confident wrong tag
    is worse than a missing one."""
    by_spk = {}
    for l, m in zip(lines, metrics):
        by_spk.setdefault(speakers_of(l), []).append(m)

    base = {}
    for spk, ms in by_spk.items():
        wp = [m["wpm"] for m in ms if m["wpm"] is not None]
        enough = len(ms) >= MIN_LINES_FOR_BASELINE and len(wp) >= MIN_LINES_FOR_BASELINE
        base[spk] = {
            "wpm_hi": pct(wp, FAST_P) if enough else None,
            "wpm_lo": pct(wp, SLOW_P) if enough else None,
            "wpm_mid": pct(wp, 50), "lines": len(ms),
        }

    out = []
    for l, m in zip(lines, metrics):
        b = base[speakers_of(l)]
        tags = []
        if m["wpm"] is not None and b["wpm_hi"] is not None and b["wpm_mid"]:
            r = m["wpm"] / b["wpm_mid"]
            if m["wpm"] >= b["wpm_hi"] and r >= 1 + MIN_WPM_DELTA:
                tags.append("(fast)")
            elif m["wpm"] <= b["wpm_lo"] and r <= 1 - MIN_WPM_DELTA:
                tags.append("(slow)")
        out.append(tags[:MAX_TAGS_PER_LINE])
    return out, base


# ============================================================ ASSEMBLY

def pause_rows(lines, events):
    """Silence between lines, where no YouTube sound tag explains it."""
    out = []
    for i in range(len(lines) - 1):
        a, b = lines[i][-1]["eff"], lines[i + 1][0]["start"]
        d = b - a
        if d < PAUSE_MIN_S or d > PAUSE_MAX_S:
            continue
        if any(ov(a, b, e["start"], e["end"]) > 0.15 for e in events):
            continue
        out.append({"after": i, "start": a, "end": b, "seconds": round(d, 1),
                    "text": f"[{'long gap' if d >= LONG_GAP_S else 'pause'} {round(d,1)}s]"})
    return out


def _load(p):
    if not p or not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcript", required=True)
    ap.add_argument("--outdir", default=None)
    ap.add_argument("--comments-json", default=None)
    ap.add_argument("--heatmap-json", default=None)
    ap.add_argument("--metadata-json", default=None)
    ap.add_argument("--clip-start", type=float, default=0.0,
                    help="offset of this clip inside the source video, so "
                         "comment and heatmap times land on the right line")
    args = ap.parse_args()

    tpath = os.path.abspath(args.transcript)
    if not os.path.exists(tpath):
        log(f"not found: {tpath}", "FATAL")
        sys.exit(2)
    with open(tpath, encoding="utf-8") as f:
        doc = json.load(f)
    words = []
    asr_tags = []
    for w in doc.get("words") or []:
        # U+FFFD leaks through from upstream decoding and is pure noise to a
        # reader; drop the character, keep the word if anything survives.
        t = (w.get("word") or "").replace("�", "").strip()
        if not t:
            continue
        if w.get("kind") == "tag":
            # YouTube heard this itself, from its own captions. Not a spoken
            # word -- it must not reach the line breaker's word counts or the
            # speed tags -- but its position is real and worth keeping.
            asr_tags.append({"tag": w.get("tag") or t.strip("[]() ").lower(),
                             "start": float(w["start"]), "end": float(w["end"])})
            continue
        words.append({"word": t, "start": float(w["start"]),
                      "end": float(w["end"]), "source": w.get("source", "asr")})
    words.sort(key=lambda w: (w["start"], w["end"]))
    asr_tags.sort(key=lambda t: t["start"])
    if not words:
        log("transcript has no words", "FATAL")
        sys.exit(2)
    eff = effective_ends(words)
    for w, e in zip(words, eff):
        w["eff"] = e
    dur = float((doc.get("meta") or {}).get("length_s") or 0) or words[-1]["end"]
    base = re.sub(r"(_final)?\.json$", "", os.path.basename(tpath))
    outdir = os.path.abspath(args.outdir or os.path.dirname(tpath))
    log(f"{len(words)} words, {dur:.1f}s")

    events = asr_tags_to_events(asr_tags)
    if asr_tags:
        log(f"{len(asr_tags)} YouTube sound tags carried through as events")

    # v1 runs no diarization. Whoever is talking, the words are the evidence
    # and the finders are told never to let a speaker label decide anything --
    # every path below already handles the single-speaker case.
    runs = split_runs(words, None, events)
    lines = []
    for r in runs:
        lines.extend(split_long(r))
    lines = merge_short(lines, ONE_SPEAKER)
    metrics = [line_metrics(l) for l in lines]
    tags, baselines = build_tags(lines, metrics, ONE_SPEAKER)
    pauses = pause_rows(lines, events)

    # interleave lines, sound tags and pauses on one timeline
    #
    # A tag that starts BETWEEN two lines gets its own row -- that is already
    # unambiguous. One that starts WHILE someone is still talking is woven
    # into the line at the word it interrupts, because a row of its own would
    # sit after the whole line and imply it came later than it did.
    rows, ev_i = [], 0
    evs = sorted(events, key=lambda e: e["start"])

    def ev_text(e):
        """[applause (youtube)]  YouTube's own captions said so; no duration"""
        name = " + ".join(e["tags"])
        return f"[{name} (youtube)]"

    def weave(words, inside):
        """Line text with each sound tag printed where it actually began.

        A tag goes immediately BEFORE the first word that starts at or after
        it, which puts it in the real gap between two words rather than a
        word late. Anything starting after the last word trails the line."""
        out, k = [], 0
        for w in words:
            while k < len(inside) and inside[k]["start"] <= w["start"]:
                out.append(ev_text(inside[k]))
                k += 1
            out.append(w["word"])
        out.extend(ev_text(e) for e in inside[k:])
        return " ".join(out)

    for i, l in enumerate(lines):
        lo, hi = l[0]["start"], l[-1]["eff"]
        while ev_i < len(evs) and evs[ev_i]["start"] < lo:
            e = evs[ev_i]
            rows.append({"kind": "event", "start": e["start"], "end": e["end"],
                         "text": ev_text(e)})
            ev_i += 1
        inside = []
        while ev_i < len(evs) and evs[ev_i]["start"] < hi:
            inside.append(evs[ev_i])
            ev_i += 1
        rows.append({"kind": "line", "start": lo, "end": hi, "tags": tags[i],
                     "text": weave(l, inside),
                     "reactions": [ev_text(e) for e in inside]})
        for p in pauses:
            if p["after"] == i:
                rows.append({"kind": "event", "start": p["start"],
                             "end": p["end"], "text": p["text"]})
    while ev_i < len(evs):
        e = evs[ev_i]
        rows.append({"kind": "event", "start": e["start"], "end": e["end"],
                     "text": ev_text(e)})
        ev_i += 1

    for n, r in enumerate(rows, 1):
        r["id"] = f"L{n:04d}"

    # How long each spoken line actually takes to say, printed beside it.
    #
    # This replaced a single SCALE figure ("one line here is about 8s") that was
    # honest on average and wrong everywhere it mattered. Line length here is
    # bimodal, not clustered: a pause-delimited punch line runs 1.5s while an
    # uninterrupted run capped by MAX_LINE_S runs 8-16s, so the median sat at the
    # cap and described almost no real line. Measured on 4Vz6L8B73i4 the header
    # claimed 8s/line against 4.3-6.8s/line in the four stretches that actually
    # produced clips, and the finder's reasoning shows it multiplying line counts
    # by the wrong constant and rejecting real moments as "too long" -- including
    # one that independent accounts published as four separate reels.
    #
    # An absolute time is still never printed. A duration cannot be turned into a
    # cut point, so the reason clock times were kept out of this document
    # survives intact: the model can measure a passage but cannot invent a
    # timestamp.
    for r in rows:
        if r["kind"] == "line":
            r["seconds"] = round(max(0.0, r["end"] - r["start"]), 1)

    def row_line(r):
        marks = "".join(f"[{m.upper()}] " for m in (r.get("marks") or []))
        pre = (" ".join(r.get("tags") or []) + " ") if r.get("tags") else ""
        # Event rows leave the duration column blank: they are not speech, and
        # their own seconds are already inside their text ("[pause 2.0s]").
        col = f"{r['seconds']:>5.1f}s" if r["kind"] == "line" else " " * 6
        return f"{r['id']}  {col}  {marks}{pre}{r['text']}"

    meta_in = _load(args.metadata_json) or {}

    # ---- audience signals -------------------------------------------------
    # Both are anchored to a LINE, never left as a number for the reader to
    # match up. Doing the lookup here is free and exact; asking the model to
    # do it costs reasoning tokens and invites it to invent a match.
    cmts = _load(args.comments_json) or {}
    heat = _load(args.heatmap_json) or {}
    off = args.clip_start
    line_rows = [r for r in rows if r["kind"] == "line"]

    def row_at(t, max_gap=CMT_MAX_GAP_S):
        """The exact line where a timestamp lands.
        If t falls directly inside a line, return that exact line.
        If t falls in a small pause between lines, attach to the nearest adjacent line."""
        if not (0.0 <= t <= dur + 1.0):
            return None
        # 1. Exact match: timestamp falls inside line boundaries
        for r in line_rows:
            if r["start"] <= t <= r["end"]:
                return r
        # 2. Falls in a small pause between adjacent lines
        best, bd = None, 1e18
        for r in line_rows:
            d = min(abs(t - r["start"]), abs(t - r["end"]))
            if d < bd:
                best, bd = r, d
        return best if bd <= max_gap else None

    n_ts, n_out, n_multi = 0, 0, 0
    # A comment carries up to MAX_TS_PER_COMMENT timestamps and is placed at
    # every one of them -- "3:45 and 12:20 were insane" is testimony about two
    # moments, and keeping only the first threw one of them away. Anything
    # naming more than three was dropped upstream as a chapter index.
    for c in (cmts.get("timestamped") or []):
        placed = 0
        for t in (c.get("ts") or [])[:MAX_TS_PER_COMMENT]:
            r = row_at(t - off)
            if r is None:
                continue
            r.setdefault("comments", []).append(
                {"text": c["text"], "likes": c.get("likes", 0),
                 "dupes": c.get("dupes", 0), "summary": c.get("summary"),
                 "of": len(c.get("ts") or [])})
            placed += 1
        if not placed:
            n_out += 1
            continue
        n_ts += 1
        n_multi += placed > 1

    # Weight of a moment is PEOPLE, not comment rows: a comment forty others
    # posted word for word is forty viewers pointing at the same second, and
    # comments.py folded them into one record carrying the count.
    def weight(r):
        return sum(1 + c.get("dupes", 0) for c in (r.get("comments") or []))

    for r in line_rows:
        if r.get("comments"):
            r["comments"].sort(key=lambda c: -(c["likes"] + c.get("dupes", 0)))
    hot = sorted((r for r in line_rows if weight(r) >= MOMENT_INDEX_MIN),
                 key=lambda r: -weight(r))[:MOMENT_INDEX_MAX]

    n_hp = 0
    for pk in (heat.get("peaks") or []):
        mid = (pk["start"] + pk["end"]) / 2.0
        r = row_at(mid, max_gap=HEAT_MAX_DIST_S)
        if r is not None and "replayed" not in (r.get("marks") or []):
            r.setdefault("marks", []).append("replayed")
            n_hp += 1

    os.makedirs(outdir, exist_ok=True)
    tp = os.path.join(outdir, f"{base}_payload.txt")
    with open(tp, "w", encoding="utf-8") as f:
        f.write(f"DURATION {int(dur)}s\n")
        # No clock times anywhere below. Every line carries an ID and the exact
        # seconds live beside it in the JSON, so the reader never does time
        # arithmetic, never mis-copies a number, and cannot invent a cut point.
        f.write(
            "\nHOW TO READ\n"
            "  L0001 = line id. Refer to clips by id, never by time.\n"
            "  The number after the id = how many seconds that line takes to "
            "say. A passage's length is the sum of the numbers on its lines, "
            "plus any [pause] printed between them. This is the only thing in "
            "the document that measures length, and it is exact -- never "
            "estimate a duration any other way.\n"
            "  A row with a BLANK number column is not speech. It carries an id "
            "but no words, so a clip can never begin or end on one.\n"
            "  (fast)(slow) = measured pace, against this video's own normal.\n"
            "  [pause 2.1s] = measured silence.\n"
            "  [applause (youtube)] = YouTube's own captions marked a sound "
            "here; no duration given.\n"
            "  [COMMENT] = a viewer comment about THIS exact moment, on its "
            "own indented line. Rare and strong.\n"
            "  [COMMENT summary] = the same, but the comment was too long to "
            "quote, so this is a machine summary of it, not the viewer's own "
            "words. Weigh it as testimony, never quote it.\n"
            "  +N more viewers marked this moment = N other people commented "
            "on this same line. The number is the signal.\n"
            "  >> inside a line = YouTube's caption marker for the OTHER "
            "PERSON STARTING TO TALK. A speaker change, not a comment, not a "
            "word. Never copy it into start_words or end_words.\n"
            "  [REPLAYED] = YouTube's replay data peaks somewhere near this "
            "line. It marks a neighbourhood, not a word.\n"
            "  THE WORDS ARE THE TRUTH. If any tag contradicts them, ignore "
            "the tag.\n")

        if hot:
            f.write("\n\nMOST-MARKED MOMENTS (line ids where viewer comments "
                    "landed, busiest first)\n")
            for r in hot:
                f.write(f"  {r['id']}  {weight(r)} viewer comments\n")

        th = (cmts.get("themes") or {})
        gen = (cmts.get("general") or [])
        if th or gen:
            f.write("\n\nAUDIENCE (about the video overall, no fixed moment)\n")
            if th.get("mood"):
                f.write(f"  mood: {th['mood']}\n")
            for t in (th.get("themes") or [])[:8]:
                f.write(f"  - {t.get('what')} -- {t.get('n')} comments, "
                        f'e.g. "{str(t.get("quote"))[:160]}"\n')
            if gen:
                f.write("\n  loudest comments, verbatim:\n")
            for c in gen[:30]:
                dup = f", {c['dupes'] + 1} people wrote this" if c.get("dupes") else ""
                f.write(f'  "{c["text"][:220]}" ({c["likes"]} likes{dup})\n')

        f.write("\n\nTRANSCRIPT\n")
        for r in rows:
            f.write(row_line(r) + "\n")
            cs = r.get("comments") or []
            for c in cs[:SHOW_PER_LINE]:
                # NOT ">>": the transcript's own text uses ">>" as YouTube's
                # speaker-change marker on 477 of 1316 lines here, so sharing
                # the prefix left the model unable to tell a viewer comment
                # from a new speaker -- it re-derived the question in every
                # call and never settled it.
                #
                # The text arrives with its whitespace already collapsed. It
                # has to: a comment containing a line break used to split the
                # payload right here and leave its tail sitting in the
                # transcript as though somebody had said it out loud.
                extra = "".join(
                    ([f", {c['dupes'] + 1} people wrote this"] if c.get("dupes") else [])
                    + ([f", also marks {c['of'] - 1} other moment"
                        + ("s" if c["of"] > 2 else "")] if c.get("of", 1) > 1 else []))
                if c.get("summary"):
                    f.write(f'       [COMMENT summary] {c["summary"][:220]} '
                            f'({c["likes"]} likes{extra})\n')
                else:
                    f.write(f'       [COMMENT] "{c["text"][:200]}" '
                            f'({c["likes"]} likes{extra})\n')
            rest = sum(1 + c.get("dupes", 0) for c in cs[SHOW_PER_LINE:]) \
                + sum(c.get("dupes", 0) for c in cs[:SHOW_PER_LINE])
            if rest:
                f.write(f'       [COMMENT] +{rest} more viewers marked this '
                        f'moment\n')

    jp = os.path.join(outdir, f"{base}_payload.json")
    with open(jp, "w", encoding="utf-8") as f:
        json.dump({"meta": {"duration_s": round(dur, 2),
                            "transcript": tpath, "clip_start_s": off,
                            "video": meta_in,
                            "comments_placed": n_ts, "replay_peaks": n_hp,
                            "comment_stats": cmts.get("stats")},
                   "audience": {"themes": cmts.get("themes"),
                                "general": cmts.get("general")},
                   "baselines": baselines,
                   "rows": rows}, f, ensure_ascii=False, indent=2)

    n_tagged = sum(1 for r in rows if r.get("tags"))
    log(f"{len(lines)} lines, {len(evs)} sound tags, {len(pauses)} pauses, "
        f"{n_tagged} tagged, {n_ts} moment-comments ({n_multi} placed at "
        f"more than one moment, {n_out} outside this clip, dropped), "
        f"{len(hot)} hot moments, {n_hp} replay peaks", "OK")
    print(f" {tp}\n {jp}")


if __name__ == "__main__":
    main()
