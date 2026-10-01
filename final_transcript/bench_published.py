# -*- coding: utf-8 -*-
"""Score a run against reels real editors actually published from the same video.

    python bench_published.py --clips out/4Vz6L8B73i4_clips.json
    python bench_published.py --clips out/4Vz6L8B73i4_step1.json --category motivational

WHY THIS EXISTS

Every other number in this project measures the pipeline against itself: cost,
coverage, how many candidates came back, how confident the model said it was.
None of them can tell you whether the clips are any good, so prompt changes were
being judged by reading a handful of outputs and forming an impression -- which
is how a change that quietly deletes the best clip in a video looks like an
improvement.

This measures against the only external ground truth available: when a big
podcast episode goes out, a dozen independent clip accounts cut it themselves,
publish, and the plays are public. Those choices are a real editorial answer to
exactly the question this system is trying to answer, made by people who had no
contact with this code.

WHAT IT DOES AND DOES NOT TELL YOU

It answers one question: did the pipeline FIND the material an editor found?
Not "did it cut it to the same length" -- scoring is intersection over the
shorter span, so a tight 12s cut sitting inside a published 20s reel counts as
found. Matching a published length was never the goal and often should not be.

Three honest limits, worth keeping in mind before moving a number:

  PLAYS ARE CONFOUNDED BY ACCOUNT SIZE. A reel on the show's own page starts with
  an audience. Treat the play figures as a rough weight, never as clip quality.

  IT IS ONE VIDEO. Coverage here is not accuracy in general, and the model's
  temperature means two runs of identical code differ. Three runs on this video
  produced 5, 13 and 16 candidates.

  THE PUBLISHED SET IS NOT THE COMPLETE SET OF GOOD CLIPS. Editors miss things
  too. A moment this system finds and nobody published is not necessarily wrong.

So: use it to catch regressions and to size a change, not to chase 100%.

WHERE THE SPANS COME FROM

Each reel's own transcribed audio was matched against the word-level transcript
of the source video, so every span below is anchored to real words rather than
placed by eye. That matters: an earlier hand-placed version of this table was
wrong by up to three and a half minutes on five of fourteen entries, and it
inverted the apparent result of a prompt change.
"""

import argparse
import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


# video_id -> [(label, start_s, end_s, published_len_s, plays, kind)]
#
# `kind` is which finder the material belongs to, so a single-category run can be
# scored against its own share instead of against everything. Some reels sit on a
# border and are marked with the finder most likely to reach them.
PUBLISHED = {
    # Dr Sahar Yousef x Raj Shamani, FO559. 21 reels scraped; the 14 below are
    # the ones carrying spoken material a finder could reach. Source:
    # instagram_reels_data.txt
    "4Vz6L8B73i4": [
        ("write the story down",              867.0,   880.6, 14.5, 2844393, "motivational"),
        ("brains confirm your beliefs",      1203.0,  1220.7, 17.3,  896295, "motivational"),
        ("repeat the story / nothing real",   832.5,   848.4, 19.7, 1790302, "motivational"),
        ("power of belief / main character",  699.1,   713.4, 14.1, 1658045, "motivational"),
        ("redirect / repeat the story",       802.2,   836.8, 31.1, 1585082, "motivational"),
        ("tell your brain to shut up",        788.7,   802.2, 11.4,  208197, "motivational"),
        ("learn the laws of your brain",      351.4,   441.7, 61.4,  626561, "general"),
        # This one and the addiction reel enclose more than their published
        # length: both cut material out of the middle, so the span is the
        # stretch the reel was taken from.
        ("billionaire brain Q+A",             588.1,   723.1, 55.2, 1974386, "motivational"),
        ("the cost I paid",                 10269.8, 10353.9, 50.9, 1090077, "motivational"),
        ("be bored (Q+A)",                   4724.6,  4745.9, 18.8,  329149, "motivational"),
        ("idea machine / a million bad ones", 4660.2, 4722.8, 54.0,  373484, "general"),
        ("most powerless -> addiction",     10025.4, 10152.2, 51.1,  551821, "motivational"),
        ("brick wall / door",                 665.7,   693.0, 20.9,  373277, "motivational"),
        ("priming / notice opportunities",   1082.6,  1174.5, 67.5,  753327, "general"),
        ("phone on the table lowers your IQ", 3303.0, 3372.0, 40.2,  608354, "general"),
        ("stress is not the enemy",           8761.0,  8793.0, 31.8,  100718, "general"),
        ("brain blueprint tour",              5860.0,  5957.0, 96.7,  305911, "general"),
    ],
}

FOUND = 0.6          # intersection over the shorter span, to call it found
PARTIAL = 0.25


def mmss(x):
    return f"{int(x) // 60}:{int(x) % 60:02d}"


def overlap(a, b):
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def spans_from(doc, category=None):
    """Clip spans out of a _clips.json, _step1.json or a single category file."""
    clips = doc.get("clips") if isinstance(doc, dict) else doc
    if not isinstance(clips, list):
        raise SystemExit("no `clips` array in that file")
    out = []
    for c in clips:
        if category and str(c.get("category") or "").lower() != category:
            continue
        s = c.get("source_start_s", c.get("start_s"))
        e = c.get("source_end_s", c.get("end_s"))
        if s is None or e is None:
            continue
        out.append((float(s), float(e), c))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", required=True,
                    help="a _clips.json, _step1.json or _<category>.json")
    ap.add_argument("--video", default=None,
                    help="video id; inferred from the filename when omitted")
    ap.add_argument("--category", default=None,
                    help="score only this finder's share of the published set")
    args = ap.parse_args()

    path = os.path.abspath(args.clips)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)

    vid = args.video
    if not vid:
        base = os.path.basename(path)
        vid = next((k for k in PUBLISHED if k in base), None)
    if vid not in PUBLISHED:
        raise SystemExit(f"no published-reel data for {vid!r}. Known: "
                         f"{', '.join(PUBLISHED)}")

    cat = (args.category or "").strip().lower() or None
    reels = [r for r in PUBLISHED[vid] if not cat or r[5] == cat]
    if not reels:
        raise SystemExit(f"no published reels tagged {cat!r} for {vid}")

    clips = spans_from(doc, cat)
    if not clips:
        raise SystemExit("that file has no clips" + (f" for {cat}" if cat else ""))

    lens = sorted(e - s for s, e, _ in clips)
    print(f"{os.path.basename(path)}"
          + (f"  [{cat}]" if cat else ""))
    print(f"{len(clips)} clips  |  lengths min {lens[0]:.0f}s  "
          f"median {lens[len(lens) // 2]:.0f}s  max {lens[-1]:.0f}s")
    pub_lens = sorted(r[3] for r in reels)
    print(f"published: {len(reels)} reels  |  lengths min {pub_lens[0]:.0f}s  "
          f"median {pub_lens[len(pub_lens) // 2]:.0f}s  max {pub_lens[-1]:.0f}s\n")

    hit = plays_hit = 0
    print(f"  {'published reel':36} {'len':>5} {'plays':>10}  found  best match")
    for label, s, e, dur, plays, kind in reels:
        best, who = 0.0, None
        for cs, ce, c in clips:
            score = overlap((s, e), (cs, ce)) / max(1.0, min(e - s, ce - cs))
            if score > best:
                best, who = score, (cs, ce)
        mark = "yes " if best >= FOUND else ("part" if best >= PARTIAL else "NO  ")
        hit += best >= FOUND
        plays_hit += plays if best >= FOUND else 0
        where = f"{mmss(who[0])}-{mmss(who[1])}" if who and best >= PARTIAL else "-"
        print(f"  {label:36} {dur:4.0f}s {plays:10,}  {mark} {best:4.0%}  {where}")

    total = sum(r[4] for r in reels)
    print(f"\n  found {hit} of {len(reels)} published reels"
          f"  ({plays_hit:,} of {total:,} plays, {plays_hit / total:.0%})")

    # Clips with no published counterpart. Not failures -- editors miss things --
    # but worth eyeballing, because this is also where invented material shows up.
    #
    # Checked against EVERY published reel for the video, not just the ones being
    # scored. With --category motivational the scored set excludes the reels
    # tagged general, and comparing against the filtered set reported clips as
    # unpublished when an account had in fact published them.
    everything = [(r[1], r[2]) for r in PUBLISHED[vid]]
    extra = []
    for cs, ce, c in clips:
        best = max((overlap((s, e), (cs, ce)) / max(1.0, min(e - s, ce - cs))
                    for s, e in everything), default=0.0)
        if best < PARTIAL:
            extra.append((cs, ce, c))
    if extra:
        print(f"\n  {len(extra)} clip(s) no account published — read these "
              f"yourself, they are not necessarily wrong:")
        for cs, ce, c in sorted(extra):
            print(f"    {mmss(cs)}-{mmss(ce)}  {ce - cs:5.0f}s  "
                  f"{str(c.get('title'))[:58]}")
    matched_other = len(clips) - len(extra) - hit
    if matched_other > 0:
        print(f"\n  {matched_other} further clip(s) match reels published under "
              f"another category")


if __name__ == "__main__":
    main()
