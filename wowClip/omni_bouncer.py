#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OMNI-BOUNCER  ·  wowClip intake gate  ·  v4
===========================================

One script. You give it a YouTube link, it tells you whether wowClip should
bother processing it -- and if yes, how much reel-gold is actually in there.

Replaces step_01_validate_link.py, step_02_download_transcript.py,
step_03_download_heatmap.py and step_04_download_metadata.py. Nothing is
imported from them; this file is self-contained.


WHAT IT DOES
------------
    PHASE 0   parse the link offline                        ~0.000s   free
    PHASE 1   two tracks in parallel:
                A. YouTube Data API -> validate + metadata  ~0.3s     1 quota unit
                B. GProxy handshake -> yt-dlp extract       ~3s       ~1 MB proxy
                   -> transcript json3 download
    PHASE 2   transcript forensics, in Python               ~0.02s    free
    PHASE 3   build payload -> OpenRouter LLM verdict       ~4s       ~$0.0002
    PHASE 4   merge LLM verdict with hard invariants, report


WHY IT IS FASTER THAN THE OLD FOUR SCRIPTS
------------------------------------------
  * step_02 and step_03 each ran their own yt_dlp.extract_info(). That is the
    single most expensive call in the whole pipeline and it was being paid
    for TWICE. The heatmap ships inside the same info blob as the caption
    track list, so one call now returns both.
  * step_01 and step_04 each ran their own YouTube Data API call for
    overlapping fields. Merged into one call with all parts.
  * The Data API track and the proxy/yt-dlp track now overlap.
  * The GProxy handshake costs no bandwidth, so it runs first inside track B.
    By the time it finishes, the Data API gate has already answered -- which
    means a dead/live/private video is rejected before a single byte of
    residential proxy bandwidth is spent.

  Old: ~9-11s and 2 proxy extracts.   New: ~4-7s and 1.


DESIGN NOTE -- WHY BLOCKS ARE RARE
----------------------------------
Warnings, not rejections. The only videos that get blocked are the ones the
pipeline physically cannot process (music, gaming, movies, trailers, live
sports) or ones with no readable speech at all. Everything else passes with
a score and honest warnings. A user who gets a warning feels informed. A
user who gets rejected feels the product is broken.


HOW TO RUN
----------
    python omni_bouncer.py https://youtu.be/VIDEOID

    --json            machine-readable output only
    --no-llm          fetch + forensics only, skip the LLM (free, offline test)
    --save-payload    write the exact text sent to the LLM, for prompt work
    --quiet           just the user-facing verdict, no diagnostics
    --keep            write the full run record to runs/<video_id>.json

Keys live in api_keys.json next to this file:
    YOUTUBE_API_KEY, GPROXY_PASS, OPENROUTER_API_KEY
Environment variables of the same name override the file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))


# ══════════════════════════════════════════════════════════════════════════
#  CONFIG  --  everything tunable lives here
# ══════════════════════════════════════════════════════════════════════════

PROMPT_FILE = "omni_bouncer_prompt_v4.md"

# --- LLM ---------------------------------------------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "inception/mercury-2"
# OpenRouter's listed price for inception/mercury-2: $0.25 / $0.75 per 1M
# tokens (in / out). 128K context. Fallback only -- whenever OpenRouter's
# response includes a real "cost" field, that number is used instead.
MODEL_PRICE_IN = 0.25 / 1_000_000      # USD per input token
MODEL_PRICE_OUT = 0.75 / 1_000_000     # USD per output token
LLM_TEMPERATURE = 0.15                 # low: we want a stable verdict, not creativity
LLM_MAX_TOKENS = 4096
LLM_TIMEOUT_S = 120
LLM_ATTEMPTS = 1                       # NO retries. If it fails, say so and stop.
# Set to a list of OpenRouter model slugs to auto-retry on a different model
# if the primary is down. Empty by default so you never get a surprise bill.
FALLBACK_MODELS: list[str] = []

# --- payload budget ----------------------------------------------------
# ling-2.6-flash has a 262K context. At $0.01/1M input this is ~$0.0003 for a
# 3-hour podcast, so the budget exists for SPEED, not cost.
MAX_TRANSCRIPT_CHARS = 90_000
CHUNK_SECONDS = 22                     # merge YouTube's 2s ASR fragments into ~22s blocks
CHUNK_MAX_CHARS = 520
SAMPLE_WINDOWS = 30                    # even slices across the timeline when over budget

# --- forensics thresholds ---------------------------------------------
DEAD_ZONE_MIN_S = 90                   # interior/leading silence this long is worth a warning
DEAD_ZONE_TRAIL_MIN_S = 240            # trailing silence bar is much higher -- see below
DEAD_ZONE_TRAIL_MIN_PCT = 8.0          # ...and it must also be a real share of the video
GAP_MIN_S = 25                         # a gap this long is counted in stats
LOW_COVERAGE_PCT = 35.0
LOW_WPM = 70
SHORT_VIDEO_S = 180
VERY_LONG_VIDEO_S = 4 * 3600
MIN_WORDS_FOR_USABLE = 120             # below this a transcript is not worth running

# --- network -----------------------------------------------------------
YT_API_TIMEOUT = 12
PROXY_TIMEOUT = 12
CAPTION_TIMEOUT = 25
ALLOW_DIRECT_FALLBACK = True           # if GProxy/yt-dlp+proxy dies, try without proxy

MUSIC_TAG_RE = re.compile(
    r"^\s*[\[\(<]?\s*(music|संगीत|музыка|音楽|음악|applause|laughter|cheering|"
    r"inaudible|foreign|silence|no audio|background music|instrumental)"
    r"\s*[\]\)>]?\s*$",
    re.IGNORECASE,
)
MUSIC_NOTE_RE = re.compile(r"^[\s♪♫🎵🎶*_\-~]+$")


# ══════════════════════════════════════════════════════════════════════════
#  CONSOLE  --  Windows terminals still lie about their encoding
# ══════════════════════════════════════════════════════════════════════════

def _init_console() -> bool:
    """Returns True if the terminal can print box-drawing characters."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass
    try:
        "─│┌┐└┘·→".encode(sys.stdout.encoding or "utf-8")
        return True
    except Exception:
        return False


UNICODE_OK = True   # set properly in main()


def _c(fancy: str, plain: str) -> str:
    return fancy if UNICODE_OK else plain


# ══════════════════════════════════════════════════════════════════════════
#  KEYS
# ══════════════════════════════════════════════════════════════════════════

_KEY_CACHE: dict[str, Optional[str]] = {}


def get_key(name: str) -> Optional[str]:
    """Env var wins, then api_keys.json next to this file."""
    if name in _KEY_CACHE:
        return _KEY_CACHE[name]

    val = (os.environ.get(name) or "").strip()
    if not val:
        for path in (
            os.path.join(_HERE, "api_keys.json"),
            os.path.join(os.path.dirname(_HERE), "Youtube_Link", "api_keys.json"),
        ):
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        val = (json.load(f).get(name) or "").strip()
                    if val:
                        break
                except Exception:
                    pass
    _KEY_CACHE[name] = val or None
    return _KEY_CACHE[name]


# ══════════════════════════════════════════════════════════════════════════
#  TIMING  --  every step is measured, nothing is guessed
# ══════════════════════════════════════════════════════════════════════════

@dataclass
class Step:
    name: str
    seconds: float
    ok: bool
    note: str = ""
    started_at: float = 0.0     # offset from run start, so parallel steps read in order


class Timeline:
    def __init__(self) -> None:
        self.steps: list[Step] = []
        self.t_start = time.perf_counter()

    def add(self, name: str, seconds: float, ok: bool, note: str = "",
            started_at: Optional[float] = None) -> None:
        if started_at is None:
            started_at = max(time.perf_counter() - self.t_start - seconds, 0.0)
        self.steps.append(Step(name, round(seconds, 3), ok, note, round(started_at, 3)))

    def ordered(self) -> list[Step]:
        """Chronological. Two threads append as they finish, not as they start."""
        return sorted(self.steps, key=lambda s: s.started_at)

    def wall(self) -> float:
        return time.perf_counter() - self.t_start

    def serial_total(self) -> float:
        return sum(s.seconds for s in self.steps)


class Clock:
    """with Clock(timeline, "name") as c:  ...  c.note = "..." ; c.ok = False"""

    def __init__(self, tl: Timeline, name: str):
        self.tl, self.name = tl, name
        self.note = ""
        self.ok = True

    def __enter__(self) -> "Clock":
        self.t0 = time.perf_counter()
        self.offset = self.t0 - self.tl.t_start
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is not None:
            self.ok = False
            if not self.note:
                self.note = f"{exc_type.__name__}: {exc}"
        self.tl.add(self.name, time.perf_counter() - self.t0, self.ok, self.note,
                    started_at=self.offset)
        return False


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 0  --  READ THE LINK      (offline, instant, free)
# ══════════════════════════════════════════════════════════════════════════

REJECT_MESSAGES: dict[str, str] = {
    "EMPTY_INPUT":     "Please paste a YouTube link.",
    "NOT_YOUTUBE":     "That doesn't look like a YouTube link.",
    "IS_SHORTS":       "That's a YouTube Short — it's already a reel. Paste a full-length video instead.",
    "IS_CHANNEL":      "That's a channel link. Open a specific video and paste that link.",
    "IS_PLAYLIST":     "That's a playlist. Open one video from it and paste that link.",
    "IS_SEARCH":       "That's a search results page. Please paste a video link.",
    "IS_CLIP":         "That's a YouTube Clip. Paste the full video link instead.",
    "IS_OTHER_PAGE":   "That's a YouTube page, but not a video. Please paste a video link.",
    "IS_CHANNEL_LIVE": "That's a channel's 'live now' page, not a specific video. Open the video and paste that link.",
    "BAD_VIDEO_ID":    "We couldn't read a valid video ID from that link. Please check it and try again.",
    "VIDEO_NOT_FOUND": "This video is private, deleted, or unavailable.",
    "LIVE_NOW":        "This stream is still live. Try again once it ends — the transcript is still growing.",
    "LIVE_UPCOMING":   "This is a scheduled stream that hasn't started yet. There's nothing to process.",
    "NOT_PROCESSED":   "YouTube is still processing this video. Try again in a few minutes.",
    "API_KEY_MISSING": "Setup problem: no YOUTUBE_API_KEY found in api_keys.json.",
    "API_ERROR":       "We couldn't reach YouTube right now. Please try again in a moment.",
}

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "gaming.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com",
}
SHORT_HOSTS = {"youtu.be", "www.youtu.be"}
BLOCKED_HOSTS = {"studio.youtube.com", "tv.youtube.com"}
CHANNEL_PREFIXES = ("channel", "c", "user")


def _clean_input(raw: str) -> str:
    s = (raw or "").strip()
    s = s.strip("\"'<>")
    s = s.replace("&amp;", "&")
    s = s.rstrip(".,;:!)]}")
    return s.strip()


def _finish_id(candidate: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    cand = (candidate or "").strip()
    if VIDEO_ID_RE.match(cand):
        return cand, None, None
    return None, "BAD_VIDEO_ID", f"extracted {cand!r}, not a valid 11-char video ID"


def parse_youtube_url(raw: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Pure, no internet. Returns (video_id, reject_code, debug_detail)."""
    s = _clean_input(raw)
    if not s:
        return None, "EMPTY_INPUT", "input was empty"

    # A bare video ID is accepted only if the WHOLE string is one -- never a
    # substring, or we'd invent IDs out of junk.
    if VIDEO_ID_RE.match(s):
        return s, None, None

    if "://" not in s:
        s = "https://" + s
    try:
        u = urllib.parse.urlparse(s)
    except Exception as e:
        return None, "NOT_YOUTUBE", f"urlparse failed: {e}"

    host = (u.hostname or "").lower()
    if host.startswith("www.") and host not in YOUTUBE_HOSTS and host not in SHORT_HOSTS:
        host = host[4:]
    if not host:
        return None, "NOT_YOUTUBE", "no hostname"
    if host in BLOCKED_HOSTS:
        return None, "IS_OTHER_PAGE", f"blocked host: {host}"

    is_short_host = host in SHORT_HOSTS
    if not (is_short_host or host in YOUTUBE_HOSTS):
        return None, "NOT_YOUTUBE", f"host is not YouTube: {host}"

    parts = [p for p in u.path.split("/") if p]
    query = urllib.parse.parse_qs(u.query)
    first = parts[0].lower() if parts else ""

    if is_short_host:
        if not parts:
            return None, "IS_OTHER_PAGE", "youtu.be with no path"
        if first == "live" and len(parts) >= 2:
            return _finish_id(parts[1])
        return _finish_id(parts[0])

    if first == "shorts":
        return None, "IS_SHORTS", "path is /shorts/"
    if first == "clip":
        return None, "IS_CLIP", "path is /clip/"
    if first == "playlist":
        return None, "IS_PLAYLIST", "path is /playlist"
    if first == "watch_videos":
        return None, "IS_PLAYLIST", "path is /watch_videos (temporary queue)"
    if first == "live_stream":
        return None, "IS_CHANNEL_LIVE", "path is /live_stream (channel-level, no fixed id)"
    if first.startswith("@") or first in CHANNEL_PREFIXES:
        return None, "IS_CHANNEL", f"path is /{first}"
    if first == "results":
        return None, "IS_SEARCH", "path is /results"
    if first == "feed":
        return None, "IS_OTHER_PAGE", "path is /feed"

    if first == "watch":
        vid = None
        for key in ("v", "V"):
            if query.get(key):
                vid = query[key][0]
                break
        if not vid:
            return None, "BAD_VIDEO_ID", "/watch with no v= parameter"
        return _finish_id(vid)

    # /live/ID is the livestream permalink -- shape is fine, the API decides
    # whether it is still running.
    if first == "live" and len(parts) >= 2:
        return _finish_id(parts[1])

    if first in ("embed", "v") and len(parts) >= 2:
        if parts[1].lower() == "videoseries":
            return None, "IS_PLAYLIST", "embed/videoseries is a playlist embed"
        return _finish_id(parts[1])

    if first == "attribution_link":
        inner = query.get("u", [None])[0]
        if inner:
            return parse_youtube_url("https://www.youtube.com" + urllib.parse.unquote(inner))
        return None, "BAD_VIDEO_ID", "attribution_link with no u="

    if not parts:
        vid = query.get("v", [None])[0]
        if vid:
            return _finish_id(vid)
        return None, "IS_OTHER_PAGE", "youtube.com homepage"

    return None, "IS_CHANNEL", f"unrecognised path /{first} (likely a channel vanity URL)"


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 1-A  --  YOUTUBE DATA API   (validation + metadata, one call)
# ══════════════════════════════════════════════════════════════════════════

API_PARTS = "snippet,contentDetails,status,statistics,liveStreamingDetails,topicDetails"

CATEGORY_NAMES: dict[str, str] = {
    "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music",
    "15": "Pets & Animals", "17": "Sports", "18": "Short Movies",
    "19": "Travel & Events", "20": "Gaming", "21": "Videoblogging",
    "22": "People & Blogs", "23": "Comedy", "24": "Entertainment",
    "25": "News & Politics", "26": "Howto & Style", "27": "Education",
    "28": "Science & Technology", "29": "Nonprofits & Activism",
    "30": "Movies", "31": "Anime/Animation", "32": "Action/Adventure",
    "33": "Classics", "34": "Comedy", "35": "Documentary", "36": "Drama",
    "37": "Family", "38": "Foreign", "39": "Horror", "40": "Sci-Fi/Fantasy",
    "41": "Thriller", "42": "Shorts", "43": "Shows", "44": "Trailers",
}

_ISO_DUR_RE = re.compile(
    r"^P(?:(?P<d>\d+)D)?(?:T(?:(?P<h>\d+)H)?(?:(?P<m>\d+)M)?(?:(?P<s>\d+)S)?)?$"
)


def parse_iso_duration(value: str) -> Optional[int]:
    if not value:
        return None
    m = _ISO_DUR_RE.match(value.strip())
    if not m:
        return None
    return (int(m.group("d") or 0) * 86400 + int(m.group("h") or 0) * 3600
            + int(m.group("m") or 0) * 60 + int(m.group("s") or 0))


def fmt_hms(seconds: Optional[float]) -> str:
    if seconds is None:
        return "?"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def human_duration(seconds: Optional[int]) -> str:
    if seconds is None:
        return "?"
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def classify_video_kind(item: dict) -> str:
    """
    NORMAL | ENDED_LIVESTREAM | LIVE_NOW | UPCOMING

    Two signals are cross-checked because liveBroadcastContent can lag for a
    few minutes after a stream actually ends.
    """
    snippet = item.get("snippet") or {}
    lsd = item.get("liveStreamingDetails") or {}
    broadcast = (snippet.get("liveBroadcastContent") or "none").lower()

    if broadcast == "live":
        return "LIVE_NOW"
    if broadcast == "upcoming":
        return "UPCOMING"
    if lsd:
        if lsd.get("actualEndTime"):
            return "ENDED_LIVESTREAM"
        if lsd.get("actualStartTime"):
            return "LIVE_NOW"      # started, never marked ended
        if lsd.get("scheduledStartTime"):
            return "UPCOMING"
    return "NORMAL"


def _topic_names(topic_urls) -> list[str]:
    out = []
    for url in topic_urls or []:
        tail = url.rstrip("/").rsplit("/", 1)[-1]
        out.append(urllib.parse.unquote(tail).replace("_", " "))
    return out


def _crop(text: str, limit: int = 600) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    window = text[:limit]
    cut = max(window.rfind(". "), window.rfind("\n"))
    if cut > limit * 0.5:
        return window[:cut + 1].strip() + " ..."
    return window.strip() + " ..."


def fetch_youtube_data(video_id: str) -> dict:
    """
    One videos.list call, all parts. Returns:
      {"ok": bool, "reject_code": str|None, "detail": str, "meta": {...}}
    """
    key = get_key("YOUTUBE_API_KEY")
    if not key:
        return {"ok": False, "reject_code": "API_KEY_MISSING",
                "detail": "no YOUTUBE_API_KEY in env or api_keys.json", "meta": {}}

    params = urllib.parse.urlencode({"id": video_id, "part": API_PARTS, "key": key})
    url = f"https://www.googleapis.com/youtube/v3/videos?{params}"
    req = urllib.request.Request(url, headers={"Accept": "application/json",
                                               "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=YT_API_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", str(e))
        except Exception:
            msg = str(e)
        return {"ok": False, "reject_code": "API_ERROR",
                "detail": f"HTTP {e.code}: {msg}", "meta": {}}
    except Exception as e:
        return {"ok": False, "reject_code": "API_ERROR",
                "detail": f"{type(e).__name__}: {e}", "meta": {}}

    items = body.get("items") or []
    if not items:
        return {"ok": False, "reject_code": "VIDEO_NOT_FOUND",
                "detail": "videos.list returned zero items", "meta": {}}

    item = items[0]
    snippet = item.get("snippet") or {}
    content = item.get("contentDetails") or {}
    status = item.get("status") or {}
    stats = item.get("statistics") or {}
    lsd = item.get("liveStreamingDetails") or {}
    topics = item.get("topicDetails") or {}

    upload_status = (status.get("uploadStatus") or "").lower()
    if upload_status and upload_status not in ("processed", "uploaded"):
        return {"ok": False, "reject_code": "NOT_PROCESSED",
                "detail": f"uploadStatus={upload_status}", "meta": {}}

    kind = classify_video_kind(item)
    if kind == "LIVE_NOW":
        return {"ok": False, "reject_code": "LIVE_NOW",
                "detail": f"liveBroadcastContent={snippet.get('liveBroadcastContent')}, "
                          f"actualStartTime={lsd.get('actualStartTime')}", "meta": {}}
    if kind == "UPCOMING":
        return {"ok": False, "reject_code": "LIVE_UPCOMING",
                "detail": f"scheduledStartTime={lsd.get('scheduledStartTime')}", "meta": {}}

    def _int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    cat_id = str(snippet.get("categoryId") or "")
    region = content.get("regionRestriction") or {}
    caption_flag = content.get("caption")

    meta = {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": snippet.get("title") or "",
        "channel": snippet.get("channelTitle") or "",
        "channel_id": snippet.get("channelId") or "",
        "description": _crop(snippet.get("description") or ""),
        "tags": (snippet.get("tags") or [])[:25],
        "category_id": cat_id,
        "category": CATEGORY_NAMES.get(cat_id, f"Unknown ({cat_id})"),
        "published_at": snippet.get("publishedAt") or "",
        "declared_language": snippet.get("defaultAudioLanguage") or snippet.get("defaultLanguage"),
        "duration_seconds": parse_iso_duration(content.get("duration") or ""),
        "video_kind": kind,
        "was_livestream": bool(lsd),
        "yt_says_has_captions": None if caption_flag is None else str(caption_flag).lower() == "true",
        "licensed_content": content.get("licensedContent"),
        "definition": content.get("definition"),
        "region_blocked": region.get("blocked") or [],
        "view_count": _int(stats.get("viewCount")),
        "like_count": _int(stats.get("likeCount")),
        "comment_count": _int(stats.get("commentCount")),
        "topics": _topic_names(topics.get("topicCategories")),
        "made_for_kids": status.get("madeForKids"),
    }
    return {"ok": True, "reject_code": None, "detail": "", "meta": meta}


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 1-B  --  GPROXY  +  ONE yt-dlp EXTRACT  (transcript track + heatmap)
# ══════════════════════════════════════════════════════════════════════════

def generate_proxy() -> tuple[Optional[str], str]:
    """Sticky residential proxy from GProxy. Costs no bandwidth to obtain."""
    password = get_key("GPROXY_PASS")
    if not password:
        return None, "no GPROXY_PASS configured"

    payload = json.dumps({
        "countries": ["IN", "US"],
        "protocol": "http",
        "sticky": True,
        "lifetime": 5,
        "count": 1,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://gproxy.net/api/v1/proxy/generate/", data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {password}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0")

    try:
        with urllib.request.urlopen(req, timeout=PROXY_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        proxies = data.get("proxies") or []
        if not proxies:
            return None, "GProxy returned an empty proxy list"
        proxy = proxies[0]
        if not proxy.startswith(("http://", "https://")):
            proxy = "http://" + proxy
        return proxy, ""
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _ydl_opts(proxy: Optional[str], clients: list[str]) -> dict:
    opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": clients}},
        "youtube_include_dash_manifest": False,
        "youtube_include_hls_manifest": False,
        "socket_timeout": 20,
    }
    if proxy:
        opts["proxy"] = proxy
    return opts


def yt_extract(video_id: str, proxy: Optional[str]) -> tuple[Optional[dict], str, list[str]]:
    """
    ONE extract_info call -> caption tracks AND heatmap AND stream language.
    Returns (info, attempt_note, attempt_log).

    Retry ladder, cheapest and most reliable first:
        1. proxy      + android_vr,ios     (the clients that still ship ASR)
        2. new proxy  + web_safari,mweb
        3. no proxy   + android_vr,ios     (only if ALLOW_DIRECT_FALLBACK)
    """
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        return None, "yt-dlp not installed (pip install -U --pre yt-dlp)", []

    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"
    log: list[str] = []

    plans: list[tuple[Optional[str], list[str], str]] = [
        (proxy, ["android_vr", "ios"], "proxy+android_vr/ios"),
        (None,  ["web_safari", "mweb"], "newproxy+web_safari/mweb"),  # proxy filled below
    ]
    if ALLOW_DIRECT_FALLBACK:
        plans.append((None, ["android_vr", "ios"], "direct+android_vr/ios"))

    for idx, (p, clients, label) in enumerate(plans):
        if idx == 1:
            # second attempt gets a fresh sticky IP; the old one may be burnt
            p, err = generate_proxy()
            if not p:
                log.append(f"{label}: fresh proxy failed ({err}), skipped")
                continue
        try:
            with yt_dlp.YoutubeDL(_ydl_opts(p, clients)) as ydl:
                info = ydl.extract_info(url, download=False)
            if info:
                log.append(f"{label}: ok")
                return info, label, log
            log.append(f"{label}: returned nothing")
        except Exception as e:
            log.append(f"{label}: {type(e).__name__}: {str(e)[:160]}")

    return None, "all extract attempts failed", log


def pick_caption_track(info: dict, declared_lang: Optional[str]) -> dict:
    """
    Choose which caption track to download.

    The trap: automatic_captions holds 100+ MACHINE TRANSLATIONS alongside the
    one real ASR track. Grabbing "whatever key comes first" silently hands you
    a translation of a translation. So we identify the original explicitly:

      1. yt-dlp marks the source track with a '<lang>-orig' key -- the most
         reliable signal available.
      2. the stream's own declared language (info['language'])
      3. the Data API's defaultAudioLanguage (cross-fed from the parallel track)
      4. manual creator captions
      5. last resort: any auto track, flagged as a translation
    """
    auto = info.get("automatic_captions") or {}
    manual = info.get("subtitles") or {}
    stream_lang = info.get("language")

    def _fmt(track):
        return next((f for f in (track or []) if f.get("ext") == "json3"), None)

    # 1. the -orig marker
    for k in auto:
        if k.endswith("-orig"):
            base = k[:-5]
            for cand in (base, k):
                if cand in auto and _fmt(auto[cand]):
                    return {"lang": cand, "track": auto[cand], "kind": "asr",
                            "is_original": True, "how": f"-orig marker ({k})"}

    # 2 & 3. declared language
    for lang, how in ((stream_lang, "stream language"),
                      (declared_lang, "Data API defaultAudioLanguage")):
        if lang and lang in auto and _fmt(auto[lang]):
            return {"lang": lang, "track": auto[lang], "kind": "asr",
                    "is_original": True, "how": how}
        if lang and lang in manual and _fmt(manual[lang]):
            return {"lang": lang, "track": manual[lang], "kind": "manual",
                    "is_original": True, "how": how + " (manual)"}

    # 4. manual captions -- creator-uploaded, almost always in one real language,
    #    so taking the first key here is far safer than doing it for auto.
    for lang, track in manual.items():
        if _fmt(track):
            return {"lang": lang, "track": track, "kind": "manual",
                    "is_original": True, "how": "only manual track available"}

    # 5. any auto track, and be honest that it may be a translation
    for lang in ("en", "hi"):
        if lang in auto and _fmt(auto[lang]):
            return {"lang": lang, "track": auto[lang], "kind": "asr",
                    "is_original": False, "how": "fallback, may be a translation"}
    for lang, track in auto.items():
        if _fmt(track):
            return {"lang": lang, "track": track, "kind": "asr",
                    "is_original": False, "how": "fallback, may be a translation"}

    return {"lang": None, "track": None, "kind": None, "is_original": False,
            "how": "no json3 caption track of any kind"}


def download_captions(track: list, proxy: Optional[str]) -> tuple[Optional[bytes], str]:
    fmt = next((f for f in track if f.get("ext") == "json3"), None)
    if not fmt:
        return None, "no json3 format in track"

    req = urllib.request.Request(fmt["url"], headers={"User-Agent": "Mozilla/5.0"})

    # DIRECT FIRST, on purpose. The caption URL is a plain timedtext link that is
    # not IP-locked, and this file is the single biggest download in the run
    # (1.6 MB on your 84-minute video). Routing it through GProxy cost ~25s of
    # latency AND ate residential bandwidth you pay for by the megabyte, for no
    # benefit. Proxy stays as the fallback in case YouTube ever starts binding
    # the URL to the extracting IP.
    try:
        with urllib.request.urlopen(req, timeout=CAPTION_TIMEOUT) as resp:
            return resp.read(), "direct"
    except Exception as e_direct:
        if not proxy:
            return None, f"direct: {e_direct}"
        try:
            opener = urllib.request.build_opener(
                urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
            with opener.open(req, timeout=CAPTION_TIMEOUT) as resp:
                return resp.read(), "via proxy (direct failed)"
        except Exception as e_proxy:
            return None, f"direct: {e_direct}; proxy: {e_proxy}"


def parse_json3(raw: bytes) -> tuple[list[dict], int]:
    """
    json3 -> [{"t": start_sec, "d": dur_sec, "text": "..."}], word_count

    Two real-world quirks handled:
      * ASR json3 emits rolling partial lines flagged aAppend=1. Left in, they
        double the word count and wreck every density number downstream.
      * Segments that are only "\n" are layout, not speech.
    """
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except Exception:
        return [], 0

    lines: list[dict] = []
    words = 0
    seen: set[tuple[int, str]] = set()

    for ev in data.get("events") or []:
        if ev.get("aAppend"):
            continue
        t0 = ev.get("tStartMs")
        if t0 is None:
            continue
        segs = ev.get("segs") or []
        text = "".join((s.get("utf8") or "") for s in segs)
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        key = (int(t0), text)
        if key in seen:
            continue
        seen.add(key)
        dur_ms = ev.get("dDurationMs") or 0
        lines.append({
            "t": round(int(t0) / 1000.0, 2),
            "d": round(max(int(dur_ms), 0) / 1000.0, 2),
            "text": text,
        })
        words += len(text.split())

    lines.sort(key=lambda x: x["t"])
    return lines, words


def extract_heatmap(info: dict) -> Optional[list[dict]]:
    """
    YouTube's 'Most Replayed' curve. It ships inside the same info blob the
    caption track list came from -- no second request, which is why step_03
    no longer needs to exist.
    """
    hm = info.get("heatmap")
    if not hm:
        return None
    out = []
    for p in hm:
        try:
            out.append({
                "start": float(p.get("start_time") or 0),
                "end": float(p.get("end_time") or 0),
                "value": float(p.get("value") or 0),
            })
        except (TypeError, ValueError):
            continue
    return out or None


def fetch_track_b(video_id: str, declared_lang: Optional[str], tl: Timeline,
                  gate: dict) -> dict:
    """
    Track B, in order:
        GProxy handshake  (free, ~0.6s)
          -> check the validation gate that Track A filled in by now
          -> yt-dlp extract  (transcript track list + heatmap, ONE call)
          -> json3 download
    """
    out: dict[str, Any] = {
        "proxy": None, "proxy_error": "", "info_ok": False, "attempts": [],
        "lines": [], "word_count": 0, "caption_lang": None, "caption_kind": None,
        "caption_is_original": True, "caption_how": "", "caption_bytes": 0,
        "heatmap": None, "stream_duration": None, "error": "",
    }

    with Clock(tl, "GProxy handshake") as c:
        proxy, err = generate_proxy()
        out["proxy"], out["proxy_error"] = proxy, err
        if not proxy:
            c.ok = False
            c.note = f"{err} -- continuing without proxy"
        else:
            c.note = proxy.split("@")[-1] if "@" in proxy else proxy

    # The gate is why the handshake goes first: it costs zero bandwidth, and by
    # the time it returns, Track A has already said whether this video is real.
    if gate.get("decided") and not gate.get("ok"):
        out["error"] = "skipped -- link validation already failed"
        return out

    with Clock(tl, "yt-dlp extract") as c:
        info, label, log = yt_extract(video_id, proxy)
        out["attempts"] = log
        if not info:
            c.ok = False
            c.note = "; ".join(log[-2:]) or label
            out["error"] = "could not read the video from YouTube"
            return out
        out["info_ok"] = True
        c.note = f"{label} (transcript track + heatmap in 1 call)"

    out["stream_duration"] = info.get("duration")
    out["heatmap"] = extract_heatmap(info)

    pick = pick_caption_track(info, declared_lang)
    out["caption_lang"] = pick["lang"]
    out["caption_kind"] = pick["kind"]
    out["caption_is_original"] = pick["is_original"]
    out["caption_how"] = pick["how"]

    if not pick["track"]:
        tl.add("Transcript download", 0.0, False, pick["how"])
        return out

    with Clock(tl, "Transcript download") as c:
        raw, note = download_captions(pick["track"], proxy)
        if not raw:
            c.ok = False
            c.note = note
            return out
        out["caption_bytes"] = len(raw)
        lines, words = parse_json3(raw)
        out["lines"], out["word_count"] = lines, words
        kb = len(raw) / 1024
        c.note = f"{kb:.1f} KB, {pick['kind']} ({pick['lang']}), {len(lines)} lines"
        if note:
            c.note += f" [{note}]"
        if not lines:
            c.ok = False
            c.note += " -- parsed empty"

    return out


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 2  --  TRANSCRIPT FORENSICS   (pure Python, measured not guessed)
# ══════════════════════════════════════════════════════════════════════════
#
#  This is the part that makes the verdict reliable. A cheap LLM cannot count
#  minutes of silence across a 3-hour transcript -- but it does not have to.
#  Everything countable is counted here, handed over as facts, and a few
#  warnings are enforced in code afterwards regardless of what the LLM says.
#  The LLM's job is judgement and language; this is arithmetic.

def _merge_intervals(intervals: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not intervals:
        return []
    intervals = sorted(intervals)
    merged = [list(intervals[0])]
    for a, b in intervals[1:]:
        if a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged]


def analyze_transcript(lines: list[dict], duration_s: Optional[float]) -> dict:
    f: dict[str, Any] = {
        "line_count": len(lines),
        "word_count": 0,
        "duration_s": duration_s,
        "speech_seconds": 0.0,
        "coverage_pct": 0.0,
        "wpm_speaking": 0.0,
        "wpm_overall": 0.0,
        "dead_zones": [],
        "gap_count": 0,
        "total_gap_s": 0.0,
        "longest_gap_s": 0.0,
        "lead_silence_s": 0.0,
        "trail_silence_s": 0.0,
        "music_tag_ratio": 0.0,
        "repeat_ratio": 0.0,
        "unique_word_ratio": 0.0,
        "avg_line_words": 0.0,
        "lyrics_signal": "NONE",
        "lyrics_note": "",
        "density_map": [],
        "density_bucket_s": 60,
        "first_speech_s": None,
        "last_speech_s": None,
    }
    if not lines:
        return f

    # --- words, music tags, spans -------------------------------------
    all_words: list[str] = []
    music_lines = 0
    spans: list[tuple[float, float]] = []

    for ln in lines:
        text = ln["text"]
        if MUSIC_TAG_RE.match(text) or MUSIC_NOTE_RE.match(text):
            music_lines += 1
        w = re.findall(r"[^\W\d_]+", text.lower(), flags=re.UNICODE)
        all_words.extend(w)
        start = ln["t"]
        # json3 duration is unreliable on some tracks; fall back to a words-based
        # estimate rather than trusting a zero.
        dur = ln["d"] if ln["d"] and ln["d"] > 0 else max(len(text.split()) / 2.8, 0.6)
        spans.append((start, start + min(dur, 30.0)))

    f["word_count"] = len(all_words)
    f["avg_line_words"] = round(len(all_words) / max(len(lines), 1), 1)
    f["music_tag_ratio"] = round(music_lines / max(len(lines), 1), 3)

    merged = _merge_intervals(spans)
    f["speech_seconds"] = round(sum(b - a for a, b in merged), 1)
    f["first_speech_s"] = round(merged[0][0], 1)
    f["last_speech_s"] = round(merged[-1][1], 1)

    total = float(duration_s) if duration_s else merged[-1][1]
    total = max(total, 1.0)
    f["duration_s"] = round(total, 1)
    f["coverage_pct"] = round(min(f["speech_seconds"] / total * 100.0, 100.0), 1)
    f["wpm_speaking"] = round(len(all_words) / max(f["speech_seconds"] / 60.0, 0.01), 1)
    f["wpm_overall"] = round(len(all_words) / (total / 60.0), 1)

    # --- silences ------------------------------------------------------
    f["lead_silence_s"] = round(merged[0][0], 1)
    f["trail_silence_s"] = round(max(total - merged[-1][1], 0), 1)

    gaps: list[tuple[float, float, str]] = []
    if merged[0][0] >= GAP_MIN_S:
        gaps.append((0.0, merged[0][0], "lead"))
    for i in range(len(merged) - 1):
        a, b = merged[i][1], merged[i + 1][0]
        if b - a >= GAP_MIN_S:
            gaps.append((a, b, "interior"))
    if total - merged[-1][1] >= GAP_MIN_S:
        gaps.append((merged[-1][1], total, "trail"))

    f["gap_count"] = len(gaps)
    f["total_gap_s"] = round(sum(b - a for a, b, _ in gaps), 1)
    f["longest_gap_s"] = round(max((b - a for a, b, _ in gaps), default=0.0), 1)

    # A dead zone is a silence worth telling the user about -- which is not the
    # same as any silence. Trailing silence is outro music, credits, or an end
    # card, and EVERY video has some; warning about it every single time is
    # noise that teaches the user to ignore warnings. So the tail needs a far
    # higher bar. Leading silence keeps the normal bar, because "the first 20
    # minutes are just music" is exactly the case this tool exists to catch.
    def _is_dead_zone(a: float, b: float, kind: str) -> bool:
        length = b - a
        if kind == "trail":
            return (length >= DEAD_ZONE_TRAIL_MIN_S
                    and length / total * 100.0 >= DEAD_ZONE_TRAIL_MIN_PCT)
        return length >= DEAD_ZONE_MIN_S

    f["dead_zones"] = [
        {"start_s": round(a, 1), "end_s": round(b, 1), "length_s": round(b - a, 1),
         "kind": kind, "range": f"{fmt_hms(a)} {_c('→', '->')} {fmt_hms(b)}"}
        for a, b, kind in sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)
        if _is_dead_zone(a, b, kind)
    ][:6]

    # --- lyrics fingerprint --------------------------------------------
    # Songs repeat. Conversation does not. A 5-gram duplicate ratio separates
    # the two far more cleanly than looking for the word "chorus".
    if len(all_words) >= 60:
        n = 5
        grams = [tuple(all_words[i:i + n]) for i in range(len(all_words) - n + 1)]
        f["repeat_ratio"] = round(1.0 - (len(set(grams)) / max(len(grams), 1)), 3)
        f["unique_word_ratio"] = round(len(set(all_words)) / len(all_words), 3)

    # Combine the three signals HERE rather than leaving a cheap model to do it.
    # Repetition alone is not a song: chants, prayers, mantras, guided
    # meditation, language drills and sales scripts all repeat heavily while
    # being perfectly good speech. What separates an actual song is repetition
    # PLUS music tagging PLUS short fragmentary lines. Getting this wrong in
    # the confident direction would block a legitimate video, so STRONG is
    # deliberately hard to reach and everything else says "go read the text".
    rep, uniq = f["repeat_ratio"], f["unique_word_ratio"]
    tags, avg_len = f["music_tag_ratio"], f["avg_line_words"]
    if tags >= 0.55:
        f["lyrics_signal"] = "STRONG"
        f["lyrics_note"] = f"{int(tags * 100)}% of lines are only music tags"
    elif rep > 0.30 and uniq < 0.25 and (tags >= 0.10 or avg_len < 9):
        f["lyrics_signal"] = "STRONG"
        f["lyrics_note"] = ("heavy repetition, tiny vocabulary and "
                            + ("music tags present" if tags >= 0.10
                               else f"very short lines ({avg_len} words avg)"))
    elif rep > 0.30 and uniq < 0.25:
        f["lyrics_signal"] = "MODERATE"
        f["lyrics_note"] = ("repetitive with a small vocabulary, but the lines are "
                            "full-length and untagged -- could equally be a chant, "
                            "mantra, prayer, drill or scripted repetition. READ THE "
                            "TEXT before calling this a song")
    else:
        f["lyrics_signal"] = "NONE"
        f["lyrics_note"] = "reads like normal speech"

    # --- density map ----------------------------------------------------
    # Words per bucket across the whole timeline. This is the single most
    # useful thing the LLM receives: "first 20 minutes is only music" is
    # visible at a glance as a run of zeros, with no counting required.
    bucket = 60
    while total / bucket > 140:
        bucket += 60
    f["density_bucket_s"] = bucket
    n_buckets = max(int(total // bucket) + 1, 1)
    dens = [0] * n_buckets
    for ln in lines:
        i = min(int(ln["t"] // bucket), n_buckets - 1)
        dens[i] += len(ln["text"].split())
    f["density_map"] = dens
    return f


def heatmap_moments(heat: dict, lines: list[dict], window: int = 25,
                    top_n: int = 8) -> list[dict]:
    """
    Pull the actual transcript text sitting at each 'most replayed' peak.

    This is the highest-value thing in the whole payload. A heatmap peak is
    thousands of real viewers voting with their attention -- but a bare
    timestamp tells the model nothing it can judge. Handing it the WORDS at
    that timestamp turns the peak from trivia into evidence, and lets the
    "one great moment in an otherwise flat video" case score correctly.
    """
    if not heat.get("available") or not lines:
        return []
    out = []
    for pk in heat.get("peaks", [])[:top_n]:
        at = pk["at_s"]
        txt = " ".join(ln["text"] for ln in lines
                       if at - window <= ln["t"] <= at + window).strip()
        if len(txt) > 400:
            txt = txt[:400].rsplit(" ", 1)[0] + " ..."
        if txt:
            out.append({"at_s": at, "at": pk["at"], "value": pk["value"], "text": txt})
    return out


def summarise_heatmap(heatmap: Optional[list[dict]], top_n: int = 15) -> dict:
    if not heatmap:
        return {"available": False, "point_count": 0, "peaks": []}
    peaks = [p for p in heatmap if p["value"] >= 0.50]
    peaks.sort(key=lambda p: p["value"], reverse=True)
    return {
        "available": True,
        "point_count": len(heatmap),
        "peak_count": len(peaks),
        "peaks": [
            {"at_s": int(p["start"]), "at": fmt_hms(p["start"]), "value": round(p["value"], 2)}
            for p in sorted(peaks[:top_n], key=lambda p: p["start"])
        ],
    }


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 3-A  --  PAYLOAD
# ══════════════════════════════════════════════════════════════════════════

def est_tokens(text: str) -> int:
    return max(1, len(text) // 4)


ASR_TAG_RE = re.compile(
    r"\[(music|applause|laughter|clapping|cheering|संगीत|तालियां)\]\s*", re.IGNORECASE)


def chunk_lines(lines: list[dict], seconds: int = CHUNK_SECONDS,
                max_chars: int = CHUNK_MAX_CHARS) -> list[dict]:
    """
    YouTube's ASR ships one caption event every ~2 seconds. Sent as-is, an
    84-minute video becomes 2,104 separate '[1234s] four words' lines -- the
    timestamps alone cost more tokens than the speech.

    Merging them into ~22s blocks cuts the payload roughly 4x with zero loss
    of what the bouncer actually needs: it is deciding whether the transcript
    is real speech, not locating a clip to the second. Precise boundaries are
    step 4's job, not this one's.
    """
    out: list[dict] = []
    cur_t: Optional[float] = None
    buf: list[str] = []

    def flush():
        if buf and cur_t is not None:
            text = " ".join(buf)
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                out.append({"t": cur_t, "text": text})

    for ln in lines:
        # Strip YouTube's own ASR tags -- your PANNs/YAMNet models do this
        # better downstream, and here they are pure token cost. Kept only when
        # a tag IS the whole line, because then it is evidence of silence.
        raw = ln["text"]
        stripped = ASR_TAG_RE.sub("", raw).strip()
        text = raw.strip() if not stripped else stripped
        text = re.sub(r">>\s*", "", text)
        if not text:
            continue
        if cur_t is None:
            cur_t = ln["t"]
        over_time = ln["t"] - cur_t >= seconds
        over_size = sum(len(b) + 1 for b in buf) >= max_chars
        if buf and (over_time or over_size):
            flush()
            buf, cur_t = [], ln["t"]
        buf.append(text)
    flush()
    return out


def render_transcript(lines: list[dict], budget: int = MAX_TRANSCRIPT_CHARS) -> tuple[str, bool]:
    """
    Format as '[123s] text'. If over budget, sample EVENLY across the timeline
    instead of truncating.

    Truncating from the front would be a correctness bug, not just a loss:
    the exact scenario this whole tool exists to catch -- 20 minutes of music
    followed by 10 good minutes -- lives at the END of the video.
    """
    lines = chunk_lines(lines)

    def one(ln: dict) -> str:
        return f"[{int(ln['t'])}s] {ln['text']}"

    full = "\n".join(one(ln) for ln in lines)
    if len(full) <= budget or not lines:
        return full, False

    per_window = budget // SAMPLE_WINDOWS
    size = max(len(lines) // SAMPLE_WINDOWS, 1)
    chunks: list[str] = []

    for w in range(SAMPLE_WINDOWS):
        lo = w * size
        hi = len(lines) if w == SAMPLE_WINDOWS - 1 else min((w + 1) * size, len(lines))
        if lo >= len(lines):
            break
        kept, used, last = [], 0, lo
        for i in range(lo, hi):
            s = one(lines[i])
            if used + len(s) > per_window and kept:
                break
            kept.append(s)
            used += len(s) + 1
            last = i
        if not kept:
            continue
        chunks.append("\n".join(kept))
        if last + 1 < hi:
            skipped = sum(len(lines[j]["text"].split()) for j in range(last + 1, hi))
            arrow = _c("→", "->")
            chunks.append(
                f"\n{_c('···', '...')} [skipped {fmt_hms(lines[last + 1]['t'])} {arrow} "
                f"{fmt_hms(lines[hi - 1]['t'])}, {skipped} words] {_c('···', '...')}\n")

    return "\n".join(chunks), True


def build_payload(meta: dict, forensics: dict, heat: dict, track_b: dict,
                  lines: list[dict]) -> tuple[str, dict]:
    p: list[str] = []
    a = _c("→", "->")

    p.append("=== VIDEO METADATA ===")
    p.append(f"title           : {meta.get('title')}")
    p.append(f"channel         : {meta.get('channel')}")
    p.append(f"youtube_category: {meta.get('category')}")
    dur = meta.get("duration_seconds")
    p.append(f"duration        : {fmt_hms(dur)}  ({dur}s)")
    p.append(f"video_kind      : {meta.get('video_kind')}"
             + ("  (this was a livestream that has ended)" if meta.get("was_livestream") else ""))
    p.append(f"declared_language: {meta.get('declared_language') or 'not declared'}")
    p.append(f"views           : {meta.get('view_count')}")
    p.append(f"likes           : {meta.get('like_count')}")
    p.append(f"comments        : {meta.get('comment_count')}")
    p.append(f"published       : {meta.get('published_at')}")
    p.append(f"made_for_kids   : {meta.get('made_for_kids')}")
    if meta.get("topics"):
        p.append(f"topics          : {', '.join(meta['topics'][:8])}")
    if meta.get("tags"):
        p.append(f"tags            : {', '.join(meta['tags'][:20])}")
    if meta.get("description"):
        p.append(f"description     : {meta['description']}")
    p.append("")

    p.append("=== TRANSCRIPT FORENSICS (computed in code -- trust these over your impression) ===")
    if not lines:
        p.append("NO TRANSCRIPT COULD BE RETRIEVED.")
        p.append(f"reason: {track_b.get('caption_how') or track_b.get('error') or 'unknown'}")
        p.append("Judge from metadata alone. If this looks like a music video, a movie, or a")
        p.append("song upload, that absence is itself the evidence -- say so plainly.")
    else:
        p.append(f"caption_kind      : {track_b.get('caption_kind')}   "
                 f"(asr = YouTube's own speech recognition; manual = creator-uploaded)")
        p.append(f"caption_language  : {track_b.get('caption_lang')}"
                 + ("" if track_b.get("caption_is_original") else "   <-- MAY BE A MACHINE TRANSLATION"))
        p.append(f"line_count        : {forensics['line_count']}")
        p.append(f"word_count        : {forensics['word_count']}")
        p.append(f"speech_seconds    : {forensics['speech_seconds']}  of {forensics['duration_s']}s total")
        p.append(f"coverage_pct      : {forensics['coverage_pct']}%   (share of the video that has speech)")
        p.append(f"wpm_speaking      : {forensics['wpm_speaking']}   (words per minute while actually talking)")
        p.append(f"wpm_overall       : {forensics['wpm_overall']}")
        p.append(f"avg_line_words    : {forensics['avg_line_words']}")
        p.append(f"music_tag_ratio   : {forensics['music_tag_ratio']}   (share of lines that are only [Music]/note symbols)")
        p.append(f"repeat_ratio      : {forensics['repeat_ratio']}   (duplicate 5-word runs)")
        p.append(f"unique_word_ratio : {forensics['unique_word_ratio']}")
        p.append(f"LYRICS_SIGNAL     : {forensics['lyrics_signal']}   -- {forensics['lyrics_note']}")
        p.append("    STRONG   = the numbers say song. Confirm in the text, then you may block MUSIC.")
        p.append("    MODERATE = repetitive but NOT necessarily a song. Do NOT block on this alone.")
        p.append("    NONE     = normal speech. Blocking MUSIC here would need very clear textual proof.")
        p.append(f"lead_silence_s    : {forensics['lead_silence_s']}   (silence before the first word)")
        p.append(f"trail_silence_s   : {forensics['trail_silence_s']}")
        p.append(f"gaps_over_{GAP_MIN_S}s     : {forensics['gap_count']}, "
                 f"totalling {forensics['total_gap_s']}s, longest {forensics['longest_gap_s']}s")
        if forensics["dead_zones"]:
            p.append("dead_zones (real silences, NOT sampling gaps):")
            label = {"lead": "at the START of the video",
                     "trail": "at the END of the video",
                     "interior": "in the middle"}
            for dz in forensics["dead_zones"]:
                p.append(f"    {dz['range']}   ({int(dz['length_s'])}s of no speech at all, "
                         f"{label.get(dz.get('kind', 'interior'), '')})")
        else:
            p.append("dead_zones        : none over "
                     f"{DEAD_ZONE_MIN_S}s -- speech is continuous enough")
    p.append("")

    if lines:
        b = forensics["density_bucket_s"]
        p.append(f"=== SPEECH DENSITY MAP (words per {b}s bucket, whole video, in order) ===")
        p.append("A run of zeros = no talking in that stretch. Front zeros = long intro.")
        p.append(",".join(str(x) for x in forensics["density_map"]))
        p.append("")

    p.append("=== HEATMAP (YouTube 'Most Replayed') ===")
    if heat.get("available"):
        p.append(f"{heat['point_count']} points, {heat.get('peak_count', 0)} above 0.50. Top peaks:")
        for pk in heat["peaks"]:
            p.append(f"    {pk['at']}  ({pk['at_s']}s)   {pk['value']}")
        hm = heatmap_moments(heat, lines)
        if hm:
            p.append("")
            p.append("--- WHAT PEOPLE ACTUALLY REPLAYED (transcript at each peak) ---")
            p.append("Thousands of real viewers chose these seconds. This is the strongest")
            p.append("signal in this payload -- weight it heavily when scoring.")
            for m in hm:
                p.append(f"  [{m['at_s']}s] {m['at']} (replay {m['value']}): {m['text']}")
    else:
        p.append("Not available. Normal for newer or lower-view videos; it is not a problem,")
        p.append("it just means there is no audience-replay signal to cross-check.")
    p.append("")

    sampled = False
    if lines:
        body, sampled = render_transcript(lines)
        p.append("=== TRANSCRIPT ===")
        if sampled:
            p.append(f"[SAMPLED EVENLY ACROSS THE FULL VIDEO -- elisions marked inline. "
                     f"A gap here is sampling, not silence. Only dead_zones above are real.]")
        p.append(body)
        p.append("")

    p.append("=== YOUR TASK ===")
    p.append("Decide GO / GO_WITH_WARNINGS / NO_GO, score it, and explain it to the user.")
    p.append("Block only for MUSIC, GAMING, MOVIE, TRAILER, SPORTS_BROADCAST or a genuinely")
    p.append("unreadable transcript. Everything else passes -- warn instead of rejecting.")
    p.append("Quote real evidence. Output the raw JSON object only, nothing else.")

    text = "\n".join(p)
    return text, {"chars": len(text), "est_tokens": est_tokens(text), "sampled": sampled}


def load_prompt() -> str:
    path = os.path.join(_HERE, PROMPT_FILE)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Prompt file not found: {path}\n"
            f"{PROMPT_FILE} must sit next to omni_bouncer.py.")
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 3-B  --  OPENROUTER
# ══════════════════════════════════════════════════════════════════════════

def extract_json(text: str) -> Optional[dict]:
    """Models wrap JSON in fences, prose, or reasoning. Dig it out."""
    if not text:
        return None
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()
    try:
        v = json.loads(t)
        return v if isinstance(v, dict) else None
    except Exception:
        pass
    start = t.find("{")
    if start == -1:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(t)):
        ch = t[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    v = json.loads(t[start:i + 1])
                    return v if isinstance(v, dict) else None
                except Exception:
                    return None
    return None


def call_llm(system_prompt: str, payload: str, model: str = MODEL) -> dict:
    key = get_key("OPENROUTER_API_KEY")
    if not key:
        return {"ok": False, "error": "no OPENROUTER_API_KEY in env or api_keys.json",
                "verdict": None, "usage": {}, "attempts": []}

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": payload},
        ],
        "temperature": LLM_TEMPERATURE,
        "max_tokens": LLM_MAX_TOKENS,
        "response_format": {"type": "json_object"},
        "usage": {"include": True},
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/wowclip",
        "X-Title": "wowClip Omni-Bouncer",
    }

    attempts: list[str] = []
    models = [model] + [m for m in FALLBACK_MODELS if m != model]

    for m in models:
        body["model"] = m
        for attempt in range(1, LLM_ATTEMPTS + 1):
            try:
                req = urllib.request.Request(
                    OPENROUTER_URL,
                    data=json.dumps(body).encode("utf-8"),
                    headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=LLM_TIMEOUT_S) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="replace"))
            except urllib.error.HTTPError as e:
                raw = ""
                try:
                    raw = e.read().decode("utf-8", errors="replace")[:300]
                except Exception:
                    pass
                attempts.append(f"{m} #{attempt}: HTTP {e.code} {raw}")
                # 4xx other than rate limiting will not fix themselves
                break
            except Exception as e:
                attempts.append(f"{m}: {type(e).__name__}: {e}")
                break

            # OpenRouter can return an error object inside a 200 response
            if isinstance(data.get("error"), dict):
                attempts.append(f"{m}: {data['error'].get('message', '')[:200]}")
                break

            choices = data.get("choices") or []
            if not choices:
                attempts.append(f"{m} #{attempt}: no choices in response")
                continue

            msg = choices[0].get("message") or {}
            content = msg.get("content") or ""
            verdict = extract_json(content)
            usage = data.get("usage") or {}

            if verdict is None:
                attempts.append(f"{m}: replied with non-JSON ({content[:150]!r})")
                break

            attempts.append(f"{m} #{attempt}: ok")
            return {
                "ok": True, "error": "", "verdict": verdict, "model_used": m,
                "raw": content, "attempts": attempts,
                "usage": {
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                    "cost_usd": usage.get("cost"),
                },
            }

    return {"ok": False, "error": attempts[-1] if attempts else "no attempt made",
            "verdict": None, "usage": {}, "attempts": attempts}


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 4  --  MERGE   (LLM judgement + invariants that must always hold)
# ══════════════════════════════════════════════════════════════════════════
#
#  The LLM decides the category and writes the language. Code enforces the
#  things that must never depend on a cheap model having a good day:
#  a dead zone that was measured always produces a warning, an empty
#  transcript always blocks, a NO_GO always carries a block object.

VALID_DECISIONS = {"GO", "GO_WITH_WARNINGS", "NO_GO"}
VALID_BLOCKS = {"MUSIC", "GAMING", "MOVIE", "TRAILER", "SPORTS_BROADCAST",
                "NO_USABLE_TRANSCRIPT"}
VALID_WARNINGS = {
    "DEAD_ZONE", "LOW_COVERAGE", "LOW_DENSITY", "MUSIC_HEAVY", "MANUAL_CAPTIONS",
    "PLACEHOLDER_RISK", "TRANSLATED_TRACK", "NOISY_ASR", "NO_FACE_LIKELY",
    "SCREEN_HEAVY", "LOW_YIELD", "SINGLE_TOPIC", "PROMO_HEAVY", "SHORT_VIDEO",
    "VERY_LONG", "NO_HEATMAP", "MULTI_LANGUAGE", "FRAGMENTED_SPEECH",
}


def compute_base_score(meta: dict, f: dict, heat: dict, lines: list[dict]) -> int:
    """
    A score floor derived purely from measurements.

    Needed because the model lowballs: it scored a 98.7%-coverage, 253-wpm,
    80-minute Raj Shamani podcast at 55/100 while claiming the video was "35%
    silent". Both were false. A transcript that dense is objectively good raw
    material, and no amount of model mood should be able to say otherwise.
    """
    if not lines:
        return 0
    score = 50
    dur = meta.get("duration_seconds") or f.get("duration_s") or 0
    cov = f.get("coverage_pct", 0)
    wpm = f.get("wpm_overall", 0)

    if cov >= 80:
        score += 15
    elif cov >= 60:
        score += 8
    elif cov < 40:
        score -= 15

    # Words per minute across the WHOLE video is the truest density signal:
    # it collapses "how much talking" and "how much video" into one number.
    if 110 <= wpm <= 400:
        score += 15
    elif 60 <= wpm < 110:
        score += 4
    elif wpm < 60:
        score -= 20

    if 600 <= dur <= 11000:
        score += 5
    if heat.get("peak_count", 0) >= 5:
        score += 5
    if f.get("music_tag_ratio", 0) >= 0.25:
        score -= 15
    if f.get("lyrics_signal") == "STRONG":
        score -= 40
    score -= min(len(f.get("dead_zones", [])) * 10, 20)
    return max(0, min(100, score))


VALID_FLAVOURS = {"COMEDY", "SAVAGE", "SIGMA", "DEBATE", "FEELING", "FACT", "STORY"}
VALID_OUTLOOK = {"HIGH", "MEDIUM", "LOW", "NONE"}
OUTLOOK_KEYS = ("motivational", "emotional", "entertainment",
                "audience_favourite", "general")


def _norm(s: str) -> str:
    return re.sub(r"[^\w]+", "", (s or "").lower())


def clean_moments(raw: Any, duration: float, lines: list[dict]) -> tuple[list[dict], int]:
    """
    Validate the model's candidate moments and drop the invented ones.

    A quote is only accepted if it actually appears in the transcript. Cheap
    models paraphrase from memory when they cannot find a real line, and a
    fabricated quote is far worse than a missing one -- it is the single thing
    most likely to make you stop trusting the score. Returns (moments, dropped).
    """
    if not isinstance(raw, list):
        return [], 0
    haystack = _norm(" ".join(ln["text"] for ln in lines))
    out, dropped = [], 0

    for m in raw[:8]:
        if not isinstance(m, dict):
            dropped += 1
            continue
        try:
            s_ = int(float(m.get("start_s", -1)))
            e_ = int(float(m.get("end_s", -1)))
            strength = max(1, min(10, int(float(m.get("strength", 5)))))
        except (TypeError, ValueError):
            dropped += 1
            continue

        if s_ < 0 or e_ <= s_ or (duration and s_ > duration + 5):
            dropped += 1
            continue
        if e_ - s_ < 8:                 # too short to be a real clip
            dropped += 1
            continue
        e_ = min(e_, s_ + 120)

        quote = str(m.get("quote") or "").strip()[:220]
        # Verify against the transcript using a distinctive slice of the quote.
        if quote and haystack:
            probe = _norm(quote)[:45]
            if len(probe) >= 18 and probe not in haystack:
                dropped += 1
                continue

        flavour = str(m.get("flavour") or "").strip().upper()
        out.append({
            "start_s": s_, "end_s": e_,
            "range": f"{fmt_hms(s_)} {_c('→', '->')} {fmt_hms(e_)}",
            "quote": quote,
            "flavour": flavour if flavour in VALID_FLAVOURS else "OTHER",
            "strength": strength,
        })

    out.sort(key=lambda m: m["strength"], reverse=True)
    return out, dropped


def clean_outlook(raw: Any) -> dict:
    out = {}
    src = raw if isinstance(raw, dict) else {}
    for k in OUTLOOK_KEYS:
        val = str(src.get(k) or "").strip().upper()
        out[k] = val if val in VALID_OUTLOOK else "LOW"
    return out


def reconcile_score(llm_score: int, moments: list[dict], f: dict, meta: dict,
                    heat: dict, lines: list[dict], had_llm: bool) -> tuple[int, str]:
    """
    Settle the score between what the model judged and what the data can support.

    The rule that matters: **peaks decide, not averages.** A flat 3-hour podcast
    with one devastating story is a good video, so a strong moment unlocks the
    measurement floor. A dense, articulate, utterly boring lecture is a bad
    video, so with no strong moment the floor drops away and the model is free
    to score it 16.

    That asymmetry is deliberate. Earlier versions floored on transcript density
    alone, which would have rescued exactly the lectures that deserve to sink.
    """
    data_floor = compute_base_score(meta, f, heat, lines)
    words = f.get("word_count", 0)
    best = max((m["strength"] for m in moments), default=0)
    strong = [m for m in moments if m["strength"] >= 7]

    if not had_llm:
        return data_floor, "scored from measurements only"

    score = llm_score
    why = "model score accepted"

    # Ceiling: you cannot promise a goldmine on a transcript this thin.
    if words < 150:
        ceiling = 25
    elif words < 400:
        ceiling = 45
    elif words < 1200:
        ceiling = 75
    else:
        ceiling = 100
    if score > ceiling:
        score, why = ceiling, f"capped at {ceiling} -- only {words} words of speech"

    # Floor: only unlocked by a genuinely strong moment. Dense speech alone
    # earns nothing, because boring-but-dense is exactly what must score low.
    if best >= 7 and words >= 400:
        floor = data_floor if len(strong) >= 2 else data_floor - 12
        floor = max(floor, 55 if best >= 9 else 45)
        if score < floor:
            score, why = floor, (f"raised to {floor} -- model found a strength-{best} "
                                 f"moment, which is a reel on its own")
    elif best <= 4 and moments:
        # Model found nothing good. Let it score low; do not prop it up.
        why = "no strong moment found -- low score is the honest answer"

    return max(0, min(100, int(round(score)))), why


def veto_llm_claims(v: dict, f: dict, lines: list[dict]) -> list[str]:
    """
    Drop model warnings that the measurements contradict, and say what was cut.

    The model claimed "about 35% of the video is silent" on a video measured at
    98.7% speech coverage with zero gaps over 25 seconds, then cited the
    forensics block as its own evidence. That is confabulation, and shipping it
    would train you to distrust every warning the tool prints. Arithmetic wins.
    """
    if not lines:
        return []
    killed: list[str] = []
    cov = f.get("coverage_pct", 0)
    kept: list[dict] = []

    for w in v["warnings"]:
        if w.get("source") != "llm":
            kept.append(w)
            continue
        code = w["code"]
        if code == "LOW_COVERAGE" and cov >= 55:
            killed.append(f"LOW_COVERAGE (measured coverage is {cov}%)")
            continue
        if code == "DEAD_ZONE" and not f.get("dead_zones"):
            killed.append(f"DEAD_ZONE (no gap over {DEAD_ZONE_MIN_S}s exists)")
            continue
        if code in ("LOW_DENSITY", "FRAGMENTED_SPEECH") and f.get("wpm_speaking", 0) >= 110:
            killed.append(f"{code} (speech runs at {f.get('wpm_speaking')} wpm)")
            continue
        if code == "MUSIC_HEAVY" and f.get("music_tag_ratio", 0) < 0.15:
            killed.append(f"MUSIC_HEAVY (music tags are only "
                          f"{int(f.get('music_tag_ratio', 0) * 100)}% of lines)")
            continue
        kept.append(w)
    v["warnings"] = kept

    # Same rule for a hard block: never let the model call something a song when
    # the text does not read like one.
    blk = v.get("block")
    if blk and blk["code"] == "MUSIC" and f.get("lyrics_signal") == "NONE":
        killed.append("MUSIC block (lyrics fingerprint says this is normal speech)")
        v["block"] = None
    return killed


def _warn(code: str, title: str, why: str, evidence: str = "", rng: str = "") -> dict:
    return {"code": code, "title": title, "why": why, "evidence": evidence,
            "range": rng, "source": "system"}


def deterministic_warnings(meta: dict, f: dict, heat: dict, track_b: dict,
                           lines: list[dict]) -> list[dict]:
    """Warnings that are measured, so they fire whether or not the LLM noticed."""
    out: list[dict] = []
    dur = meta.get("duration_seconds") or f.get("duration_s") or 0

    for dz in f.get("dead_zones", [])[:3]:
        mins = max(int(dz["length_s"] // 60), 1)
        where = {"lead": "The video doesn't start talking until {end}",
                 "trail": "The video stops talking at {start}",
                 "interior": "Nothing is spoken between {rng}"}
        sentence = where.get(dz.get("kind", "interior"), where["interior"]).format(
            end=fmt_hms(dz["end_s"]), start=fmt_hms(dz["start_s"]), rng=dz["range"])
        out.append(_warn(
            "DEAD_ZONE",
            f"{mins} min with no talking",
            f"{sentence}, so no clips can come from that stretch.",
            f"measured silence of {int(dz['length_s'])}s",
            dz["range"]))

    if lines and f.get("coverage_pct", 100) < LOW_COVERAGE_PCT:
        out.append(_warn(
            "LOW_COVERAGE", "Not much talking overall",
            f"Only {f['coverage_pct']}% of this video has speech in it, so there is "
            f"less material to pick from than usual.",
            f"coverage_pct={f['coverage_pct']}"))

    if lines and 0 < f.get("wpm_speaking", 999) < LOW_WPM:
        out.append(_warn(
            "LOW_DENSITY", "Very slow or broken speech",
            "The transcript is unusually thin for the time it covers, which usually "
            "means long pauses, singing, or a poor-quality caption track.",
            f"wpm_speaking={f['wpm_speaking']}"))

    if lines and f.get("music_tag_ratio", 0) >= 0.35:
        out.append(_warn(
            "MUSIC_HEAVY", "A lot of music",
            "A large share of this video is music rather than speech.",
            f"music_tag_ratio={f['music_tag_ratio']}"))

    if track_b.get("caption_kind") == "manual":
        out.append(_warn(
            "MANUAL_CAPTIONS", "Creator-written captions",
            "These captions were uploaded by the channel rather than generated from the "
            "audio, so they may not cover everything that is actually said.",
            f"caption_kind=manual ({track_b.get('caption_lang')})"))
        if f.get("coverage_pct", 100) < 50:
            out.append(_warn(
                "PLACEHOLDER_RISK", "Captions look incomplete",
                "The uploaded captions cover only part of the video. There may be plenty "
                "of speech we simply cannot see yet.",
                f"manual captions covering {f.get('coverage_pct')}% of the video"))

    if lines and not track_b.get("caption_is_original", True):
        out.append(_warn(
            "TRANSLATED_TRACK", "Translated captions",
            "We could not find the original-language caption track, so this text may be "
            "a machine translation. Wording will be rougher than the real speech.",
            f"picked '{track_b.get('caption_lang')}' via: {track_b.get('caption_how')}"))

    if not heat.get("available"):
        out.append(_warn(
            "NO_HEATMAP", "No 'most replayed' data",
            "YouTube has not generated replay data for this video yet, so we are working "
            "from the transcript alone. Usually just means it is new or low-view.",
            "heatmap unavailable"))

    if dur and dur < SHORT_VIDEO_S:
        out.append(_warn(
            "SHORT_VIDEO", "Very short video",
            f"At {human_duration(int(dur))} there is not much to choose from, so expect "
            f"one or two clips at most.",
            f"duration={int(dur)}s"))
    if dur and dur > VERY_LONG_VIDEO_S:
        out.append(_warn(
            "VERY_LONG", "Very long video",
            f"At {human_duration(int(dur))} this will take longer than usual to process.",
            f"duration={int(dur)}s"))

    return out


def _clean_llm_warning(w: Any) -> Optional[dict]:
    if not isinstance(w, dict):
        return None
    code = str(w.get("code") or "").strip().upper()
    if code not in VALID_WARNINGS:
        return None
    return {
        "code": code,
        "title": str(w.get("title") or code.replace("_", " ").title())[:80],
        "why": str(w.get("why") or "")[:400],
        "evidence": str(w.get("evidence") or "")[:300],
        "range": str(w.get("range") or "")[:40],
        "source": "llm",
    }


def merge_verdict(llm: Optional[dict], meta: dict, f: dict, heat: dict,
                  track_b: dict, lines: list[dict], llm_error: str = "") -> dict:
    v: dict[str, Any] = {
        "decision": "GO_WITH_WARNINGS",
        "score": 50,
        "content_type": "other",
        "transcript_verdict": "USABLE",
        "face_outlook": "UNKNOWN",
        "expected_clips": "SOME",
        "block": None,
        "warnings": [],
        "best_regions": [],
        "moments": [],
        "category_outlook": {k: "LOW" for k in OUTLOOK_KEYS},
        "score_reason": "",
        "energy": "UNKNOWN",
        "screen_dependent": False,
        "dropped_moments": 0,
        "headline": "",
        "user_message": "",
        "llm_ok": bool(llm),
        "degraded": False,
        "base_score": 0,
        "vetoed": [],
    }

    if llm:
        d = str(llm.get("decision") or "").strip().upper().replace(" ", "_")
        if d in VALID_DECISIONS:
            v["decision"] = d
        try:
            v["score"] = max(0, min(100, int(round(float(llm.get("score", 50))))))
        except (TypeError, ValueError):
            pass
        for k in ("content_type", "transcript_verdict", "face_outlook",
                  "expected_clips", "energy"):
            if llm.get(k):
                v[k] = str(llm[k]).strip()
        v["screen_dependent"] = bool(llm.get("screen_dependent"))
        v["score_reason"] = str(llm.get("score_reason") or "").strip()[:220]
        v["category_outlook"] = clean_outlook(llm.get("category_outlook"))
        v["moments"], v["dropped_moments"] = clean_moments(
            llm.get("moments"), meta.get("duration_seconds") or 0, lines)
        v["headline"] = str(llm.get("headline") or "").strip()[:200]
        v["user_message"] = str(llm.get("user_message") or "").strip()[:900]

        blk = llm.get("block")
        if isinstance(blk, dict) and str(blk.get("code") or "").upper() in VALID_BLOCKS:
            v["block"] = {
                "code": str(blk["code"]).upper(),
                "title": str(blk.get("title") or "")[:80],
                "why": str(blk.get("why") or "")[:400],
                "evidence": str(blk.get("evidence") or "")[:300],
            }

        for w in (llm.get("warnings") or [])[:8]:
            cw = _clean_llm_warning(w)
            if cw:
                v["warnings"].append(cw)

        for r in (llm.get("best_regions") or [])[:3]:
            if not isinstance(r, dict):
                continue
            try:
                s_, e_ = int(float(r.get("start_s", 0))), int(float(r.get("end_s", 0)))
            except (TypeError, ValueError):
                continue
            # A 2-second "best region" is noise -- the model emits these when it
            # is pointing at a heatmap spike rather than a spoken moment.
            if e_ - s_ >= 15 and s_ >= 0:
                v["best_regions"].append({
                    "start_s": s_, "end_s": e_,
                    "range": f"{fmt_hms(s_)} {_c('→', '->')} {fmt_hms(e_)}",
                    "why": str(r.get("why") or "")[:160],
                })
    else:
        v["degraded"] = True

    # ---- kill anything the model invented that the numbers disprove -------
    v["vetoed"] = veto_llm_claims(v, f, lines)

    # ---- reconcile the score: peaks decide, not averages ------------------
    v["base_score"] = compute_base_score(meta, f, heat, lines)
    if lines:
        v["score"], v["score_note"] = reconcile_score(
            v["score"], v["moments"], f, meta, heat, lines, bool(llm))

    # ---- merge measured warnings, LLM wording wins on duplicates ----------
    have = {w["code"] for w in v["warnings"]}
    for w in deterministic_warnings(meta, f, heat, track_b, lines):
        if w["code"] not in have:
            v["warnings"].append(w)
            have.add(w["code"])

    # ---- INVARIANT 1: no usable transcript is always a block --------------
    words = f.get("word_count", 0)
    if not lines or words < MIN_WORDS_FOR_USABLE:
        # If the LLM already named a more informative cause (a music video has
        # no speech *because* it is a music video), keep its explanation.
        if not v["block"]:
            if not lines:
                why = ("We could not get any transcript for this video, so there is "
                       "nothing for the clip finder to read.")
                ev = track_b.get("caption_how") or track_b.get("error") or "no caption track"
            else:
                why = (f"This video has only {words} words of speech in total — far too "
                       f"little to build a reel from.")
                ev = f"word_count={words} over {fmt_hms(f.get('duration_s'))}"
            v["block"] = {"code": "NO_USABLE_TRANSCRIPT",
                          "title": "No usable speech", "why": why, "evidence": ev}
        v["decision"] = "NO_GO"
        v["transcript_verdict"] = "BROKEN" if not lines else "SPARSE"

    # ---- INVARIANT 2: NO_GO always carries a block, and vice versa --------
    if v["decision"] == "NO_GO" and not v["block"]:
        v["block"] = {"code": "NO_USABLE_TRANSCRIPT", "title": "Cannot process",
                      "why": "This video cannot be processed by the pipeline.",
                      "evidence": ""}
    if v["block"]:
        v["decision"] = "NO_GO"
        v["score"] = min(v["score"], 9)
        v["warnings"] = []          # a block makes warnings noise
        v["best_regions"] = []
    elif v["warnings"]:
        v["decision"] = "GO_WITH_WARNINGS"
    else:
        v["decision"] = "GO"

    # ---- INVARIANT 3: never show the user an empty verdict ----------------
    if not v["headline"]:
        v["degraded"] = True
        if v["block"]:
            v["headline"] = v["block"].get("title") or "This video can't be processed."
        elif v["warnings"]:
            v["headline"] = "Usable, with some things worth knowing first."
        else:
            v["headline"] = "Looks good — plenty of spoken material to work with."
    if not v["user_message"]:
        v["user_message"] = v["headline"]
    if False:
        if v["block"]:
            v["user_message"] = v["block"].get("why") or (
                "This video can't be turned into reels. Try a podcast, interview, or "
                "any video where people are talking.")
        else:
            bits = [f"This video has {f.get('word_count', 0):,} words of speech across "
                    f"{fmt_hms(f.get('duration_s'))}, covering {f.get('coverage_pct', 0)}% "
                    f"of its length."]
            if v["warnings"]:
                bits.append("There are a few things to be aware of, listed below.")
            if llm_error:
                bits.append("(The quality scoring step didn't complete, so this is based "
                            "on the transcript measurements only.)")
            v["user_message"] = " ".join(bits)

    # Three warnings is the honest limit. A wall of caveats is the same as no
    # caveats -- it just gets skipped. Measured ones rank above model opinion.
    v["warnings"].sort(key=lambda w: 0 if w.get("source") == "system" else 1)
    v["warnings"] = v["warnings"][:3]

    # Keep the headline number and the expectation consistent with each other.
    s = v["score"]
    v["expected_clips"] = ("MANY" if s >= 78 else "SOME" if s >= 55
                           else "FEW" if s >= 30 else "ALMOST_NONE")
    if v["block"]:
        v["moments"] = []
        v["category_outlook"] = {k: "NONE" for k in OUTLOOK_KEYS}
    return v


# ══════════════════════════════════════════════════════════════════════════
#  REPORT
# ══════════════════════════════════════════════════════════════════════════

def _rule(width: int = 74) -> str:
    return _c("─", "-") * width


def _head(title: str, width: int = 74) -> str:
    bar = _c("═", "=") * width
    return f"{bar}\n  {title}\n{bar}"


def print_diagnostics(tl: Timeline, meta: dict, f: dict, heat: dict,
                      track_b: dict, payload_stats: dict, llm: dict,
                      debug: bool = False) -> None:
    """Compact by default. The full forensics dump lives behind --debug."""
    print()
    print(_c("=" * 74, "=" * 74))
    if meta:
        title = (meta.get("title") or "?")
        if len(title) > 68:
            title = title[:65] + "..."
        print(f"  {title}")
        print(f"  {meta.get('channel', '?')}   {_c('·', '|')}   "
              f"{human_duration(meta.get('duration_seconds'))}   {_c('·', '|')}   "
              f"{meta.get('category', '?')}")
    print(_c("-" * 74, "-" * 74))

    for s in tl.ordered():
        mark = "ok  " if s.ok else "FAIL"
        note = f"   {s.note}" if (s.note and (debug or not s.ok)) else ""
        if not debug and s.ok:
            note = f"   {s.note}" if s.name in ("Transcript download", "Payload build",
                                                "LLM verdict") else ""
        print(f"  {s.name:<21}{s.seconds:>7.2f}s   {mark}{note}")
    print(_c("-" * 74, "-" * 74))
    print(f"  {'TOTAL':<21}{tl.wall():>7.2f}s")

    if llm and llm.get("ok"):
        u = llm.get("usage", {})
        pt, ct = u.get("prompt_tokens"), u.get("completion_tokens")
        cost = u.get("cost_usd")
        if cost is None and pt is not None:
            cost = pt * MODEL_PRICE_IN + (ct or 0) * MODEL_PRICE_OUT
        if cost is not None:
            print(f"  {'cost':<21}{'':>7}   in {pt} / out {ct} / ${cost:.6f} "
                  f"({_c('≈', '~')}Rs {cost * 88:.3f})")
    elif llm and llm.get("error") and llm.get("error") != "--no-llm":
        print(f"  LLM FAILED: {llm['error'][:200]}")

    if not debug:
        return

    print()
    print(f"  {_c('──', '--')} FORENSICS (--debug) {_rule(50)}")
    if f.get("line_count"):
        print(f"    transcript    : {str(track_b.get('caption_kind', '?')).upper()} "
              f"({track_b.get('caption_lang')})  {f['word_count']:,} words  "
              f"{f['line_count']:,} lines   [{track_b.get('caption_how')}]")
        print(f"    coverage      : {f['coverage_pct']}%  "
              f"({int(f['speech_seconds'])}s of {int(f['duration_s'])}s)")
        print(f"    density       : {f['wpm_speaking']} wpm speaking, "
              f"{f['wpm_overall']} wpm overall")
        print(f"    silence       : {f['gap_count']} gaps over {GAP_MIN_S}s, "
              f"longest {int(f['longest_gap_s'])}s")
        for dz in f.get("dead_zones", [])[:4]:
            print(f"                    dead zone {dz['range']} ({int(dz['length_s'])}s)")
        print(f"    lyrics        : {f['lyrics_signal']} (repeat={f['repeat_ratio']} "
              f"unique={f['unique_word_ratio']} tags={f['music_tag_ratio']})")
    else:
        print(f"    transcript    : NONE -- "
              f"{track_b.get('caption_how') or track_b.get('error') or 'unknown'}")
    print(f"    heatmap       : "
          + (f"{heat['point_count']} points, {heat.get('peak_count', 0)} peaks"
             if heat.get("available") else "not available"))
    if payload_stats:
        print(f"    payload       : {payload_stats['chars']:,} chars "
              f"({_c('≈', '~')}{payload_stats['est_tokens']:,} tokens)"
              + ("  [sampled]" if payload_stats.get("sampled") else ""))


def print_verdict(v: dict, quiet: bool = False, debug: bool = False) -> None:
    width = 74
    print()
    badge = {"GO": "READY", "GO_WITH_WARNINGS": "READY", "NO_GO": "CANNOT USE"}[v["decision"]]

    if v["decision"] == "NO_GO":
        print(f"  {badge}   {_c('·', '|')}   {v['block']['title']}")
        print()
        for line in _wrap(v["headline"], width - 4):
            print(f"  {line}")
        if v["block"].get("why") and v["block"]["why"] != v["headline"]:
            for line in _wrap(v["block"]["why"], width - 4):
                print(f"  {line}")
        print(_c("=" * 74, "=" * 74))
        return

    filled = int(round(v["score"] / 10))
    bar = _c("█", "#") * filled + _c("░", ".") * (10 - filled)
    extra = ""
    if v.get("energy") and v["energy"] not in ("UNKNOWN", ""):
        extra = f"   {_c('·', '|')}   energy {v['energy'].lower()}"
    print(f"  {badge}   {bar}  {v['score']}/100{extra}")
    print()

    for line in _wrap(v["headline"], width - 4):
        print(f"  {line}")

    if v.get("moments"):
        print()
        print(f"  BEST MOMENTS")
        for m in v["moments"][:5]:
            fl = m["flavour"] if m["flavour"] != "OTHER" else ""
            head = f"  {m['range']:<17} {m['strength']}/10  {fl}"
            print(head.rstrip())
            if m.get("quote"):
                for line in _wrap(f'"{m["quote"]}"', width - 8):
                    print(f"      {line}")

    picks = [k for k in OUTLOOK_KEYS
             if v.get("category_outlook", {}).get(k) in ("HIGH", "MEDIUM")]
    if picks and not v["block"]:
        pretty = ", ".join(
            f"{k.replace('_', ' ')}"
            + ("*" if v["category_outlook"][k] == "HIGH" else "")
            for k in picks)
        print()
        print(f"  WORTH RUNNING   {pretty}")
        skipped = [k for k in OUTLOOK_KEYS if k not in picks]
        if skipped:
            print(f"  skip            {', '.join(k.replace('_', ' ') for k in skipped)}")

    if v["warnings"]:
        print()
        for w in v["warnings"]:
            rng = f"  [{w['range']}]" if w.get("range") else ""
            body = _wrap(f"{w['why']}{rng}", width - 6)
            print(f"  {_c('•', '*')} {body[0]}")
            for line in body[1:]:
                print(f"    {line}")

    if debug:
        if v.get("score_reason"):
            print(f"\n  why this score: {v['score_reason']}")
        if v.get("score_note"):
            print(f"  reconcile     : {v['score_note']}  "
                  f"(measured floor {v.get('base_score')})")
        if v.get("dropped_moments"):
            print(f"  dropped {v['dropped_moments']} moment(s) -- bad timestamps or "
                  f"quotes not found in the transcript")
        if v.get("vetoed"):
            print("  dropped (contradicted by the measurements):")
            for k in v["vetoed"]:
                print(f"    - {k}")
        out = v.get("category_outlook", {})
        print("  outlook       : " + "  ".join(f"{k[:4]}={out.get(k)}" for k in OUTLOOK_KEYS))
    if v.get("degraded"):
        print("\n  (scored from measurements -- the model did not answer)")
    print(_c("=" * 74, "=" * 74))


def _wrap(text: str, width: int) -> list[str]:
    words, lines, cur = (text or "").split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines or [""]


# ══════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════

def run(link: str, use_llm: bool = True, save_payload: bool = False) -> dict:
    tl = Timeline()
    record: dict[str, Any] = {"input": link, "ok": False}

    # ---- PHASE 0 : offline ------------------------------------------------
    with Clock(tl, "URL parse") as c:
        video_id, code, detail = parse_youtube_url(link)
        if code:
            c.ok = False
            c.note = detail or code
        else:
            c.note = video_id or ""

    if code:
        record.update({
            "stage": "url", "reject_code": code,
            "reject_message": REJECT_MESSAGES.get(code, "This link can't be processed."),
            "detail": detail, "timeline": tl,
        })
        return record

    record["video_id"] = video_id

    # ---- PHASE 1 : two tracks in parallel ---------------------------------
    # Track B does its zero-bandwidth proxy handshake first and only then
    # checks this gate, so a dead video never costs proxy bandwidth.
    gate: dict[str, Any] = {"decided": False, "ok": False}
    yt_holder: dict[str, Any] = {}

    def track_a() -> dict:
        t0 = time.perf_counter()
        yt_holder["offset"] = t0 - tl.t_start
        res = fetch_youtube_data(video_id)
        yt_holder["seconds"] = time.perf_counter() - t0
        gate["decided"] = True
        gate["ok"] = res["ok"]
        return res

    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(track_a)
        fb = pool.submit(fetch_track_b, video_id, None, tl, gate)
        yt = fa.result()
        track_b = fb.result()

    tl.add("YouTube Data API", yt_holder.get("seconds", 0.0), yt["ok"],
           yt["detail"] if not yt["ok"] else
           f"{yt['meta'].get('category')}, {human_duration(yt['meta'].get('duration_seconds'))}",
           started_at=yt_holder.get("offset", 0.0))

    if not yt["ok"]:
        record.update({
            "stage": "api", "reject_code": yt["reject_code"],
            "reject_message": REJECT_MESSAGES.get(
                yt["reject_code"], "This link can't be processed."),
            "detail": yt["detail"], "timeline": tl,
        })
        return record

    meta = yt["meta"]

    # yt-dlp's own stream duration is a useful cross-check when the API
    # duration is missing (rare, but it happens on ex-livestreams).
    if not meta.get("duration_seconds") and track_b.get("stream_duration"):
        meta["duration_seconds"] = int(track_b["stream_duration"])

    # ---- PHASE 2 : forensics ---------------------------------------------
    with Clock(tl, "Forensics") as c:
        lines = track_b.get("lines") or []
        forensics = analyze_transcript(lines, meta.get("duration_seconds"))
        heat = summarise_heatmap(track_b.get("heatmap"))
        c.note = (f"{forensics['coverage_pct']}% coverage, "
                  f"{len(forensics['dead_zones'])} dead zones") if lines else "no transcript"

    # ---- PHASE 3 : payload + LLM -----------------------------------------
    payload_stats: dict[str, Any] = {}
    llm_result: dict[str, Any] = {}
    payload = ""

    with Clock(tl, "Payload build") as c:
        payload, payload_stats = build_payload(meta, forensics, heat, track_b, lines)
        c.note = f"{payload_stats['est_tokens']:,} est. tokens"

    if save_payload:
        p = os.path.join(_HERE, f"payload_{video_id}.txt")
        try:
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(payload)
            print(f"  [payload written to {p}]")
        except Exception as e:
            print(f"  [could not write payload: {e}]")

    if use_llm:
        with Clock(tl, "LLM verdict") as c:
            try:
                system_prompt = load_prompt()
            except FileNotFoundError as e:
                llm_result = {"ok": False, "error": str(e), "verdict": None,
                              "usage": {}, "attempts": []}
                c.ok = False
                c.note = "prompt file missing"
            else:
                llm_result = call_llm(system_prompt, payload)
                c.ok = llm_result["ok"]
                c.note = (llm_result.get("model_used", MODEL) if llm_result["ok"]
                          else llm_result["error"][:80])
    else:
        llm_result = {"ok": False, "error": "--no-llm", "verdict": None,
                      "usage": {}, "attempts": []}

    # ---- PHASE 4 : merge --------------------------------------------------
    verdict = merge_verdict(
        llm_result.get("verdict"), meta, forensics, heat, track_b, lines,
        llm_error="" if llm_result.get("ok") else llm_result.get("error", ""))

    record.update({
        "ok": True, "stage": "done", "meta": meta, "forensics": forensics,
        "heatmap": heat, "track_b": {k: val for k, val in track_b.items()
                                     if k not in ("lines", "heatmap")},
        "payload_stats": payload_stats, "llm": {k: val for k, val in llm_result.items()
                                                if k != "raw"},
        "verdict": verdict, "timeline": tl,
    })
    return record


def print_link_rejection(record: dict) -> None:
    width = 74
    print()
    print(_head("WHAT THE USER SEES", width))
    print("  CAN'T USE THIS LINK")
    print()
    for line in _wrap(record["reject_message"], width - 4):
        print(f"  {line}")
    print()
    print(f"  {_c('──', '--')} DEBUG {_rule(width - 12)}")
    print(f"    code   : {record['reject_code']}")
    print(f"    detail : {record.get('detail') or '-'}")
    print(f"    stage  : {record['stage']}")
    tl: Timeline = record["timeline"]
    for s in tl.ordered():
        print(f"    {s.name:<22}{s.seconds:>7.3f}s   {'ok' if s.ok else 'FAIL'}")
    print(f"    {'WALL CLOCK':<22}{tl.wall():>7.3f}s")
    print(_c("═", "=") * width)


def to_json_safe(record: dict) -> dict:
    out = {k: v for k, v in record.items() if k != "timeline"}
    tl = record.get("timeline")
    if tl:
        out["timing"] = {
            "steps": [{"name": s.name, "seconds": s.seconds, "ok": s.ok,
                       "note": s.note, "started_at_s": s.started_at}
                      for s in tl.ordered()],
            "wall_clock_s": round(tl.wall(), 3),
            "steps_total_s": round(tl.serial_total(), 3),
        }
    return out


def main(argv: list[str]) -> int:
    global UNICODE_OK
    UNICODE_OK = _init_console()

    ap = argparse.ArgumentParser(
        description="OMNI-BOUNCER v4 - decide whether a YouTube video is worth "
                    "running through the wowClip pipeline.")
    ap.add_argument("link", nargs="*", help="YouTube link or bare video ID")
    ap.add_argument("--json", action="store_true", help="machine-readable output only")
    ap.add_argument("--no-llm", action="store_true", help="fetch + forensics only")
    ap.add_argument("--save-payload", action="store_true",
                    help="write the exact LLM payload to payload_<id>.txt")
    ap.add_argument("--quiet", action="store_true", help="verdict only, no diagnostics")
    ap.add_argument("--debug", action="store_true",
                    help="show forensics, vetoed claims and score internals")
    ap.add_argument("--keep", action="store_true",
                    help="write the full run record to runs/<id>.json")
    args = ap.parse_args(argv[1:])

    link = " ".join(args.link).strip()
    if not link:
        try:
            link = input("Paste YouTube link: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 2

    try:
        record = run(link, use_llm=not args.no_llm, save_payload=args.save_payload)
    except KeyboardInterrupt:
        print("\n  Cancelled.")
        return 2
    except Exception as e:
        # Nothing should reach here, but if it does the user gets a sentence,
        # not a stack trace.
        import traceback
        if args.json:
            print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, indent=2))
        else:
            print("\n  Something went wrong while checking this video. "
                  "Please try again.\n")
            print("  --- debug ---")
            traceback.print_exc()
        return 3

    if args.keep and record.get("video_id"):
        d = os.path.join(_HERE, "runs")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, f"{record['video_id']}.json"), "w",
                  encoding="utf-8") as fh:
            json.dump(to_json_safe(record), fh, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(to_json_safe(record), ensure_ascii=False, indent=2))
        if not record.get("ok"):
            return 1
        return 0 if record["verdict"]["decision"] != "NO_GO" else 1

    if not record.get("ok"):
        print_link_rejection(record)
        return 1

    if not args.quiet:
        print_diagnostics(record["timeline"], record["meta"], record["forensics"],
                          record["heatmap"], record["track_b"],
                          record["payload_stats"], record["llm"], debug=args.debug)
    print_verdict(record["verdict"], quiet=args.quiet, debug=args.debug)
    return 0 if record["verdict"]["decision"] != "NO_GO" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
