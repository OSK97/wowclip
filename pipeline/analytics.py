"""Transcript analytics — hard numbers for the Omni Bouncer to reason with.

The whole point of this module: instead of the pipeline making a mechanical
PASS/FAIL decision from thresholds, it computes objective measurements and
hands them to the LLM alongside the transcript. Thresholds cannot tell the
difference between "sparse because the video is a silent montage" and "sparse
because it's a prank video with long setup shots and three devastating
one-liners". A model reading the actual words can.

So nothing here decides anything. It measures:

  coverage        how much of the runtime has speech attached
  density         spoken lines and words per minute
  gaps            where speech stops, how long, and how often
  distribution    is speech spread across the video or clustered at the start
  repetition      how often lines repeat, which is how lyrics look
  bursts          the longest continuous stretches of dense speech

The bursts matter most for the edge case where a video has little total speech
but that speech is gold. A 20-minute video with four minutes of talking is
"sparse" by ratio and perfectly viable in reality.
"""

import re
from collections import Counter

# A gap longer than this means speech genuinely stopped rather than the speaker
# taking a breath between caption lines.
GAP_THRESHOLD = 20

# Continuous speech shorter than this is not listed as its own stretch. It no
# longer erases the longest-stretch figure: the gate prompt tests that number
# against 30s, so reporting 0 for a video whose stretches are all 14s told the
# model there was no material when there was 14s of it.
MIN_BURST_SECONDS = 15

# How much speech one caption cue can be assumed to carry.
#
# The cue's own dDurationMs cannot be used: transcript.py documents that it
# "routinely overruns the next event's start, so it is a display hint and never
# a real duration", and the generic parse path sets duration to 0 for every cue.
# So a cue's honest span is the distance to the next cue, capped here — anything
# beyond this is silence, not speech.
CUE_CAP_S = 12.0

WORD = re.compile(r"\w+", re.UNICODE)


def analyse(segments: list, duration: int) -> dict:
    """Measure a parsed transcript against the video's real runtime."""
    if not segments:
        return {
            "line_count": 0,
            "word_count": 0,
            "covered_seconds": 0,
            "coverage_ratio": 0.0,
            "lines_per_minute": 0.0,
            "words_per_minute": 0.0,
            "gap_count": 0,
            "largest_gap": 0,
            "gap_seconds_total": 0,
            "thirds": [0.0, 0.0, 0.0],
            "repetition_ratio": 0.0,
            "top_repeats": [],
            "bursts": [],
            "biggest_gaps": [],
            "longest_burst": 0,
            "usable_burst_seconds": 0,
            "burst_count": 0,
            "runtime_s": int(duration or 0),
        }

    duration = max(duration, segments[-1]["start"] + 1)

    texts = [s["text"] for s in segments]
    counts = [len(WORD.findall(t)) for t in texts]
    word_count = sum(counts)

    # -- how much speech each cue carries, and where the real silences are --
    #
    # Coverage used to be "runtime minus every silence of 20s or more", which
    # counted every gap under 20s AS SPEECH. A video alternating 15s of talk and
    # 15s of silence reported ~100% coverage, and the gate prompt reasons about
    # that number out loud. Measuring the cues instead makes it a measurement.
    spans = []
    for previous, current in zip(segments, segments[1:]):
        spans.append(min(max(current["start"] - previous["start"], 0.0), CUE_CAP_S))
    typical = sorted(spans)[len(spans) // 2] if spans else 2.0
    spans.append(min(max(segments[-1].get("duration") or typical, 0.2), CUE_CAP_S))

    gaps = []
    for i, (previous, current) in enumerate(zip(segments, segments[1:])):
        gap = current["start"] - (previous["start"] + spans[i])
        if gap >= GAP_THRESHOLD:
            gaps.append({"from": int(previous["start"] + spans[i]),
                         "seconds": int(gap)})

    # Leading and trailing silence count too.
    if segments[0]["start"] >= GAP_THRESHOLD:
        gaps.insert(0, {"from": 0, "seconds": int(segments[0]["start"])})
    tail = duration - (segments[-1]["start"] + spans[-1])
    if tail >= GAP_THRESHOLD:
        gaps.append({"from": int(segments[-1]["start"] + spans[-1]),
                     "seconds": int(tail)})

    gap_total = sum(g["seconds"] for g in gaps)
    covered = min(max(sum(spans), 0.0), duration)

    # -- stretches with no long silence in them --
    #
    # Length is measured to the END of the last cue in the stretch, not to its
    # start. Start-to-start silently dropped the final cue's speech from every
    # stretch, which understated the one figure the gate prompt tests against a
    # threshold. The name is also honest now: a stretch here contains no silence
    # longer than GAP_THRESHOLD, which is not the same as "unbroken".
    bursts, all_bursts = [], []
    burst_start = segments[0]["start"]
    for i, segment in enumerate(segments):
        nxt = segments[i + 1] if i + 1 < len(segments) else None
        ends_here = nxt is None or (nxt["start"] - segment["start"]) >= GAP_THRESHOLD
        if ends_here:
            length = (segment["start"] + spans[i]) - burst_start
            all_bursts.append({"start": int(burst_start), "seconds": int(length)})
            if nxt is not None:
                burst_start = nxt["start"]

    all_bursts.sort(key=lambda b: b["seconds"], reverse=True)
    bursts = [b for b in all_bursts if b["seconds"] >= MIN_BURST_SECONDS]

    # -- distribution across the video --
    #
    # Weighted by WORDS, not by line count. A third full of dense speech and a
    # third full of one-word interjections used to look identical, and this is
    # printed to the model as "Speech distribution".
    third = max(duration / 3.0, 1)
    buckets = [0, 0, 0]
    for segment, n in zip(segments, counts):
        index = min(int(segment["start"] / third), 2)
        buckets[index] += n
    total = max(word_count, 1)
    thirds = [round(b / total, 2) for b in buckets]

    # -- repetition, the signature of song lyrics --
    normalised = [t.lower().strip() for t in texts if len(t.strip()) > 8]
    counts = Counter(normalised)
    repeated = sum(c for c in counts.values() if c > 1)
    repetition_ratio = round(repeated / len(normalised), 3) if normalised else 0.0
    top_repeats = [
        {"text": text[:90], "times": times}
        for text, times in counts.most_common(5)
        if times > 2
    ]

    minutes = duration / 60.0
    spoken_minutes = max(covered / 60.0, 0.01)

    return {
        # The runtime every figure below is measured against, so the brief
        # cannot print a percentage of one number beside a different one.
        "runtime_s": int(duration),
        "line_count": len(segments),
        "word_count": word_count,
        "covered_seconds": int(covered),
        "coverage_ratio": round(covered / duration, 3),
        "lines_per_minute": round(len(segments) / max(minutes, 0.01), 1),
        # Measured over spoken time, not total runtime, so long silences don't
        # make a fast talker look slow.
        "words_per_minute": round(word_count / spoken_minutes, 1),
        "gap_count": len(gaps),
        "largest_gap": max((g["seconds"] for g in gaps), default=0),
        "gap_seconds_total": gap_total,
        "biggest_gaps": sorted(gaps, key=lambda g: g["seconds"], reverse=True)[:5],
        "thirds": thirds,
        "repetition_ratio": repetition_ratio,
        "top_repeats": top_repeats,
        "bursts": bursts[:8],
        # The true longest, whether or not it clears MIN_BURST_SECONDS, because
        # the gate prompt compares this against 30 and a 0 here reads as "no
        # material in this video".
        "longest_burst": all_bursts[0]["seconds"] if all_bursts else 0,
        "usable_burst_seconds": sum(b["seconds"] for b in bursts),
        # Counted over the same set the total sums, so the two agree. `bursts`
        # is truncated to 8 for display and used to be the denominator of a
        # total taken over all of them.
        "burst_count": len(bursts),
    }


def to_brief(stats: dict, duration: int) -> str:
    """Render the measurements as a compact block for the prompt."""
    thirds = stats["thirds"]
    # Every figure below was measured against this, so print this one. The
    # caller's duration and the one analyse() actually used can differ, which
    # produced a percentage of one number sitting beside a different runtime.
    duration = int(stats.get("runtime_s") or duration)
    lines = [
        f"Runtime              : {duration}s ({duration // 60}m {duration % 60}s)",
        f"Transcript lines     : {stats['line_count']}",
        f"Total words          : {stats['word_count']:,}",
        f"Speech coverage      : {int(stats['coverage_ratio'] * 100)}% of runtime "
        f"({stats['covered_seconds']}s carries speech, {stats['gap_seconds_total']}s "
        f"in silences over {GAP_THRESHOLD}s)",
        f"Speaking pace        : {stats['words_per_minute']} words/min during speech",
        f"Lines per minute     : {stats['lines_per_minute']}",
        f"Silent gaps (>{GAP_THRESHOLD}s)   : {stats['gap_count']} gaps, largest {stats['largest_gap']}s",
        f"Word distribution    : {int(thirds[0] * 100)}% first third / "
        f"{int(thirds[1] * 100)}% middle / {int(thirds[2] * 100)}% last third",
        f"Repeated-line ratio  : {int(stats['repetition_ratio'] * 100)}% "
        "(high values suggest song lyrics rather than conversation)",
        f"Continuous speech    : longest stretch with no silence over "
        f"{GAP_THRESHOLD}s is {stats['longest_burst']}s; "
        f"{stats['usable_burst_seconds']}s total across "
        f"{stats.get('burst_count', len(stats['bursts']))} such stretches",
    ]

    if stats["bursts"]:
        spans = ", ".join(
            f"{b['start']}s(+{b['seconds']}s)" for b in stats["bursts"][:6]
        )
        lines.append(f"Dense speech starts  : {spans}")

    if stats["biggest_gaps"]:
        spans = ", ".join(
            f"{g['from']}s(+{g['seconds']}s)" for g in stats["biggest_gaps"]
        )
        lines.append(f"Biggest silences at  : {spans}")

    if stats["top_repeats"]:
        lines.append("Most repeated lines  :")
        for repeat in stats["top_repeats"]:
            lines.append(f"    {repeat['times']}x  {repeat['text']}")

    return "\n".join(lines)
