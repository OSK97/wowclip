"""
json3 caption bytes -> word-level words + YouTube's own ASR chunks.

TWO things come out of this file and both matter:

  WORDS   every word with a start and an end. Nothing the model reads is built
          from these directly -- they exist so an audio event can be dropped
          into the EXACT gap between two words instead of "somewhere near".

  BLOCKS  YouTube's own ASR chunks, verbatim. These are the lines the model
          reads. Not sentences I reconstructed -- YouTube's ASR already decided
          where the chunk boundaries go, that decision is consistent across
          every video, and it is what the model sees when the transcript is fed
          to it raw. Rebuilding sentences on top of that was a mistake: it
          invented boundaries that do not exist in the source, and the clip
          start/end times inherited every one of those invented edges.

A note on why blocks cannot be trusted for their own end time: json3 events
overlap. Block [11.76] reports a 2.8s duration, which would end at 14.56, but
the next block starts at 13.08. That is the ASR's rolling window, not real
timing. A block's real end is its last word's end, which is why word-level
timing is the source of truth for everything positional.
"""

import json
import re

from .config import FALLBACK_WORD_DURATION, MAX_WORD_DURATION

_WS = re.compile(r"\s+")

# YouTube's ASR writes its own event tags into the caption text. We run PANNs
# and Silero over the real audio, so these are both redundant and less
# accurate -- and worse, they are the tags the model would see *without* a
# matching entry in our own event list, which is exactly the mismatch problem.
_ASR_TAG = re.compile(
    r"\[\s*(music|musique|applause|laughter|laughs|clapping|cheering|"
    r"crowd|inaudible|silence|sound effects?|foreign|__+)\s*\]",
    re.IGNORECASE)


def parse_json3(raw_bytes):
    """
    Returns {"words": [{"w","t","e","b"}], "blocks": [{"t","text","w0","w1"}]}

    "b" on a word is the index of the block it belongs to; "w0"/"w1" on a block
    are the first and last word indices it spans. Those two links are what make
    exact tag placement possible.

    Two real-world quirks, both of which silently corrupt everything downstream:

    1. `aAppend` events. ASR emits rolling partial repeats of the previous
       line. Leave them in and the word count roughly doubles, every WPM figure
       is nonsense, and the same sentence appears twice seconds apart.

    2. Segments that are only "\\n". Layout, not speech.
    """
    try:
        data = json.loads(raw_bytes.decode("utf-8", errors="replace")
                          if isinstance(raw_bytes, (bytes, bytearray))
                          else raw_bytes)
    except Exception as e:
        raise ValueError(f"caption file is not valid json3: {e}") from e

    raw_blocks = []
    seen = set()

    for ev in data.get("events") or []:
        if ev.get("aAppend"):
            continue
        t0 = ev.get("tStartMs")
        if t0 is None:
            continue
        segs = ev.get("segs") or []
        if not segs:
            continue

        joined = _WS.sub(" ", "".join(
            (s.get("utf8") or "") for s in segs)).strip()
        if not joined:
            continue
        key = (int(t0), joined)
        if key in seen:
            continue
        seen.add(key)

        toks = []
        for seg in segs:
            text = seg.get("utf8") or ""
            if not text.strip():
                continue
            token = _WS.sub(" ", text).strip()
            token = _ASR_TAG.sub("", token).strip()
            if not token:
                continue
            toks.append({"w": token,
                         "t": round((int(t0) + int(seg.get("tOffsetMs") or 0))
                                    / 1000.0, 3)})
        if not toks:
            continue
        toks.sort(key=lambda x: x["t"])
        raw_blocks.append({"t": round(int(t0) / 1000.0, 3), "toks": toks})

    raw_blocks.sort(key=lambda b: b["t"])

    # Flatten, keeping the word -> block link.
    words, blocks = [], []
    for blk in raw_blocks:
        w0 = len(words)
        for tok in blk["toks"]:
            words.append({"w": tok["w"], "t": tok["t"], "b": len(blocks)})
        if len(words) == w0:
            continue
        blocks.append({"t": blk["t"],
                       "text": " ".join(t["w"] for t in blk["toks"]),
                       "w0": w0, "w1": len(words) - 1})

    # Words must be globally monotonic for gap-finding to be sound. json3
    # occasionally emits an out-of-order offset; clamp rather than reorder, so
    # a word never leaves the block it was transcribed in.
    for i in range(1, len(words)):
        if words[i]["t"] < words[i - 1]["t"]:
            words[i]["t"] = words[i - 1]["t"]

    _fill_end_times(words)
    for b in blocks:
        b["t"] = words[b["w0"]]["t"]
        b["e"] = words[b["w1"]]["e"]

    return {"words": words, "blocks": blocks}


def _fill_end_times(words):
    """
    json3 gives start times only. A word's end is the next word's start --
    UNLESS there is a gap, in which case the gap is silence, not a very long
    word. Capping this is what makes the silences findable: an uncapped word
    would swallow the pause that follows it, and the pause tag would then be
    placed inside a word instead of after it.
    """
    n = len(words)
    for i, w in enumerate(words):
        if i + 1 < n:
            gap = words[i + 1]["t"] - w["t"]
            dur = min(max(gap, 0.04), MAX_WORD_DURATION)
        else:
            dur = _estimate_duration(w["w"])
        w["e"] = round(w["t"] + dur, 3)


def _estimate_duration(token):
    n = max(1, len(token.strip(".,!?;:\"')")))
    return min(max(0.12 * n, FALLBACK_WORD_DURATION), MAX_WORD_DURATION)


def load(path_or_data):
    """
    Accepts our new {"words","blocks"} file, our old bare word list, or the
    legacy Audio/fetch_word_level_ytdlp.py format. Old caches keep working.
    """
    if isinstance(path_or_data, str):
        with open(path_or_data, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = path_or_data

    if isinstance(data, dict) and "blocks" in data and "words" in data \
            and data["blocks"] and "w0" in data["blocks"][0]:
        return data

    # Legacy shapes -- words only. Rebuild one block per word run so the rest
    # of the pipeline still has something to work with, and say so.
    raw = data["words"] if isinstance(data, dict) else data
    words = []
    for w in raw:
        token = (w.get("word") or w.get("w") or "").strip()
        if not token:
            continue
        t = float(w.get("start_sec", w.get("t", 0)))
        words.append({"w": token, "t": t, "b": 0})
    words.sort(key=lambda x: x["t"])
    _fill_end_times(words)
    blocks = ([{"t": words[0]["t"], "e": words[-1]["e"],
                "text": " ".join(w["w"] for w in words),
                "w0": 0, "w1": len(words) - 1}] if words else [])
    return {"words": words, "blocks": blocks, "legacy": True}


def stats(parsed):
    words, blocks = parsed["words"], parsed["blocks"]
    if not words:
        return {"words": 0, "blocks": 0}
    durs = sorted(b["e"] - b["t"] for b in blocks)
    counts = sorted(b["w1"] - b["w0"] + 1 for b in blocks)
    return {
        "words": len(words),
        "blocks": len(blocks),
        "first_s": round(words[0]["t"], 2),
        "last_s": round(words[-1]["e"], 2),
        "median_block_s": round(durs[len(durs) // 2], 1) if durs else 0,
        "median_block_words": counts[len(counts) // 2] if counts else 0,
    }
