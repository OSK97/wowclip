"""Where a run's work is kept so the next stage can pick it up.

The point of this module is that stage 2 must not refetch anything. Stage 1
already pulled the word-level transcript and the replay heatmap through the
proxy — that is the slowest and the only metered part of the whole system — so
those bytes are written to disk here and stage 2 reads them straight off it.

File names and shapes deliberately match what the clip project's
build_payload.py already expects, so nothing has to be converted in between:

    <video_id>/_final.json      {"meta": {...}, "words": [{word,start,end,...}]}
    <video_id>/_heatmap.json    {"points": N, "peaks": [{start,end,value,rel}]}
    <video_id>/_comments.json   {"ok":..,"timestamped":[..],"general":[..],..}
    <video_id>/_metadata.json   {"video_id","title","channel","duration_s",..}
    <video_id>/_payload.txt     built by stage 2
    <video_id>/_payload.json
    <video_id>/_step1.json      finder candidates
    <video_id>/_clips.json      final clips

One directory per video, not per run: a second run of the same video should
reuse the transcript rather than pay for it twice. Nothing here is a cache with
an expiry — YouTube captions for a published video do not change.
"""

import json
import os
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS = os.environ.get("PIPELINE_RUNS_DIR") or os.path.join(HERE, "runs")


def run_dir(video_id: str) -> str:
    """The directory for this video, created if needed."""
    safe = "".join(c for c in video_id if c.isalnum() or c in "-_")
    if not safe:
        raise ValueError(f"unusable video id {video_id!r}")
    path = os.path.join(RUNS, safe)
    os.makedirs(path, exist_ok=True)
    return path


def path_for(video_id: str, suffix: str) -> str:
    """e.g. path_for('abc', '_final.json') -> runs/abc/abc_final.json"""
    return os.path.join(run_dir(video_id), f"{video_id}{suffix}")


def save(video_id: str, suffix: str, payload) -> str:
    """Write one artifact as JSON. Returns the path."""
    target = path_for(video_id, suffix)
    # Written to a temporary name and moved into place so a crash halfway
    # through cannot leave a half-written file that later looks valid.
    staging = target + ".part"
    with open(staging, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(staging, target)
    return target


def load(video_id: str, suffix: str):
    """Read one artifact, or None when it was never written."""
    target = path_for(video_id, suffix)
    if not os.path.exists(target):
        return None
    try:
        with open(target, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def has(video_id: str, suffix: str) -> bool:
    target = path_for(video_id, suffix)
    return os.path.exists(target) and os.path.getsize(target) > 2


def age_seconds(video_id: str, suffix: str):
    """How long ago an artifact was written, or None if it does not exist."""
    target = path_for(video_id, suffix)
    if not os.path.exists(target):
        return None
    return round(time.time() - os.path.getmtime(target), 1)


def write_transcript(video_id: str, words: list, meta: dict) -> str:
    """Persist the word-level transcript in the clip project's own format."""
    return save(video_id, "_final.json", {"meta": meta, "words": words})


def write_heatmap(video_id: str, points: int, peaks: list) -> str:
    return save(video_id, "_heatmap.json", {"points": points, "peaks": peaks})


def write_metadata(video_id: str, metadata: dict) -> str:
    return save(video_id, "_metadata.json", metadata)


def write_comments(video_id: str, payload: dict) -> str:
    return save(video_id, "_comments.json", payload)
