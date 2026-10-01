"""
Getting the five inputs, once, and never again.

This file imports from `omni_bouncer.py`, `step_05_fetch_comments.py` and
`step_06_download_audio.py` rather than reimplementing them. Those scripts
contain a lot of hard-won knowledge about how YouTube actually behaves --
which client to spoof, when the proxy helps and when it costs you, how CDN URLs
are IP-bound. Duplicating that here would mean two copies drifting apart, and
the copy that breaks first would be this one.

Caching rule enforced here: if the artifact is already in cache/raw, this file
does nothing at all. No request, no quota, no bandwidth, no Modal.
"""

import json
import os
import sys

_WOWCLIP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WOWCLIP_DIR not in sys.path:
    sys.path.insert(0, _WOWCLIP_DIR)

from .config import get_key
from . import words as W


class FetchError(RuntimeError):
    pass


def _bouncer():
    try:
        import omni_bouncer
        return omni_bouncer
    except Exception as e:
        raise FetchError(
            f"could not import omni_bouncer.py from {_WOWCLIP_DIR}: {e}\n"
            f"wowClip reuses its YouTube plumbing instead of duplicating it.") from e


# ══════════════════════════════════════════════════════════════════════════
#  METADATA + HEATMAP + CAPTIONS   (one yt-dlp extract, one API call)
# ══════════════════════════════════════════════════════════════════════════

def fetch_metadata(cache, video_id, log=print):
    if cache.has("metadata"):
        log("  metadata      cached")
        return cache.read_json("metadata")

    ob = _bouncer()
    log("  metadata      YouTube Data API...")
    res = ob.fetch_youtube_data(video_id)
    cache.write_json("youtube_api", res, note="raw Data API result")
    if not res.get("ok"):
        raise FetchError(f"YouTube Data API rejected this video: "
                         f"{res.get('reject_code')} {res.get('detail', '')}")
    meta = res["meta"]
    cache.write_json("metadata", meta)
    log(f"                {meta.get('title', '')[:60]}")
    return meta


def fetch_captions_and_heatmap(cache, video_id, declared_lang=None, log=print):
    """
    Returns (words, heatmap).

    The raw json3 bytes are what get cached, not the parsed words. Parsing is
    free and may improve; the download is the part that costs GProxy bandwidth
    and can get rate-limited, so the exact bytes are kept forever.
    """
    have_caps = cache.has("captions")
    have_heat = cache.has("heatmap")

    if have_caps and have_heat:
        log("  transcript    cached")
        # Always re-parse from the cached raw json3 rather than trusting a
        # words.json written by an older version of the parser. The bytes are
        # the source of truth; parsing them is free and always current.
        parsed = W.parse_json3(cache.read_bytes("captions"))
        cache.write_json("words", parsed)
        st = W.stats(parsed)
        log(f"                {st['words']:,} words in {st['blocks']:,} "
            f"YouTube chunks")
        return parsed, cache.read_json("heatmap")

    ob = _bouncer()
    log("  transcript    GProxy handshake + yt-dlp extract...")
    proxy, proxy_err = ob.generate_proxy()
    if not proxy:
        log(f"                proxy unavailable ({proxy_err}); trying direct")

    info, label, attempts = ob.yt_extract(video_id, proxy)
    if not info:
        raise FetchError("yt-dlp could not read this video: " +
                         "; ".join(attempts[-2:]))
    log(f"                {label}")

    heatmap = ob.extract_heatmap(info) or []
    cache.write_json("heatmap", heatmap,
                     note=f"{len(heatmap)} points" if heatmap else "none published")
    log(f"  heatmap       {len(heatmap)} points"
        if heatmap else "  heatmap       not published for this video")

    try:
        cache.write_json("ytdlp_info", {
            "duration": info.get("duration"),
            "title": info.get("title"),
            "subtitle_langs": sorted((info.get("subtitles") or {}).keys()),
            "auto_langs": sorted((info.get("automatic_captions") or {}).keys()),
        }, note="trimmed -- the full blob is megabytes of format URLs that expire")
    except Exception:
        pass

    pick = ob.pick_caption_track(info, declared_lang)
    if not pick.get("track"):
        raise FetchError(f"no usable caption track: {pick.get('how')}")

    raw, how = ob.download_captions(pick["track"], proxy)
    if not raw:
        raise FetchError(f"caption download failed: {how}")
    cache.write_bytes("captions", raw,
                      note=f"{pick.get('kind')} ({pick.get('lang')}) via {how}")
    log(f"                {len(raw)/1024:.0f} KB, {pick.get('kind')} "
        f"({pick.get('lang')}) via {how}")

    parsed = W.parse_json3(raw)
    if not parsed["words"]:
        raise FetchError("caption file parsed to zero words")
    st = W.stats(parsed)
    cache.write_json("words", parsed,
                     note=f"{st['words']} words / {st['blocks']} chunks")
    log(f"                {st['words']:,} words in {st['blocks']:,} "
        f"YouTube chunks (median {st['median_block_words']} words each)")
    return parsed, heatmap


# ══════════════════════════════════════════════════════════════════════════
#  COMMENTS
# ══════════════════════════════════════════════════════════════════════════

def fetch_comments(cache, video_id, parsed=None, log=print):
    if cache.has("comments"):
        log("  comments      cached")
        return cache.read_json("comments")

    try:
        import step_05_fetch_comments as s5
    except Exception as e:
        log(f"  comments      SKIPPED (cannot import step_05: {e})")
        cache.write_json("comments", [], note="step_05 unavailable")
        return []

    log("  comments      YouTube Data API...")
    try:
        raw, stats = s5.fetch_comments(video_id, get_key("YOUTUBE_API_KEY"))
    except Exception as e:
        log(f"                failed: {e}")
        cache.write_json("comments", [], note=f"fetch failed: {e}")
        return []

    if not raw:
        log("                none (comments disabled, or the video has none)")
        cache.write_json("comments", [], note="no comments")
        return []
    cache.write_json("comments_raw", raw, note=f"{len(raw)} raw")

    cleaned, dropped = s5.clean_comments(raw)

    # step_05 tags a comment CONTENT_REF when it quotes words that really appear
    # in the transcript. We already have the transcript in memory, so hand it
    # over instead of letting it hunt for a file on disk.
    vocab = set()
    if parsed:
        for w in parsed["words"]:
            tok = "".join(ch for ch in w["w"].lower() if ch.isalnum())
            if len(tok) > 3:
                vocab.add(tok)
    ranked = s5.tag_and_rank(cleaned, vocab)

    out = [{"likes": c.get("like_count", 0), "text": c.get("text", ""),
            "signal": c.get("signal", "GENERIC")} for c in ranked]
    cache.write_json("comments", out,
                     note=f"{len(raw)} fetched -> {len(out)} kept")

    counts = {}
    for c in out:
        counts[c["signal"]] = counts.get(c["signal"], 0) + 1
    log(f"                {len(out)} kept | {counts.get('TIMESTAMP', 0)} with "
        f"timestamps | {counts.get('CONTENT_REF', 0)} quoting the video")
    return out


# ══════════════════════════════════════════════════════════════════════════
#  BOUNCER  (optional gate)
# ══════════════════════════════════════════════════════════════════════════

def run_bouncer(cache, link, log=print, use_llm=True):
    if cache.has("bouncer"):
        v = cache.read_json("bouncer")
        log(f"  bouncer       cached: {v.get('decision')} "
            f"(score {v.get('score')})")
        return v

    ob = _bouncer()
    record = ob.run(link, use_llm=use_llm)
    if not record.get("ok"):
        verdict = {"decision": "NO_GO",
                   "reject_code": record.get("reject_code"),
                   "reason": record.get("reject_message"),
                   "score": 0}
    else:
        verdict = record["verdict"]
    cache.write_json("bouncer", verdict)
    log(f"  bouncer       {verdict.get('decision')} (score {verdict.get('score')})")
    return verdict


def extract_video_id(link):
    ob = _bouncer()
    vid, code, detail = ob.parse_youtube_url(link)
    if code:
        raise FetchError(f"{code}: {detail or 'not a usable YouTube link'}")
    return vid
