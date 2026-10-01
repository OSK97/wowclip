"""
The artifact store.

The whole point: you should be able to change the prompt at 2am, rerun, and pay
nothing. Fetching a transcript costs GProxy bandwidth you buy by the megabyte.
Fetching comments costs YouTube API quota. None of that should ever happen
twice for the same video.

Three tiers, and the tier decides the caching rule:

    raw/       exact bytes from the outside world.
               NEVER refetched once present. This is the source of truth.

    derived/   deterministic transforms of raw/, plus the one expensive
               computation (Modal GPU). NEVER recomputed once present.

    build/     the transcript, the payload -- everything you actually iterate on.
               ALWAYS rebuilt. Free, and you want the newest code's output.

    runs/      one file per LLM call, kept forever so you can diff prompt
               versions against each other later.

`--refresh <stage>` is the escape hatch when something was fetched wrong.
"""

import hashlib
import json
import os
import shutil
import time

from .config import CACHE_ROOT

# Stage -> (tier, filename). One table so nothing can drift.
ARTIFACTS = {
    # raw: never refetched
    "captions":    ("raw", "captions.json3"),
    "ytdlp_info":  ("raw", "ytdlp_info.json"),
    "youtube_api": ("raw", "youtube_api.json"),
    "comments_raw": ("raw", "comments_raw.json"),
    # derived: never recomputed
    "words":       ("derived", "words.json"),
    "metadata":    ("derived", "metadata.json"),
    "heatmap":     ("derived", "heatmap.json"),
    "comments":    ("derived", "comments.json"),
    "bouncer":     ("derived", "bouncer_verdict.json"),
    # build: always rebuilt
    "lines":       ("build", "lines.json"),
    "transcript":  ("build", "transcript.txt"),
    "events":      ("build", "events.json"),
}

REFRESHABLE = sorted(set(list(ARTIFACTS.keys()) + ["all"]))


class Cache:
    """Everything the pipeline knows about one video."""

    def __init__(self, video_id, root=None):
        self.video_id = video_id
        self.root = os.path.join(root or CACHE_ROOT, video_id)
        self.refresh = set()
        for tier in ("raw", "derived", "build", "runs"):
            os.makedirs(os.path.join(self.root, tier), exist_ok=True)

    # ── paths ────────────────────────────────────────────────────────────
    def path(self, stage):
        tier, name = ARTIFACTS[stage]
        return os.path.join(self.root, tier, name)

    @property
    def manifest_path(self):
        return os.path.join(self.root, "manifest.json")



    # ── refresh control ──────────────────────────────────────────────────
    def set_refresh(self, stages):
        """stages: list of stage names, or ['all']."""
        stages = set(stages or [])
        if "all" in stages:
            self.refresh = set(ARTIFACTS)
        else:
            self.refresh = stages

    def _forced(self, stage):
        return stage in self.refresh

    # ── the two questions every stage asks ───────────────────────────────
    def has(self, stage):
        """Is this artifact already on disk and still trusted?

        Anything in the `build` tier answers False always -- build output is
        cheap and must always reflect the current code.
        """
        tier, _ = ARTIFACTS[stage]
        if tier == "build":
            return False
        if self._forced(stage):
            return False
        p = self.path(stage)
        return os.path.exists(p) and os.path.getsize(p) > 0



    # ── read / write ─────────────────────────────────────────────────────
    def read_json(self, stage):
        with open(self.path(stage), encoding="utf-8") as f:
            return json.load(f)

    def write_json(self, stage, data, note=""):
        p = self.path(stage)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, p)
        self._record(stage, p, note)
        return p

    def read_bytes(self, stage):
        with open(self.path(stage), "rb") as f:
            return f.read()

    def write_bytes(self, stage, data, note=""):
        p = self.path(stage)
        tmp = p + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, p)
        self._record(stage, p, note)
        return p

    def read_text(self, stage):
        with open(self.path(stage), encoding="utf-8") as f:
            return f.read()

    def write_text(self, stage, text, note=""):
        p = self.path(stage)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, p)
        self._record(stage, p, note)
        return p



    # ── build output that is not a fixed artifact (payloads, runs) ───────
    def build_path(self, name):
        return os.path.join(self.root, "build", name)

    def write_build(self, name, text, note=""):
        p = self.build_path(name)
        with open(p, "w", encoding="utf-8") as f:
            f.write(text)
        self._record(f"build:{name}", p, note)
        return p

    def write_run(self, label, data):
        stamp = time.strftime("%Y%m%d-%H%M%S")
        p = os.path.join(self.root, "runs", f"{stamp}_{label}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        return p

    # ── manifest ─────────────────────────────────────────────────────────
    def _load_manifest(self):
        try:
            with open(self.manifest_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"video_id": self.video_id, "artifacts": {}}

    def _record(self, stage, path, note=""):
        m = self._load_manifest()
        try:
            size = os.path.getsize(path)
            with open(path, "rb") as f:
                digest = hashlib.sha256(f.read()).hexdigest()[:16]
        except OSError:
            size, digest = 0, ""
        m["artifacts"][stage] = {
            "file": os.path.relpath(path, self.root).replace("\\", "/"),
            "bytes": size,
            "sha256_16": digest,
            "written_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "note": note,
        }
        m["video_id"] = self.video_id
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=1)

    def summary(self):
        """Human-readable 'what do I already have for this video'."""
        m = self._load_manifest()
        rows = []
        for stage in list(ARTIFACTS):
            tier, _ = ARTIFACTS[stage]
            p = self.path(stage)
            present = os.path.exists(p) and os.path.getsize(p) > 0
            size = os.path.getsize(p) if present else 0
            info = m["artifacts"].get(stage, {})
            rows.append({
                "stage": stage,
                "present": present,
                "bytes": size,
                "written_at": info.get("written_at", ""),
            })
        return rows
