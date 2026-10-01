"""
THE TRANSCRIPT.

    [59] we got time for one final joke. Why are
    [62] balloons so expensive?
    [64] [[pause 1.7s]]
    [65] Inflation.

Two rules, and everything here follows from them.

RULE 1 -- THE LINES ARE YOUTUBE'S, NOT MINE.

Every line is one of YouTube's own ASR chunks, verbatim, with its own start
time. They break mid-sentence sometimes -- "They're / talking to you here" --
because that is where the ASR broke them, and that is what the model gets when
the transcript is handed over raw. The previous version rebuilt these into
sentences. That invented boundaries that exist nowhere in the source, and every
clip start and end inherited an invented edge.

RULE 2 -- PAUSES ARE MEASURED FROM TIMESTAMPS.

Between every pair of consecutive transcript chunks, there is a measurable gap.
If that gap exceeds 1.5 seconds, a [[pause Xs]] tag is inserted. Gaps above
8 seconds become [[gap Xs]] tags, indicating a scene break or edit. This is
computed purely from YouTube's own word timings -- no audio download, no GPU,
no external service.
"""

from .config import PAUSE_MIN_S, PAUSE_GAP_S


HEADER = """FORMAT OF THE TRANSCRIPT BELOW

[59] we got time for one final joke. Why are
[62] balloons so expensive?
[64] [[pause 1.7s]]
[65] Inflation.

[59]        the second this line starts.

            These lines are YouTube's own transcript chunks, exactly as its
            captioning produced them. A chunk sometimes ends mid-sentence and
            continues on the next line. That is normal -- read across the line
            break, the sentence is not finished where the line is.

[[ ... ]]   a measured silence between two spoken chunks.

            [[pause 2.4s]]     silence of 1.5 to 8 seconds -- a dramatic beat,
                               a reaction, or a breath between topics
            [[gap 31.0s]]      a long silence above 8 seconds -- usually a scene
                               break, an edit cut, or a topic transition

            These are computed from the gap between consecutive transcript
            timestamps. If chunk A ends and chunk B starts 3.2 seconds later,
            that is a [[pause 3.2s]]. No audio analysis is involved.

The words are the signal. The pause tags are supporting evidence -- they mark
where the speaker stopped, which often means something just landed.
"""


def compose(parsed):
    """
    parsed:  {"words": [...], "blocks": [...]} from words.parse_json3

    Returns the transcript text with pause/gap tags inserted between chunks
    where the silence exceeds PAUSE_MIN_S.
    """
    words = parsed["words"]
    blocks = parsed["blocks"]
    if not blocks:
        raise ValueError("transcript has no blocks")

    report = {"warnings": []}

    # ── 1. detect pauses from timestamp gaps ─────────────────────────────
    pauses = _detect_pauses(blocks)

    report["pause_stats"] = {
        "pauses": sum(1 for p in pauses if p["family"] == "pause"),
        "gaps": sum(1 for p in pauses if p["family"] == "gap"),
        "total": len(pauses),
    }

    # ── 2. render ────────────────────────────────────────────────────────
    body, n_lines = _render(blocks, pauses)

    report["line_stats"] = _line_stats(blocks, n_lines)
    report["chars"] = len(body)
    report["est_tokens"] = len(body) // 4

    return {"text": HEADER + "\n" + body, "body": body, "header": HEADER,
            "blocks": blocks, "words": words, "events": pauses,
            "report": report}


# ══════════════════════════════════════════════════════════════════════════
#  PAUSE DETECTION  --  pure timestamp arithmetic, no audio needed
# ══════════════════════════════════════════════════════════════════════════

def _detect_pauses(blocks):
    """
    Walk consecutive blocks. If the gap between block[i].end and
    block[i+1].start exceeds PAUSE_MIN_S, emit a pause (or gap) tag.

    This replaces the entire PANNs CNN14 + Silero VAD pipeline with a
    simple, reliable, zero-cost computation.
    """
    pauses = []
    for i in range(len(blocks) - 1):
        end_of_current = blocks[i]["e"]
        start_of_next = blocks[i + 1]["t"]
        gap = start_of_next - end_of_current

        if gap >= PAUSE_MIN_S:
            family = "gap" if gap >= PAUSE_GAP_S else "pause"
            pauses.append({
                "family": family,
                "start": round(end_of_current, 1),
                "end": round(start_of_next, 1),
                "duration": round(gap, 1),
                "after_block": i,
            })
    return pauses


# ══════════════════════════════════════════════════════════════════════════
#  RENDER  --  one pass over blocks, inserting pause tags between them
# ══════════════════════════════════════════════════════════════════════════

def _render(blocks, pauses):
    """
    Emit each block as a line with its timestamp, and insert [[pause]] or
    [[gap]] tags between blocks where a significant silence was detected.
    """
    # Index pauses by the block they come after
    pause_after = {}
    for p in pauses:
        pause_after[p["after_block"]] = p

    out = []
    n_lines = 0

    for bi, blk in enumerate(blocks):
        # Emit the block text
        text = blk["text"].strip()
        if text:
            out.append(f"[{int(blk['t'])}] {text}")
            n_lines += 1

        # Emit pause tag if there is one after this block
        p = pause_after.get(bi)
        if p:
            out.append(f"[{int(p['start'])}] [[{p['family']} {p['duration']:.1f}s]]")
            n_lines += 1

    return "\n".join(out), n_lines


def _tag(ev):
    return f"[[{ev['family']} {ev['duration']:.1f}s]]"


# ══════════════════════════════════════════════════════════════════════════
#  STATS
# ══════════════════════════════════════════════════════════════════════════

def _line_stats(blocks, n_lines):
    if not blocks:
        return {}
    durs = sorted(b["e"] - b["t"] for b in blocks)
    counts = sorted(b["w1"] - b["w0"] + 1 for b in blocks)
    return {
        "lines": n_lines,
        "youtube_chunks": len(blocks),
        "median_duration_s": round(durs[len(durs) // 2], 1),
        "mean_words": round(sum(counts) / len(counts), 1),
    }
