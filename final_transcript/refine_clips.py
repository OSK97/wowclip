# -*- coding: utf-8 -*-
"""STEP 2 -- decide which moments ship, then cut each one properly.

    python refine_clips.py --step1 out/CLIP_step1.json
    python refine_clips.py --step1 out/CLIP_step1.json --no-select

Step 1 read the whole video with five different mindsets and marked roughly
where the good moments are. This step runs in two passes, because its two
decisions want opposite things from the model.

PASS A -- SELECT (one call, every candidate side by side).
Five finders read the same video, so the same moment often arrives nominated
two or three times with different boundaries and different reasons. Only a
stage that sees the whole list at once can notice that C3 and C11 are the same
thing, so merging and dropping happen here and nowhere else. It never touches
a boundary. prompts/refine_select.md

PASS B -- CUT (one call per surviving moment, in parallel).
Where a clip starts and stops is the most consequential decision in the
pipeline and the one that most rewards undivided attention, so each moment
gets its own call, its own window of context, and a prompt that talks about
nothing else. Batching this was cheaper and asked one model to hold thirty
separate boundary problems at once.  prompts/refine_cut.md

Then, in code rather than in a model:

WORD-LEVEL BOUNDARIES. The model names the exact words the clip starts and
ends on, not a line. Those words are matched against the word-level transcript
here, which is where the real timestamp comes from -- lines are arbitrary
machine cuts and starting on one is usually a second or two off. The model
never returns a time; a phrase either matches the audio's own words or the
clip falls back to the line boundary and says so.

DANGLING ENDS. If the last word cannot end a sentence ("aur", "and", "the"),
the end walks forward in the word list until it can. This replaced a whole
third LLM stage that measured worse than doing nothing.

EVIDENCE. The reason shown to the user is assembled from the payload rows, not
written by a model: a comment exists or it does not, viewers rewound or they
did not. Nothing here can invent a signal that was not measured.
"""

import argparse
import concurrent.futures
import difflib
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS = os.path.join(HERE, "prompts")

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

MODEL = "z-ai/glm-5.3-flash"
MAX_TOKENS = 64000

# Reasoning effort, per pass, because the two passes are not the same kind of
# problem and were both being run at "max".
#
# Measured on one 3-hour video: the cut stage was 49% of the whole bill -- 15
# calls, 5.80 rupees -- and 98,502 of its 102,942 output tokens were reasoning.
# 96% of what was paid for was deliberation over a decision whose output is
# eight words. Select was 79% reasoning for a merge decision.
#
# These are defaults, not limits; both are overridable per run.
SELECT_EFFORT = "medium"
CUT_EFFORT = "medium"
# Each call here sees one short window, so a slow answer means a stalled
# connection rather than hard thinking -- measured, these return in well under
# two minutes. Step 1 reads a whole transcript and legitimately needs longer.
TIMEOUT_S = 90
RETRIES = 3
TEMPERATURE = 0.3

# Context handed to the cut model, and deliberately LOPSIDED.
#
# Every boundary error measured on real runs is at the start, not the end, and
# the expensive one is always the same: the clip is an answer and the question
# that provoked it is not in the reel. Two of four clips on 4Vz6L8B73i4 opened
# without their question, and one of them ("I love the word you used,
# powerless") opened on a reference to a word the viewer never heard. The
# independently published versions of both moments open on the host's question.
#
# So there is more room before than after. It also costs less than it looks:
# the model is told plainly that the window is room and not an assignment, and
# the tail is where drift happens, so trimming the tail removes temptation
# rather than options.
PAD_BEFORE_S = 45.0
PAD_AFTER_S = 20.0
PAD_S = PAD_BEFORE_S      # kept as the old single-value name for callers
# Two candidates are the SAME moment only when they are near-identical. Anything
# less is two products: measured against twenty reels published from one
# interview, a 61s stretch became four separate reels at 1.5-1.8M plays each,
# all overlapping. See cluster().
# Two candidates are the same moment when they overlap by more than this AND are
# within SAME_MOMENT_SLACK_S of each other in length. Both conditions, not
# either: a 15s punchline sitting inside a 50s build overlaps it heavily and is a
# different reel, and the length test is what tells them apart.
#
# Raised from 0.75 when the LLM select pass was removed, so this is now the only
# place two candidates are ever treated as one. 0.75 was merging genuinely
# different readings of one stretch; at 0.85 with the length test, only near
# twins merge and everything else is cut separately and judged after.
SAME_MOMENT_IOU = 0.85
SAME_MOMENT_SLACK_S = 20.0
MAX_CLUSTER_S = 320.0     # the general finder may legitimately return 300s
MIN_CLIP_S = 4.0
# Not a limit, only the point where the report says something. Past three
# minutes a clip stops being a Short at all and Instagram stops showing it in
# the Reels tab to non-followers -- worth flagging, never worth dropping.
MAX_CLIP_S = 180.0
DUP_IOU = 0.85            # final pass -- only drop near-exact duplicates

# Word matching. The model copies a phrase out of the transcript; these decide
# how hard we look for it before giving up and using the line boundary.
NEAR_LINES = 6            # search this far around the line it named, first
STRONG = 0.80             # good enough to stop looking
OK = 0.55                 # good enough when the wide search is all we have

# ASR word boundaries sit tight against the phoneme. Cutting exactly on them
# clips the first consonant and swallows the last syllable, which is audible.
# Take a little of the surrounding silence -- never more than half the gap, so
# the clip cannot eat into the neighbouring word.
LEAD_S, TAIL_S = 0.12, 0.25
END_PAUSE_MAX_S = 2.0


def log(m, tag="INFO"):
    print(f"[{time.strftime('%H:%M:%S')}] [{tag:<5}] {m}", flush=True)


def mmss(x):
    return f"{int(x) // 60}:{int(x) % 60:02d}"


def _sections(path):
    with open(path, encoding="utf-8") as f:
        parts = re.split(r"<<<SECTION:([A-Z_0-9]+)>>>", f.read())
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts), 2)}


def prompt_text(path=None):
    p = path or os.path.join(PROMPTS, "refine_cut.md")
    sec = _sections(p)
    if "PROMPT" not in sec:
        raise SystemExit(f"{p}: missing <<<SECTION:PROMPT>>>")
    return sec["PROMPT"]


def cut_prompt_for(category, path=None):
    """The cut prompt for ONE category: the shared body plus that category's
    own boundary rules, and nobody else's.

    Every cut call used to read all six category paragraphs and be told which
    one applied. Two costs to that. The obvious one is noise -- five sixths of
    the most important instruction block in the system is about a job this call
    is not doing. The subtler one is that a single shared block has to be
    written to be true of every category at once, which is how the motivational
    paragraph ended up saying a later start is tolerable "because the setup is
    often generic and the claim is self-explaining". That is false for this
    material and it cost two of four clips their opening question on a measured
    run, while the independently published versions of both moments open on
    exactly that question.

    One file still, so the shared body cannot drift; one category block sent."""
    p = path or os.path.join(PROMPTS, "refine_cut.md")
    sec = _sections(p)
    if "PROMPT" not in sec:
        raise SystemExit(f"{p}: missing <<<SECTION:PROMPT>>>")
    cat = str(category or "").strip().lower()
    block = sec.get(f"CAT_{cat.upper()}")
    if not block:
        # An unknown or missing label must never mean "no boundary guidance".
        block = sec.get("CAT_ANY") or ""
    return sec["PROMPT"] + (f"\n\n\n{block}" if block else "")


def call(messages, key, model, effort, max_tokens=MAX_TOKENS, url=None):
    """One answer, or an exception saying why there isn't one.

    A reasoning model spends the same budget on thinking and on answering, so
    when it thinks too long the reply arrives with an empty content field and a
    full reasoning block -- measured once at 11 minutes and no output. Retrying
    identically just burns it again. An empty answer can try a larger budget;
    transport retries keep the same settings. Permanent HTTP failures stop.
    High effort may fall back to medium; medium never silently drops to low.

    OpenRouter's `reasoning`/`include_reasoning` fields are its own extension,
    not something DeepSeek's own API understands -- they are only sent when
    talking to OpenRouter."""
    via_openrouter = (url or llm.URL) == llm.URL
    plans = [(effort, max_tokens), (effort, max_tokens * 2)]
    if effort == "high":
        plans.append(("medium", max_tokens * 2))
    last = None
    for eff, mx in plans:
        body = {"model": model, "messages": messages, "temperature": TEMPERATURE,
                "max_tokens": mx, "response_format": {"type": "json_object"}}
        if via_openrouter:
            body["reasoning"] = {"effort": eff, "exclude": False}
            body["provider"] = llm.provider_block(model)
        else:
            body["reasoning_effort"] = eff
        for a in range(1, RETRIES + 1):
            try:
                content, reasoning, usage = llm.post_stream(
                    body, key, url=url, timeout=TIMEOUT_S)
            except Exception as ex:
                last = ex
                status = getattr(ex, "code", None)
                if status is not None and 400 <= status < 500 and status not in (408, 429):
                    raise
                if a < RETRIES:
                    time.sleep(3 * a)
                continue
            if content.strip():
                if url == DEEPSEEK_URL:
                    llm.calculate_deepseek_cost(usage, model)
                return content, reasoning, usage
            last = RuntimeError(
                f"empty answer (effort={eff}, max_tokens={mx}) -- the budget "
                f"went to reasoning ({usage.get('reasoning_tokens', 0)} "
                f"thinking tokens, no content)")
            break                      # only a bigger budget can help
        else:
            raise RuntimeError(str(last)) from last
    raise RuntimeError(str(last))


# ---- word-level matching --------------------------------------------------

# Preserve Devanagari letters/marks, but not danda punctuation (।, ॥).
# Keeping danda made "आए" fail to match the timed word "आए।", so a cut
# fell back to the end of its caption line and swallowed the next sher.
_STRIP = re.compile(r"[^\wऀ-ॣ०-ॿ]+", re.U)


_MARKER = re.compile(r"\[[^\]]*\]")


def toks(s):
    """Words only.

    Reactions are printed inside a line now ("...kahunga [laughter 0.6s] yeh
    baat"), so a model copying its start_words out of the transcript can drag
    a marker along with them. The marker is not in the audio's word list and
    would only ever spoil the match, so it is stripped before comparing."""
    s = _MARKER.sub(" ", s or "")
    return [t for t in (_STRIP.sub("", w).lower() for w in s.split()) if t]


def _score(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def _best_in(words, want, lo, hi, prefer=None):
    """Best (i, j, score) window of `words[lo:hi]` matching token list `want`.

    `prefer` is the word index the phrase is expected near -- the middle of the
    line the model actually named. It breaks ties by distance, which matters more
    than it sounds: this used to keep the FIRST maximum and return early on the
    first exact match, so a short common phrase ("you know", "and that's it",
    "aur phir") matched an earlier identical occurrence inside the search window,
    scored 1.00, raised no flag because a perfect score needs no explanation, and
    ended the clip before its payoff. On a 6-word line the window is about a
    minute of speech, so there is plenty of room for a repeat.

    Widths run to n+4 rather than n+2 because ASR inserts words. difflib's ratio
    is 2*matches/(len_a+len_b), so a 3-token phrase with 3 inserted tokens caps
    at 0.67 and falls under STRONG through no fault of the model's."""
    n = len(want)
    if n == 0 or lo >= hi:
        return None
    widths = sorted({max(1, n - 2), max(1, n - 1), n, n + 1, n + 2,
                     n + 3, n + 4})
    best, best_key = None, None
    for i in range(lo, hi):
        for w in widths:
            j = min(i + w, hi)
            if j <= i:
                continue
            sc = _score([x["t"] for x in words[i:j]], want)
            # Distance only separates matches of equal quality; rounding the
            # score keeps "equal" from meaning "equal to fifteen decimals".
            key = (round(sc, 4), -abs(i - prefer) if prefer is not None else 0)
            if best_key is None or key > best_key:
                best, best_key = (i, j, sc), key
    return best


def locate(words, phrase, anchor_lo, anchor_hi, prefer=None, outer=None):
    """Find `phrase` in the word list.

    Looks near the line the model named first, because a phrase like "and then
    he said" occurs many times and the nearest one is the intended one. Only
    widens if nothing there matches, which is what happens when the model named
    the right words but the wrong line id.

    `outer` bounds the widened search to the window the model was actually
    shown. It cannot have copied words from outside it, so a match out there is
    a coincidence rather than a rescue -- and on a two-hour transcript scanning
    the whole thing for every phrase is slow enough to notice."""
    want = toks(phrase)
    if not want:
        return None, 0.0, "no words given"
    alo, ahi = max(0, anchor_lo), min(len(words), anchor_hi)
    mid = prefer if prefer is not None else (alo + ahi) // 2
    near = _best_in(words, want, alo, ahi, prefer=mid)
    if near and near[2] >= STRONG:
        return (near[0], near[1]), near[2], None
    olo, ohi = outer or (0, len(words))
    wide = _best_in(words, want, max(0, olo), min(len(words), ohi), prefer=mid)
    cand = max([x for x in (near, wide) if x], key=lambda x: x[2], default=None)
    if not cand:
        return None, 0.0, "not found"
    if cand[2] < OK:
        return None, cand[2], f"weak match {cand[2]:.2f}"
    note = None
    if wide and cand is wide and (not near or wide[2] > near[2] + 0.15):
        note = f"matched {cand[2]:.2f} outside the named line"
    return (cand[0], cand[1]), cand[2], note


def pad_start(words, i):
    t = words[i]["start"]
    prev_end = words[i - 1]["end"] if i > 0 else 0.0
    return max(prev_end, t - min(LEAD_S, max(0.0, t - prev_end) / 2.0), 0.0)


def pad_end(words, j):
    """j is exclusive, so the last word of the span is j-1."""
    t = words[j - 1]["end"]
    nxt = words[j]["start"] if j < len(words) else t + TAIL_S
    return min(nxt, t + min(TAIL_S, max(0.0, nxt - t) / 2.0))


def ending_pause_end(words, j, rows, window_end):
    """Preserve only an explicitly measured pause after the final spoken word.

    A model requests the pause, but never supplies a time. Sound-tag reactions,
    unknown silence after the transcript, and another sentence cannot extend it.
    """
    normal_end = pad_end(words, j)
    word_end = words[j - 1]["end"]
    next_start = words[j]["start"] if j < len(words) else None
    for row in rows:
        if (row.get("kind") != "event"
                or not re.fullmatch(r"\[(?:pause|long gap) [\d.]+s\]",
                                    row.get("text") or "")):
            continue
        # The pause must begin at this boundary, not after unselected speech.
        if row["start"] > word_end + 0.15 or row["end"] <= word_end:
            continue
        limit = min(row["end"], word_end + END_PAUSE_MAX_S, window_end)
        if next_start is not None:
            limit = min(limit, next_start)
        return max(normal_end, limit)
    return normal_end


# Words that cannot be the last word of a clip: they grammatically demand
# something after them, so ending there leaves the sentence hanging. English
# plus the Hindi/Hinglish equivalents this material is full of.
# Deliberately only words that CANNOT end a sentence. Ambiguous ones are left
# out on purpose: "her", "this", "that", "his" are possessive determiners but
# also perfectly good objects ("I loved her"), and extending off one of those
# damages a clip that was already correct. Under-fixing is invisible;
# over-fixing drags the next sentence's first word into the reel.
DANGLING = {
    "and", "or", "but", "the", "a", "an", "to", "of", "in", "for", "with",
    "from", "by", "as", "at", "into", "onto", "about", "because", "although",
    "while", "whether", "my", "your", "our",
    # Added after an audit: each of these demands something after it just as
    # plainly as "and" does, and leaving them out meant the repair silently
    # under-fired on endings that sound just as cut off.
    "than", "without", "between", "unless", "until", "during", "upon", "nor",
    "towards", "toward", "despite", "besides", "among", "across",
    "aur", "ya", "ki", "ke", "ka", "ko", "se", "mein", "ek",
    # Hinglish connectives that cannot end a thought. "toh" and "par" are
    # deliberately NOT here: both end sentences perfectly well in speech
    # ("theek hai toh", "mere par"), and over-firing drags the next sentence's
    # first word into the reel, which is the worse error.
    "kyunki", "lekin", "agar", "taki", "jabki", "balki",
    "और", "या", "की", "के", "का", "को", "से", "में",
    "क्योंकि", "लेकिन", "अगर", "ताकि",
    # The English words above, as YouTube spells them on a Hindi track. Without
    # these the whole check was blind on Hinglish: the speaker says "and" and the
    # transcript writes "एंड", which matched nothing in this set.
    "एंड", "बट", "ऑर", "बिकॉज़", "बिकॉज", "टू", "ऑफ", "इन", "फॉर", "विथ",
    "फ्रॉम", "ऐज", "ऐट", "इनटू", "अबाउट", "व्हाइल", "अनलेस", "अनटिल",
}

# A word carrying sentence-final punctuation ends a sentence whatever it is --
# `toks()` strips punctuation before matching, so without this check "her."
# reads as a hanging possessive and the clip gets extended past its own end.
_TERMINAL = (".", "?", "!", "।", "…")

EXTEND_LIMIT = 8          # give up rather than run into the next sentence
EXTEND_GAP_S = 1.2        # a pause this long is a sentence break, so stop


# Words that must not be the FIRST word of a clip: pure discourse connectives
# and verbal throat-clearing that carry no meaning at the head of a reel. A
# viewer hearing "And a lot of people are addicted to..." as the opening syllable
# of a reel is hearing the middle of a conversation.
#
# This is the start-side mirror of DANGLING, and it exists because the prompt
# rule kept being missed on Hinglish material: refine_cut.md listed the words in
# Latin script ("so", "but", "phir") while YouTube spells them phonetically in
# Devanagari, so "एंड" and "सो" matched nothing. Measured on one Hinglish video,
# four of ten clips opened on a word in this set.
#
# Deliberately narrow. Only words that are pure connective AT THE START and can
# never carry the meaning of an opening. Excluded on purpose: "now" (opens real
# sentences -- "now it's our generation's turn"), "पर" (also means "on"), "अब"
# (carries real time sense), and every content word. Dropping one of these is
# always safe; dropping a word that means something is not.
LEADING_FILLER = {
    "and", "but", "so", "or", "okay", "ok", "well", "yeah", "yes", "right",
    "anyway", "also", "because", "and-so",
    "aur", "lekin", "toh", "haan", "matlab", "yaani", "accha",
    # The same words as YouTube spells them on a Hindi track.
    "एंड", "बट", "सो", "ऑर", "ओके", "ओकय", "वेल", "ऑलसो", "बिकॉज़", "बिकॉज",
    "और", "लेकिन", "तो", "हां", "हाँ", "मतलब", "यानी", "अच्छा",
}
TRIM_START_LIMIT = 2      # never eat into the sentence itself


def trim_leading_filler(words, i, j_end):
    """Walk a clip's start forward off a leading connective.

    `i` is the first word index, `j_end` the exclusive end. Returns the new start
    and how many words were dropped. Stops after TRIM_START_LIMIT so a clip whose
    genuine opening happens to be conversational is not shaved down, and never
    trims a clip to fewer than four words."""
    k, moved = i, 0
    while (moved < TRIM_START_LIMIT and k < j_end - 4
           and words[k]["t"] in LEADING_FILLER):
        k += 1
        moved += 1
    return k, moved


def fix_dangling_end(words, j):
    """Walk a clip's end forward off a hanging word.

    The model names the last words it wants heard, and it mostly gets this
    right -- but when it does not, the clip ends on "aur" or "and" or "the"
    and the reel sounds cut off. Rather than spend another LLM call checking
    (that stage measured worse than doing nothing), walk forward in the word
    list until the last word is one that can actually end a sentence.

    Stops at a real pause, because a gap that long means the next word starts
    a new sentence and dragging it in is worse than the dangling word.

    `j` is exclusive. Returns the new exclusive end, and how many words it
    took."""
    k, moved = j, 0
    while (k < len(words) and moved < EXTEND_LIMIT
           and words[k - 1]["t"] in DANGLING
           and not words[k - 1]["word"].rstrip().endswith(_TERMINAL)):
        if words[k]["start"] - words[k - 1]["end"] > EXTEND_GAP_S:
            break
        k += 1
        moved += 1
    # Whether it is STILL hanging, so giving up is reportable. Previously the
    # caller only flagged `if moved`, which means the one case worth knowing
    # about -- it tried, hit a pause, and the reel still ends on "aur" -- was
    # the one case that said nothing.
    stuck = (k > 0 and words[k - 1]["t"] in DANGLING
             and not words[k - 1]["word"].rstrip().endswith(_TERMINAL))
    return k, moved, stuck


# ---- clustering -----------------------------------------------------------

def cluster(clips):
    """Group candidates that are the SAME moment, and only those.

    This used to group anything that overlapped at all, comparing each candidate
    against the previous group and then EXTENDING that group's end -- so overlap
    chained transitively. A(0-100) + B(90-200) + C(190-300) collapsed into one
    0-300s "moment", which then got one cut window and one clip. Two of the three
    moments were gone before any model saw the list, with no drop record
    anywhere, and the protections in select_pass against exactly this could not
    reach them because this runs first.

    It was also the wrong idea about what a clip is. Measured against twenty
    reels published from one interview by independent accounts: a single 61s
    stretch was published as FOUR reels (11s, 19s, 17s, 31s) taking 1.5-1.8M
    plays each, and a 55s question-and-answer was published both in full and as a
    21s slice of its own payoff. Those are not duplicates of one moment, they are
    separate products from one stretch, and fusing them produces a single long
    clip whose best line sits at the end behind everything else.

    So: merge only near-identical ranges, compare against every group rather
    than the last one, and never let a group grow past what its seed was.
    Everything else stays separate and gets its own cut call. Deciding which of
    several overlapping readings should ship is step 2's job -- it is the only
    stage that sees them side by side, and unlike this one it can read them."""
    out = []
    for c in sorted(clips, key=lambda c: (c["start_s"], c["end_s"])):
        span = (c["start_s"], c["end_s"])
        length = c["end_s"] - c["start_s"]
        best, best_iou = None, 0.0
        for g in out:
            score = iou(span, (g["start_s"], g["end_s"]))
            # Same length as well as same place. Without this a short punchline
            # nested inside its own build merges into it and stops being its own
            # reel, which is the single most valuable thing this stage protects.
            if (score > best_iou
                    and abs((g["end_s"] - g["start_s"]) - length) <= SAME_MOMENT_SLACK_S):
                best, best_iou = g, score
        if best is not None and best_iou >= SAME_MOMENT_IOU:
            best["start_s"] = min(best["start_s"], c["start_s"])
            best["end_s"] = max(best["end_s"], c["end_s"])
            best["members"].append(c)
            continue
        out.append({"start_s": c["start_s"], "end_s": c["end_s"], "members": [c]})
    out.sort(key=lambda g: (g["start_s"], g["end_s"]))
    return out


def label_groups(groups):
    """Decide in code which category's cut prompt each moment gets.

    This is the one thing the removed LLM select pass produced that the cut stage
    genuinely needs: `cut_for` picks between the per-category boundary blocks in
    refine_cut.md, and without it every clip falls back to CAT_ANY -- so a
    comeback would be cut without the rule that says take the stupid question
    first.

    It never needed a model. The category is simply who nominated the moment.
    Where several finders did, the most confident nomination wins, then the
    longest -- a finder that returned more of the moment saw more of it.
    """
    rank = {"HIGH": 2, "MEDIUM": 1, "LOW": 0}
    for g in groups:
        best = max(g["members"],
                   key=lambda m: (rank.get(str(m.get("confidence") or "").upper(), 0),
                                  m.get("duration_s") or 0))
        g["cut_for"] = best.get("category")
        # The finder's own words about the moment, which the cut prompt prints as
        # WHAT THIS MOMENT IS. The select pass used to write this; the finder
        # already said it better.
        g.setdefault("note", best.get("why"))
    return groups


def mark_siblings(groups):
    """Tell each group which neighbours are being cut separately.

    A consequence of keeping overlapping candidates apart: four cut calls now
    look at four overlapping windows of one stretch, each with room on both
    sides, and nothing stops all four from widening to cover the whole stretch
    and returning the same clip. The dedup at the end would then collapse them
    back to one and the granularity would be lost again -- with the cost of four
    calls instead of one.

    Naming the neighbours fixes it: the cut prompt is told this moment is one of
    several from the same stretch and to cut its own claim rather than the tour.
    """
    for g in groups:
        near = []
        for o in groups:
            if o is g:
                continue
            if min(g["end_s"], o["end_s"]) - max(g["start_s"], o["start_s"]) > 0:
                near.append(o)
        g["siblings"] = [
            {"start_s": o["start_s"], "end_s": o["end_s"],
             "title": next((m.get("title") for m in o["members"] if m.get("title")),
                           None)}
            for o in sorted(near, key=lambda o: o["start_s"])]
    return groups


# ---- rendering the window -------------------------------------------------

SHOW_COMMENTS = 4         # matches what the finder saw in build_payload.py


def render(rows, lo, hi, names=None):
    names = names or {}
    lines, last = [], None
    for r in rows:
        if r["end"] <= lo or r["start"] >= hi:
            continue
        if r["kind"] == "line":
            d = r.get("display") or ""
            who = names.get(d, d)
            if who and who != last:
                lines.append(f"\n{who}")
                last = who
        marks = "".join(f"[{m.upper()}] " for m in (r.get("marks") or []))
        pre = (" ".join(r.get("tags") or []) + " ") if r.get("tags") else ""
        # Same duration column the finder read, so the cut model can measure its
        # own answer instead of guessing at it.
        col = (f"{r['seconds']:>5.1f}s" if r["kind"] == "line"
               and r.get("seconds") is not None else " " * 6)
        lines.append(f"{r['id']}  {col}  {marks}{pre}{r['text']}")
        cs = r.get("comments") or []
        for c in cs[:SHOW_COMMENTS]:
            # NOT ">>": YouTube's captions use ">>" inside the transcript text
            # itself as a speaker-change marker (409 of 1192 rows on the test
            # video). Sharing the prefix made the model unable to tell a new
            # speaker from a viewer comment, and it burned thousands of
            # reasoning tokens per call trying to work out which was which.
            lines.append(f'       [COMMENT] "{c["text"][:180]}" ({c["likes"]} likes)')
        # The weight of a moment is how many PEOPLE marked it, and the cut model
        # was the only stage not told. It showed three comment texts and no
        # count, while the evidence shown to the user counted everyone -- so the
        # user could read "9 viewers point at this moment" about a clip cut by a
        # model that thought three did.
        rest = (sum(1 + (c.get("dupes") or 0) for c in cs[SHOW_COMMENTS:])
                + sum((c.get("dupes") or 0) for c in cs[:SHOW_COMMENTS]))
        if rest:
            lines.append(f"       [COMMENT] +{rest} more viewers marked this "
                         f"moment")
    return "\n".join(lines)


def candidate_block(group):
    out = []
    for c in group["members"]:
        out.append(
            f"\n  NOMINATED BY THE {c['category'].upper()} FINDER"
            f"  (confidence {c.get('confidence')}, "
            f"hook {c.get('hook_strength')}/10"
            f"{', SHORT -- treated as a one-liner' if c.get('one_liner') else ''})\n"
            f"    proposed: {c['start_line']} .. {c['end_line']}  "
            f"({c['duration_s']:.0f}s)\n"
            f"    opens on: \"{(c.get('start_words') or '')[:120]}\"\n"
            f"    closes on: \"{(c.get('end_words') or '')[:120]}\"\n"
            f"    title: {c.get('title')}\n"
            f"    why: {c.get('why')}\n"
            + (f"    signals: {', '.join(map(str, c.get('signals_used') or []))}\n"
               if c.get("signals_used") else ""))
    return "".join(out)


# ---- evidence -------------------------------------------------------------

def evidence(rows, lo, hi):
    """Why a person is being shown this clip. Assembled from measurements that
    are present in the payload -- never inferred, never written by a model."""
    inside = [r for r in rows if r["end"] > lo and r["start"] < hi]
    ev = []
    cs = [c for r in inside for c in (r.get("comments") or [])]
    if cs:
        top = max(cs, key=lambda c: c.get("likes") or 0)
        # PEOPLE, not comment rows. comments.py folds identical comments into one
        # record carrying `dupes`, so sixteen viewers writing the same sentence
        # arrived here as one -- and this then reported "1 viewer comment points
        # at this moment" about the most heavily marked second in the video, and
        # ranked it accordingly.
        people = sum(1 + (c.get("dupes") or 0) for c in cs)
        ev.append({"kind": "comments", "count": people, "rows": len(cs),
                   "top_comment": top["text"][:200], "top_likes": top.get("likes", 0),
                   "text": (f"{people} viewer comment"
                            f"{'s' if people > 1 else ''} point at this exact "
                            f"moment, the top one with {top.get('likes', 0):,} likes")})
    if any("replayed" in (r.get("marks") or []) for r in inside):
        ev.append({"kind": "replayed",
                   "text": "YouTube's most-replayed data peaks inside this clip"})
    heard = {}
    for r in inside:
        if r["kind"] != "event":
            continue
        m = re.match(r"\[(.+?)\s+([\d.]+)s\]", r["text"])
        if m:
            heard[m.group(1)] = max(heard.get(m.group(1), 0.0), float(m.group(2)))
            continue
        # The audio-classification stage is off, so a reaction now arrives
        # as "[laughter (youtube)]" with no duration at all. Without this
        # branch it was silently unreportable.
        m = re.match(r"\[(.+?)\s+\(youtube\)\]", r["text"])
        if m:
            heard.setdefault(m.group(1), 0.0)
    for what, secs in sorted(heard.items(), key=lambda x: -x[1]):
        if what in ("pause", "long gap"):
            ev.append({"kind": "pause", "seconds": secs,
                       "text": f"a {secs:.1f}s pause lands inside this clip"})
        elif secs:
            ev.append({"kind": "reaction", "what": what, "seconds": secs,
                       "text": f"the room reacts -- {what} for {secs:.1f}s"})
        else:
            ev.append({"kind": "reaction", "what": what,
                       "text": f"YouTube's captions mark {what} inside this clip"})
    tags = sorted({t for r in inside for t in (r.get("tags") or [])})
    if tags:
        ev.append({"kind": "delivery", "tags": tags,
                   "text": "delivery shifts here: " + " ".join(tags)})
    return ev


# ---- one moment -----------------------------------------------------------

def candidate_fallback(group, words, reason):
    """Keep a finder nomination visible when the cut answer cannot be used.

    These are approximate boundaries from the finder's lines, explicitly marked
    for review. A transport or JSON error must not erase a moment the finder
    actually selected.
    """
    best = max(group["members"], key=lambda m: (
        {"HIGH": 2, "MEDIUM": 1, "LOW": 0}.get(
            str(m.get("confidence") or "").upper(), 0),
        m.get("duration_s") or 0,
    ))
    start_i = next((i for i, w in enumerate(words)
                    if w["end"] > group["start_s"]), 0)
    end_i = next((i for i in range(len(words) - 1, -1, -1)
                  if words[i]["start"] < group["end_s"]), len(words) - 1)
    if end_i <= start_i:
        end_i = min(len(words) - 1, start_i + 1)
    start_s = round(pad_start(words, start_i), 2)
    end_s = round(pad_end(words, end_i + 1), 2)
    note = ("The cut response could not be used. These are the finder's rough "
            f"boundaries; check the opening and ending before publishing ({reason}).")
    return {
        "title": best.get("title"), "description": best.get("why") or "",
        "category": best.get("category") or group.get("cut_for") or "general",
        "is_one_liner": bool(best.get("one_liner")),
        "confidence": "LOW", "boundary_note": note,
        "cut_status": "needs_review",
        "segments": [{"start_s": start_s, "end_s": end_s,
                      "duration_s": round(end_s - start_s, 2),
                      "start_words": words[start_i]["word"],
                      "end_words": words[end_i]["word"],
                      "start_line": best.get("start_line"),
                      "end_line": best.get("end_line"),
                      "match": {"start": 0.0, "end": 0.0},
                      "text": _text_between(words, start_s, end_s)}],
        "start_s": start_s, "end_s": end_s,
        "duration_s": round(end_s - start_s, 2),
        "transcript": _text_between(words, start_s, end_s),
        "nominated_by": sorted({m["category"] for m in group["members"]}),
        "step1": [{k: m.get(k) for k in
                   ("category", "id", "title", "why", "confidence",
                    "hook_strength", "signals_used", "start_line", "end_line")}
                  for m in group["members"]],
        "flags": [note],
    }


def refine_one(group, rows, words, prompt, key, model, effort, pad=None,
               names=None, url=None, pad_before=None, pad_after=None):
    before = PAD_BEFORE_S if pad_before is None else pad_before
    after = PAD_AFTER_S if pad_after is None else pad_after
    if pad is not None and pad_before is None and pad_after is None:
        # An explicit single `pad` from an older caller still means symmetric.
        before = after = pad
    lo = max(0.0, group["start_s"] - before)
    hi = group["end_s"] + after
    pos = {r["id"]: i for i, r in enumerate(rows)}
    win = render(rows, lo, hi, names=names)
    sibs = group.get("siblings") or []
    sib_block = ""
    if sibs:
        sib_block = (
            "\n  OTHER MOMENTS IN THIS SAME STRETCH, being cut separately:\n"
            + "".join(f"    {mmss(s['start_s'])}-{mmss(s['end_s'])}"
                      f"{'  ' + s['title'] if s.get('title') else ''}\n"
                      for s in sibs[:6])
            + "    Those are other reels. Cut YOUR claim and let them have\n"
              "    theirs -- widening to cover them produces one long clip\n"
              "    where there were several, and the shorter ones are the\n"
              "    ones that travel.\n")
    user = ("THE CANDIDATE MOMENT\n" + candidate_block(group)
            + (f"\n  CUT IT FOR: {group['cut_for']}\n"
               if group.get("cut_for") else "")
            + (f"  WHAT THIS MOMENT IS: {group['note']}\n"
               if group.get("note") else "")
            + sib_block
            + "\n\nTHE TRANSCRIPT AROUND IT\n"
            + "(the window reaches further back than forward, because a clip is "
              "far more often missing its setup than its ending. It is room, not "
              "an assignment. The number after each id is that line's length in "
              "seconds, so you can measure your own cut.)\n"
            + win + "\n\nNow cut the clip. Return the JSON object only.")
    t0 = time.time()
    res = {"group": group, "error": None, "usage": {}, "seconds": 0.0}
    try:
        content, reasoning, usage = call(
            [{"role": "system", "content": prompt},
             {"role": "user", "content": user}], key, model, effort, url=url)
    except Exception as e:
        res["error"] = f"{type(e).__name__}: {str(e)[:200]}"
        res["clip"] = candidate_fallback(group, words, res["error"])
        return res
    res["usage"] = usage
    res["seconds"] = round(time.time() - t0, 1)
    res["reasoning"] = reasoning
    raw = llm.parse_json(content)
    if not isinstance(raw, dict):
        segments = llm.salvage_list(content, "segments")
        if segments:
            raw = {"keep": True, "segments": segments,
                   "title": llm.salvage_field(content, "title"),
                   "description": llm.salvage_field(content, "description"),
                   "category": llm.salvage_field(content, "category"),
                   "confidence": llm.salvage_field(content, "confidence"),
                   "boundary_note": llm.salvage_field(content, "boundary_note")}
            res["salvaged"] = True
        else:
            res["error"] = "response was not JSON and no segments could be recovered"
            res["raw"] = content
            res["clip"] = candidate_fallback(group, words, res["error"])
            return res
    res["raw_json"] = raw

    if raw.get("keep") is False:
        res["dropped"] = raw.get("drop_reason") or "model returned keep=false"
        return res

    clip, err = build_clip(raw, group, rows, words, pos, lo, hi)
    if err:
        res["error"] = err
        res["clip"] = candidate_fallback(group, words, err)
    else:
        if res.get("salvaged"):
            clip["flags"].append("Cut JSON was malformed; valid segment was recovered")
            clip["cut_status"] = "needs_review"
        res["clip"] = clip
    return res


def build_clip(raw, group, rows, words, pos, lo, hi):
    """Turn one model answer into a clip with real timestamps.

    -> (clip, None) or (None, error)."""
    # The model can only have copied words from the window it was shown.
    outer = (next((i for i, w in enumerate(words) if w["end"] > lo), 0),
             next((i for i in range(len(words) - 1, -1, -1)
                   if words[i]["start"] < hi), len(words) - 1) + 1)
    segs, flags = [], []
    all_segs = raw.get("segments") or []
    if not isinstance(all_segs, list):
        return None, "segments was not a list"
    # The prompt asks for at most three. Keep every returned segment if the
    # model breaks that rule; truncating the array can remove its payoff.
    if len(all_segs) > 3:
        flags.append(f"{len(all_segs)} segments returned -- review the full cut")
    for segment_i, s in enumerate(all_segs):
        if not isinstance(s, dict):
            continue
        a = s.get("start_line")
        b = s.get("end_line")
        ia = pos.get(str(a or "").strip().upper())
        ib = pos.get(str(b or "").strip().upper())
        # A named line that does not exist is a hint we cannot use, not a
        # failure -- the words still have to be found somewhere.
        alo, ahi, pa = _word_range(words, rows, ia, "start")
        blo, bhi, pb = _word_range(words, rows, ib, "end")
        span_a, sc_a, note_a = locate(words, s.get("start_words"), alo, ahi,
                                      prefer=pa, outer=outer)
        span_b, sc_b, note_b = locate(words, s.get("end_words"), blo, bhi,
                                      prefer=pb, outer=outer)

        # The line-boundary fallback used to skip both the lead/tail padding and
        # the dangling-end repair, so a clip that had already lost its word match
        # got a hard cut on an arbitrary machine line break too -- which is
        # precisely where a hanging word is most likely. Both paths now land in
        # the word list and get the same treatment.
        if span_a:
            start_i = span_a[0]
        elif ia is not None:
            start_i = _word_at(words, rows[ia]["start"], "fwd")
            flags.append(f"start words unmatched ({note_a}) -- using line {a}")
        else:
            flags.append(f"start unusable: {note_a}, line {a!r} unknown")
            continue
        if start_i is None:
            st = rows[ia]["start"]
        else:
            # Drop a leading "and"/"so"/"एंड"/"सो" the model left on the front.
            # Unambiguous and always an improvement: no reel should open on a
            # connective. Anything harder than this -- a mid-sentence start, a
            # pronoun with no antecedent -- needs the model, because fixing it
            # means moving BACKWARDS and only a reader knows how far.
            end_guess = span_b[1] if span_b else len(words)
            k, dropped_words = trim_leading_filler(words, start_i, end_guess)
            if dropped_words:
                flags.append(
                    f"dropped {dropped_words} leading filler word(s) "
                    f"({' '.join(words[x]['word'] for x in range(start_i, k))})")
            st = pad_start(words, k)
        if span_b:
            end_i = span_b[1]
        elif ib is not None:
            j0 = _word_at(words, rows[ib]["end"], "back")
            end_i = (j0 + 1) if j0 is not None else None
            flags.append(f"end words unmatched ({note_b}) -- using line {b}")
        else:
            flags.append(f"end unusable: {note_b}, line {b!r} unknown")
            continue
        end_pause_s = 0.0
        if end_i is None:
            en = rows[ib]["end"]
        else:
            # The model named the last words it wants heard. If those words
            # cannot end a sentence, walk forward off them in code -- this is
            # the check the removed third LLM stage used to do.
            j, moved, stuck = fix_dangling_end(words, end_i)
            if moved:
                flags.append(f"end extended {moved} word(s) off "
                             f"{words[end_i - 1]['word']!r}")
            if stuck:
                flags.append(f"still ends on {words[j - 1]['word']!r}, which "
                             f"cannot close a sentence -- a pause blocked the fix")
            en = pad_end(words, j)
            if (s.get("keep_end_pause") is True
                    and segment_i == len(all_segs) - 1
                    and sc_b >= STRONG and not stuck):
                pause_end = ending_pause_end(words, j, rows, hi)
                if pause_end > en:
                    en = pause_end
                    end_pause_s = round(en - words[j - 1]["end"], 2)
                    flags.append(f"kept {end_pause_s:.2f}s measured ending pause")
        if note_a:
            flags.append("start: " + note_a)
        if note_b:
            flags.append("end: " + note_b)
        if en <= st:
            flags.append(f"end {en:.1f}s is not after start {st:.1f}s -- dropped")
            continue
        segs.append({"start_s": round(st, 2), "end_s": round(en, 2),
                     "duration_s": round(en - st, 2),
                     "start_words": s.get("start_words"),
                     "end_words": s.get("end_words"),
                     "start_line": a, "end_line": b,
                     "match": {"start": round(sc_a, 2), "end": round(sc_b, 2)},
                     "end_pause_s": end_pause_s,
                     "text": _text_between(words, st, en)})
    if not segs:
        return None, ("no usable segment: " + "; ".join(flags) if flags
                      else "no segments returned")

    segs.sort(key=lambda x: x["start_s"])
    needs_review = (len(all_segs) > 3 or len(segs) != len(all_segs)
                    or any(s["match"][side] < STRONG for s in segs
                           for side in ("start", "end")))
    return {
        "title": raw.get("title"), "description": raw.get("description"),
        "category": _category(raw, group),
        "is_one_liner": bool(raw.get("is_one_liner")),
        "confidence": _confidence(raw),
        "boundary_note": raw.get("boundary_note"),
        "segments": segs,
        "start_s": segs[0]["start_s"], "end_s": segs[-1]["end_s"],
        "duration_s": round(sum(s["duration_s"] for s in segs), 2),
        "transcript": " ".join(s["text"] for s in segs),
        "nominated_by": sorted({m["category"] for m in group["members"]}),
        "step1": [{k: m.get(k) for k in
                   ("category", "id", "title", "why", "confidence",
                    "hook_strength", "signals_used", "start_line", "end_line")}
                  for m in group["members"]],
        "flags": flags,
        **({"cut_status": "needs_review"} if needs_review else {}),
    }, None


CATEGORIES = ("motivational", "emotional", "entertainment", "general",
              "audience")
CONFIDENCES = ("high", "medium", "low")


def _category(raw, group):
    """Whatever the model typed, mapped onto the five real category names.

    It echoes the label back in whatever case it feels like -- one run
    produced "AUD" and "aud", "Mot", "Motivational" and "ENTERTAINMENT" as
    five separate categories across eleven videos. Downstream anything that
    groups or filters by category then silently splits one bucket into
    several, and `--only` matches none of them."""
    v = str(raw.get("category") or "").strip().lower()
    if v in CATEGORIES:
        return v
    for c in CATEGORIES:                       # "mot", "aud", "entertain..."
        if v and (c.startswith(v) or v.startswith(c)):
            return c
    v = str(group.get("cut_for") or "").strip().lower()
    if v in CATEGORIES:
        return v
    # Last resort: what the finders themselves said, preferring a real
    # nomination over a label the model invented.
    for m in group["members"]:
        if m.get("category") in CATEGORIES:
            return m["category"]
    return "general"


def _confidence(raw):
    v = str(raw.get("confidence") or "").strip().lower()
    return v if v in CONFIDENCES else "medium"


def _has_audience(g):
    return any(m.get("category") == "audience" for m in g["members"])


def _overlaps(a, b):
    return min(a["end_s"], b["end_s"]) - max(a["start_s"], b["start_s"]) > 0


def select_pass(groups, prompt, key, model, effort, url=None):
    """PASS A -- every candidate in one call, so duplicates can be seen.

    This is the only stage in the system that sees the whole candidate list at
    once, which is the one thing code cannot do well: two finders can nominate
    the same exchange from different angles, land on ranges that do not
    overlap by a single second, and produce two reels of one moment.

    It is deliberately given only a rough excerpt of each candidate and no
    window around it. Boundaries are not its job and it is told so -- asking
    one call to both de-duplicate thirty candidates and cut thirty pairs of
    boundaries is what the batch shape used to do, and the boundary work is
    what suffered.

    Merges are applied to the groups in place. -> (kept, [(group, why)], usage)
    """
    ids, blocks = {}, []
    for n, g in enumerate(groups, 1):
        cid = f"C{n}"
        ids[cid] = g
        who = ", ".join(sorted({m["category"] for m in g["members"]}))
        txt = max((m.get("text") or "" for m in g["members"]), key=len, default="")
        blocks.append(f"\n\n{'=' * 70}\nCANDIDATE {cid}   nominated by: {who}"
                      f"\n{'=' * 70}"
                      + candidate_block(g)
                      + f"\n  ROUGHLY WHAT THEY SELECTED\n    {txt[:1800]}\n")
    user = (f"{len(groups)} candidates came back from the five finders."
            + "".join(blocks)
            + f"\n\n{'=' * 70}\nMerge what is the same moment, drop what "
              f"should not ship, keep the rest. Every id C1 to C{len(groups)} "
              f"must be accounted for exactly once. Return the JSON object "
              f"only.")

    content, reasoning, usage = call(
        [{"role": "system", "content": prompt},
         {"role": "user", "content": user}], key, model, effort, url=url)
    raw = llm.parse_json(content)
    if not isinstance(raw, dict):
        raise RuntimeError("select response was not JSON")

    dropped, kept, seen = [], [], set()
    for d in (raw.get("drop") or []):
        cid = str(d.get("id") or "").strip().upper()
        if cid in ids and cid not in seen:
            seen.add(cid)
            dropped.append((ids[cid], d.get("reason") or "dropped in selection"))
    for k in (raw.get("keep") or []):
        cid = str(k.get("id") or "").strip().upper()
        if cid not in ids or cid in seen:
            continue
        seen.add(cid)
        g = ids[cid]
        for other in (k.get("merged_with") or []):
            oid = str(other).strip().upper()
            o = ids.get(oid)
            if o is None or oid in seen or o is g:
                continue
            lo, hi = min(g["start_s"], o["start_s"]), max(g["end_s"], o["end_s"])
            # A "merge" that spans five minutes is the model mislabelling two
            # separate moments, not one moment seen twice. Keep them apart.
            if hi - lo > MAX_CLUSTER_S:
                continue
            # Two stretches the audience marked SEPARATELY are two moments,
            # whatever they look like in a transcript. Measured on the Jim Rohn
            # talk: viewers left one comment at 3:41 and four more (27 and 26
            # likes) at 6:19, and because the speaker says "why not you"
            # throughout, both candidates came back with near-identical titles
            # and were merged into one 166s clip that buried the payoff behind
            # two minutes of dated year-2000 goal-setting. A repeated catchphrase
            # is not sameness, and viewers pointing at two places is the
            # strongest evidence in the payload that there are two places.
            if not _overlaps(g, o) and _has_audience(g) and _has_audience(o):
                continue
            seen.add(oid)
            g["members"].extend(o["members"])
            g["start_s"], g["end_s"] = lo, hi
        g["cut_for"] = k.get("cut_for")
        g["note"] = k.get("note")
        kept.append(g)
    # A candidate the model simply forgot is kept, never silently lost.
    for cid, g in ids.items():
        if cid not in seen:
            g.setdefault("note", None)
            kept.append(g)
    kept.sort(key=lambda g: g["start_s"])
    return kept, dropped, usage


def _word_at(words, t, prefer):
    """Index of the word nearest time `t`. 'fwd' for a start, 'back' for an end.

    Lets the line-boundary fallback re-enter the word list, so it can be padded
    and dangling-checked like a matched boundary instead of cutting raw on a
    machine line break."""
    if not words:
        return None
    if prefer == "fwd":
        i = next((i for i, w in enumerate(words) if w["end"] > t - 0.01), None)
        return i if i is not None else len(words) - 1
    i = next((i for i in range(len(words) - 1, -1, -1)
              if words[i]["start"] < t + 0.01), None)
    return i if i is not None else 0


def _word_range(words, rows, row_i, which="start"):
    """Where to look for a phrase: (lo, hi, prefer).

    lo..hi is the named line widened by a few lines, because the model can name
    a neighbouring id and still have copied the right words. `prefer` is where
    inside that window the phrase is expected, and it is the tie-breaker
    `_best_in` needs when a phrase occurs more than once.

    Two things it has to get right, both measured on the test video:

      THE NAMED LINE, NOT THE WINDOW. "some of these amazing people" is said
      twice, twelve seconds apart, and both occurrences sit inside the widened
      window. Anchored on the middle of the WINDOW, both scored 1.00 and the
      earlier one won -- a clip asked to start at 643.0s started at 630.9s,
      dragging in the tail of the previous sentence.

      WHICH END OF IT. `end_words` are the LAST words of the clip, so when the
      phrase repeats inside one line the later occurrence is the intended one.
      L0104 ends "...They believe it. Truly, they believe it." and an end phrase
      of "they believe it." has to resolve to the second one, or the clip stops
      1.8s early and loses the repetition that was the whole point of the line.
    """
    if row_i is None:
        return 0, len(words), None
    lo_r = max(0, row_i - NEAR_LINES)
    hi_r = min(len(rows) - 1, row_i + NEAR_LINES)
    t0, t1 = rows[lo_r]["start"], rows[hi_r]["end"]
    lo = next((i for i, w in enumerate(words) if w["end"] > t0), 0)
    hi = next((i for i in range(len(words) - 1, -1, -1)
               if words[i]["start"] < t1), len(words) - 1) + 1
    if which == "end":
        anchor_t = rows[row_i]["end"]
        prefer = next((i for i in range(len(words) - 1, -1, -1)
                       if words[i]["start"] <= anchor_t), lo)
    else:
        anchor_t = rows[row_i]["start"]
        prefer = next((i for i, w in enumerate(words) if w["end"] >= anchor_t), lo)
    return lo, hi, prefer


def _text_between(words, s, e):
    return " ".join(w["word"] for w in words
                    if w["start"] >= s - 0.05 and w["end"] <= e + 0.05)


# ---- output ---------------------------------------------------------------

def iou(a, b):
    inter = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    union = max(a[1], b[1]) - min(a[0], b[0])
    return inter / union if union > 0 else 0.0


_CONF = {"HIGH": 2, "MEDIUM": 1}


def finalise(clips, rows, off, video_id, dropped_short=None, dropped_dup=None):
    out = []
    dropped_short = dropped_short if dropped_short is not None else []
    dropped_dup = dropped_dup if dropped_dup is not None else []
    for c in clips:
        c["source_start_s"] = round(c["start_s"] + off, 2)
        c["source_end_s"] = round(c["end_s"] + off, 2)
        for s in c["segments"]:
            s["source_start_s"] = round(s["start_s"] + off, 2)
            s["source_end_s"] = round(s["end_s"] + off, 2)
        c["evidence"] = evidence(rows, c["start_s"], c["end_s"])
        if video_id:
            c["youtube_url"] = (f"https://www.youtube.com/watch?v={video_id}"
                                f"&t={int(c['source_start_s'])}s")
            c["embed_url"] = (f"https://www.youtube.com/embed/{video_id}"
                              f"?start={int(c['source_start_s'])}"
                              f"&end={int(c['source_end_s']) + 1}")
        # Too short is fatal, too long is not. Under MIN_CLIP_S there is no
        # reel to publish -- a 2.2s cut is a word and a half, and shipping it
        # with a flag just moves the problem to whoever reads the list. Over
        # MAX_CLIP_S the clip is real and merely needs trimming, so it stays
        # and says so.
        if c["duration_s"] < MIN_CLIP_S:
            c["flags"].append(
                f"{c['duration_s']:.1f}s is unusually short -- review before publishing")
        if c["duration_s"] > MAX_CLIP_S:
            c["flags"].append(f"{c['duration_s']:.0f}s is over "
                              f"{MAX_CLIP_S:.0f}s -- trim before publishing")
        out.append(c)

    out.sort(key=lambda c: (-_CONF.get(str(c.get("confidence", "")).upper(), 0),
                            -len(c["nominated_by"]),
                            -max([m.get("hook_strength") or 0
                                  for m in c["step1"]] or [0]),
                            -len(c["evidence"]), c["start_s"]))
    kept = []
    for c in out:
        # Only a near-exact duplicate is dropped here, and now it says so. This
        # was the one place a finished, cut, publishable clip disappeared with no
        # record in flags, in meta, or in any event -- which made it impossible
        # to tell "the model found three moments" from "the model found five and
        # two were swallowed".
        twin = next((k for k in kept
                   if c.get("cut_status") != "needs_review"
                   and k.get("cut_status") != "needs_review"
                   if iou((c["start_s"], c["end_s"]),
                            (k["start_s"], k["end_s"])) > DUP_IOU), None)
        if twin:
            dropped_dup.append(
                f"{mmss(c['start_s'] + off)}-{mmss(c['end_s'] + off)} "
                f"{str(c.get('title'))[:60]} -- same seconds as "
                f"{str(twin.get('title'))[:40]}")
            continue
        kept.append(c)
    for i, c in enumerate(kept, 1):
        c["rank"] = i
        c["id"] = f"clip{i}"
    return kept


def report(path, clips, meta):
    with open(path, "w", encoding="utf-8") as f:
        v = meta.get("video") or {}
        if v.get("title"):
            f.write(f"{v['title']}\n{v.get('channel') or ''}\n")
        f.write(f"{len(clips)} clips  |  {meta['seconds']:.0f}s  |  "
                f"${meta['cost_usd']:.4f}\n")
        for c in clips:
            f.write(f"\n{'=' * 74}\n#{c['rank']}  "
                    f"{mmss(c['source_start_s'])}-{mmss(c['source_end_s'])}  "
                    f"{c['duration_s']:.1f}s  {c['confidence']}  {c['category']}"
                    f"{'  ONE-LINER' if c['is_one_liner'] else ''}\n")
            f.write(f"{c['title']}\n{c['description']}\n")
            f.write(f"  found by: {', '.join(c['nominated_by'])}\n")
            f.write(f"  cut: {c.get('boundary_note') or '-'}\n")
            for s in c["segments"]:
                f.write(f"  segment {s['source_start_s']:.2f}-{s['source_end_s']:.2f}"
                        f"  match {s['match']['start']:.2f}/{s['match']['end']:.2f}\n")
            for e in c["evidence"]:
                f.write(f"  + {e['text']}\n")
            for x in c["flags"]:
                f.write(f"  !! {x}\n")
            if c.get("youtube_url"):
                f.write(f"  {c['youtube_url']}\n")
            f.write(f"\n  {c['transcript'][:900]}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--step1", required=True, help="the _step1.json")
    ap.add_argument("--payload", default=None, help="defaults to the one step 1 used")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--effort", default=None,
                    choices=["low", "medium", "high", "max"],
                    help="sets both passes; overridden by the two below")
    ap.add_argument("--select-effort", dest="select_effort", default=None,
                    choices=["low", "medium", "high", "max"])
    ap.add_argument("--cut-effort", dest="cut_effort", default=None,
                    choices=["low", "medium", "high", "max"])
    ap.add_argument("--pad", type=float, default=PAD_BEFORE_S,
                    help="seconds of context BEFORE a candidate")
    ap.add_argument("--pad-after", dest="pad_after", type=float,
                    default=PAD_AFTER_S,
                    help="seconds of context after a candidate")
    ap.add_argument("--only", default=None, help="refine only these categories")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--no-select", action="store_true",
                    help="(no longer needed: the LLM select pass is off by "
                         "default) kept so old commands still run")
    ap.add_argument("--llm-select", action="store_true",
                    help="run the old LLM select pass as well as the code "
                         "dedup, for comparison")
    ap.add_argument("--outdir", default=None)
    ap.add_argument("--deepseek", action="store_true",
                    help="call DeepSeek's own API instead of OpenRouter")
    args = ap.parse_args()
    args.select_effort = args.select_effort or args.effort or SELECT_EFFORT
    args.cut_effort = args.cut_effort or args.effort or CUT_EFFORT
    url = DEEPSEEK_URL if args.deepseek else None
    key_name = "DEEPSEEK_API_KEY" if args.deepseek else "OPENROUTER_API_KEY"

    sp = os.path.abspath(args.step1)
    with open(sp, encoding="utf-8") as f:
        step1 = json.load(f)
    pmeta = step1.get("meta") or {}
    payload_json = re.sub(r"\.txt$", ".json",
                          args.payload or pmeta.get("payload") or "")
    if not payload_json or not os.path.exists(payload_json):
        log(f"payload json not found: {payload_json!r}", "FATAL")
        sys.exit(2)
    with open(payload_json, encoding="utf-8") as f:
        pay = json.load(f)
    rows = pay["rows"]
    meta = pay.get("meta") or {}
    off = float(meta.get("clip_start_s") or 0.0)

    tpath = meta.get("transcript")
    if not tpath or not os.path.exists(tpath):
        log(f"word-level transcript not found: {tpath!r}", "FATAL")
        sys.exit(2)
    with open(tpath, encoding="utf-8") as f:
        # Sound tags carry timestamps but are not speech. A clip must never
        # be cut on "[Applause]", so they are left out of the matching list
        # entirely -- the payload still shows them, this just cannot land there.
        words = [{"word": w["word"], "t": _STRIP.sub("", w["word"]).lower(),
                  "start": float(w["start"]), "end": float(w["end"])}
                 for w in (json.load(f).get("words") or [])
                 if (w.get("word") or "").strip() and w.get("kind") != "tag"]
    words.sort(key=lambda w: (w["start"], w["end"]))
    if not words:
        log("word-level transcript is empty", "FATAL")
        sys.exit(2)

    clips = step1.get("clips") or []
    if args.only:
        want = {c.strip() for c in args.only.split(",")}
        clips = [c for c in clips if c["category"] in want]
    if not clips:
        log("no candidates to refine", "WARN")
        sys.exit(0)

    groups = cluster(clips)
    merged = sum(1 for g in groups if len(g["members"]) > 1)
    log(f"merged on overlap >{SAME_MOMENT_IOU:.0%} AND length within "
        f"+/-{SAME_MOMENT_SLACK_S:.0f}s")
    log(f"{len(clips)} candidates -> {len(groups)} distinct moments "
        f"({merged} nominated by more than one finder), "
        f"-{args.pad:.0f}s/+{args.pad_after:.0f}s context each")

    names = meta.get("speaker_names") or {}
    key = llm.get_key(key_name)
    t0 = time.time()
    results = []
    batch_usage = {}

    # The LLM select pass is off by default. Duplicate detection is arithmetic
    # (see cluster) and the rest of what that pass did was drop moments, which is
    # the one irreversible thing this stage can do. Still available with
    # --llm-select for comparison.
    if args.llm_select:
        log(f"pass A -- all {len(groups)} moments in one call on {args.model} "
            f"({args.select_effort}): merging duplicates, dropping what cannot ship")
        try:
            groups, sel_dropped, batch_usage = select_pass(
                groups, prompt_text(os.path.join(PROMPTS, "refine_select.md")),
                key, args.model, args.select_effort, url=url)
            for g, why in sel_dropped:
                results.append({"group": g, "usage": {}, "seconds": 0.0,
                                "error": None, "dropped": why})
            log(f"  {len(groups)} kept, {len(sel_dropped)} dropped  "
                f"${batch_usage.get('cost', 0):.4f}")
        except Exception as e:
            # Selection is an improvement, not a gate. If it fails, cutting
            # every candidate is a worse answer than a merged one and a far
            # better answer than no answer.
            log(f"select pass failed ({type(e).__name__}: {str(e)[:140]}) -- "
                f"cutting all {len(groups)} candidates instead", "WARN")

    if not groups:
        log("no moments to cut", "WARN")
    label_groups(groups)
    mark_siblings(groups)
    log(f"pass B -- cutting {len(groups)} moments in parallel on {args.model} "
        f"({args.cut_effort}), -{args.pad:.0f}s/+{args.pad_after:.0f}s of context each")
    with concurrent.futures.ThreadPoolExecutor(
            max_workers=max(1, min(args.workers, len(groups)))) as ex:
        futs = {ex.submit(refine_one, g, rows, words,
                          cut_prompt_for(g.get("cut_for")), key, args.model,
                          args.cut_effort, names=names, url=url,
                          pad_before=args.pad, pad_after=args.pad_after): g
                for g in groups}
        for fu in concurrent.futures.as_completed(futs):
            try:
                results.append(fu.result())
            except Exception as e:
                g = futs[fu]
                results.append({"group": g, "usage": {}, "seconds": 0.0,
                                "error": f"{type(e).__name__}: {str(e)[:200]}"})

    results.sort(key=lambda r: r["group"]["start_s"])
    for r in results:
        g = r["group"]
        who = "+".join(sorted({m["category"][:3] for m in g["members"]}))
        if r.get("clip"):
            c = r["clip"]
            log(f"  {mmss(g['start_s'] + off):>7} [{who}] -> "
                f"{c['duration_s']:.1f}s  {c['confidence']}"
                + (f"  !! {len(c['flags'])}" if c["flags"] else ""))
        elif r.get("dropped"):
            log(f"  {mmss(g['start_s'] + off):>7} [{who}] dropped: "
                f"{r['dropped'][:90]}")
        else:
            log(f"  {mmss(g['start_s'] + off):>7} [{who}] FAILED: "
                f"{str(r['error'])[:90]}", "WARN")

    video = (pmeta.get("video") or meta.get("video") or {})
    dropped_short, dropped_dup = [], []
    kept = finalise([r["clip"] for r in results if r.get("clip")], rows, off,
                    video.get("video_id"), dropped_short, dropped_dup)
    for d in dropped_short:
        log(f"  dropped, under {MIN_CLIP_S:.0f}s -- {d}", "WARN")
    for d in dropped_dup:
        log(f"  dropped, duplicate seconds -- {d}", "WARN")
    cost = (float(batch_usage.get("cost") or 0)
            + sum(float((r["usage"] or {}).get("cost") or 0) for r in results))
    outdir = os.path.abspath(args.outdir or os.path.dirname(sp))
    os.makedirs(outdir, exist_ok=True)
    stem = os.path.join(outdir, re.sub(r"_step1\.json$", "", os.path.basename(sp)))
    fmeta = {"step1": sp, "payload": payload_json, "transcript": tpath,
             "model": args.model, "select_effort": args.select_effort,
             "cut_effort": args.cut_effort, "pad_s": args.pad,
             "clip_start_s": off, "video": video,
             "candidates": len(clips), "moments": len(groups),
             "dropped_by_model": [r["dropped"] for r in results if r.get("dropped")],
             "dropped_too_short": dropped_short,
             "dropped_duplicate": dropped_dup,
             "failed": [r["error"] for r in results if r.get("error")],
             "cost_usd": round(cost, 5), "seconds": round(time.time() - t0, 1)}
    with open(stem + "_clips.json", "w", encoding="utf-8") as f:
        json.dump({"meta": fmeta, "clips": kept}, f, ensure_ascii=False, indent=2)
    report(stem + "_clips.txt", kept, fmeta)

    flagged = sum(1 for c in kept if c["flags"])
    weak = sum(1 for c in kept for s in c["segments"]
               if min(s["match"]["start"], s["match"]["end"]) < STRONG)
    log(f"{len(kept)} final clips ({flagged} flagged, {weak} segment(s) with a "
        f"soft word match) in {time.time() - t0:.0f}s, ${cost:.4f}", "OK")
    print(f" {stem}_clips.txt\n {stem}_clips.json")

    # Losing every clip to the same transport error is a failed run, not a
    # run that found nothing, and the two must not look alike. Measured: an
    # exhausted OpenRouter key returned 403 on the select pass and on all ten
    # cut calls, and this exited 0 with a cheerful "0 final clips" -- twenty-
    # one perfectly good step-1 candidates thrown away while the pipeline
    # recorded the stage as a success. A video that genuinely has nothing
    # worth clipping still exits 0; only a total wipeout with errors behind
    # it does not, so step 1 stays on disk and the run can be repeated.
    errs = [r["error"] for r in results if r.get("error")]
    if not kept and errs:
        log(f"every one of the {len(errs)} clip(s) failed -- a failed run, "
            f"not an empty one. First error: {errs[0][:120]}", "FATAL")
        sys.exit(1)


if __name__ == "__main__":
    main()
