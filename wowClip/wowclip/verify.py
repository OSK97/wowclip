"""
What happens after the model answers: NOTHING IS CHANGED.

The previous version moved boundaries around. If the model said 3515 and the
quoted words looked like a better match at 3509, it "repaired" the timestamp;
if an anchor did not match it marked the clip failed; if start and end looked
reversed it swapped them. All of that was wrong, and it was wrong in the most
expensive way -- it silently overrode the one judgement the model is actually
good at, and made a bad clip look like a verified one.

So this file no longer edits anything. It takes the model's JSON and hands it
to the report as-is. `start_seconds`, `end_seconds`, `start_words`,
`end_words` come out exactly as the model wrote them.

The only thing added is CONTEXT, never a correction: the transcript lines that
sit between the two timestamps, so the report can show what is actually there.
If the model's number is off, you will see it immediately in that text -- which
is the right way to catch it, because then YOU decide, not a heuristic.

(When the cutting stage is built, THAT is where start_words/end_words earn
their keep: they locate the exact word inside the line to cut on. That is a
downstream job on a clip you have already accepted. It is not this file's
business and it never should have been.)
"""


def attach_context(clip, blocks, pad_lines=1):
    """
    Add the transcript text between the model's own start and end timestamps.
    Nothing else. Returns a new dict; the input is not modified.
    """
    out = dict(clip)
    try:
        s = float(clip.get("start_seconds"))
        e = float(clip.get("end_seconds"))
    except (TypeError, ValueError):
        out["transcript"] = ""
        out["duration"] = None
        return out

    lo, hi = (s, e) if s <= e else (e, s)

    idx = [i for i, b in enumerate(blocks) if lo - 0.01 <= b["t"] <= hi + 0.01]
    if not idx:
        # The model named a time between two chunk starts. Show the chunk it
        # falls inside rather than nothing -- still not a correction, just the
        # text that is there.
        near = [i for i, b in enumerate(blocks) if b["t"] <= lo]
        idx = [near[-1]] if near else [0]

    a = max(0, idx[0] - pad_lines)
    b = min(len(blocks) - 1, idx[-1] + pad_lines)

    out["transcript"] = " ".join(blocks[i]["text"] for i in idx)
    out["transcript_padded"] = " ".join(blocks[i]["text"] for i in range(a, b + 1))
    out["duration"] = round(hi - lo, 1)
    return out


def attach_all(clips, blocks):
    return [attach_context(c, blocks) for c in (clips or [])]


def format_report(clips):
    """Terminal summary. Reports what the model said; asserts nothing about it."""
    if not clips:
        return "  (no clips)"
    rows = []
    for c in clips:
        rows.append(
            f"  #{c.get('rank', '?')}  "
            f"{_hms(c.get('start_seconds'))} -> {_hms(c.get('end_seconds'))}  "
            f"({c.get('duration', '?')}s)  {c.get('confidence', '')}")
        rows.append(f"        {c.get('title', '')}")
        if c.get("start_words"):
            rows.append(f"        in:  \"{c['start_words']}\"")
        if c.get("end_words"):
            rows.append(f"        out: \"{c['end_words']}\"")
    return "\n".join(rows)


def _hms(sec):
    try:
        sec = int(float(sec))
    except (TypeError, ValueError):
        return "?"
    h, rem = divmod(max(sec, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
