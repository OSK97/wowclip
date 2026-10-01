# -*- coding: utf-8 -*-
"""Video title, channel and description from the YouTube Data API.

Only exists so the speaker namer and the clip finders know what the video is.
Everything here degrades to None -- a missing description costs a little
context, never the run.
"""

import json
import re
import urllib.parse
import urllib.request

API = "https://www.googleapis.com/youtube/v3/videos"
TIMEOUT_S = 20


def _iso_seconds(s):
    m = re.match(r"P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    if not m:
        return None
    d, h, mi, sec = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + sec


def fetch(video_id, api_key):
    q = urllib.parse.urlencode({"part": "snippet,contentDetails,statistics",
                                "id": video_id, "key": api_key})
    try:
        with urllib.request.urlopen(f"{API}?{q}", timeout=TIMEOUT_S) as r:
            d = json.loads(r.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return None, f"{type(e).__name__}: {str(e)[:150]}"
    items = d.get("items") or []
    if not items:
        return None, "video not found or not public"
    sn = items[0].get("snippet") or {}
    cd = items[0].get("contentDetails") or {}
    st = items[0].get("statistics") or {}
    return {"video_id": video_id,
            "title": sn.get("title"),
            "channel": sn.get("channelTitle"),
            "description": sn.get("description"),
            "published": sn.get("publishedAt"),
            "tags": (sn.get("tags") or [])[:20],
            "duration_s": _iso_seconds(cd.get("duration")),
            "views": int(st["viewCount"]) if st.get("viewCount") else None}, None
