# -*- coding: utf-8 -*-
"""One command: YouTube link -> ranked reel clips with exact cut times.

    python pipeline.py --url "https://youtu.be/VJ9VC9OqdAA"
    python pipeline.py --url "..." --start 2579 --end 2879
    python pipeline.py --url "..." --only motivational      # one finder
    python pipeline.py --url "..." --stop-after payload     # build, don't select

    1  transcript           transcript.py         (YouTube's own captions)
       comments + heatmap   comments.py, heatmap.py      -- alongside
       metadata             metadata.py                  -- alongside
    2  payload               build_payload.py      (line breaking + signals)
    3  candidates           find_clips.py         (5 finders in parallel)
    4  final cut            refine_clips.py       (one call: de-dup + exact words)

Step 3 reads the whole video five ways and returns line ids only -- it is told
explicitly not to spend thinking on boundaries. Step 4 then runs two passes of
its own: one call over every candidate at once to merge duplicates and drop
what cannot ship, then one call per survivor that does nothing but decide the
exact words it starts and ends on.

There is no step 5. A +/-10s LLM re-check of each boundary used to exist and
the only failure it caught was a clip ending on a hanging word, which
refine_clips.fix_dangling_end now does in code, for nothing. Its script and
prompt have been deleted rather than left lying around.

No audio is downloaded or analysed -- v1 runs on the transcript, YouTube's own
caption-embedded sound tags, comments, and the replay heatmap. That is a
deliberate trade: the ClipsCutter download plus PANNs/SwiftF0 GPU jobs added
~90% of total run time and, measured against it directly on two videos, made
no reliable difference to which clips were found. That stage still exists,
untouched, in _backup_pro_pipeline/audio_pipeline/ if a video's crowd
reactions (applause, laughter) are ever worth the cost as an optional deep
pass -- it is not part of this pipeline by default.

Everything that can run concurrently does, and every stage degrades to "signal
missing" rather than failing the run. The only hard dependency is the
transcript: without it there is nothing to annotate.
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comments as C
import heatmap as H
import llm
import metadata as M
from transcript import GPROXY_URL

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

STAGES = []               # (name, seconds, cost_usd, note)

USD_INR = 96.0


def extract_video_id(text):
    """Pulls the 11-char YouTube video id out of any common URL shape, or
    returns the text itself if it already looks like a bare id."""
    text = text.strip()
    m = re.search(r"(?:v=|/shorts/|/embed/|/live/|youtu\.be/)([A-Za-z0-9_-]{11})", text)
    if m:
        return m.group(1)
    return text if re.fullmatch(r"[A-Za-z0-9_-]{11}", text) else None


def log(m, tag="INFO"):
    print(f"[{time.strftime('%H:%M:%S')}] [{tag:<5}] {m}", flush=True)


def banner(n, title):
    print(f"\n{'-' * 74}\n  STEP {n}  {title}\n{'-' * 74}", flush=True)


def run(cmd, cwd=None, timeout=7200):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", cwd=cwd, timeout=timeout)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def echo(out, keep=("[", "C:")):
    for l in out.splitlines():
        s = l.strip()
        if s.startswith(keep) or "!!" in s:
            print("       " + s, flush=True)


def load(p):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def audience(url, vid, clip_start, clip_end, proxy, out_dir, keys):
    """Comments, heatmap and metadata: everything about the video that does not
    come out of the transcript. All three are optional -- comments disabled, no
    published heatmap and a quota-exhausted API key are all normal."""
    res = {}
    # Metadata first, and not only for its own sake: the video's duration is
    # what tells find_ts that "final score 5:30" is a football result and not a
    # cue. Without it a comment about a match lands on a real line and becomes
    # the strongest-looking wrong signal in the payload.
    dur = None
    try:
        md, err = M.fetch(vid, keys["YOUTUBE_API_KEY"])
        if md:
            p = os.path.join(out_dir, f"{vid}_metadata.json")
            json.dump(md, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            res["metadata"] = p
            dur = md.get("duration_s")
            log(f"  {md.get('channel')} -- {str(md.get('title'))[:70]}")
        else:
            log(f"  metadata: {err}", "WARN")
    except Exception as e:
        log(f"metadata unavailable: {e}", "WARN")
    try:
        cm = C.collect(vid, keys["YOUTUBE_API_KEY"], keys["OPENROUTER_API_KEY"],
                       dur=dur, log=lambda m, *a: log(m, *(a or ("INFO",))))
        p = os.path.join(out_dir, f"{vid}_comments.json")
        json.dump(cm, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        res["comments"] = p
    except Exception as e:
        log(f"comments unavailable: {e}", "WARN")
    try:
        pts, err = H.fetch(url, proxy)
        if pts:
            pk = H.peaks(pts, clip_start, clip_end)
            p = os.path.join(out_dir, f"{vid}_heatmap.json")
            json.dump({"points": len(pts), "peaks": pk},
                      open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            res["heatmap"] = p
            log(f"  heatmap {len(pts)} points -> {len(pk)} peaks in this window")
        else:
            log(f"  heatmap: {err}", "WARN")
    except Exception as e:
        log(f"heatmap unavailable: {e}", "WARN")
    return res


def summary(t0, outputs):
    tot_usd = sum(s[2] for s in STAGES)
    wall = time.time() - t0
    print(f"\n{'=' * 78}\n  RUN SUMMARY\n{'=' * 78}")
    print(f"  {'stage':<22}{'time':>9}{'cost':>11}{'INR':>11}   note")
    for name, secs, cost, note in STAGES:
        print(f"  {name:<22}{secs:>8.0f}s{('$%.4f' % cost):>11}"
              f"{('Rs %.2f' % (cost * USD_INR)):>11}   {note}")
    print(f"  {'-' * 74}")
    print(f"  {'TOTAL':<22}{wall:>8.0f}s{('$%.4f' % tot_usd):>11}"
          f"{('Rs %.2f' % (tot_usd * USD_INR)):>11}")
    print(f"  {wall / 60:.1f} min for the whole run   |   $1 = Rs {USD_INR:.0f}")
    if outputs:
        print("\n  outputs")
        for p in outputs:
            print(f"    {p}")
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--outdir", default=OUT)
    ap.add_argument("--proxy", default=GPROXY_URL)
    ap.add_argument("--lang", default=None,
                    help="force a caption track code, e.g. hi-orig")
    ap.add_argument("--no-manual", action="store_true",
                    help="ignore manually uploaded subtitles")
    ap.add_argument("--only", default=None,
                    help="comma-separated finders, e.g. motivational,emotional")
    ap.add_argument("--model", default=None)
    EFFORTS = ["low", "medium", "high", "max"]
    # These defaults are model-specific and were wrong for the model actually
    # in use. The old note here recorded a DeepSeek measurement -- low/medium/
    # max at 18.3k/21.0k/21.7k thinking tokens, "the knob barely moves" -- and
    # concluded the finders should sit at medium. On GLM-5.3-flash the knob
    # moves enormously, so medium was buying almost no reasoning at all.
    #
    # Measured 2026-09-04 on real payloads, six matched finder pairs across
    # three videos (entertainment and emotional):
    #
    #     effort   thinking tokens   clips found   secs   cost
    #     medium              450           2.7    28.2   $0.027
    #     high              4,454           3.3    73.0   $0.035
    #
    # and on one 13k-token payload the full sweep was low 286, medium 163,
    # high 2,957, max 19,039 thinking tokens. A finder reading a two-hour
    # transcript on 163 thinking tokens is not analysing it, and high found
    # more clips in five of the six pairs for about a rupee more per video.
    #
    # Refine goes to max rather than high because it is the stage where the
    # judgement lives and it is cheap: pass B sends a small window, so max
    # costs $0.019 against $0.007 for nine clips. Measured on the same three
    # videos it did visibly more work -- narrowing one clip from 71s to a
    # 22s exchange, and finding a better Hindi start another run had missed.
    ap.add_argument("--effort", default=None, choices=EFFORTS,
                    help="override both stages at once")
    ap.add_argument("--finder-effort", default="high", choices=EFFORTS)
    ap.add_argument("--refine-effort", default="max", choices=EFFORTS)
    ap.add_argument("--pad", type=float, default=None,
                    help="seconds of context step 4 gets on each side")
    ap.add_argument("--no-select", action="store_true",
                    help="step 4 skips its merge pass and cuts every candidate")
    ap.add_argument("--stop-after", default="clips",
                    choices=["payload", "step1", "clips"])
    ap.add_argument("--deepseek", action="store_true",
                    help="call DeepSeek's own API instead of OpenRouter in "
                         "the finder and refine stages")
    args = ap.parse_args()
    llm_model = args.model or ("deepseek-v4-flash" if args.deepseek else None)
    finder_eff = args.effort or args.finder_effort
    refine_eff = args.effort or args.refine_effort

    vid = extract_video_id(args.url)
    if not vid:
        log(f"no video id in {args.url!r}", "FATAL")
        sys.exit(2)
    os.makedirs(args.outdir, exist_ok=True)
    t0 = time.time()
    keys = json.load(open(llm.KEYS, encoding="utf-8"))
    outputs = []
    base = vid
    clip_end = args.end if args.end else None

    # ---- 1. transcript, with the video's own data alongside it
    banner(1, "TRANSCRIPT + AUDIENCE DATA")
    ts = time.time()
    tj = os.path.join(args.outdir, base + "_final.json")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        f_aud = ex.submit(audience, args.url, vid, args.start,
                          clip_end if clip_end else 10 ** 9, args.proxy,
                          args.outdir, keys)
        cmd = [sys.executable, os.path.join(HERE, "transcript.py"),
               "--url", args.url, "--outdir", args.outdir, "--base", base,
               "--clip-start", str(args.start), "--proxy", args.proxy]
        if clip_end:
            cmd += ["--clip-end", str(clip_end)]
        if args.lang:
            cmd += ["--lang", args.lang]
        if args.no_manual:
            cmd += ["--no-manual"]
        log("transcript: YouTube captions ...")
        rc, out = run(cmd, cwd=HERE)
        echo(out)
        aud = f_aud.result()
    if rc != 0 or not os.path.exists(tj):
        log("no transcript -- nothing downstream can run", "FATAL")
        print(out[-1200:])
        sys.exit(1)
    tmeta = (load(tj) or {}).get("meta") or {}
    cm_cost = float((((load(aud.get("comments", "")) or {}).get("stats") or {})
                     .get("llm") or {}).get("cost_usd") or 0)
    tr = tmeta.get("track") or {}
    STAGES.append(("transcript+audience", time.time() - ts, cm_cost,
                   f"{tmeta.get('words', 0)} words, {tr.get('kind', '?')}/"
                   f"{tr.get('code', '?')}, "
                   + (", ".join(sorted(aud)) or "no audience data")))

    # ---- 2. payload
    banner(2, "PAYLOAD")
    ts = time.time()
    cmd = [sys.executable, os.path.join(HERE, "build_payload.py"),
           "--transcript", tj, "--outdir", args.outdir,
           "--clip-start", str(args.start)]
    for flag, k in (("--comments-json", "comments"), ("--heatmap-json", "heatmap"),
                    ("--metadata-json", "metadata")):
        if aud.get(k):
            cmd += [flag, aud[k]]
    rc, out = run(cmd, cwd=HERE)
    echo(out)
    if rc != 0:
        log("payload stage failed", "FATAL")
        sys.exit(1)
    payload = os.path.join(args.outdir, base + "_payload.txt")
    if not os.path.exists(payload):
        log("payload file missing", "FATAL")
        sys.exit(1)
    outputs.append(payload)
    pmeta = (load(re.sub(r"\.txt$", ".json", payload)) or {}).get("meta") or {}
    STAGES.append(("payload", time.time() - ts, 0.0,
                   f"{pmeta.get('comments_placed', 0)} placed comments, "
                   f"{pmeta.get('replay_peaks', 0)} replay peaks"))
    if args.stop_after == "payload":
        summary(t0, outputs)
        return

    # ---- 3. candidates
    banner(3, "FINDERS")
    ts = time.time()
    cmd = [sys.executable, os.path.join(HERE, "find_clips.py"),
           "--payload", payload, "--effort", finder_eff]
    if args.only:
        cmd += ["--only", args.only]
    if llm_model:
        cmd += ["--model", llm_model]
    if args.deepseek:
        cmd += ["--deepseek"]
    rc, out = run(cmd, cwd=HERE)
    echo(out)
    step1 = re.sub(r"_payload\.txt$", "_step1.json", payload)
    if rc != 0 or not os.path.exists(step1):
        log("clip finding failed -- the payload is still usable", "WARN")
        summary(t0, outputs)
        sys.exit(1)
    s1 = load(step1)
    outputs.append(re.sub(r"\.json$", ".txt", step1))
    STAGES.append(("finders", time.time() - ts,
                   float((s1.get("meta") or {}).get("cost_usd") or 0),
                   f"{len(s1.get('clips') or [])} candidates from "
                   f"{len((s1.get('meta') or {}).get('categories') or [])} finders"))
    if args.stop_after == "step1" or not (s1.get("clips") or []):
        if not (s1.get("clips") or []):
            log("no candidates -- nothing to refine", "WARN")
        summary(t0, outputs)
        return

    # ---- 4. final cut
    banner(4, "BOUNDARIES + EXACT TIMES")
    ts = time.time()
    cmd = [sys.executable, os.path.join(HERE, "refine_clips.py"),
           "--step1", step1, "--effort", refine_eff]
    if llm_model:
        cmd += ["--model", llm_model]
    if args.deepseek:
        cmd += ["--deepseek"]
    if args.pad is not None:
        cmd += ["--pad", str(args.pad)]
    if args.no_select:
        cmd += ["--no-select"]
    rc, out = run(cmd, cwd=HERE)
    echo(out)
    final = re.sub(r"_step1\.json$", "_clips.json", step1)
    if rc != 0 or not os.path.exists(final):
        log("refinement failed -- step 1 candidates are still usable", "WARN")
        summary(t0, outputs)
        sys.exit(1)
    fj = load(final)
    outputs += [re.sub(r"\.json$", ".txt", final), final]
    STAGES.append(("refine", time.time() - ts,
                   float((fj.get("meta") or {}).get("cost_usd") or 0),
                   f"{len(fj.get('clips') or [])} clips"))
    summary(t0, outputs)
    for c in (fj.get("clips") or [])[:10]:
        print(f"  #{c['rank']}  {c['source_start_s']:>8.2f}s -> "
              f"{c['source_end_s']:>8.2f}s  ({c['duration_s']:>5.1f}s)  "
              f"{c['confidence']:<7}{c['category']:<16}{str(c['title'])[:44]}")
    print()


if __name__ == "__main__":
    main()
