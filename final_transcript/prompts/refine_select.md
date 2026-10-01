<<<SECTION:PROMPT>>>

Review the nominated moments together. This optional legacy pass merges true
duplicates and removes unusable nominations; the website currently merges in
code. Exact starts, ends, words and durations belong to the later cutting pass.
Do not turn this review into another full search or boundary debate.

INPUT

Each CANDIDATE C1, C2, etc. carries its readings, rough line range, speech and
finder concerns. Edges can be approximate, questions may need recovery, and ASR
words or punctuation may be noisy. Judge the underlying moment, not those
repairable edges. Never rewrite speech or invent unavailable evidence.

DUPLICATES

Merge only the same build and payoff nominated more than once. Choose one
survivor, attach the others through merged_with, and choose a cut_for reading
that fits the actual moment. Other readings and audience evidence stay useful.

Overlap, containment, shared themes, similar titles, repeated catchphrases or
the same closing sentence alone are insufficient to merge. A complete one-line
insight and a larger arc can each have value. Distinct claims inside one stretch
remain separate moments. Marks at different times can corroborate separate arcs
but can also point to different parts of one arc; confirm from the words.
When uncertain whether two nominations are duplicates, keep them separately.
Do not widen boundaries to combine nearby ideas.

UNUSABLE NOMINATIONS

Drop only when the visible evidence clearly establishes no recoverable moment:
pure promotion/housekeeping, speech whose meaning cannot be recovered, entirely
unavailable visual action, or an unresolved fragment with no reachable setup or
payoff. An intro, outro or trailer position is not enough: genuine complete
material inside such a section is eligible. Rough boundaries, shortness,
length, quiet openings, niche topics and a stronger neighbour are not grounds
to drop a real nomination. Let the cutting pass repair locally missing context.

Local audience evidence warrants attention, not a fabricated meaning or
resolution. Confirm its referent; do not dismiss a genuinely marked moment
merely because it is ordinary by your own taste. No target count or duration.
Keep specific uncertainty in the note rather than hiding it by removing a clip.

OUTPUT

Return one JSON object, with no other prose:

{
  "keep": [
    {"id": "C1", "merged_with": ["C7"], "cut_for": "entertainment",
     "note": "Brief English identification of this moment and useful cutting context."}
  ],
  "drop": [
    {"id": "C4", "reason": "Specific unrecoverable fault in this nomination."}
  ]
}

Account for every input candidate id EXACTLY ONCE, either as a kept id, an id
inside merged_with, or a dropped id. A merged id must not also be kept or
dropped. Use only ids supplied in the input. Omit merged_with or use [] when
none. cut_for is motivational, emotional, entertainment, general or audience.
Notes and reasons are concise, in English, and refer to this actual nomination.
Check that no id is missing or accounted for twice; do not re-litigate clear
judgements to manufacture a tidier or shorter list.
