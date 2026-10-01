"""
Payload assembly -- Cognitive Priming Architecture.

Everything the model sees, in one text document, in an order chosen around how
attention actually behaves over a long context: strongest at the start,
strongest again at the end, weakest in the middle.

    1  WHO YOU ARE            role and taste          -- primacy
    2  HOW TO READ THE DATA   heatmap + comments
    3  CATEGORIES             a map, not a cage
    4  REAL VIRAL EXAMPLES    taste calibration
    5  ANTI-EXAMPLES          rejection instinct
    6  VIDEO IDENTITY         metadata
    7  AUDIENCE REACTIONS     comments
    8  VIEWER ATTENTION       heatmap
    9  GROUNDING              "everything above was calibration"
   10  THE TRANSCRIPT         the actual job         -- recency
   11  WHAT TO OUTPUT         format, last thing read before generating

Why TXT and not JSON: JSON spends tokens on braces, quotes and escapes that
carry no meaning, and it invites the model to pattern-match on structure rather
than read. Plain text with stable headers reads like a document.

Why timestamps are raw seconds everywhere -- transcript, comments, heatmap:
so the model never converts anything. A comment saying [4708s] can be compared
to a transcript line [4706] by looking at it. Every conversion the model does
not perform is thinking left over for judging clips.
"""

import json
import os
import re
import unicodedata

from .config import COMMENT_MAX_CHARS, COMMENTS_MAX, HEATMAP_MIN_SCORE

SECTION_RE = re.compile(r"^<<<SECTION:([A-Z_]+)>>>\s*$", re.MULTILINE)


# ══════════════════════════════════════════════════════════════════════════
#  PROMPT
# ══════════════════════════════════════════════════════════════════════════

def load_prompt_sections(path):
    """
    Split a prompt file on explicit <<<SECTION:NAME>>> markers.

    The old builder regex-matched '## PART 4B:' style headings, which meant
    renaming a heading silently dropped a section from the payload and nothing
    complained. Explicit markers cannot drift.
    """
    with open(path, encoding="utf-8") as f:
        text = f.read()

    marks = list(SECTION_RE.finditer(text))
    if not marks:
        raise ValueError(
            f"{path} has no <<<SECTION:...>>> markers -- the payload builder "
            f"cannot order it. See prompts/motivational.md for the expected form.")

    sections = {}
    for i, m in enumerate(marks):
        name = m.group(1)
        start = m.end()
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        sections[name] = text[start:end].strip()
    return sections


REQUIRED_SECTIONS = ["MINDSET", "SIGNALS", "CATEGORIES", "EXAMPLES",
                     "ANTIEXAMPLES", "OUTPUT"]


# ══════════════════════════════════════════════════════════════════════════
#  METADATA
# ══════════════════════════════════════════════════════════════════════════

def format_metadata(meta, duration_s=None):
    lines = []
    lines.append(f"Title: {meta.get('title') or 'Unknown'}")
    lines.append(f"Channel: {meta.get('channel') or 'Unknown'}")
    if duration_s:
        h, rem = divmod(int(duration_s), 3600)
        m, s = divmod(rem, 60)
        pretty = f"{h}h {m}m" if h else f"{m}m {s}s"
        lines.append(f"Duration: {pretty} ({int(duration_s)} seconds total)")
    for key, label in (("views", "Views"), ("likes", "Likes"),
                       ("comment_count", "Comment count")):
        val = meta.get(key)
        if val and str(val) not in ("0", "None"):
            lines.append(f"{label}: {val}")
    desc = (meta.get("description") or "").strip()
    if desc:
        # The description is almost entirely sponsor links and boilerplate.
        # A couple of lines is enough to establish what the video is.
        desc = re.sub(r"https?://\S+", "", desc)
        desc = re.sub(r"\s*\n\s*", " ", desc)
        desc = re.sub(r"\s{2,}", " ", desc).strip()
        if desc:
            lines.append(f"Description: {desc[:400]}")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════
#  COMMENTS
# ══════════════════════════════════════════════════════════════════════════

_TS_HMS = re.compile(r"(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![\d:])")
_TS_MS = re.compile(r"(?<![\d:\[])(\d{1,3}):([0-5]\d)(?![\d:]|\s*[AaPp][Mm])")


def convert_timestamps(text):
    """
    1:18:28 -> [4708s]

    Timestamp comments are the single highest-value comment type -- a human
    pointing directly at a moment they thought was worth rewatching. Converting
    them here means the model can compare them against transcript timestamps by
    eye instead of doing base-60 arithmetic hundreds of times.
    """
    def hms(m):
        total = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
        return f"[{total}s]"

    def ms(m):
        mins = int(m.group(1))
        if mins > 240:            # no video is 4+ hours; this is a score or a date
            return m.group(0)
        return f"[{mins * 60 + int(m.group(2))}s]"

    text = _TS_HMS.sub(hms, text)
    text = _TS_MS.sub(ms, text)
    return text


def clean_comment(text):
    """
    Strip emoji and control characters; they cost tokens and add nothing.

    Category M (combining marks) MUST be kept. In Devanagari the vowel signs
    are marks, so dropping them turns कुशलता into कशलत -- a real word into
    consonant soup. Given that a large share of this audience is Hindi and
    Hinglish, that is not a cosmetic bug.
    """
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "N", "P", "Z", "M") or ch in " \t":
            out.append(ch)
        elif cat[0] == "S" and ch in "+=<>$%#@&*/":
            out.append(ch)
    return " ".join("".join(out).split())


def format_comments(comments):
    """
    comments: [{"likes": int, "text": str, "signal": str}] or [(likes, text)]

    Timestamp-bearing comments are floated to the top within their like tier so
    the model meets the pointers first.
    """
    norm = []
    for c in comments:
        if isinstance(c, dict):
            likes = int(c.get("likes") or c.get("like_count") or 0)
            text = c.get("text") or ""
        else:
            likes, text = int(c[0]), c[1]
        text = clean_comment(text)
        if len(text) > COMMENT_MAX_CHARS:
            text = text[:COMMENT_MAX_CHARS].rsplit(" ", 1)[0] + " ..."
        text = convert_timestamps(text)
        if len(text.split()) < 3:
            continue
        has_ts = "[" in text and "s]" in text
        norm.append((has_ts, likes, text))

    seen = set()
    unique = []
    for has_ts, likes, text in norm:
        key = text.lower()[:90]
        if key in seen:
            continue
        seen.add(key)
        unique.append((has_ts, likes, text))

    unique.sort(key=lambda x: (not x[0], -x[1]))
    unique = unique[:COMMENTS_MAX]
    return "\n".join(f"{likes} | {text}" for _, likes, text in unique), len(unique)


# ══════════════════════════════════════════════════════════════════════════
#  HEATMAP
# ══════════════════════════════════════════════════════════════════════════

def format_heatmap(heatmap, lines=None):
    """
    Only peaks. Below HEATMAP_MIN_SCORE viewers were skipping, and a flat list
    of 100 near-identical low numbers is 100 lines the model reads for nothing.

    When transcript lines are available, each peak carries the first few words
    spoken there. That is the difference between "viewers replayed second 4710"
    -- which the model must go hunting for -- and "viewers replayed the moment
    he said 'if somebody who's ordinary...'", which it can act on immediately.
    """
    if not heatmap:
        return None, 0

    points = []
    for p in heatmap:
        if isinstance(p, dict):
            start = float(p.get("start") or p.get("start_time") or 0)
            val = float(p.get("value") or 0)
        else:
            start, val = float(p[0]), float(p[1])
        points.append((start, val))
    points.sort()

    peaks = [(s, v) for s, v in points if v >= HEATMAP_MIN_SCORE]
    if not peaks:
        return None, 0

    index = None
    if lines:
        index = sorted((ln["t"], ln["text"]) for ln in lines)

    out = []
    for start, val in peaks:
        row = f"[{int(start)}] {val:.2f}"
        if index:
            words = _words_at(index, start)
            if words:
                row += f"  {words}"
        out.append(row)
    return "\n".join(out), len(out)


def _words_at(index, t, n_words=9):
    """First few words spoken at or just before time t."""
    lo, hi = 0, len(index) - 1
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        if index[mid][0] <= t:
            best = index[mid]
            lo = mid + 1
        else:
            hi = mid - 1
    if not best:
        return ""
    words = best[1].split()
    txt = " ".join(words[:n_words])
    return txt + (" ..." if len(words) > n_words else "")


# ══════════════════════════════════════════════════════════════════════════
#  ASSEMBLY
# ══════════════════════════════════════════════════════════════════════════

GROUNDING = """================================================================
EVERYTHING ABOVE THIS LINE WAS CALIBRATION.

The examples, the anti-examples, the categories, the instructions -- none of
them came from this video. They exist to tune your taste. Do not quote them,
do not look for them below, do not blend them with what follows.

WHAT FOLLOWS IS THE REAL VIDEO. This is the only thing you are analysing.

Every start and end time you output must be a real [timestamp] you can see in
the transcript below. If you cannot find the words at a timestamp, that clip
does not exist -- do not invent it.

If this video contains nothing worth clipping, say so and return zero clips.
That is a correct and valuable answer, not a failure.
================================================================"""


def build(prompt_path, transcript_text, meta=None, comments=None,
          heatmap=None, lines=None, duration_s=None, extra_note=""):
    """Returns (payload_text, stats)."""
    sections = load_prompt_sections(prompt_path)
    missing = [s for s in REQUIRED_SECTIONS if s not in sections]
    if missing:
        raise ValueError(f"prompt {os.path.basename(prompt_path)} is missing "
                         f"sections: {', '.join(missing)}")

    parts = []
    stats = {}

    # 1-5 : calibration
    parts.append(sections["MINDSET"])
    parts.append(sections["SIGNALS"])
    parts.append(sections["CATEGORIES"])
    parts.append(sections["EXAMPLES"])
    parts.append(sections["ANTIEXAMPLES"])

    # 6 : identity
    if meta:
        parts.append("=== VIDEO IDENTITY ===\n"
                     "(The specific video you are analysing.)\n\n"
                     + format_metadata(meta, duration_s))

    # 7 : comments
    if comments:
        body, n = format_comments(comments)
        stats["comments"] = n
        parts.append(
            f"=== AUDIENCE REACTIONS ({n} top comments) ===\n"
            "Format: LikeCount | CommentText\n"
            "These are real humans reacting to this video. They tell you which\n"
            "topics landed. Comments containing a timestamp like [4708s] are the\n"
            "highest-value kind -- a viewer pointing straight at a moment worth\n"
            "rewatching. Those seconds match the [timestamps] in the transcript\n"
            "exactly. Timestamp comments are listed first.\n"
            "Comments tell you WHAT resonated. They do not tell you where a clip\n"
            "starts or ends -- that is your judgement.\n\n" + body)
    else:
        stats["comments"] = 0
        parts.append(
            "=== AUDIENCE REACTIONS ===\n"
            "No comment data for this video (comments off, or none fetched).\n"
            "Judge on the transcript itself. This is common and is not a problem.")

    # 8 : heatmap
    heat_body, n_peaks = format_heatmap(heatmap, lines)
    stats["heatmap_peaks"] = n_peaks
    if heat_body:
        parts.append(
            "=== VIEWER ATTENTION (YouTube 'most replayed') ===\n"
            "Format: [StartSecond] Score  first words spoken there\n"
            "Score is replay intensity, 1.00 = the single most replayed moment\n"
            "in the video. Only peaks at or above "
            f"{HEATMAP_MIN_SCORE:.2f} are listed; everything\n"
            "else was skipped past by viewers and is not shown.\n"
            "Thousands of people already voted with their scrub bar. A peak means\n"
            "something happened there -- it does not tell you it was motivational.\n"
            "Use it to find candidates and to confirm ones you already like.\n\n"
            + heat_body)
    else:
        parts.append(
            "=== VIEWER ATTENTION (YouTube 'most replayed') ===\n"
            "Not available for this video. YouTube only publishes this for videos\n"
            "with enough views. Judge on the transcript and comments.")

    if extra_note:
        parts.append("=== USER NOTE ===\n" + extra_note.strip())

    # 9-10 : grounding + the actual job
    parts.append(GROUNDING)
    parts.append("=== FULL TRANSCRIPT ===\n\n" + transcript_text)

    # 11 : what to output, read last
    parts.append(sections["OUTPUT"])

    payload = "\n\n\n".join(p.strip() for p in parts if p and p.strip()) + "\n"

    stats.update({
        "chars": len(payload),
        "est_tokens": len(payload) // 4,
        "transcript_chars": len(transcript_text),
        "transcript_share": round(len(transcript_text) / max(len(payload), 1), 2),
    })
    return payload, stats


def safe_filename(title, video_id, suffix):
    if title:
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", title)
        name = re.sub(r"\s+", " ", name).strip()[:90]
    else:
        name = video_id
    return f"{name}__{suffix}.txt"


def load_comments_file(path):
    """
    Read whatever comment format is on disk.

    Two exist in this repo: the old 'likes | text' one-per-line format from the
    payload_fetcher era, and step_05_fetch_comments.py's newer
    '[SIGNAL] (+likes)' / '"text"' pair format. Both are handled so neither
    script has to change.
    """
    if not os.path.exists(path):
        return None
    if path.endswith(".json"):
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    with open(path, encoding="utf-8") as f:
        raw = f.read()

    out = []
    # newer format
    for m in re.finditer(r"^\[([A-Z_]+)\]\s*\(\+(\d+)\)\s*\n\"(.*?)\"\s*$",
                         raw, re.MULTILINE | re.DOTALL):
        out.append({"signal": m.group(1), "likes": int(m.group(2)),
                    "text": m.group(3).strip()})
    if out:
        return out

    # older format
    for line in raw.split("\n"):
        line = line.strip()
        if not line or " | " not in line:
            continue
        head, text = line.split(" | ", 1)
        try:
            likes = int(head.strip())
        except ValueError:
            continue
        if text.strip():
            out.append({"likes": likes, "text": text.strip()})
    return out or None
