"""Comment fetch — official YouTube Data API only.

Quota math, since this is the cheapest signal we have:
  commentThreads.list costs 1 unit per call and returns up to 100 threads.
  The daily budget is 10,000 units. Three pages = 300 comments for 3 units.
  So a video costs 0.03% of the daily quota. Effectively free.

Ranking: comments that contain a timestamp get a large boost. A viewer who
writes "12:45 this part broke me" has hand-labelled a viral moment, which is
exactly what the clip finder is looking for. Plain like counts tell you the
comment was funny; timestamps tell you *where* to cut.
"""

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from config import (
    COMMENT_PAGES,
    COMMENT_TIME_BUDGET,
    COMMENTS_PER_PAGE,
    MAX_COMMENTS_FOR_LLM,
    NETWORK_TIMEOUT,
    YOUTUBE_API_KEY,
)

API = "https://www.googleapis.com/youtube/v3/commentThreads"

# Matches 1:23, 12:45, 1:02:03
TIMESTAMP = re.compile(r"\b(\d{1,2}:)?\d{1,2}:\d{2}\b")
URL_IN_TEXT = re.compile(r"https?://\S+|www\.\S+")

TIMESTAMP_BOOST = 5.0


def _clean(text: str) -> str:
    """Strip emoji and control characters; keep letters, digits, punctuation.

    Emoji are a meaningful slice of Indian YouTube comments but they cost
    tokens and carry little positional signal, so they go.
    """
    kept = []
    for ch in text:
        category = unicodedata.category(ch)
        if category[0] in ("L", "N", "Z", "P") or ch in " \n\t":
            kept.append(ch)
    return " ".join("".join(kept).split())


def _score(likes: int, text: str) -> float:
    base = float(likes)
    if TIMESTAMP.search(text):
        # Boost multiplicatively so a timestamped comment with real traction
        # outranks a timestamped comment with none.
        return base * TIMESTAMP_BOOST + TIMESTAMP_BOOST
    return base


def fetch(video_id: str) -> dict:
    """Fetch, clean, dedupe and rank comments.

    Returns {"comments": [{likes, text, has_timestamp}], "fetched": int,
             "unique": int, "with_timestamp": int, "kept": int,
             "pages": int, "quota_units": int}
    """
    if not YOUTUBE_API_KEY:
        raise RuntimeError("YOUTUBE_API_KEY is not set")

    raw: list[tuple[int, str]] = []
    page_token = None
    pages = 0
    started = time.time()
    truncated = False

    for _ in range(COMMENT_PAGES):
        # Comments are a supporting signal, not a requirement. Whatever has
        # arrived by the budget is enough — continuing to page would only delay
        # the verdict for diminishing returns.
        if time.time() - started > COMMENT_TIME_BUDGET and raw:
            truncated = True
            break

        params = {
            "part": "snippet",
            "videoId": video_id,
            "maxResults": str(COMMENTS_PER_PAGE),
            "order": "relevance",
            "textFormat": "plainText",
            "key": YOUTUBE_API_KEY,
        }
        if page_token:
            params["pageToken"] = page_token

        url = f"{API}?{urllib.parse.urlencode(params)}"

        try:
            with urllib.request.urlopen(url, timeout=NETWORK_TIMEOUT) as res:
                data = json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            # Creators can disable comments entirely; that is not a failure.
            if e.code == 403 and "disabled" in body.lower():
                return {
                    "comments": [],
                    "fetched": 0,
                    "unique": 0,
                    "with_timestamp": 0,
                    "kept": 0,
                    "pages": pages,
                    "quota_units": max(pages, 1),
                    "disabled": True,
                    "truncated": False,
                }
            try:
                message = json.loads(body)["error"]["message"]
            except Exception:
                message = body[:200]
            raise RuntimeError(f"YouTube comments API {e.code}: {message}") from e

        pages += 1

        for item in data.get("items", []):
            top = (
                item.get("snippet", {})
                .get("topLevelComment", {})
                .get("snippet", {})
            )
            text = top.get("textDisplay") or top.get("textOriginal") or ""
            if not text.strip():
                continue
            if URL_IN_TEXT.search(text):
                continue  # spam and self-promo
            raw.append((int(top.get("likeCount", 0) or 0), text))

        # A video with few comments simply has no next page. Stop immediately
        # rather than issuing requests that can only come back empty.
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    # Dedupe on cleaned lowercase text, keeping the highest like count.
    seen: dict[str, tuple[int, str]] = {}
    for likes, text in raw:
        clean = _clean(text)
        if not clean:
            continue
        key = clean.lower()
        if key not in seen or likes > seen[key][0]:
            seen[key] = (likes, clean)

    ranked = sorted(
        seen.values(),
        key=lambda pair: _score(pair[0], pair[1]),
        reverse=True,
    )
    kept = ranked[:MAX_COMMENTS_FOR_LLM]

    comments = [
        {
            "likes": likes,
            "text": text,
            "has_timestamp": bool(TIMESTAMP.search(text)),
        }
        for likes, text in kept
    ]

    return {
        "comments": comments,
        "fetched": len(raw),
        "unique": len(seen),
        "with_timestamp": sum(1 for c in comments if c["has_timestamp"]),
        "kept": len(comments),
        "pages": pages,
        "quota_units": max(pages, 1),
        "disabled": False,
        "truncated": truncated,
        "seconds": round(time.time() - started, 2),
    }


def to_lines(comments: list) -> str:
    """Compact comments for the LLM payload: likes | text."""
    return "\n".join(f"{c['likes']} | {c['text']}" for c in comments)
