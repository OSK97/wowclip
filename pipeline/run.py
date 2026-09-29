"""Pipeline orchestrator.

    python run.py <video_id> [--title "..." --duration 3600 ...]

Emits NDJSON progress events on stdout (see events.py). Diagnostics go to
stderr so they never corrupt the stream.

Flow:

    1. parallel   two lanes at once
         lane A   yt-dlp via GProxy       captions + heatmap in ONE call
         lane B   YouTube API, free       comments
    2. analyse    local, instant          coverage, gaps, bursts, repetition
    3. verdict    LLM                     PASS/FAIL, score, evidence

Two consolidations worth knowing about, both aimed at the proxy step, which is
the bottleneck:

Subtitles and heatmap come from one extraction. They used to be two separate
yt-dlp runs, which meant paying for the same watch-page fetch twice — and that
fetch is where essentially all the proxy bandwidth goes.

Caption discovery is not a separate request either. The YouTube captions.list
endpoint reports the same auto-vs-manual split that yt-dlp hands back as two
dicts, but it cost 50 quota units and a sequential round trip before this step
could even begin. Dropping it took quota from 52 units per video to 2.
"""

import argparse
import concurrent.futures
import sys
import time

import analytics
import bouncer
import comments as comments_mod
import events
import heatmap as heatmap_mod
import store
import transcript as transcript_mod
import ytdlp_fetch
from config import (
    GPROXY_USD_PER_GB,
    INR_PER_USD,
    MAX_COMMENTS_FOR_LLM,
    TRANSCRIPT_WORDS_PER_LINE,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("video_id")
    p.add_argument("--title", default="")
    p.add_argument("--channel", default="")
    p.add_argument("--duration", type=int, default=0)
    p.add_argument("--views", default="")
    p.add_argument("--likes", default="")
    p.add_argument("--comments", default="")
    # YouTube's declared audio language, from the validate step. Used to tell
    # the real ASR track apart from its machine translations.
    p.add_argument("--audio-lang", dest="audio_lang", default="")
    return p.parse_args()


def _finish(
    video_id: str,
    verdict: dict,
    timings: dict,
    costs: dict,
    started: float,
    clips_ready: bool = False,
):
    events.verdict(verdict)
    events.report({"timings": timings, "costs": costs})
    events.done(
        {
            "video_id": video_id,
            "status": verdict["status"],
            "score": verdict.get("score", 0),
            # Whether clip finding can run without fetching anything again.
            # The UI uses this to decide if it can offer to go ahead.
            "clips_ready": clips_ready,
            "total_seconds": round(time.time() - started, 2),
        }
    )


def main() -> int:
    # Windows consoles default to cp1252, which explodes on Devanagari.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    args = parse_args()
    video_id = args.video_id
    started = time.time()

    metadata = {
        "videoId": video_id,
        "title": args.title,
        "channel": args.channel,
        "durationSeconds": args.duration,
        "viewCount": args.views,
        "likeCount": args.likes,
        "commentCount": args.comments,
    }

    timings: dict = {}
    costs: dict = {
        "youtube_api_units": 0,
        "proxy_bytes_measured": 0,
        "proxy_bytes_estimated": 0,
        "proxy_inr": 0.0,
        "llm_inr": 0.0,
        "total_inr": 0.0,
    }

    # ---------------------------------------------------------------
    # Step 1 — two lanes in parallel
    #
    # There is deliberately no separate caption-discovery request here. The
    # YouTube captions.list endpoint reports the same auto-vs-manual split that
    # yt-dlp already returns as two dicts, but it costs 50 quota units and a
    # sequential round trip before this step could even start.
    # ---------------------------------------------------------------
    events.step_start("fetch", "Reading captions and replay data")
    events.step_start("comments", "Fetching comments")

    fetched = None
    comments_data = None
    no_captions = False
    lane_start = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        future_fetch = pool.submit(
            ytdlp_fetch.fetch,
            video_id,
            args.audio_lang or "",
            True,  # always prefer speech recognition over uploaded captions
        )
        future_comments = pool.submit(comments_mod.fetch, video_id)

        # -- lane A: subtitles + heatmap (required) --
        try:
            fetched = future_fetch.result()
            kind_label = (
                "speech recognition"
                if fetched["kind"] == "auto"
                else "creator-uploaded captions"
            )
            events.step_done(
                "fetch",
                "Reading captions and replay data",
                (
                    f"{kind_label}, {fetched['subtitle_language']}, untranslated"
                    f" · replay data included · {fetched['seconds']}s"
                ),
                {
                    "kind": fetched["kind"],
                    "subtitle_language": fetched["subtitle_language"],
                    "audio_language": fetched["audio_language"],
                    "automatic_tracks": fetched["automatic_track_count"],
                    "manual_tracks": fetched["manual_track_count"],
                },
            )
            events.note(fetched["selection_note"])
            if fetched["kind"] == "manual":
                events.note(
                    "Manual captions can be partial — creators sometimes "
                    "caption only part of a video. Coverage is measured next "
                    "and the model is told to treat partial captions carefully."
                )
        except Exception as exc:  # noqa: BLE001
            if str(exc) == "NO_CAPTIONS":
                no_captions = True
                events.step_fail(
                    "fetch",
                    "Reading captions and replay data",
                    "This video has no caption track of any kind",
                )
            else:
                events.step_fail(
                    "fetch", "Reading captions and replay data", str(exc)
                )

        # -- lane B: comments (optional) --
        try:
            comments_data = future_comments.result()
            costs["youtube_api_units"] += comments_data["quota_units"]
            if comments_data.get("disabled"):
                events.step_skip(
                    "comments", "Fetching comments", "Comments are disabled"
                )
            else:
                events.step_done(
                    "comments",
                    "Fetching comments",
                    (
                        f"{comments_data['fetched']} pulled over "
                        f"{comments_data['pages']} "
                        f"{'page' if comments_data['pages'] == 1 else 'pages'}, "
                        f"{comments_data['unique']} unique after dedupe, "
                        f"kept top {comments_data['kept']} "
                        f"({comments_data['with_timestamp']} contain timestamps)"
                        + (
                            " — stopped early on the time budget"
                            if comments_data.get("truncated")
                            else ""
                        )
                    ),
                    {
                        "fetched": comments_data["fetched"],
                        "unique": comments_data["unique"],
                        "kept": comments_data["kept"],
                        "with_timestamp": comments_data["with_timestamp"],
                        "cap": MAX_COMMENTS_FOR_LLM,
                    },
                )
        except Exception as exc:  # noqa: BLE001
            events.step_fail("comments", "Fetching comments", str(exc))

    timings["fetch_parallel"] = round(time.time() - lane_start, 2)

    if no_captions:
        verdict = bouncer.precheck({"needs_asr": True})
        _finish(video_id, verdict, timings, costs, started)
        return 0

    if not fetched:
        events.fatal(
            "The transcript could not be fetched, so there is nothing to "
            "analyse. This is usually a proxy or rate-limit problem. Try again."
        )
        return 1

    # Proxy bandwidth -> rupees.
    measured = fetched["bytes_measured"]
    estimated = fetched["bytes_estimated"]
    costs["proxy_bytes_measured"] = measured
    costs["proxy_bytes_estimated"] = estimated
    proxy_gb = (measured + estimated) / 1_000_000_000
    costs["proxy_inr"] = round(proxy_gb * GPROXY_USD_PER_GB * INR_PER_USD, 4)

    # ---------------------------------------------------------------
    # Step 2 — parse and measure (local, free)
    # ---------------------------------------------------------------
    events.step_start("analyse", "Measuring transcript")
    t0 = time.time()

    segments = transcript_mod.parse(fetched["subtitle_json"])
    if not segments:
        events.step_fail("analyse", "Measuring transcript", "Parsed to zero lines")
        events.fatal("The subtitle file could not be parsed into any lines.")
        return 1

    duration = args.duration or (segments[-1]["start"] + 1)
    stats = analytics.analyse(segments, duration)
    heat = heatmap_mod.shape(fetched["heatmap_raw"])

    # Keep the expensive half of this download. The same json3 file that gave
    # us lines also carries a start time for every individual word, and the
    # clip-finding stage cuts on those. Writing them here means that stage
    # never touches the proxy again — it is the whole reason a second fetch is
    # not needed once the user decides to go ahead.
    cut_ready = transcript_mod.cut_words(fetched["subtitle_json"])
    word_ratio = transcript_mod.word_level_ratio(cut_ready)
    stored = None
    if cut_ready:
        store.write_transcript(
            video_id,
            cut_ready,
            {
                "video_id": video_id,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "length_s": round(float(duration), 2),
                "clip_start_s": 0.0,
                "clip_end_s": None,
                "source": "youtube",
                "track": {
                    "code": fetched["subtitle_language"],
                    "kind": fetched["kind"],
                    "translated": False,
                    "why": fetched["selection_note"],
                },
                "language": fetched["audio_language"] or fetched["subtitle_language"],
                "words": len(cut_ready),
                "word_level_ratio": round(word_ratio, 3),
                "seconds": fetched["seconds"],
            },
        )
        store.write_heatmap(
            video_id,
            len(heat["points"]) if heat["available"] else 0,
            heat["peaks"] if heat["available"] else [],
        )
        store.write_metadata(
            video_id,
            {
                "video_id": video_id,
                "title": args.title,
                "channel": args.channel,
                "duration_s": float(duration),
                "views": args.views or None,
            },
        )
        stored = store.run_dir(video_id)

    timings["analyse"] = round(time.time() - t0, 2)

    events.step_done(
        "analyse",
        "Measuring transcript",
        (
            f"{stats['line_count']} lines, {stats['word_count']:,} words, "
            f"{int(stats['coverage_ratio'] * 100)}% speech coverage, "
            f"longest unbroken stretch {stats['longest_burst']}s"
        ),
        {
            "line_count": stats["line_count"],
            "word_count": stats["word_count"],
            "coverage_ratio": stats["coverage_ratio"],
            "longest_burst": stats["longest_burst"],
            "gap_count": stats["gap_count"],
            "repetition_ratio": stats["repetition_ratio"],
        },
    )

    if heat["available"]:
        events.note(
            f"Replay data: {len(heat['points'])} points, "
            f"{len(heat['peaks'])} peaks above threshold (came free with the same call)"
        )
    else:
        events.note(
            "No replay data for this video. YouTube only computes it above a "
            "view threshold, so this is normal."
        )

    if stored:
        events.note(
            f"Kept {len(cut_ready):,} word-level timings and the replay peaks "
            f"on disk ({int(word_ratio * 100)}% of entries are single words). "
            "If you go ahead with this video, clip finding reads these instead "
            "of paying for the proxy a second time."
        )
    else:
        events.note(
            "This track carries no per-word timings, so clip finding would "
            "have to cut on caption boundaries rather than on exact words."
        )

    # ---------------------------------------------------------------
    # Step 3 — verdict
    # ---------------------------------------------------------------
    events.step_start("verdict", "Judging clip potential")

    comment_list = comments_data["comments"] if comments_data else []
    comment_summary = (
        f"Showing top {len(comment_list)} of {comments_data['unique']} unique "
        f"comments, ranked by likes with a 5x boost for comments containing "
        f"timestamps."
        if comments_data and comment_list
        else ""
    )

    payload = bouncer.build_payload(
        metadata=metadata,
        captions={
            "kind": fetched["kind"],
            "language": fetched["subtitle_language"],
        },
        stats_brief=analytics.to_brief(stats, duration),
        transcript_lines=transcript_mod.to_lines(
            segments, TRANSCRIPT_WORDS_PER_LINE
        ),
        comment_lines=comments_mod.to_lines(comment_list),
        comment_summary=comment_summary,
        heatmap_lines=heatmap_mod.to_lines(heat["peaks"]) if heat["available"] else "",
    )

    events.note(f"Payload assembled: {len(payload):,} characters")

    t0 = time.time()
    try:
        verdict = bouncer.ask(payload)
    except Exception as exc:  # noqa: BLE001
        events.step_fail("verdict", "Judging clip potential", str(exc))
        events.fatal(f"The model call failed: {exc}")
        return 1

    timings["verdict"] = round(time.time() - t0, 2)
    costs["llm_inr"] = verdict["cost_inr"]
    costs["total_inr"] = round(costs["proxy_inr"] + costs["llm_inr"], 4)
    costs["llm_tokens"] = verdict["total_tokens"]
    costs["llm_cost_source"] = verdict["cost_source"]
    costs["model"] = verdict["model"]

    events.step_done(
        "verdict",
        "Judging clip potential",
        f"{verdict['status']} · score {verdict['score']}/100 · {verdict['llm_seconds']}s",
    )

    _finish(video_id, verdict, timings, costs, started, clips_ready=bool(stored))
    return 0


if __name__ == "__main__":
    sys.exit(main())
