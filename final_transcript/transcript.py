# -*- coding: utf-8 -*-
"""TRANSCRIPT -- YouTube's own captions, with word-level timings.

    python transcript.py --url "https://youtu.be/VJ9VC9OqdAA" --outdir out
    python transcript.py --url "..." --clip-start 120 --clip-end 240

YouTube already ran ASR on every video it hosts. It is free, it arrives in
about ten seconds, and on the videos measured here it was MORE complete than a
GPU transcription pass -- so v1 uses it directly instead of paying for one.

What you give up is script: YouTube transliterates every English word in a
Hinglish video into Devanagari, so "nervousness" arrives as नर्वसनेस. The
meaning survives, the spelling does not. That is a real cost and it is
accepted deliberately here; the clip finders read for meaning.

WORD-LEVEL TIMING IS THE WHOLE POINT. The automatic track gives one timestamp
per word, which is what the boundary pass cuts on. A manually uploaded
subtitle track is usually more accurate as TEXT but is written in cue blocks --
one timestamp for a whole sentence -- which would throw away the precision the
rest of the pipeline is built on. So a manual track is used only when it
actually carries per-word timings, and otherwise the automatic track wins and
says why.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

GPROXY_URL = ("http://gproxy_1584_lakshdiyorazz:V5te1gkisr2A9tJqnLmJ"
              "@proxy.gproxy.net:1000")

YTDLP_DISCOVER_TIMEOUT_S = 90
YTDLP_TRIES = 4
CAPTION_FETCH_TIMEOUT_S = 60
CAPTION_FETCH_RETRIES = 3

# A "word" holding a space is a cue block, not a word. A track where most
# entries look like that has sentence-level timing and is useless for cutting.
WORD_LEVEL_MIN_RATIO = 0.80

# YouTube's own sound tags -- [Applause], [Music], [Laughter], and their
# translated forms. Measured on the Harvard speech: 10x [Applause], 2x [Music].
# They are worth keeping and they are NOT words: they come from YouTube's own
# audio pass, so they share a clock with the captions exactly, which makes them
# an independent check on the audio models that run later. Marked here rather
# than deleted, so the payload can use them and the word counters can skip them.
_TAG = re.compile(r"^\s*[\[\(](.{1,40}?)[\]\)]\s*$")


def log(m, tag="INFO"):
    print(f"[{tag:<5}] {m}", flush=True)


def extract_video_id(text):
    text = (text or "").strip()
    m = re.search(r"(?:v=|/shorts/|/embed/|/live/|youtu\.be/)([A-Za-z0-9_-]{11})",
                  text)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", text):
        return text
    return None


def _ytdlp_discover(url, proxy, ytdlp="yt-dlp"):
    """One extraction, three fields: detected language, automatic caption map,
    manual subtitle map.

    Deliberately does NOT download a subtitle file. yt-dlp hands back the
    timedtext URLs and the caption is fetched directly afterwards -- one small
    request we control, instead of yt-dlp's fragmented path which for the ASR
    track can arrive as VTT with no word timings at all."""
    cmd = [ytdlp, "--skip-download", "--no-warnings", "--no-playlist",
           "--socket-timeout", "30",
           "--print", "%(language)s",
           "--print", "%(automatic_captions)j",
           "--print", "%(subtitles)j", url]
    if proxy:
        cmd[1:1] = ["--proxy", proxy]
    # The residential proxy hands out a different exit IP per connection and a
    # few of them are ones YouTube has already flagged, so a single extract
    # fails "Sign in to confirm you're not a bot" perhaps one time in ten while
    # the very next attempt succeeds. Measured over five sequential extracts
    # the plain proxied call was 5/5; every alternative player_client was worse
    # (android_vr 4/5, ios/tv/web_safari 0/5). So the answer is to retry on a
    # fresh connection, not to reconfigure the extractor.
    p, last = None, "yt-dlp failed"
    for attempt in range(1, YTDLP_TRIES + 1):
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=YTDLP_DISCOVER_TIMEOUT_S)
        if p.returncode == 0:
            break
        last = (p.stderr or p.stdout or "yt-dlp failed").strip()[:400]
        if attempt < YTDLP_TRIES:
            log(f"yt-dlp attempt {attempt} failed, retrying on a fresh proxy "
                f"IP ({last.splitlines()[0][:70]})", "WARN")
            time.sleep(2 * attempt)
    if p.returncode != 0:
        raise RuntimeError(last)
    lines = [l for l in (p.stdout or "").splitlines() if l.strip()]
    if len(lines) < 2:
        raise RuntimeError(f"unexpected yt-dlp output: {(p.stdout or '')[:200]}")
    lang = lines[0].strip()
    auto = json.loads(lines[1]) if lines[1].strip() not in ("NA", "") else {}
    manual = {}
    if len(lines) > 2 and lines[2].strip() not in ("NA", ""):
        try:
            manual = json.loads(lines[2])
        except json.JSONDecodeError:
            manual = {}
    return (lang if lang and lang != "NA" else None), auto, manual


def _json3_url(entries):
    for f in entries or []:
        if f.get("ext") == "json3" and f.get("url"):
            return f["url"]
    return None


def _is_translated(u):
    """A translated timedtext URL carries tlang=. A raw ASR one does not.

    This is the discriminator rather than the language name, because names
    lie: for a Hindi video BOTH `hi` and `hi-orig` are called "Hindi", and one
    is a machine translation of the other. A translation is evidence of what a
    translator thought was meant, not of what was said."""
    try:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
        return bool(q.get("tlang"))
    except Exception:
        return False


def candidates(lang, auto, manual):
    """Every usable track, best first, each labelled with where it came from."""
    out = []
    for code, entries in (manual or {}).items():
        u = _json3_url(entries)
        if u:
            out.append({"code": code, "url": u, "kind": "manual",
                        "translated": _is_translated(u),
                        "why": "manually uploaded subtitles"})
    auto_c = []
    for code, entries in (auto or {}).items():
        u = _json3_url(entries)
        if u:
            auto_c.append({"code": code, "url": u, "kind": "auto",
                           "translated": _is_translated(u), "why": ""})
    ranked = []
    if lang:
        ranked += [c for c in auto_c if c["code"] == f"{lang}-orig"]
    ranked += [c for c in auto_c
               if c["code"].endswith("-orig") and c not in ranked]
    ranked += [c for c in auto_c if not c["translated"] and c not in ranked]
    ranked += [c for c in auto_c if c not in ranked]
    for c in ranked:
        c["why"] = ("original ASR for the video's own language"
                    if c["code"] == f"{lang}-orig" else
                    "original ASR track" if c["code"].endswith("-orig") else
                    "untranslated ASR track" if not c["translated"] else
                    "TRANSLATED track -- this is not what was said")
    return out + ranked


def _fetch(url, proxy, timeout):
    handlers = []
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"http": proxy,
                                                     "https": proxy}))
    op = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"),
        "Accept-Language": "en-US,en;q=0.9"})
    with op.open(req, timeout=timeout) as r:
        return r.read()


def fetch_json3(url, proxy):
    """Fetch with retry, then fall back to a direct attempt.

    429 through a shared residential proxy is the single most likely reason
    this fails. The caption file is ~1 MB and unauthenticated, so a direct
    fetch usually works and costs nothing but local bandwidth."""
    last = None
    for attempt in range(1, CAPTION_FETCH_RETRIES + 1):
        try:
            return _fetch(url, proxy, CAPTION_FETCH_TIMEOUT_S), "proxy"
        except urllib.error.HTTPError as ex:
            last = f"HTTP {ex.code}"
            if ex.code == 429 and attempt < CAPTION_FETCH_RETRIES:
                wait = 4 * attempt
                log(f"HTTP 429 through the proxy, retrying in {wait}s "
                    f"({attempt}/{CAPTION_FETCH_RETRIES})", "WARN")
                time.sleep(wait)
                continue
            break
        except Exception as ex:
            last = f"{type(ex).__name__}: {ex}"
            if attempt < CAPTION_FETCH_RETRIES:
                time.sleep(2 * attempt)
                continue
    log(f"proxy fetch failed ({last}); trying direct", "WARN")
    try:
        return _fetch(url, None, CAPTION_FETCH_TIMEOUT_S), "direct"
    except Exception as ex:
        raise RuntimeError(f"caption fetch failed: proxy={last}, "
                           f"direct={type(ex).__name__}: {ex}")


def parse_json3(raw):
    """json3 -> flat word list in VIDEO time (seconds).

    Three things this format does that bite you if unhandled:

      aAppend events   YouTube's rolling-caption effect emits a duplicate
                       event carrying only a newline. Keeping them duplicates
                       every line in the file.
      no word ends     only starts are given. End is the next word's start,
                       clamped so a long pause does not stretch one word
                       across it.
      event overlap    dDurationMs routinely runs past the next event's
                       start, so it is a display hint, not a duration.
    """
    data = json.loads(raw.decode("utf-8", errors="replace")
                      if isinstance(raw, (bytes, bytearray)) else raw)
    words = []
    for ev in data.get("events", []) or []:
        if ev.get("aAppend"):
            continue
        t0 = ev.get("tStartMs", 0)
        for sg in (ev.get("segs") or []):
            u = sg.get("utf8", "")
            if not u or not u.strip():
                continue
            t = u.strip()
            m = _TAG.match(t)
            w = {"word": t, "start": (t0 + sg.get("tOffsetMs", 0)) / 1000.0,
                 "source": "asr"}
            if m:
                w["kind"] = "tag"
                w["tag"] = m.group(1).strip().lower()
            words.append(w)
    words.sort(key=lambda w: w["start"])

    # An exact (time, text) repeat is a format artefact, never real speech.
    seen, uniq = set(), []
    for w in words:
        k = (round(w["start"], 3), w["word"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(w)
    words = uniq

    for i, w in enumerate(words):
        nxt = words[i + 1]["start"] if i + 1 < len(words) else w["start"] + 0.40
        w["end"] = round(min(max(nxt, w["start"] + 0.06), w["start"] + 1.20), 3)
        w["start"] = round(w["start"], 3)
    return words


def word_level_ratio(words):
    """How many entries are single words rather than whole cues.

    Sound tags are excluded: "[Applause]" is one token either way and says
    nothing about whether this track carries per-word timing."""
    real = [w for w in words if w.get("kind") != "tag"]
    if not real:
        return 0.0
    single = sum(1 for w in real if " " not in w["word"].strip())
    return single / float(len(real))


def fetch(url, proxy=GPROXY_URL, force_lang=None, allow_manual=True,
          cache_dir=None, ytdlp="yt-dlp"):
    """-> dict with ok / words / track / error. Never raises."""
    res = {"ok": False, "words": [], "track": None, "video_id": None,
           "language": None, "via": None, "manual_tracks": [],
           "rejected": [], "error": None, "seconds": 0.0}
    t0 = time.time()
    try:
        vid = res["video_id"] = extract_video_id(url)
        if not shutil.which(ytdlp):
            raise RuntimeError(f"{ytdlp} is not on PATH")
        log("yt-dlp: discovering caption tracks ...")
        lang, auto, manual = _ytdlp_discover(url, proxy, ytdlp)
        res["language"] = lang
        res["manual_tracks"] = sorted(manual or {})
        cands = candidates(lang, auto, manual if allow_manual else {})
        if force_lang:
            cands = [c for c in cands if c["code"] == force_lang] or cands
        if not cands:
            raise RuntimeError("no track offers json3 (word-level) captions")

        for c in cands:
            cache = (os.path.join(cache_dir, f"{vid}.{c['kind']}.{c['code']}.json3")
                     if cache_dir and vid else None)
            if cache and os.path.exists(cache) and os.path.getsize(cache) > 0:
                with open(cache, "rb") as f:
                    raw = f.read()
                via = "cache"
            else:
                raw, via = fetch_json3(c["url"], proxy)
                if cache:
                    os.makedirs(cache_dir, exist_ok=True)
                    with open(cache, "wb") as f:
                        f.write(raw)
            words = parse_json3(raw)
            ratio = word_level_ratio(words)
            if not words:
                res["rejected"].append(f"{c['kind']}/{c['code']}: empty")
                continue
            # A manual track is better text but is usually written in cue
            # blocks. Cutting on a sentence timestamp throws away everything
            # the boundary pass is for, so it only wins if it is per-word.
            if ratio < WORD_LEVEL_MIN_RATIO:
                res["rejected"].append(
                    f"{c['kind']}/{c['code']}: cue-level timing "
                    f"({ratio:.0%} single words), not usable for cutting")
                continue
            res.update(ok=True, words=words, via=via,
                       track={k: c[k] for k in ("code", "kind", "translated", "why")})
            ntag = sum(1 for w in words if w.get("kind") == "tag")
            log(f"{c['kind']} track {c['code']} -- {len(words) - ntag} words, "
                f"{ntag} sound tags, {ratio:.0%} word-level, "
                f"{words[0]['start']:.0f}s..{words[-1]['end']:.0f}s "
                f"(via {via})", "OK")
            if c["translated"]:
                log("this track is a MACHINE TRANSLATION, not what was said",
                    "WARN")
            break
        if not res["ok"]:
            raise RuntimeError("; ".join(res["rejected"]) or "no usable track")
    except Exception as ex:
        res["error"] = f"{type(ex).__name__}: {str(ex)[:300]}"
        log(res["error"], "FATAL")
    res["seconds"] = round(time.time() - t0, 2)
    return res


def window(words, clip_start, clip_end):
    """Cut to the clip and rebase to clip-relative time.

    Everything downstream works in clip time and adds clip_start back only
    when it needs a position in the source video."""
    lo = float(clip_start or 0.0)
    hi = float(clip_end) if clip_end else None
    out = []
    for w in words:
        if w["end"] <= lo or (hi is not None and w["start"] >= hi):
            continue
        rec = {"word": w["word"], "source": w.get("source", "asr"),
               "start": round(max(0.0, w["start"] - lo), 3),
               "end": round(max(0.0, w["end"] - lo), 3)}
        if w.get("kind") == "tag":
            rec["kind"], rec["tag"] = "tag", w["tag"]
        out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--outdir", default="out")
    ap.add_argument("--base", default=None,
                    help="output stem; defaults to the video id")
    ap.add_argument("--clip-start", type=float, default=0.0)
    ap.add_argument("--clip-end", type=float, default=None)
    ap.add_argument("--proxy", default=GPROXY_URL)
    ap.add_argument("--lang", default=None, help="force a track code")
    ap.add_argument("--no-manual", action="store_true",
                    help="ignore manually uploaded subtitles")
    ap.add_argument("--cache-dir", default=None)
    args = ap.parse_args()

    vid = extract_video_id(args.url)
    cache = args.cache_dir or os.path.join(args.outdir, "_captions")
    res = fetch(args.url, args.proxy, args.lang, not args.no_manual, cache)
    if not res["ok"]:
        log("no transcript -- nothing downstream can run", "FATAL")
        sys.exit(1)

    words = window(res["words"], args.clip_start, args.clip_end)
    if not words:
        log(f"no words inside {args.clip_start}s..{args.clip_end}s", "FATAL")
        sys.exit(1)
    length = (float(args.clip_end) - float(args.clip_start)) if args.clip_end \
        else words[-1]["end"]

    os.makedirs(args.outdir, exist_ok=True)
    base = args.base or vid or "transcript"
    out = os.path.join(args.outdir, f"{base}_final.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"meta": {"video_id": vid, "url": args.url,
                            "length_s": round(length, 2),
                            "clip_start_s": args.clip_start,
                            "clip_end_s": args.clip_end,
                            "source": "youtube",
                            "track": res["track"], "via": res["via"],
                            "language": res["language"],
                            "manual_tracks": res["manual_tracks"],
                            "rejected_tracks": res["rejected"],
                            "words": sum(1 for w in words if w.get("kind") != "tag"),
                            "asr_tags": sum(1 for w in words if w.get("kind") == "tag"),
                            "seconds": res["seconds"]},
                   "words": words}, f, ensure_ascii=False, indent=2)
    log(f"{len(words)} words, {length:.0f}s -> {out}", "OK")
    print(out)


if __name__ == "__main__":
    main()
