"""Heatmap shaping. No network — the raw data arrives with ytdlp_fetch.

Not every video has replay data: YouTube only computes the curve above a view
threshold. A missing heatmap is normal and never blocks the pipeline. It is one
optional corroborating signal, not a requirement.
"""

from config import HEATMAP_MIN_SCORE


def shape(raw) -> dict:
    """Normalise yt-dlp's heatmap into {available, points, peaks}."""
    if not isinstance(raw, list) or not raw:
        return {"available": False, "points": [], "peaks": []}

    points = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        points.append(
            {
                "start": int(entry.get("start_time", 0) or 0),
                "end": int(entry.get("end_time", 0) or 0),
                "score": round(float(entry.get("value", 0) or 0), 3),
            }
        )

    if not points:
        return {"available": False, "points": [], "peaks": []}

    points.sort(key=lambda p: p["start"])

    # Only peaks carry signal. Below the threshold means viewers skipped past,
    # which tells the clip finder nothing about where to cut.
    peaks = [p for p in points if p["score"] >= HEATMAP_MIN_SCORE]

    return {"available": True, "points": points, "peaks": peaks}


def to_lines(peaks: list) -> str:
    """Compact heatmap for the LLM payload: [seconds] score."""
    return "\n".join(f"[{p['start']}] {p['score']:.2f}" for p in peaks)
