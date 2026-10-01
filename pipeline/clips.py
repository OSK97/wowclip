"""Stage 2 — find the clips.

    python clips.py <video_id> [--categories motivational,emotional] [--effort medium]

Runs only after the user has looked at the gate's verdict and decided to go
ahead with this video, which is why it is a separate entry point rather than the
tail of run.py. Emits the same NDJSON events as stage 1 (see events.py).

    1. comments    YouTube API + a cheap triage model
    2. payload     line breaking, comment anchoring, replay marks
    3. finders     N category prompts, in parallel, one call each
    4. select      one call over every candidate: merge duplicates, drop junk
    5. cut         one call per surviving moment, in parallel
    6. curate      order the list for a human to read

NOTHING IS FETCHED THROUGH THE PROXY HERE. Stage 1 already pulled the
word-level transcript and the replay heatmap in a single extraction and wrote
them to the run store, so this stage starts by reading its own disk. That is
the whole reason the gate is worth running first: a video that gets rejected
costs one proxy call, and a video that gets accepted costs no more than that.

Comments are the exception, and deliberately. Stage 1 pulls a plain list of
them for the gate. This stage pulls them again through the clip project's own
collector, which additionally works out which comments name a real timestamp
and groups the rest into themes. That second pass runs a model over them, so it
is only worth paying for once somebody has committed to the video. The fetch
itself is free in practice: 100 comments per request against a 10,000/day
budget.
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time

import bridge
import events
import store
from config import INR_PER_USD, OPENROUTER_API_KEY, YOUTUBE_API_KEY

HERE = os.path.dirname(os.path.abspath(__file__))

# Medium reasoning for both whole-video nominations and exact-word cuts.
# Keep the output budget generous: reasoning and visible JSON share it.
# Explicit CLI flags still override these defaults.
FINDER_EFFORT = "medium"
SELECT_EFFORT = "medium"
CUT_EFFORT = "medium"
REFINE_EFFORT = SELECT_EFFORT      # the old single knob, kept for callers

# How many moments get cut at once. Each is one model call on a small window.
#
# Was 6, which turned 15 clips into three sequential waves — 523s of wall time
# for about 90s of work per wave. These calls are small (~5k prompt against the
# finder's 77k), so the concurrency that throttles a batch of finders is not the
# same risk here.
CUT_WORKERS = 12


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("video_id")
    p.add_argument(
        "--categories",
        default="",
        help="comma-separated finders to run; empty means every one",
    )
    p.add_argument("--effort", default=FINDER_EFFORT)
    p.add_argument("--refine-effort", dest="refine_effort", default=SELECT_EFFORT,
                   help="effort for the select pass")
    p.add_argument("--cut-effort", dest="cut_effort", default=CUT_EFFORT,
                   help="effort for the per-clip cut calls")
    p.add_argument(
        "--skip-select",
        action="store_true",
        help="no longer used — duplicate merging is arithmetic now and always "
             "runs. Kept so existing commands do not break.",
    )
    return p.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    args = parse_args()
    video_id = args.video_id
    started = time.time()
    timings: dict = {}
    # by_step records what each stage cost on its own. Without it the run only
    # knows its grand total, which is useless for working out which stage to
    # optimise — the first time a per-step cost table was wanted, select and cut
    # had already been summed together and could not be separated.
    costs = {
        "llm_inr": 0.0,
        "youtube_api_units": 0,
        "total_inr": 0.0,
        "by_step": {},
        "tokens_by_step": {},
    }

    def charge(step: str, usage: dict, note: str = "") -> float:
        """Record one stage's spend in rupees and return it."""
        usd = float((usage or {}).get("cost") or 0)
        inr = round(usd * INR_PER_USD, 4)
        costs["llm_inr"] = round(costs["llm_inr"] + inr, 4)
        costs["by_step"][step] = round(costs["by_step"].get(step, 0.0) + inr, 4)
        slot = costs["tokens_by_step"].setdefault(
            step, {"prompt": 0, "completion": 0, "reasoning": 0, "calls": 0}
        )
        slot["prompt"] += int((usage or {}).get("prompt_tokens") or 0)
        slot["completion"] += int((usage or {}).get("completion_tokens") or 0)
        slot["reasoning"] += int((usage or {}).get("reasoning_tokens") or 0)
        slot["calls"] += 1
        if note:
            events.log(f"[cost] {step}: ₹{inr:.4f} {note}")
        return inr

    if not OPENROUTER_API_KEY:
        events.fatal("OPENROUTER_API_KEY is not set, so no model can be called.")
        return 1

    # ---------------------------------------------------------------
    # What stage 1 left behind
    # ---------------------------------------------------------------
    transcript_path = store.path_for(video_id, "_final.json")
    stored = store.load(video_id, "_final.json")
    if not stored or not stored.get("words"):
        events.fatal(
            "The word-level transcript for this video is not on disk. Run the "
            "check first — clip finding reads what that step saved rather than "
            "fetching anything again."
        )
        return 1

    meta = stored.get("meta") or {}
    words = stored["words"]
    heat = store.load(video_id, "_heatmap.json") or {}
    metadata = store.load(video_id, "_metadata.json") or {}
    age = store.age_seconds(video_id, "_final.json")

    events.step_done(
        "reuse",
        "Reusing the transcript already fetched",
        (
            f"{len(words):,} word-level timings and "
            f"{len(heat.get('peaks') or [])} replay peaks read from disk "
            f"· nothing re-downloaded"
        ),
        {
            "words": len(words),
            "replay_peaks": len(heat.get("peaks") or []),
            "track": meta.get("track"),
            "age_seconds": age,
        },
    )

    try:
        find_clips, refine_clips, llm = bridge.load()
    except bridge.BridgeError as exc:
        events.fatal(str(exc))
        return 1

    wanted = [c.strip() for c in args.categories.split(",") if c.strip()]
    available = bridge.categories()
    if not wanted:
        wanted = list(available)
    unknown = [c for c in wanted if c not in available]
    if unknown:
        events.fatal(
            f"no prompt for {', '.join(unknown)}. Available: {', '.join(available)}"
        )
        return 1

    # ---------------------------------------------------------------
    # Step 1 — comments, with the triage the payload needs
    # ---------------------------------------------------------------
    events.step_start("comments2", "Reading comments for timestamps and themes")
    t0 = time.time()
    comments_path = None
    try:
        collector = bridge.load_comments()
        collected = collector.collect(
            video_id,
            YOUTUBE_API_KEY,
            OPENROUTER_API_KEY,
            dur=meta.get("length_s") or metadata.get("duration_s"),
            log=lambda m, *a: events.log(f"[comments] {m}"),
        )
        comments_path = store.write_comments(video_id, collected)
        stats = collected.get("stats") or {}
        triage_cost = float(((stats.get("llm") or {}).get("cost_usd") or 0))
        charge("comments", {"cost": triage_cost})
        costs["youtube_api_units"] += int(stats.get("pages") or 0)
        placed = len(collected.get("timestamped") or [])
        events.step_done(
            "comments2",
            "Reading comments for timestamps and themes",
            (
                f"{stats.get('raw', 0)} comments · {placed} name a real moment "
                f"· {len(collected.get('general') or [])} kept as overall reaction"
            ),
            {"timestamped": placed, "raw": stats.get("raw", 0)},
        )
    except Exception as exc:  # noqa: BLE001
        # Comments are a signal, never a requirement. A video with them off is
        # a normal video, and the finders read the transcript either way.
        events.step_skip(
            "comments2",
            "Reading comments for timestamps and themes",
            f"unavailable ({type(exc).__name__}) — the finders will read the transcript alone",
        )
    timings["comments"] = round(time.time() - t0, 2)

    # ---------------------------------------------------------------
    # Step 2 — payload
    # ---------------------------------------------------------------
    events.step_start("payload", "Building the reading the model gets")
    t0 = time.time()
    out_dir = store.run_dir(video_id)
    cmd = [
        sys.executable,
        os.path.join(bridge.CLIPS_DIR, "build_payload.py"),
        "--transcript",
        transcript_path,
        "--outdir",
        out_dir,
        "--clip-start",
        "0",
    ]
    if comments_path:
        cmd += ["--comments-json", comments_path]
    if heat.get("peaks"):
        cmd += ["--heatmap-json", store.path_for(video_id, "_heatmap.json")]
    if metadata:
        cmd += ["--metadata-json", store.path_for(video_id, "_metadata.json")]

    built = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=bridge.CLIPS_DIR,
    )
    payload_txt = os.path.join(out_dir, f"{video_id}_payload.txt")
    payload_json = os.path.join(out_dir, f"{video_id}_payload.json")
    if built.returncode != 0 or not os.path.exists(payload_txt):
        events.log((built.stdout or "") + (built.stderr or ""))
        events.step_fail(
            "payload", "Building the reading the model gets", "the payload build failed"
        )
        events.fatal(
            "The transcript could not be turned into a payload. The pipeline log "
            "has the detail."
        )
        return 1

    with open(payload_txt, encoding="utf-8") as f:
        payload_text = f.read()
    with open(payload_json, encoding="utf-8") as f:
        payload_doc = json.load(f)

    rows = payload_doc["rows"]
    pmeta = payload_doc.get("meta") or {}
    line_rows = [r for r in rows if r["kind"] == "line"]
    duration = float(pmeta.get("duration_s") or 0)
    offset = float(pmeta.get("clip_start_s") or 0.0)

    timings["payload"] = round(time.time() - t0, 2)
    events.step_done(
        "payload",
        "Building the reading the model gets",
        (
            f"{len(line_rows)} spoken lines split at real pauses · "
            f"{pmeta.get('comments_placed', 0)} comments pinned to the exact line "
            f"they talk about · {pmeta.get('replay_peaks', 0)} replay marks"
        ),
        {
            "lines": len(line_rows),
            "rows": len(rows),
            "comments_placed": pmeta.get("comments_placed", 0),
            "replay_peaks": pmeta.get("replay_peaks", 0),
            "chars": len(payload_text),
        },
    )
    events.note(
        "The transcript handed to the model carries line ids and no clock "
        "times, so a timestamp cannot be invented — an id either exists or the "
        "clip is thrown away."
    )

    # ---------------------------------------------------------------
    # Step 3 — the finders, in parallel
    # ---------------------------------------------------------------
    events.step_start("finders", f"Reading the video {len(wanted)} ways")
    t0 = time.time()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(wanted)) as pool:
        futures = {
            pool.submit(
                find_clips.run_category,
                category,
                payload_text,
                rows,
                offset,
                OPENROUTER_API_KEY,
                find_clips.MODEL,
                args.effort,
                out_dir,
                video_id,
            ): category
            for category in wanted
        }
        failures = []
        for future in concurrent.futures.as_completed(futures):
            category = futures[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{type(exc).__name__}: {exc}")
                events.note(f"{category}: failed — {type(exc).__name__}: {exc}")
                continue
            if result.get("error"):
                failures.append(str(result["error"]))
            results.append(result)
            usage = result.get("usage") or {}
            cost = float(usage.get("cost") or 0)
            charge("finders", usage)
            costs["by_step"][f"finder:{category}"] = round(cost * INR_PER_USD, 4)
            if result.get("error"):
                events.note(f"{category}: failed — {result['error']}")
            else:
                coverage_note = (
                    f"read {result['coverage']:.0%} of the transcript"
                    if result.get("coverage") is not None else
                    "coverage unknown after JSON recovery"
                )
                events.note(
                    f"{category}: {len(result['clips'])} candidate"
                    f"{'' if len(result['clips']) == 1 else 's'}, "
                    f"{coverage_note}, "
                    f"{usage.get('reasoning_tokens', 0):,} tokens of thinking, "
                    f"₹{cost * INR_PER_USD:.2f}"
                )

    results.sort(key=lambda r: wanted.index(r["category"]))
    candidates = [c for r in results for c in r["clips"]]
    timings["finders"] = round(time.time() - t0, 2)

    # Every finder failing is a broken run, not a video with nothing in it, and
    # the two must never look the same. Measured: an out-of-credit API key
    # returned 403 to all five finders and this reported "no candidate moments
    # found" and exited 0 — which reads as a verdict about the video and would
    # have been taken as one.
    if not candidates and failures:
        events.step_fail(
            "finders",
            f"Reading the video {len(wanted)} ways",
            f"all {len(failures)} readings failed to reach the model",
        )
        events.fatal(explain_failure(failures))
        return 1

    if not candidates:
        events.step_done(
            "finders",
            f"Reading the video {len(wanted)} ways",
            "no candidate moments found",
        )
        _finish(video_id, [], {}, timings, costs, started, payload_doc, results)
        return 0

    events.step_done(
        "finders",
        f"Reading the video {len(wanted)} ways",
        (
            f"{len(candidates)} candidate moment"
            f"{'' if len(candidates) == 1 else 's'} from "
            f"{len([r for r in results if not r.get('error')])} of {len(wanted)} readings"
        ),
        {
            "candidates": len(candidates),
            "by_category": {r["category"]: len(r["clips"]) for r in results},
            "coverage": {r["category"]: r["coverage"] for r in results},
        },
    )

    # ---------------------------------------------------------------
    # Steps 4 and 5 — select, then cut
    # ---------------------------------------------------------------
    step1_doc = {
        "meta": {
            "payload": payload_txt,
            "model": find_clips.MODEL,
            "effort": args.effort,
            "clip_start_s": offset,
            "duration_s": duration,
            "lines": len(line_rows),
            "categories": wanted,
            "video": metadata,
        },
        "by_category": {
            r["category"]: {
                "video_read": r["video_read"],
                "coverage": r["coverage"],
                "error": r["error"],
                "near_misses": r["near_misses"],
                "skipped": r["skipped"],
                "dropped": r["dropped"],
            }
            for r in results
        },
        "clips": candidates,
    }
    store.save(video_id, "_step1.json", step1_doc)

    # ---------------------------------------------------------------
    # Merging duplicates — in code, not in a model
    # ---------------------------------------------------------------
    #
    # There used to be an LLM pass here ("Deciding which moments ship") that read
    # every candidate at once and merged or dropped them. It is gone.
    #
    # What it was actually deciding did not need a model. Two candidates are the
    # same moment when they sit on the same seconds AND run to about the same
    # length, and that is arithmetic. Everything else it did was judgement this
    # system does not want at this point: it could drop a moment, and a dropped
    # moment is unrecoverable, while an extra one costs a person one click.
    #
    # It also cost real time and money for that privilege — on a 3-hour video, 38
    # seconds and 0.34 rupees of 79%-reasoning tokens to merge nothing at all
    # (15 candidates in, 15 kept, 0 dropped).
    #
    # `cluster` applies the rule; `label_groups` fills in the one useful thing the
    # pass produced, which category's boundary rules the cut stage should use.
    events.step_start("merge", "Merging duplicate moments")
    t0 = time.time()
    before = len(candidates)
    groups = refine_clips.label_groups(refine_clips.cluster(candidates))
    merged = before - len(groups)
    timings["merge"] = round(time.time() - t0, 2)

    events.step_done(
        "merge",
        "Merging duplicate moments",
        (
            f"{before} candidate{'' if before == 1 else 's'} → {len(groups)} "
            f"moment{'' if len(groups) == 1 else 's'}"
            + (f", {merged} folded in as duplicates" if merged else
               ", none were duplicates")
        ),
        {"candidates": before, "moments": len(groups), "merged": merged},
    )
    events.note(
        f"Two candidates count as one moment only when they overlap by more than "
        f"{refine_clips.SAME_MOMENT_IOU:.0%} AND their lengths are within "
        f"{refine_clips.SAME_MOMENT_SLACK_S:.0f}s of each other. A short "
        f"punchline inside a longer build fails the length test, so it stays its "
        f"own reel. Nothing is dropped here — this is arithmetic, not a verdict."
    )
    dropped_in_select: list = []

    events.step_start("cut", f"Cutting {len(groups)} moment(s) to exact words")
    t0 = time.time()
    # Each moment is told which neighbours are being cut separately, so four
    # cuts of one stretch stay four clips instead of all widening into the same
    # long one.
    refine_clips.mark_siblings(groups)
    cut_prompt_path = os.path.join(bridge.PROMPTS_DIR, "refine_cut.md")
    # The payload knows who is speaking when diarization ran; passing None here
    # left render()'s speaker mapping inert and the model reading raw labels.
    speaker_names = pmeta.get("speaker_names") or {}
    real_words = match_words(refine_clips, words)
    if not real_words:
        events.step_fail(
            "cut",
            f"Cutting {len(groups)} moment(s) to exact words",
            "the transcript has no per-word timings to cut on",
        )
        events.fatal(
            "This track carries no word-level timings, so a clip cannot be cut "
            "on an exact word."
        )
        return 1
    cut_results = []
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, min(CUT_WORKERS, len(groups)))
    ) as pool:
        futures = {
            pool.submit(
                refine_clips.refine_one,
                group,
                rows,
                real_words,
                # One category's boundary rules per call, not all six.
                refine_clips.cut_prompt_for(group.get("cut_for"), cut_prompt_path),
                OPENROUTER_API_KEY,
                find_clips.MODEL,
                args.cut_effort,
                names=speaker_names,
                pad_before=refine_clips.PAD_BEFORE_S,
                pad_after=refine_clips.PAD_AFTER_S,
            ): group
            for group in groups
        }
        for future in concurrent.futures.as_completed(futures):
            # One moment failing must never cost the others theirs.
            try:
                cut_results.append(future.result())
            except Exception as exc:  # noqa: BLE001
                failed_group = futures[future]
                problem = f"{type(exc).__name__}: {str(exc)[:200]}"
                cut_results.append(
                    {
                        "group": failed_group,
                        "usage": {},
                        "seconds": 0.0,
                        "error": problem,
                        "clip": refine_clips.candidate_fallback(
                            failed_group, real_words, problem),
                    }
                )

    for result in cut_results:
        charge("cut", result.get("usage") or {})

    dropped_short: list = []
    dropped_dup: list = []
    clips = refine_clips.finalise(
        [r["clip"] for r in cut_results if r.get("clip")],
        rows,
        offset,
        video_id,
        dropped_short,
        dropped_dup,
    )
    timings["cut"] = round(time.time() - t0, 2)

    failures = [r["error"] for r in cut_results if r.get("error")]
    needs_review = sum(c.get("cut_status") == "needs_review" for c in clips)
    diagnostics = [
        {"group": r.get("group"), "error": r.get("error"),
         "raw": r.get("raw"), "seconds": r.get("seconds"),
         "usage": r.get("usage")}
        for r in cut_results if r.get("error") or r.get("salvaged")
    ]
    if diagnostics:
        store.save(video_id, "_cut_diagnostics.json", diagnostics)
    # Everything a moment can turn into, gathered in one place and carried all
    # the way to the artifact. This is where a clip used to disappear: `failures`
    # was never passed to _finish, `r["dropped"]` was never read at all, and the
    # UI's "Dropped as duplicates or unusable" list showed only select-pass
    # drops — which reads as a complete account of what was lost and was not one.
    # Measured on 4Vz6L8B73i4: the most-commented line in the whole video went
    # into this stage and left no trace but the integer 1.
    lost = []
    for result in cut_results:
        group = result.get("group") or {}
        where = f"{refine_clips.mmss(group.get('start_s', 0) + offset)}"
        title = next(
            (m.get("title") for m in (group.get("members") or []) if m.get("title")),
            "untitled",
        )
        if result.get("dropped"):
            lost.append(f"{where} {title} — the cut model rejected it: {result['dropped']}")
        elif result.get("error") and not result.get("clip"):
            lost.append(f"{where} {title} — could not be cut: {result['error']}")
    lost += [f"too short to publish: {d}" for d in dropped_short]
    lost += [f"duplicate seconds: {d}" for d in dropped_dup]

    events.step_done(
        "cut",
        f"Cutting {len(groups)} moment(s) to exact words",
        (
            f"{len(clips) - needs_review} exact cut(s) · "
            f"{needs_review} approximate cut(s)"
            + (" need review" if needs_review else "")
            + (f" · {len(lost)} moment(s) did not survive" if lost else "")
        ),
        {"clips": len(clips), "failed": len(failures),
         "needs_review": needs_review, "lost": len(lost)},
    )
    for result in cut_results:
        if (result.get("clip") or {}).get("cut_status") == "needs_review":
            events.note(f"cut needs review: {result['clip'].get('title') or 'untitled'}")
    for d in lost:
        events.note(f"lost in cutting: {d}")

    # A total wipeout is a failed run, not a video with nothing in it, and the
    # two must not look the same to whoever reads the result.
    if not clips and failures:
        events.fatal(
            f"Every one of the {len(failures)} cut calls failed, so this is a "
            f"broken run rather than a video with nothing in it. First error: "
            f"{failures[0][:160]}"
        )
        return 1

    _finish(
        video_id, clips, dropped_in_select, timings, costs, started, payload_doc,
        results, lost,
    )
    return 0


def _finish(
    video_id: str,
    clips: list,
    dropped_in_select: list,
    timings: dict,
    costs: dict,
    started: float,
    payload_doc: dict,
    results: list,
    lost_in_cutting: list | None = None,
):
    """Order the clips for a person, write them out, and report."""
    ordered = curate(clips)
    finder_dropped = [
        f"{r['category']}: {(d['clip'].get('title') or 'untitled') if isinstance(d.get('clip'), dict) else 'untitled'} "
        f"— {d.get('reason') or 'could not map this nomination'}"
        for r in results for d in (r.get('dropped') or [])
        if isinstance(d, dict)
    ]

    costs["total_inr"] = round(costs["llm_inr"], 4)
    doc = {
        "meta": {
            "video_id": video_id,
            "video": (payload_doc.get("meta") or {}).get("video") or {},
            "categories": [r["category"] for r in results],
            "readings": {
                r["category"]: {
                    "video_read": r.get("video_read") or "",
                    "coverage": r.get("coverage"),
                    "error": r.get("error"),
                    "near_misses": r.get("near_misses") or [],
                    "skipped": r.get("skipped") or [],
                }
                for r in results
            },
            "dropped_in_select": [why for _, why in dropped_in_select],
            "dropped_in_finders": finder_dropped,
            "lost_in_cutting": list(lost_in_cutting or []),
            "timings": timings,
            "costs": costs,
            "seconds": round(time.time() - started, 2),
        },
        "clips": ordered,
    }
    store.save(video_id, "_clips.json", doc)

    events.report({"timings": timings, "costs": costs})
    events.clips(
        {
            "video_id": video_id,
            "clips": ordered,
            "readings": doc["meta"]["readings"],
            "dropped": (doc["meta"]["dropped_in_finders"]
                        + doc["meta"]["dropped_in_select"]
                        + doc["meta"]["lost_in_cutting"]),
        }
    )
    events.done(
        {
            "video_id": video_id,
            "clip_count": len(ordered),
            "total_seconds": round(time.time() - started, 2),
        }
    )


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

def explain_failure(failures: list) -> str:
    """Turn a wall of identical transport errors into something actionable.

    When every reading fails the same way the cause is almost never the video,
    and the message the user sees should say what to actually do about it rather
    than repeating a status code five times.
    """
    joined = " ".join(failures).lower()
    first = failures[0][:160] if failures else "unknown error"

    if "403" in joined or "forbidden" in joined:
        return (
            "Every reading was refused by the model provider with 403. That is "
            "almost always an API key with no credit left or a key that has been "
            "disabled — check the spend limit on your OpenRouter key. Nothing is "
            "wrong with this video, and the transcript is still on disk, so this "
            "can be re-run for free once the key works."
        )
    if "429" in joined or "rate" in joined:
        return (
            "Every reading was rate-limited by the model provider. This clears "
            "on its own — wait a few minutes and re-run. The transcript is "
            "already on disk, so the retry costs no bandwidth."
        )
    if "401" in joined:
        return (
            "The model provider rejected the API key (401). Check "
            "OPENROUTER_API_KEY in .env.local. The transcript is on disk, so a "
            "re-run costs no bandwidth."
        )
    if "timed out" in joined or "timeout" in joined:
        return (
            "Every reading timed out before the model answered. The provider is "
            "likely overloaded. The transcript is on disk, so re-running is free."
        )
    return (
        f"Every reading failed before returning anything, so this is a broken "
        f"run rather than a video with nothing in it. First error: {first}"
    )


def match_words(refine_clips, words: list) -> list:
    """Prepare the word list the cut stage matches phrases against.

    Two things have to happen and neither is optional:

    Sound tags are removed. "[Applause]" carries a timestamp but is not speech,
    and a clip must never be cut on it. The payload still shows the tag; this
    list just cannot land there.

    Each word gets a `t` field — itself, stripped of punctuation and
    lowercased. That is what the fuzzy matcher compares against, because the
    model copies a phrase out of a transcript that has invented punctuation and
    inconsistent case. Without it, matching runs on raw tokens and fails on a
    comma.

    The stripping regex is taken from the refine module rather than rewritten
    here, so the two can never disagree about what counts as punctuation.
    """
    strip = refine_clips._STRIP
    prepared = [
        {
            "word": w["word"],
            "t": strip.sub("", w["word"]).lower(),
            "start": float(w["start"]),
            "end": float(w["end"]),
        }
        for w in words
        if (w.get("word") or "").strip() and w.get("kind") != "tag"
    ]
    prepared.sort(key=lambda w: (w["start"], w["end"]))
    return prepared


_CONFIDENCE_RANK = {"high": 2, "medium": 1, "low": 0}


def curate(clips: list) -> list:
    """Put the clips in the order a person should read them.

    Deliberately NOT ordered by hook_strength. That number is about the first
    three seconds only, and the best clip in a video is regularly a quiet
    opening that pays off later — the "Eureka moment is a dangerous lie" clip
    scored 6/10 on hook and was the strongest thing in its video. Sorting by it
    buries exactly the material this system exists to find.

    What decides the order instead:

      1. The model's confidence in the clip AS CUT, which is a judgement about
         whether it stands alone and lands, not about how it opens.
      2. Whether real people are behind it. A viewer commenting on that exact
         second, or YouTube's replay data peaking inside the clip, is evidence
         from outside the model, and it outranks anything the model thought.
      3. How many independent readings found the same moment. Two finders
         arriving at one stretch from different angles is agreement.
      4. Time order, so equals read in the order they happen.

    Every clip keeps its rank; nothing is hidden. The UI shows the first few and
    puts the rest behind a control.
    """

    def audience_weight(clip: dict) -> int:
        weight = 0
        for item in clip.get("evidence") or []:
            kind = item.get("kind")
            if kind == "comments":
                # People, not comment rows.
                weight += 2 + int(item.get("count") or 0)
            elif kind == "replayed":
                weight += 2
        return weight

    ordered = sorted(
        clips,
        key=lambda c: (
            -_CONFIDENCE_RANK.get(str(c.get("confidence", "")).lower(), 0),
            -audience_weight(c),
            -len(c.get("nominated_by") or []),
            c.get("source_start_s", 0),
        ),
    )

    for i, clip in enumerate(ordered, 1):
        clip["rank"] = i
        clip["id"] = f"clip{i}"
        clip["title"] = title_for(clip)
        clip["description"] = clip.get("description") or ""
        clip["why_chosen"] = why_chosen(clip)
    return ordered


# A clip is identified by its title everywhere downstream, so it cannot be
# empty. Measured: the cut stage occasionally returns a clip with every other
# field populated and no title at all, which rendered as a blank row.
TITLE_WORDS = 12


def title_for(clip: dict) -> str:
    """The clip's title, or the best honest substitute.

    Falls back through: what the cut stage named it, what the finder that
    nominated it named it, then the clip's own opening words. The last option is
    not a good title but it is always true, which beats an empty row.
    """
    given = (clip.get("title") or "").strip()
    if given:
        return given

    for candidate in clip.get("step1") or []:
        inherited = (candidate.get("title") or "").strip()
        if inherited:
            return inherited

    words = (clip.get("transcript") or "").split()
    if words:
        opening = " ".join(words[:TITLE_WORDS])
        return opening + ("…" if len(words) > TITLE_WORDS else "")

    return "Untitled clip"


def why_chosen(clip: dict) -> dict:
    """The case for this clip, separated into what was measured and what was read.

    Kept apart on purpose. "Nine viewers commented on this second" is a fact
    that came out of YouTube's API; "this removes the excuse the viewer is
    holding" is a model's reading of the words. Presenting them as one list
    would let the second borrow the authority of the first.
    """
    measured, counts = [], {}
    for item in clip.get("evidence") or []:
        kind = item.get("kind")
        counts[kind] = counts.get(kind, 0) + 1
        text = item.get("text") or ""
        if kind == "comments":
            measured.append(
                {
                    "kind": "comments",
                    "text": text,
                    "quote": item.get("top_comment"),
                    "likes": item.get("top_likes"),
                }
            )
        elif kind == "replayed":
            measured.append(
                {
                    "kind": "replayed",
                    "text": "YouTube's most-replayed data peaks inside this clip",
                }
            )
        elif kind in ("pause", "reaction", "delivery"):
            measured.append({"kind": kind, "text": text})

    found_by = clip.get("nominated_by") or []
    reasons = [
        s.get("why") for s in (clip.get("step1") or []) if s.get("why")
    ]

    return {
        # Facts, from YouTube or from arithmetic on the timings.
        "measured": measured,
        # The model's reading of the words.
        "reading": reasons[0] if reasons else (clip.get("description") or ""),
        "found_by": found_by,
        "agreement": len(found_by),
        "boundary": clip.get("boundary_note") or "",
        "has_audience": any(
            m["kind"] in ("comments", "replayed") for m in measured
        ),
    }


if __name__ == "__main__":
    sys.exit(main())
