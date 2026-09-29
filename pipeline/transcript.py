"""Subtitle parsing. No network — see ytdlp_fetch.py for the download."""

TIME_KEYS = (
    "tStartMs",  # json3 — must come first, see parse_json3 below
    "start",
    "startMs",
    "offset",
    "startTime",
    "time",
    "start_time",
)
TEXT_KEYS = ("text", "transcript", "utf8")


def _extract_time(item: dict):
    for key in TIME_KEYS:
        if key not in item:
            continue
        value = item[key]
        if isinstance(value, (int, float)):
            seconds = float(value)
        elif isinstance(value, str) and value.replace(".", "", 1).isdigit():
            seconds = float(value)
        else:
            continue
        return int(seconds / 1000.0) if key.lower().endswith("ms") else int(seconds)
    return None


def _extract_text(item: dict):
    for key in TEXT_KEYS:
        value = item.get(key)
        if isinstance(value, str):
            text = " ".join(value.split())
            if text:
                return text
    return None


def parse_json3(data) -> list:
    """Parse YouTube's json3 caption format.

    Shape:
        {"events": [
            {"tStartMs": 91234, "dDurationMs": 2400,
             "segs": [{"utf8": "hello"}, {"utf8": " world", "tOffsetMs": 300}]}
        ]}

    The trap: each seg can carry its own tOffsetMs, a few hundred milliseconds
    *relative to its event*. A generic key search finds that before tStartMs and
    produces timestamps that never exceed a few seconds, silently destroying
    every downstream timestamp. So json3 is handled explicitly: the real start
    is the event's tStartMs, and a line's text is all of its segs joined.
    """
    events = data.get("events")
    if not isinstance(events, list):
        return []

    segments = []
    for event in events:
        if not isinstance(event, dict):
            continue

        start_ms = event.get("tStartMs")
        if start_ms is None:
            continue

        segs = event.get("segs")
        if not isinstance(segs, list):
            continue

        text = "".join(seg.get("utf8", "") for seg in segs if isinstance(seg, dict))
        text = " ".join(text.split())

        # Auto-captions emit standalone newline events as padding.
        if not text:
            continue

        duration_ms = event.get("dDurationMs") or 0
        base_ms = int(start_ms)

        # Word-level timings are already here: each seg carries tOffsetMs,
        # measured from this event's tStartMs. Absolute time is the sum. This
        # costs nothing extra to keep — the bytes are already downloaded — and
        # it is what lets the payload be regrouped at any granularity later.
        words = []
        for seg in segs:
            if not isinstance(seg, dict):
                continue
            token = seg.get("utf8", "")
            stripped = token.strip()
            if not stripped:
                continue
            words.append(
                {
                    "t": round((base_ms + int(seg.get("tOffsetMs", 0) or 0)) / 1000, 2),
                    "w": stripped,
                }
            )

        segments.append(
            {
                "start": int(base_ms / 1000),
                "text": text,
                "duration": round(int(duration_ms) / 1000, 2),
                "words": words,
            }
        )

    return segments


def parse(data) -> list:
    """Parse any subtitle JSON shape into [{start, text, duration}]."""
    if isinstance(data, dict) and "events" in data:
        json3 = parse_json3(data)
        if json3:
            return _dedupe(json3)

    segments: list = []

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return

        start = _extract_time(node)
        text = _extract_text(node)
        if start is not None and text is not None:
            segments.append(
                {"start": start, "text": text, "duration": 0, "words": []}
            )
            return

        for value in node.values():
            walk(value)

    walk(data)
    return _dedupe(segments)


def _dedupe(segments: list) -> list:
    """Sort by time and drop repeated consecutive lines.

    YouTube's auto-captions stream a rolling window, so the same phrase appears
    across several events. Left in, it inflates the transcript and wastes the
    model's attention on duplicates.
    """
    segments.sort(key=lambda s: s["start"])

    cleaned = []
    for seg in segments:
        if cleaned and cleaned[-1]["text"] == seg["text"]:
            continue
        cleaned.append(seg)

    return cleaned


def flatten_words(segments: list) -> list:
    """All words in order, each with an absolute timestamp.

    Kept as its own function because downstream work (exact clip trimming,
    caption placement) needs the raw word stream, not the display grouping.
    """
    words: list = []
    for segment in segments:
        for word in segment.get("words") or []:
            words.append(word)
    words.sort(key=lambda w: w["t"])
    return words


def to_lines(segments: list, words_per_line: int = 0) -> str:
    """Render the transcript for the LLM payload as `[seconds] text`.

    Only the start time is included. End times are redundant here: the next
    line's start marks the boundary, and the gatekeeper is not cutting clips —
    it is deciding whether the video is usable. Duplicating every timestamp
    would cost input tokens and buy nothing.

    When `words_per_line` is set and word timings exist, YouTube's own caption
    grouping is discarded and the word stream is regrouped into fixed-size
    chunks instead. The reason is consistency: YouTube's caption events are
    irregular, sometimes two words and sometimes fifteen, so a timestamp can
    refer to anywhere in a long span of speech. Fixed chunks make every
    timestamp mean the same thing, which is what makes them line up cleanly
    against heatmap peaks and timestamped comments.
    """
    if words_per_line > 0:
        words = flatten_words(segments)
        if words:
            lines = []
            for i in range(0, len(words), words_per_line):
                chunk = words[i : i + words_per_line]
                text = " ".join(w["w"] for w in chunk)
                lines.append(f"[{int(chunk[0]['t'])}] {text}")
            return "\n".join(lines)

    # Fall back to YouTube's caption grouping when word timings are absent.
    return "\n".join(f"[{s['start']}] {s['text']}" for s in segments)


# ---------------------------------------------------------------------------
# Cut-ready word list
# ---------------------------------------------------------------------------
#
# Everything above produces lines for the gatekeeper's prompt. This produces
# the other thing the same download contains: a flat word list with a start AND
# an end for every word, which is what a later stage needs to cut a clip on an
# exact syllable rather than on an arbitrary caption boundary.
#
# The shape and the arithmetic here deliberately match the clip project's own
# parser, so its payload builder can read this file without any conversion. If
# that project changes how it derives word ends, this has to change with it.

import re

_TAG = re.compile(r"^\[(.+?)\]$")

# json3 gives word STARTS only. A word's end is the next word's start, except
# across a pause, where that would stretch one word over several seconds of
# silence and make every duration downstream meaningless. So it is clamped:
# never shorter than a syllable, never longer than a slow word.
MIN_WORD_S = 0.06
MAX_WORD_S = 1.20
LAST_WORD_S = 0.40


def cut_words(data) -> list:
    """json3 -> [{"word","start","end","source"}] in video time.

    Three things about this format bite if they are not handled:

      aAppend events   YouTube's rolling-caption effect emits a duplicate event
                       carrying only a newline. Kept, they double every line.
      no word ends     only starts exist; see the clamp above.
      dDurationMs      routinely overruns the next event's start, so it is a
                       display hint and never a real duration.
    """
    events = data.get("events") if isinstance(data, dict) else None
    if not isinstance(events, list):
        return []

    words = []
    for event in events:
        if not isinstance(event, dict) or event.get("aAppend"):
            continue
        base_ms = event.get("tStartMs")
        if base_ms is None:
            continue
        for seg in event.get("segs") or []:
            if not isinstance(seg, dict):
                continue
            token = (seg.get("utf8") or "").strip()
            if not token:
                continue
            word = {
                "word": token,
                "start": (int(base_ms) + int(seg.get("tOffsetMs", 0) or 0)) / 1000.0,
                "source": "asr",
            }
            tag = _TAG.match(token)
            if tag:
                # "[Applause]" is a sound YouTube's captions marked, not speech.
                # Flagged so a clip can never be made to start on one.
                word["kind"] = "tag"
                word["tag"] = tag.group(1).strip().lower()
            words.append(word)

    words.sort(key=lambda w: w["start"])

    # An exact (time, text) repeat is a format artefact, never real speech.
    seen, unique = set(), []
    for word in words:
        key = (round(word["start"], 3), word["word"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(word)

    for i, word in enumerate(unique):
        following = (
            unique[i + 1]["start"]
            if i + 1 < len(unique)
            else word["start"] + LAST_WORD_S
        )
        word["end"] = round(
            min(
                max(following, word["start"] + MIN_WORD_S),
                word["start"] + MAX_WORD_S,
            ),
            3,
        )
        word["start"] = round(word["start"], 3)

    return unique


def word_level_ratio(words: list) -> float:
    """How much of this track is per-word rather than whole cues.

    A manual caption track often carries one timestamp per subtitle card, so
    "start" points at a whole sentence. That is fine for reading along and
    useless for cutting, and this is how the difference is detected. Sound tags
    are excluded: "[Applause]" is a single token either way and says nothing
    about timing granularity.
    """
    real = [w for w in words if w.get("kind") != "tag"]
    if not real:
        return 0.0
    single = sum(1 for w in real if " " not in w["word"].strip())
    return single / float(len(real))
