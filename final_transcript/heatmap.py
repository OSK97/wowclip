# -*- coding: utf-8 -*-
"""YouTube 'Most Replayed'. The other signal that comes from real humans.

YouTube publishes ~100 points regardless of video length, so on a 3-hour
podcast each point covers roughly 2 minutes -- coarse, but it is measured
viewing behaviour rather than anyone's guess, and a peak means thousands of
people scrubbed back to that spot.

Peaks are found relative to THIS video's own curve, not against a fixed
number. Every video's curve has a different shape (intros are always replayed,
long videos decay), so an absolute cutoff either floods a flat video or finds
nothing in a peaky one.
"""

import json
import subprocess
import time

PEAK_P = 80          # a point must beat this percentile of its own curve
PEAK_MIN_REL = 1.15  # ...and be this much above the video's median
MERGE_GAP_S = 5.0
MAX_PEAKS = 40


TRIES = 4


def fetch(url, proxy=None, ytdlp="yt-dlp", timeout=300):
    """One yt-dlp extract. The heatmap ships in the same info blob as
    everything else, so this costs one page load and no extra API quota."""
    cmd = [ytdlp, "--skip-download", "--no-warnings", "--no-playlist",
           "--socket-timeout", "30", "--print", "%(heatmap)j", url]
    if proxy:
        cmd[1:1] = ["--proxy", proxy]
    # Retried for the same reason as the caption discovery: the proxy's exit IP
    # is sometimes one YouTube has flagged. This used to matter twice over,
    # because a bot-gated extract exits non-zero with an empty stdout and the
    # check below then reported it as "this video has no published heatmap" --
    # a hard failure wearing the costume of a normal, expected absence. The
    # audience finder is built entirely on this signal, so it would have gone
    # blind without anything in the log saying why.
    p, last = None, "yt-dlp failed"
    for attempt in range(1, TRIES + 1):
        try:
            p = subprocess.run(cmd, capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=timeout)
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
            p = None
        if p is not None and p.returncode == 0:
            break
        if p is not None:
            last = (p.stderr or "yt-dlp failed").strip().splitlines()[0][:160]
        if attempt < TRIES:
            time.sleep(2 * attempt)
    if p is None or p.returncode != 0:
        return None, f"heatmap fetch failed after {TRIES} tries: {last}"
    line = (p.stdout or "").strip().splitlines()
    if not line or line[-1] in ("NA", "null", ""):
        return None, "this video has no published heatmap"
    try:
        raw = json.loads(line[-1])
    except Exception:
        return None, "heatmap did not parse"
    out = []
    for pt in raw or []:
        try:
            out.append({"start": float(pt.get("start_time") or 0),
                        "end": float(pt.get("end_time") or 0),
                        "value": float(pt.get("value") or 0)})
        except (TypeError, ValueError):
            continue
    return (out or None), (None if out else "heatmap was empty")


def peaks(points, lo=None, hi=None):
    """The replayed stretches, clipped to the clip window if one is given."""
    if not points:
        return []
    vals = sorted(p["value"] for p in points)
    n = len(vals)
    med = vals[n // 2]
    cut = vals[min(n - 1, int(n * PEAK_P / 100.0))]
    thr = max(cut, med * PEAK_MIN_REL)

    hot = [p for p in points if p["value"] >= thr]
    hot.sort(key=lambda p: p["start"])
    merged = []
    for p in hot:
        if merged and p["start"] - merged[-1]["end"] <= MERGE_GAP_S:
            merged[-1]["end"] = max(merged[-1]["end"], p["end"])
            merged[-1]["value"] = max(merged[-1]["value"], p["value"])
        else:
            merged.append(dict(p))

    out = []
    for m in merged:
        a, b = m["start"], m["end"]
        if lo is not None:
            if b <= lo or a >= hi:
                continue
            a, b = max(a, lo) - lo, min(b, hi) - lo
        out.append({"start": round(a, 1), "end": round(b, 1),
                    "value": round(m["value"], 3),
                    "rel": round(m["value"] / med, 2) if med else 1.0})
    out.sort(key=lambda x: -x["value"])
    return out[:MAX_PEAKS]
