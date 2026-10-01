"""
The one command.

    python -m wowclip run <youtube-link>

Everything else is a flag on that. Sub-commands exist for when you want to stop
part-way -- `build` to get a payload without spending anything on the finder,
`show` to see what is already cached.
"""

import argparse
import json
import os
import sys
import time

from . import fetch, finder, payload as payload_mod, report_html, verify
from .cache import Cache, REFRESHABLE
from .compose import compose
from .config import CACHE_ROOT, PROMPT_DIR


def _utf8():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


def rule(title=""):
    if title:
        pad = max(0, 68 - len(title) - 3)
        return f"-- {title} " + "-" * pad
    return "-" * 70


# ══════════════════════════════════════════════════════════════════════════
#  STAGES
# ══════════════════════════════════════════════════════════════════════════

def stage_fetch(cache, link, video_id, skip_bouncer, log):
    log(rule("FETCH"))
    if not skip_bouncer:
        v = fetch.run_bouncer(cache, link, log=log)
        if v.get("decision") == "NO_GO":
            raise SystemExit(
                f"\nBouncer says NO_GO: {v.get('reason') or v.get('block', {})}\n"
                f"Run again with --skip-bouncer to force it through.")

    meta = fetch.fetch_metadata(cache, video_id, log=log)
    parsed, heatmap = fetch.fetch_captions_and_heatmap(
        cache, video_id, declared_lang=meta.get("language"), log=log)
    comments = fetch.fetch_comments(cache, video_id, parsed=parsed, log=log)
    return meta, parsed, heatmap, comments


def stage_compose(cache, parsed, duration_s, log):
    log(rule("TRANSCRIPT"))
    result = compose(parsed)
    rep = result["report"]

    for w in rep.get("warnings", []):
        log(f"  !! {w}")

    ls = rep.get("line_stats", {})
    log(f"  lines         {ls.get('lines', 0):,} "
        f"({ls.get('youtube_chunks', 0):,} YouTube chunks, median "
        f"{ls.get('mean_words', 0)} words)")
    ps = rep.get("pause_stats", {})
    if ps:
        log(f"  pauses        {ps.get('pauses', 0)} pauses, "
            f"{ps.get('gaps', 0)} gaps "
            f"(detected from timestamp gaps)")
    log(f"  size          {rep.get('chars', 0):,} chars "
        f"(~{rep.get('est_tokens', 0):,} tokens)")

    cache.write_text("transcript", result["text"])
    cache.write_json("lines", result["blocks"])
    cache.write_json("events", {"placed": result["events"]})
    return result


def stage_payload(cache, category, result, meta, comments, heatmap,
                  duration_s, note, log):
    log(rule("PAYLOAD"))
    prompt_path = os.path.join(PROMPT_DIR, f"{category}.md")
    if not os.path.exists(prompt_path):
        avail = ", ".join(sorted(
            f[:-3] for f in os.listdir(PROMPT_DIR) if f.endswith(".md")))
        raise SystemExit(f"no prompt at {prompt_path}. Available: {avail}")

    text, stats = payload_mod.build(
        prompt_path=prompt_path,
        transcript_text=result["text"],
        meta=meta, comments=comments, heatmap=heatmap,
        lines=result["blocks"], duration_s=duration_s, extra_note=note)

    name = payload_mod.safe_filename(meta.get("title") if meta else None,
                                     cache.video_id, category)
    path = cache.write_build(name, text)
    log(f"  prompt        {os.path.basename(prompt_path)}")
    log(f"  comments      {stats.get('comments', 0)}")
    log(f"  heatmap peaks {stats.get('heatmap_peaks', 0)}")
    log(f"  size          {stats['chars']:,} chars (~{stats['est_tokens']:,} "
        f"tokens, {stats['transcript_share']:.0%} transcript)")
    if stats["est_tokens"] > 120_000:
        log("  !! over ~120K tokens -- quality degrades on long contexts. "
            "Consider a shorter video or splitting the transcript.")
    log(f"  written       {path}")
    return text, stats, path


def stage_find(cache, category, payload_text, result, payload_stats,
               meta, duration_s, model, log):
    from .config import LLM_MODEL, LLM_REASONING_EFFORT
    log(rule("FINDER"))
    log(f"  model         {model or LLM_MODEL}  (effort {LLM_REASONING_EFFORT})")
    log("  thinking...")
    res = finder.call(payload_text, model=model)

    resolved = []
    if res["ok"]:
        u = res["usage"]
        log(f"  done          {res['seconds']}s | Rs {u['inr']:.4f} "
            f"({u['source']}) | {u['total_tokens']:,} tokens "
            f"({u['thinking_tokens']:,} thinking)")

        clips = (res["verdict"] or {}).get("clips") or []
        # Context only. The model's timestamps and words are passed through
        # exactly as written -- nothing here moves, swaps or rejects them.
        resolved = verify.attach_all(clips, result["blocks"])
        log("")
        log(f"  {len(clips)} clip(s)")
        log(verify.format_report(resolved))
    else:
        log(f"  FAILED        {res['error']}")

    # The HTML report is written either way -- a failed run is exactly when you
    # want to see what the payload looked like.
    data = report_html.build_payload_dict(
        res, resolved, payload_stats, result["report"], meta,
        cache.video_id, category, duration_s,
        generated_at=time.strftime("%Y-%m-%d %H:%M"))
    html_path = report_html.write(cache.build_path(f"{category}_report.html"),
                                  data)
    report_html.write_json_sidecar(
        cache.build_path(f"{category}_report.json"), data)
    cache.write_run(category, {k: v for k, v in data.items()
                               if k != "reasoning"})

    log("")
    log(f"  report        {html_path}")
    log("                open that file in your browser")
    return res, resolved


# ══════════════════════════════════════════════════════════════════════════
#  COMMANDS
# ══════════════════════════════════════════════════════════════════════════

def cmd_run(args, log=print):
    t0 = time.time()
    video_id = fetch.extract_video_id(args.link)
    cache = Cache(video_id, root=args.cache_root)
    cache.set_refresh(args.refresh)

    log(rule())
    log(f"  wowClip | {video_id} | {args.category}")
    log(f"  cache: {cache.root}")
    if args.refresh:
        log(f"  refreshing: {', '.join(args.refresh)}")
    log(rule())

    meta, parsed, heatmap, comments = stage_fetch(
        cache, args.link, video_id, args.skip_bouncer, log)
    duration_s = meta.get("duration_seconds")

    result = stage_compose(cache, parsed, duration_s, log)
    payload_text, stats, payload_path = stage_payload(
        cache, args.category, result, meta, comments, heatmap,
        duration_s, args.note, log)

    if args.build_only:
        log(rule())
        log(f"  built in {time.time()-t0:.0f}s. Payload ready, finder not run.")
        log(rule())
        return 0

    stage_find(cache, args.category, payload_text, result, stats,
               meta, duration_s, args.model, log)
    log(rule())
    log(f"  total {time.time()-t0:.0f}s")
    log(rule())
    return 0


def cmd_show(args, log=print):
    video_id = args.video_id
    cache = Cache(video_id, root=args.cache_root)
    log(f"cache: {cache.root}\n")
    log(f"{'artifact':<16}{'':<4}{'size':>12}   written")
    log("-" * 62)
    for row in cache.summary():
        mark = "yes" if row["present"] else " - "
        size = f"{row['bytes']:,}" if row["present"] else ""
        log(f"{row['stage']:<16}{mark:<4}{size:>12}   {row['written_at']}")
    builds = os.path.join(cache.root, "build")
    if os.path.isdir(builds) and os.listdir(builds):
        log("\nbuild/")
        for f in sorted(os.listdir(builds)):
            p = os.path.join(builds, f)
            log(f"  {os.path.getsize(p):>10,}  {f}")
    runs = os.path.join(cache.root, "runs")
    if os.path.isdir(runs) and os.listdir(runs):
        log("\nruns/")
        for f in sorted(os.listdir(runs)):
            log(f"  {f}")
    return 0


def cmd_compose(args, log=print):
    """Rebuild the transcript from cache only. No network, no GPU, instant."""
    cache = Cache(args.video_id, root=args.cache_root)
    if not cache.has("words"):
        raise SystemExit(f"no cached transcript for {args.video_id}. "
                         f"Run `run <link>` first.")
    from . import words as W
    parsed = W.load(cache.read_json("words"))
    if parsed.get("legacy") and cache.has("captions"):
        parsed = W.parse_json3(cache.read_bytes("captions"))
        cache.write_json("words", parsed, note="re-parsed with chunks")
    meta = cache.read_json("metadata") if cache.has("metadata") else {}
    result = stage_compose(cache, parsed,
                           meta.get("duration_seconds"), log)
    log(f"\n{cache.path('transcript')}")
    return 0


def build_parser():
    p = argparse.ArgumentParser(
        prog="python -m wowclip",
        description="Find the clips worth posting.")
    p.add_argument("--cache-root", default=CACHE_ROOT,
                   help=argparse.SUPPRESS)
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="full pipeline on a YouTube link")
    r.add_argument("link")
    r.add_argument("--category", default="motivational",
                   help="which prompt in prompts/ to use (default: motivational)")
    r.add_argument("--build-only", action="store_true",
                   help="stop after writing the payload; costs nothing further")
    r.add_argument("--skip-bouncer", action="store_true",
                   help="do not run the omni_bouncer gate")
    r.add_argument("--note", default="",
                   help="extra steer, e.g. 'focus on the failure stories'")
    r.add_argument("--model", default=None, help="override the finder model")
    r.add_argument("--refresh", nargs="*", default=[], metavar="STAGE",
                   help="force refetch: " + " ".join(REFRESHABLE))
    r.set_defaults(func=cmd_run)

    s = sub.add_parser("show", help="what is cached for a video")
    s.add_argument("video_id")
    s.set_defaults(func=cmd_show)

    c = sub.add_parser("compose",
                       help="rebuild the transcript from cache (free, instant)")
    c.add_argument("video_id")
    c.set_defaults(func=cmd_compose)
    return p


def main(argv=None):
    _utf8()
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except fetch.FetchError as e:
        print(f"\nFETCH FAILED: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\ncancelled", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
