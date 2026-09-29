"""Single yt-dlp extraction that yields BOTH the subtitle JSON and the heatmap.

Why one call instead of two:

The old flow ran yt-dlp twice through GProxy — once for subtitles, once for
`%(heatmap)j`. Both need the same watch-page extraction, and that page fetch is
where nearly all the proxy bandwidth goes. Since GProxy bills by the gigabyte,
running it twice doubled the per-video proxy cost for data we already had in
hand the first time. `extract_info` returns `heatmap` in the same dict as
`automatic_captions`, so one call covers both.

Bandwidth accounting: the subtitle download is measured exactly. yt-dlp's own
internal traffic (watch page, player JS, innertube calls) cannot be measured
from outside the library, so it is estimated with a documented constant and
reported as an estimate rather than a fact.
"""

import json
import os
import re
import sys
import time
import urllib.request

import yt_dlp

from config import GPROXY_URL, NETWORK_TIMEOUT

ATTEMPTS = 3

# yt-dlp's YouTube extractor pulls the watch page, player JS and a few
# innertube responses. Measured informally at roughly 1.5-2.5 MB per video.
# Used only for cost reporting, and always labelled as an estimate.
YTDLP_ESTIMATED_BYTES = 2_000_000


def is_translation(url: str) -> bool:
    """True when this caption URL is a machine translation of another track.

    YouTube's timedtext endpoint marks translations with a `tlang` parameter:

        kind=asr&lang=hi              -> the original ASR track
        kind=asr&lang=hi&tlang=en     -> that same track translated to English

    This matters more than it looks. A single video exposes its real ASR track
    plus one machine-translated variant for every language YouTube supports —
    157 entries on the video used to test this. Translating Hindi speech to
    English and then hunting for viral quotes would destroy the exact thing the
    clip finder is looking for: the speaker's actual words, their phrasing, the
    code-switching. Only the untranslated original is acceptable.
    """
    return "tlang=" in url


def source_language(automatic: dict) -> str | None:
    """Recover the original ASR language from any automatic track.

    Every caption URL names its source language, and translated ones name both:

        kind=asr&lang=hi              original Hindi ASR
        kind=asr&lang=hi&tlang=en     that same Hindi track, shown in English

    Because a translation cannot exist without the track it was translated
    from, the presence of ANY translated variant proves an original ASR track
    exists and tells us its language. So instead of guessing which of 157 keys
    is the real one, read `lang=` off whichever track we happen to look at
    first and go fetch that language directly.
    """
    for entry in automatic.values():
        url = _url_for(entry)
        if not url:
            continue
        match = re.search(r"[?&]lang=([A-Za-z0-9-]+)", url)
        if match:
            return match.group(1)
    return None


def _url_for(entry) -> str | None:
    """Pull the json3 URL out of a yt-dlp track entry."""
    if isinstance(entry, dict):
        return entry.get("url")
    if isinstance(entry, list):
        json3 = [t for t in entry if t.get("ext") == "json3"]
        candidate = (json3 or entry)
        return candidate[0].get("url") if candidate else None
    return None


def select_track(
    automatic: dict,
    manual: dict,
    want_language: str,
    prefer_asr: bool,
    audio_language: str | None,
) -> tuple[str, str]:
    """Pick exactly one caption track. Returns (language_key, url).

    Order of preference:
      1. ASR in the language YouTube detected in the audio, untranslated
      2. Human-uploaded captions, untranslated

    Never falls back to "whatever is first in the dict". That dict is sorted
    alphabetically and begins at Abkhazian, so an arbitrary pick would silently
    hand back a machine translation into a language nobody in the video speaks.
    """
    base = (want_language or "").split("-")[0].lower()
    audio_base = (audio_language or "").split("-")[0].lower()

    # Read the true source language off the tracks themselves. This is more
    # trustworthy than anything passed in, because it comes from the URLs
    # YouTube generated rather than from a metadata field a creator may have
    # set wrong or left blank.
    detected = source_language(automatic)
    detected_base = (detected or "").split("-")[0].lower()

    # yt-dlp exposes the untranslated original as "<lang>-orig" when the same
    # language code also has a translated variant. Prefer it when present.
    asr_candidates = [
        f"{detected_base}-orig" if detected_base else None,
        detected_base or None,
        f"{base}-orig" if base else None,
        base or None,
        f"{audio_base}-orig" if audio_base else None,
        audio_base or None,
    ]

    if prefer_asr:
        for key in asr_candidates:
            if not key or key not in automatic:
                continue
            url = _url_for(automatic[key])
            if url and not is_translation(url):
                return key, url

    # Manual tracks: the requested language, then the spoken language, then any
    # untranslated track that exists.
    for key in (base, audio_base):
        if key and key in manual:
            url = _url_for(manual[key])
            if url and not is_translation(url):
                return key, url

    for key, entry in manual.items():
        url = _url_for(entry)
        if url and not is_translation(url):
            return key, url

    # Last resort: an untranslated automatic track, even if we were asked to
    # prefer manual. Better a real ASR track than nothing.
    if not prefer_asr:
        for key in asr_candidates:
            if not key or key not in automatic:
                continue
            url = _url_for(automatic[key])
            if url and not is_translation(url):
                return key, url

    raise RuntimeError(
        "no untranslated caption track found "
        f"(wanted {want_language!r}, audio language {audio_language!r}, "
        f"{len(automatic)} automatic and {len(manual)} manual tracks present, "
        "all either missing or machine translations)"
    )


def fetch(video_id: str, language: str = "en", prefer_asr: bool = True) -> dict:
    """Run one extraction.

    Returns:
      {
        "subtitle_json": dict,        # raw json3 payload
        "subtitle_language": str,
        "heatmap_raw": list | None,
        "bytes_measured": int,        # exact, subtitle download only
        "bytes_estimated": int,       # yt-dlp internal traffic
        "seconds": float,
      }
    """
    if not GPROXY_URL:
        raise RuntimeError("GProxy credentials are not set")

    options = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitlesformat": "json3",
        "quiet": True,
        "no_warnings": True,
        "proxy": GPROXY_URL,
        "subtitleslangs": [language, "en", "all"],
        # Captions only, never media. Without this, yt-dlp still runs video
        # format selection during extract_info and aborts with "Requested
        # format is not available" when YouTube withholds formats, even though
        # the caption tracks came back fine.
        "ignore_no_formats_error": True,
        "simulate": True,
    }

    started = time.time()
    last_error = None

    for attempt in range(ATTEMPTS):
        try:
            # yt-dlp writes progress noise to stderr; keep it off our stream.
            original_stderr = sys.stderr
            sys.stderr = open(os.devnull, "w")
            try:
                with yt_dlp.YoutubeDL(options) as ydl:
                    info = ydl.extract_info(
                        f"https://www.youtube.com/watch?v={video_id}",
                        download=False,
                    )
            finally:
                sys.stderr.close()
                sys.stderr = original_stderr

            if not info:
                raise RuntimeError("yt-dlp returned no info")

            # -- heatmap rides along for free --
            heatmap_raw = info.get("heatmap")

            # -- subtitle track --
            automatic = info.get("automatic_captions") or {}
            manual = info.get("subtitles") or {}

            if not automatic and not manual:
                raise RuntimeError("NO_CAPTIONS")

            lang, sub_url = select_track(
                automatic=automatic,
                manual=manual,
                want_language=language,
                prefer_asr=prefer_asr,
                audio_language=info.get("language"),
            )

            # Which pool did the winning track come from? yt-dlp separates
            # speech-recognition tracks (automatic_captions) from
            # creator-uploaded ones (subtitles), which is the same distinction
            # the YouTube captions.list endpoint reports — without the extra
            # request or the 50 quota units it costs.
            from_asr = lang in automatic
            kind = "auto" if from_asr else "manual"

            if from_asr:
                note = (
                    f"Using YouTube's own speech recognition in "
                    f"{source_language(automatic) or lang}, untranslated. "
                    f"Ignored {max(len(automatic) - 1, 0)} machine-translated "
                    "variants of it."
                )
            else:
                note = (
                    f"No speech-recognition track exists, so using the "
                    f"creator's uploaded captions ({lang})"
                    + (
                        f", chosen from {len(manual)} uploaded tracks."
                        if len(manual) > 1
                        else "."
                    )
                )

            proxy_handler = urllib.request.ProxyHandler(
                {"http": GPROXY_URL, "https": GPROXY_URL}
            )
            opener = urllib.request.build_opener(proxy_handler)
            with opener.open(sub_url, timeout=NETWORK_TIMEOUT) as res:
                raw = res.read()

            # A caption URL can answer 200 with an empty body or an HTML error
            # page. Common on music videos, where the track is listed but not
            # actually served. Without this guard the failure surfaces as an
            # opaque "Expecting value: line 1 column 1".
            if not raw.strip():
                raise RuntimeError(
                    "YouTube served an empty caption file for this video"
                )

            try:
                subtitle_json = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError as exc:
                preview = raw[:80].decode("utf-8", errors="replace")
                raise RuntimeError(
                    "the caption file was not valid JSON "
                    f"(starts with: {preview!r})"
                ) from exc

            return {
                "subtitle_json": subtitle_json,
                "subtitle_language": lang,
                "audio_language": info.get("language"),
                "kind": kind,
                "selection_note": note,
                "automatic_track_count": len(automatic),
                "manual_track_count": len(manual),
                "heatmap_raw": heatmap_raw,
                "bytes_measured": len(raw),
                "bytes_estimated": YTDLP_ESTIMATED_BYTES,
                "seconds": round(time.time() - started, 2),
            }

        except Exception as exc:  # noqa: BLE001 - retry on any transport failure
            # Some outcomes are facts about the video, not transport hiccups.
            # Retrying them just burns proxy bandwidth and the user's time.
            message = str(exc)
            if message == "NO_CAPTIONS" or "no untranslated caption track" in message:
                raise

            last_error = exc
            if attempt < ATTEMPTS - 1:
                time.sleep(1)

    raise RuntimeError(f"yt-dlp failed after {ATTEMPTS} attempts: {last_error}")
