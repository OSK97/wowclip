# -*- coding: utf-8 -*-
"""STEP 1 -- five category finders read the same payload in parallel.

    python find_clips.py --payload out/CLIP_payload.txt
    python find_clips.py --payload out/CLIP_payload.txt --only motivational

Each finder is one call: a different mindset over identical data. They do not
see each other's answers, which is the point -- five independent readings beat
one reading trying to hold five criteria at once.

No finder ever sees or returns a clock time. It refers to lines by the ids
already in the payload (L0142) and this file converts those to seconds from
the payload JSON, so a hallucinated timestamp is not possible: an id either
exists or the clip is dropped.

Message layout is attention-correct, and deliberately NOT cache-correct:

    system  = mindset + how to read the data + territory + examples
              -- byte-identical for a given category on every run
    user    = grounding wall + the payload + the task and output contract
              -- the video sits between two walls of instruction, and the
                 output format is the last thing read before generating

The payload is identical across all five finders but sits behind a system
message that differs from the first token, so prefix caching can never fire
here -- measured, prompt_cache_hit_tokens is 0 on every finder. Putting the
shared payload first would fix that and save roughly a quarter of the input
bill, at the cost of moving the video to the very front of the prompt. That
trade was considered and declined: the input is the cheap half of a run, and
this order exists to keep the category framing away from the position where
this model is weakest. Do not "fix" the caching without measuring the clips.

The shared half of every prompt lives in prompts/_common.md and is composed in
here, so the five category files hold only what makes them different.
"""

import argparse
import concurrent.futures
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
COMMON = os.path.join(PROMPTS, "_common.md")

CATEGORIES = ["motivational", "emotional", "entertainment", "general", "audience"]

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

MODEL = "z-ai/glm-5.3-flash"
MAX_TOKENS = 64000
TIMEOUT_S = 75
RETRIES = 3
TEMPERATURE = 0.4

# NOTHING IS DROPPED HERE FOR LENGTH ANY MORE. Both of these are report
# thresholds now, and the difference is the whole point.
#
# A finder proposes a rough RANGE; the cut stage afterwards is what narrows it
# to real boundaries. So a candidate dropped at this stage is never shortened --
# it is gone, and the moment inside it goes with it. Every version of a length
# filter here has cost real reels:
#
#   110s  binned a nominated moment that independent accounts published as a
#         real reel with 1.09 million plays, because the finder proposed 123s
#         of range around a 51s moment. It also threw away all three of the
#         audience finder's nominations, so that finder returned nothing.
#   170s  moved the cliff without removing it, and the four categories that
#         were subject to it are never told the number exists -- _common.md
#         tells them the opposite ("boundaries are not your job", "never
#         estimate a duration"). Code deleting work the prompt asked for is
#         not a sanity net, it is a silent contradiction.
#
# Length is decided in prompts/refine_cut.md, by a model that can see the
# window. A misjudged range now costs a flag, never the clip.
LONG_CLIP_S = 170.0
LONG_CLIP_S_BY_CAT = {"general": 300.0}   # general may legitimately run long
SHORT_CLIP_S = 4.0
# Overlap between two candidates from the SAME finder. It no longer drops
# anything either: measured against twenty published reels cut from one
# interview, a single 61s stretch was published as four separate reels at
# 1.5-1.8M plays each, all of them overlapping heavily. Two readings of one
# stretch are two products, and the stage that can actually tell them apart is
# step 2, which sees every candidate at once.
DUP_IOU = 0.9             # only near-identical ranges are marked as twins
# Finders are no longer asked to make `skipped` tile the whole transcript --
# that accounting cost more thinking than the check was worth. Coverage is
# now a loose smoke test for a finder that stopped reading partway, not a
# measure of how completely it accounted for the video.
LOW_COVERAGE = 0.3


def log(m, tag="INFO"):
    print(f"[{time.strftime('%H:%M:%S')}] [{tag:<5}] {m}", flush=True)


def mmss(x):
    return f"{int(x) // 60}:{int(x) % 60:02d}"


def sections(path):
    with open(path, encoding="utf-8") as f:
        parts = re.split(r"<<<SECTION:([A-Z_]+)>>>", f.read())
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts), 2)}


def compose(category, prompts_dir=PROMPTS):
    """-> (system prompt, grounding wall, task tail)

    Order inside the system message: who you are, then how to read the data,
    then the territory, then the calibration frame, then the examples. The
    frame has to arrive before the examples or it cannot do its job."""
    cat_path = os.path.join(prompts_dir, f"{category}.md")
    if not os.path.exists(cat_path):
        raise SystemExit(f"no prompt at {cat_path}")
    com = sections(os.path.join(prompts_dir, "_common.md"))
    cat = sections(cat_path)
    for need, where in (("MINDSET", cat_path), ("TERRITORY", cat_path),
                        ("READING", COMMON), ("UNCERTAINTY", COMMON),
                        ("CALIBRATION", COMMON), ("GROUNDING", COMMON),
                        ("TASK", COMMON)):
        src = cat if where == cat_path else com
        if need not in src:
            raise SystemExit(f"{where}: missing <<<SECTION:{need}>>>")
    body = [cat["MINDSET"], com["READING"], com["UNCERTAINTY"], cat["TERRITORY"],
            com["CALIBRATION"]]
    for k in ("EXAMPLES", "ANTIEXAMPLES"):
        if cat.get(k):
            body.append(cat[k])
    return "\n\n\n".join(body), com["GROUNDING"], com["TASK"]


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


# ---- resolving ids back to time ------------------------------------------

_ID_NUM = re.compile(r"(\d{1,6})")


def norm_id(rid):
    """Any way a model might write a line id -> the canonical 'L0142'.

    Ids are the ONLY channel a finder has for pointing at a moment, so a
    formatting slip used to be unrecoverable: exact-or-die matching deleted the
    clip and reported "line id does not exist". Every variant below has been
    seen in a real answer, and in each one the intended line is unambiguous.

        'l142'  'L142'  '142'  'Line 142'  'L0142.'  'L0142-L0151'  0142

    The first run of digits wins, which is what makes a range ('L0142-L0151')
    resolve to its own end of the range -- the caller passes start and end
    separately, so each side reads the number nearest it. Returns None only
    when there is no number at all to work with."""
    if rid is None:
        return None
    s = str(rid).strip().upper()
    m = _ID_NUM.search(s)
    if not m:
        return None
    return f"L{int(m.group(1)):04d}"


def resolve(rows, rid, prefer):
    """Map an id a finder returned to a spoken line.

    Event rows ([laughter 2.1s]) carry ids too and a clip must not begin or end
    on one -- there are no words there to cut on. `prefer` decides which way to
    walk off an event: 'fwd' for a start, 'back' for an end.

    Walking off an event can run out of rows (an end id sitting on the very last
    event row). Falling back to the nearest spoken line in the OTHER direction
    beats returning None, which deletes the clip over a row that carries no
    words either way."""
    idx = {r["id"]: i for i, r in enumerate(rows)}
    i = idx.get(norm_id(rid))
    if i is None:
        return None
    step = 1 if prefer == "fwd" else -1
    j = i
    while 0 <= j < len(rows) and rows[j]["kind"] != "line":
        j += step
    if 0 <= j < len(rows):
        return rows[j]
    j = i
    while 0 <= j < len(rows) and rows[j]["kind"] != "line":
        j -= step
    return rows[j] if 0 <= j < len(rows) else None


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def anchor_ok(words, text):
    """A finder copies a few words out of the line it chose. If they are not in
    that line it was looking somewhere else -- worth flagging, not worth
    discarding, since ASR text is full of near-duplicates."""
    w, t = norm(words), norm(text)
    if not w:
        return None
    if w in t:
        return True
    toks = w.split()
    return sum(1 for x in toks if x in t) >= max(2, len(toks) * 0.6)


def iou(a, b):
    inter = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    union = max(a[1], b[1]) - min(a[0], b[0])
    return inter / union if union > 0 else 0.0


def _num(v, default=None):
    """A number out of whatever the model typed, or `default`.

    Every field here is unvalidated model output, and two of them are sort keys.
    `"hook_strength": "8"` used to raise a TypeError inside the sort at the
    bottom of this function -- which runs OUTSIDE the only try/except in
    run_category, so one stray quote on one clip escaped to the main thread,
    killed the ThreadPoolExecutor block, and cost all five finders their output
    and both step-1 artifacts. A string that looks like a number is obviously
    usable; anything else becomes the default and is flagged, never fatal."""
    if isinstance(v, bool) or v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        m = re.search(r"-?\d+(?:\.\d+)?", str(v))
        return float(m.group(0)) if m else default


def build_clips(raw, rows, off, category):
    long_s = LONG_CLIP_S_BY_CAT.get(category, LONG_CLIP_S)
    line_ids = [r["id"] for r in rows if r["kind"] == "line"]
    pos = {r["id"]: i for i, r in enumerate(rows)}
    out, dropped = [], []

    raw_clips = raw.get("clips") or []
    if not isinstance(raw_clips, list):
        raise ValueError("clips must be a list")
    for c in raw_clips:
        if not isinstance(c, dict):
            dropped.append({"category": category, "clip": c,
                            "reason": "clip was not an object"})
            continue
        a = resolve(rows, c.get("start_line"), "fwd")
        b = resolve(rows, c.get("end_line"), "back")
        if not a or not b:
            dropped.append({"category": category, "clip": c,
                            "reason": f"no line id usable "
                                      f"({c.get('start_line')!r}..{c.get('end_line')!r})"})
            continue
        flags = []
        sw, ew = c.get("start_words"), c.get("end_words")
        if pos[a["id"]] > pos[b["id"]]:
            # The words travel with the line they were copied from. Swapping the
            # rows and leaving the anchors behind handed the cut stage a start
            # phrase that lives in the end line, which is a guaranteed word-match
            # failure on a clip that was otherwise fine.
            a, b = b, a
            sw, ew = ew, sw
            flags.append("start_line/end_line arrived reversed -- swapped")
        s, e = float(a["start"]), float(b["end"])
        length = e - s
        # Length is reported, never enforced. See LONG_CLIP_S.
        if length > long_s:
            flags.append(f"{length:.0f}s of range proposed -- the cut stage has "
                         f"to find the moment inside it")
        if length < SHORT_CLIP_S:
            flags.append(f"only {length:.1f}s of range proposed")

        if anchor_ok(sw, a["text"]) is False:
            flags.append("start_words not in start line")
        if anchor_ok(ew, b["text"]) is False:
            flags.append("end_words not in end line")
        if not sw:
            flags.append("no start_words given")
        if not ew:
            flags.append("no end_words given")
        if c.get("self_contained") is False:
            flags.append("finder marked it not self-contained")

        body = [r for r in rows
                if pos[a["id"]] <= pos[r["id"]] <= pos[b["id"]]]
        out.append({
            "category": category,
            "rank": _num(c.get("rank")),
            # What the finder itself called its best, kept because `rank` below
            # is overwritten with post-sort position and the two are different
            # facts: "the finder's #1" and "what was left after two drops".
            "finder_rank": _num(c.get("rank")),
            "title": c.get("title"),
            "why": c.get("why"),
            "category_hint": c.get("category_hint"),
            "hook_strength": _num(c.get("hook_strength")),
            "self_contained": c.get("self_contained"),
            "confidence": c.get("confidence"),
            "signals_used": c.get("signals_used") or [],
            "start_line": a["id"], "end_line": b["id"],
            "start_words": sw, "end_words": ew,
            "start_s": round(s, 2), "end_s": round(e, 2),
            "duration_s": round(length, 2),
            # The payload is built from a cut of the source video, so its times
            # are clip-relative. Downstream cutting works on the source.
            "source_start_s": round(s + off, 2), "source_end_s": round(e + off, 2),
            "one_liner": length < 15.0,
            "text": " ".join(r["text"] for r in body if r["kind"] == "line"),
            "flags": flags,
        })

    out.sort(key=lambda c: (c["rank"] is None, c["rank"] or 0.0,
                            -(c["hook_strength"] or 0.0)))
    # Overlap is NOT sameness, and this stage no longer deletes anything for it.
    #
    # It used to drop any candidate overlapping a kept one by more than half.
    # Measured against twenty reels published from one interview by independent
    # accounts: a single 61s stretch became FOUR reels (11s, 19s, 17s, 31s) at
    # 1.5-1.8M plays each, every one of them overlapping the others by far more
    # than 50%. Under the old rule three of those four were unreachable.
    #
    # Near-identical ranges are still worth naming so the next stage does not
    # pay twice for one moment, so they are marked and kept rather than binned.
    kept = []
    for c in out:
        twin = next((k for k in kept if iou((c["start_s"], c["end_s"]),
                                            (k["start_s"], k["end_s"])) > DUP_IOU), None)
        if twin:
            c["flags"] = list(c["flags"]) + [
                f"near-identical range to {twin['start_line']}-{twin['end_line']}"]
            c["twin_of"] = f"{twin['start_line']}-{twin['end_line']}"
        kept.append(c)

    # How much of the video the finder accounted for -- as a clip, a near miss,
    # or an explicit skip. A low number means it stopped reading partway, which
    # is the failure mode long transcripts actually have.
    seen = set()
    for c in kept:
        seen.update(r["id"] for r in rows
                    if pos[c["start_line"]] <= pos[r["id"]] <= pos[c["end_line"]])
    for key, ka, kb in (("near_misses", "start_line", "end_line"),
                        ("skipped", "from_line", "to_line")):
        grp = raw.get(key) or []
        if not isinstance(grp, list):
            dropped.append({"category": category, "clip": None,
                            "reason": f"{key} was not a list"})
            continue
        for g in grp:
            if not isinstance(g, dict):
                dropped.append({"category": category, "clip": None,
                                "reason": f"{key} entry was not an object"})
                continue
            x, y = resolve(rows, g.get(ka), "fwd"), resolve(rows, g.get(kb), "back")
            if x and y and pos[x["id"]] <= pos[y["id"]]:
                seen.update(r["id"] for r in rows
                            if pos[x["id"]] <= pos[r["id"]] <= pos[y["id"]])
    cov = len(seen & set(line_ids)) / max(1, len(line_ids))
    return kept, dropped, cov


# ---- one category ---------------------------------------------------------

def run_category(cat, data, rows, off, key, model, effort, outdir, base,
                 prompts_dir=PROMPTS, url=None):
    t0 = time.time()
    system, grounding, task = compose(cat, prompts_dir)
    messages = [{"role": "system", "content": system},
                {"role": "user", "content": f"{grounding}\n\n\n{data}\n\n\n{task}"}]
    res = {"category": cat, "clips": [], "dropped": [], "near_misses": [],
           "skipped": [], "video_read": "", "coverage": 0.0, "usage": {},
           "error": None, "seconds": 0.0}
    try:
        content, reasoning, usage = call(messages, key, model, effort, url=url)
    except Exception as e:
        res["error"] = f"{type(e).__name__}: {str(e)[:200]}"
        res["seconds"] = round(time.time() - t0, 1)
        return res
    res["usage"] = usage
    res["seconds"] = round(time.time() - t0, 1)

    raw = llm.parse_json(content)
    if not isinstance(raw, dict):
        # Never lose an expensive answer to a parse failure. One stray
        # character anywhere in a 15k-character answer makes json.loads
        # reject all of it -- measured here as `"rank": 9",` on the tenth
        # clip, which threw away the nine good ones in front of it. Salvage
        # keeps every clip object that parses on its own and drops only the
        # broken one; it never edits a value.
        with open(os.path.join(outdir, f"{base}_{cat}_raw.txt"), "w",
                  encoding="utf-8") as f:
            f.write(content)
        rescued = llm.salvage_list(content, "clips")
        rescued_misses = llm.salvage_list(content, "near_misses")
        rescued_skipped = llm.salvage_list(content, "skipped")
        rescued_read = llm.salvage_field(content, "video_read")
        if rescued or rescued_misses or rescued_skipped or rescued_read:
            log(f"{cat}: response was not JSON -- salvaged "
                f"{len(rescued)} clip(s), {len(rescued_misses)} near miss(es), "
                f"{len(rescued_skipped)} skipped range(s)"
                + ("" if rescued_read else ", video_read not recovered"), "WARN")
            raw = {
                "clips": rescued,
                "near_misses": rescued_misses,
                "skipped": rescued_skipped,
                "video_read": rescued_read or "",
            }
            res["salvaged"] = True
        else:
            res["error"] = "response was not JSON (kept as _raw.txt)"
            return res

    # Everything below this point is local work on an answer that has already
    # been paid for, and none of it is worth the answer. This used to run bare:
    # one unexpected shape in the model's JSON raised out of run_category, out
    # of the worker thread, and out of the `with ThreadPoolExecutor` block --
    # taking four healthy finders' results and both step-1 artifacts with it.
    try:
        clips, dropped, cov = build_clips(raw, rows, off, cat)
    except Exception as e:
        with open(os.path.join(outdir, f"{base}_{cat}_raw.txt"), "w",
                  encoding="utf-8") as f:
            f.write(content)
        res["error"] = (f"answer arrived but could not be read: "
                        f"{type(e).__name__}: {str(e)[:200]} (kept as _raw.txt)")
        return res
    for i, c in enumerate(clips, 1):
        c["rank"] = i
        c["id"] = f"{cat[:3]}{i}"

    # Coverage is counted only from what the answer explicitly returned
    # (clips + near_misses + skipped). After a salvage, skipped and near_misses
    # are usually incomplete even when recovered, because the salvage regex only
    # catches well-formed array entries. A low number here after a salvage is
    # therefore a fact about what survived parsing, not about how much of the
    # video the model actually read -- so it is reported as unknown rather than
    # printed as a real measurement that would otherwise read as a red flag.
    coverage_value = None if res.get("salvaged") else round(cov, 3)

    res.update({"clips": clips, "dropped": dropped, "coverage": coverage_value,
                "coverage_note": (
                    "not measurable after a JSON salvage -- see 'salvaged'"
                    if res.get("salvaged") else None
                ),
                "video_read": str(raw.get("video_read") or ""),
                "near_misses": [x for x in (raw.get("near_misses") or [])
                                if isinstance(x, dict)]
                if isinstance(raw.get("near_misses") or [], list) else [],
                "skipped": [x for x in (raw.get("skipped") or [])
                            if isinstance(x, dict)]
                if isinstance(raw.get("skipped") or [], list) else [],
                "reasoning": reasoning})
    with open(os.path.join(outdir, f"{base}_{cat}.json"), "w",
              encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    return res


def report(path, results, dur):
    with open(path, "w", encoding="utf-8") as f:
        for r in results:
            cov_str = "unknown" if r["coverage"] is None else f"{r['coverage']:.0%}"
            f.write(f"\n{'=' * 74}\n{r['category'].upper()}  "
                    f"{len(r['clips'])} clips  coverage {cov_str}  "
                    f"{r['seconds']:.0f}s  ${float((r['usage'] or {}).get('cost') or 0):.4f}\n")
            if r["error"]:
                f.write(f"  ERROR {r['error']}\n")
                continue
            f.write(f"{r['video_read'].strip()}\n")
            for c in r["clips"]:
                f.write(f"\n  [{c['id']}] {mmss(c['source_start_s'])}"
                        f"-{mmss(c['source_end_s'])}  {c['duration_s']:.0f}s  "
                        f"hook {c['hook_strength']}/10  {c['confidence']}"
                        f"{'  ONE-LINER' if c['one_liner'] else ''}\n")
                f.write(f"    {c['title']}\n    {c['why']}\n")
                if c["signals_used"]:
                    f.write(f"    signals: {', '.join(map(str, c['signals_used']))}\n")
                for x in c["flags"]:
                    f.write(f"    !! {x}\n")
                f.write(f"    {c['text'][:400]}\n")
            # The two places a good clip is most likely to have ended up were
            # both invisible in this file, which is the one a person reads.
            if r.get("near_misses"):
                f.write("\n  NEAR MISSES (the finder's own close calls)\n")
                for m in r["near_misses"]:
                    f.write(f"    {m.get('start_line')}-{m.get('end_line')}  "
                            f"{str(m.get('why_not'))[:200]}\n")
            if r.get("dropped"):
                f.write("\n  DROPPED IN CODE, NOT BY THE MODEL\n")
                for d in r["dropped"]:
                    c = d.get("clip") or {}
                    title = c.get("title") if isinstance(c, dict) else None
                    f.write(f"    {str(title)[:60]}  --  {d.get('reason')}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True, help="the _payload.txt")
    ap.add_argument("--only", default=None,
                    help="comma-separated subset, e.g. motivational,emotional")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--effort", default="medium", choices=["low", "medium", "high", "max"])
    ap.add_argument("--outdir", default=None)
    ap.add_argument("--deepseek", action="store_true",
                    help="call DeepSeek's own API instead of OpenRouter")
    args = ap.parse_args()
    url = DEEPSEEK_URL if args.deepseek else None
    key_name = "DEEPSEEK_API_KEY" if args.deepseek else "OPENROUTER_API_KEY"

    tp = os.path.abspath(args.payload)
    jp = re.sub(r"\.txt$", ".json", tp)
    if not os.path.exists(tp) or not os.path.exists(jp):
        log(f"need both {os.path.basename(tp)} and its .json", "FATAL")
        sys.exit(2)
    with open(tp, encoding="utf-8") as f:
        data = f.read()
    with open(jp, encoding="utf-8") as f:
        doc = json.load(f)
    rows = doc["rows"]
    meta = doc.get("meta") or {}
    dur = float(meta.get("duration_s") or rows[-1]["end"])
    off = float(meta.get("clip_start_s") or 0.0)
    n_lines = sum(1 for r in rows if r["kind"] == "line")

    cats = [c.strip() for c in args.only.split(",")] if args.only else list(CATEGORIES)
    bad = [c for c in cats if not os.path.exists(os.path.join(PROMPTS, f"{c}.md"))]
    if bad:
        log(f"no prompt for: {', '.join(bad)}", "FATAL")
        sys.exit(2)

    n_cmt = sum(len(r.get("comments") or []) for r in rows)
    n_rep = sum(1 for r in rows if "replayed" in (r.get("marks") or []))
    if "audience" in cats and not (n_cmt or n_rep):
        log("audience finder has no comments and no replay marks to work "
            "from -- running it anyway, as asked", "WARN")

    outdir = os.path.abspath(args.outdir or os.path.dirname(tp))
    base = re.sub(r"_payload\.txt$", "", os.path.basename(tp))
    os.makedirs(outdir, exist_ok=True)
    key = llm.get_key(key_name)
    log(f"{n_lines} lines, {dur:.0f}s, ~{len(data) // 4000}k tokens of data, "
        f"{n_cmt} placed comments, {n_rep} replay peaks")
    log(f"{len(cats)} finders in parallel on {args.model} ({args.effort}): "
        f"{', '.join(cats)}")

    t0 = time.time()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(cats)) as ex:
        futs = {ex.submit(run_category, c, data, rows, off, key, args.model,
                          args.effort, outdir, base, url=url): c for c in cats}
        for f in concurrent.futures.as_completed(futs):
            # One finder's unexpected failure must never cost the others theirs.
            try:
                r = f.result()
            except Exception as e:
                cat = futs[f]
                log(f"{cat:<14} CRASHED  {type(e).__name__}: {str(e)[:160]}",
                    "WARN")
                results.append({"category": cat, "clips": [], "dropped": [],
                                "near_misses": [], "skipped": [],
                                "video_read": "", "coverage": None, "usage": {},
                                "error": f"{type(e).__name__}: {str(e)[:200]}",
                                "seconds": 0.0, "coverage_note": None})
                continue
            results.append(r)
            cost = float((r["usage"] or {}).get("cost") or 0)
            if r["error"]:
                log(f"{r['category']:<14} FAILED  {r['error']}", "WARN")
            else:
                rt = (r["usage"] or {}).get("reasoning_tokens", 0)
                cov_str = "unknown (salvaged)" if r["coverage"] is None else f"{r['coverage']:.0%}"
                log(f"{r['category']:<14} {len(r['clips'])} clips  "
                    f"coverage {cov_str}  {r['seconds']:.0f}s  "
                    f"${cost:.4f}  {rt} thinking tokens"
                    + (f"  ({len(r['dropped'])} dropped)" if r["dropped"] else ""))
                # A None coverage means the answer was salvaged from broken
                # JSON, which says nothing about how much the model actually
                # read -- so it must never be compared against the threshold
                # below, which is a real low-coverage warning for a clean answer.
                if r["coverage"] is not None and r["coverage"] < LOW_COVERAGE:
                    log(f"{r['category']:<14} accounted for only "
                        f"{r['coverage']:.0%} of the transcript -- it likely "
                        f"skimmed the middle; re-run this finder alone",
                        "WARN")
    results.sort(key=lambda r: cats.index(r["category"]))

    all_clips = [c for r in results for c in r["clips"]]
    cost = sum(float((r["usage"] or {}).get("cost") or 0) for r in results)
    stem = os.path.join(outdir, base)
    combined = {"meta": {"payload": tp, "model": args.model, "effort": args.effort,
                         "clip_start_s": off, "duration_s": round(dur, 2),
                         "lines": n_lines, "categories": cats,
                         "cost_usd": round(cost, 5),
                         "seconds": round(time.time() - t0, 1),
                         "speaker_names": meta.get("speaker_names") or {},
                         "video": meta.get("video") or {}},
                "by_category": {r["category"]: {
                    "video_read": r["video_read"], "coverage": r["coverage"],
                    "error": r["error"], "seconds": r["seconds"],
                    "near_misses": r["near_misses"], "skipped": r["skipped"],
                    "dropped": r["dropped"]} for r in results},
                "clips": all_clips}
    with open(stem + "_step1.json", "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
    report(stem + "_step1.txt", results, dur)

    failed = [r["category"] for r in results if r["error"]]
    log(f"{len(all_clips)} candidate clips from {len(cats) - len(failed)}/"
        f"{len(cats)} finders in {time.time() - t0:.0f}s, ${cost:.4f}",
        "WARN" if failed else "OK")
    print(f" {stem}_step1.txt\n {stem}_step1.json")
    # A video that genuinely has nothing still exits 0. Every finder failing is
    # a broken run, and the two must not look alike to whatever ran this.
    if not all_clips and failed:
        log(f"all {len(failed)} finder(s) failed -- a broken run, not a video "
            f"with nothing in it", "FATAL")
        sys.exit(1)


if __name__ == "__main__":
    main()
