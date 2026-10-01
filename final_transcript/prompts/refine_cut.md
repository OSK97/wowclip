<<<SECTION:PROMPT>>>

Cut the nominated moment to its actual first and last spoken words.
Read the supplied window, identify the setup and completed payoff, choose the
boundaries, then do one focused check of those words. Avoid repeated speculative
comparisons once a clear, complete cut is found. Return the JSON below.

THE NOMINATION IS YOUR TARGET

Extra context before and after is available to repair a missing question,
referent or final clause. It is not material you must include. Keep the nominated
claim or arc; do not substitute a different stronger moment from the window.
Neighbouring nominations are separate reels. They do not forbid shared setup,
but do not widen merely to swallow a neighbour's payoff. If the nominated arc
really cannot be separated, explain that in boundary_note.

CLEAR START, COMPLETE END

- Start at a genuine sentence or independently spoken complete unit. Read across
  caption lines: ASR punctuation and line breaks do not reliably mark sentences.
  Do not start on a clause that only finishes an earlier thought.
- Keep the question, provocation, relationship or story setup when it supplies
  necessary meaning, tension or emotional build. A complete specific claim can
  start without its question when nothing is lost. A question can itself refer
  backwards; either recover what it needs or use a truly independent claim.
- Remove detachable throat-clearing or abandoned starts when meaning and natural
  speech survive. Words such as and/but/so, तो/एंड/सो/बट, this/that or ये/वो are
  clues, not forbidden vocabulary. Check their meaning in this actual sentence.
  A reference needs an understandable referent; not every pronoun needs a name.
- A quiet meaningful setup is allowed. Do not replace it with a punchline that
  destroys the build. Do not rely on a later editor to invent a hook or context.
- Run through the actual landing and every clause it needs. A dangling connective
  or unfinished sentence is not an ending. Stop before the next question, topic,
  independent claim or story begins. Include a follow-up if it completes this
  payoff, not merely because it happens next.

COMPLETE MEANING BEFORE LENGTH

There is no target duration, minimum duration or category-specific ceiling.
Choose the narrowest cut that preserves THIS moment's value and understandability.
A one-line claim needs no padding; a story or explanation can need a real build.
Do not calculate hypothetical lengths or compare alternative sums of line times;
the code measures your chosen segment.

A joke needs setup and punchline; a story or parable needs its consequence;
an announced list needs the promised items when the list is the moment;
a question needs a completed answer. Poetry may be a whole piece or an
internally complete smaller unit, such as a full sher. Arbitrary opening verses
that halt before their resolution are not complete. If a smaller complete unit
preserves the nominated value, it may work; do not replace a whole nominated arc
with an unrelated isolated line. Keep a worthwhile long whole when nothing
smaller works and note the length for review. Keep a necessary quieter stretch,
but remove unrelated preamble and follow-up. Do not amputate an earned ending.

READING THIS INPUT

Use the header's actual notation. >> can mark a caption turn change; it is not
a word and does not prove speaker identity. Speaker labels, if supplied, help.
Questions and answers can also occur inside one person's monologue.

Caption words, punctuation, numbers and names may be wrong. Interpret clear
meaning across noisy spelling, including phonetic English in Devanagari, but
copy the supplied boundary text literally. Do not invent missing speech or
visual events. When an uncertainty prevents a fully trustworthy cut, keep the
real nomination with lower confidence and a specific boundary_note for review.

Comments and replay data point to neighbourhoods, not exact boundary words.
A sound tag may drift or be mislabeled. A pause, refrain or applause is a clue
to an ending, not proof that a poem or story has finished. Words establish the
completed form. Missing signals are never grounds to reject a moment.

MEASURED ENDING PAUSE

Name the last SPOKEN line and words. For an emotional landing immediately
followed by a supplied [pause] or [long gap], keep_end_pause may be true on the
FINAL segment. The program keeps up to two seconds of that measured gap, within
the window and before subsequent speech. This is a pause preservation cap, not
a clip-length rule. Do not invent silence, request a duration, end on an event
row or include the next spoken line to make the ending breathe. An unmeasured
laughter/applause tag alone does not request an extended ending.

EXACT WORD ANCHORS

Copy four to eight words from each chosen spoken line exactly as supplied:
start_words begins at the first word the viewer should hear; end_words ends
at the last. Use fewer words for a shorter available phrase. They must occur
in the line you name. Never translate, correct spelling or punctuation, switch
scripts, or include >>, tags or comments. The program matches these words to
the word-level timings; a weak match may fall back to a rough boundary for review.

Normally keep one continuous segment. Extra segments can remove a genuinely
unnecessary interruption at safe sentence boundaries while preserving meaning
and natural order. Prefer a continuous cut when an interjection belongs to the
exchange. Never assemble a new claim from distant speech or remove the question
that makes the answer understandable. Use only as many segments as needed.

OUTPUT

Return one JSON object and no prose outside it:

{
  "keep": true,
  "segments": [
    {
      "start_line": "L0142",
      "start_words": "exact first words copied from that line",
      "end_line": "L0151",
      "end_words": "exact last words copied from that line",
      "keep_end_pause": false
    }
  ],
  "title": "a caption suited to this actual moment",
  "description": "Brief English description of this clip's value.",
  "category": "the reading you cut it for",
  "is_one_liner": false,
  "confidence": "HIGH",
  "boundary_note": "Brief reason for the chosen boundaries and any specific uncertainty."
}

- keep is normally true. Do not refuse because you prefer another nomination,
  the opening is quiet, or the clip is long. False is for a nomination that
  proves to be pure promotion or entirely dependent on unavailable visual
  action. Include a specific drop_reason when false.
- confidence is HIGH or MEDIUM. If necessary meaning or an edge is uncertain,
  use MEDIUM and explain it for review instead of pretending the cut is exact.
- keep_end_pause defaults to false and applies only on the last segment.
- is_one_liner describes the actual completed unit, not its duration.
- Keep descriptions and notes concise, in English; quote speech in its own script.

ONE FINAL CHECK

Verify that both ids exist and name speech, the anchors occur in those lines,
the opening is understandable and does not finish an earlier sentence, the
ending completes the nominated payoff, and no unrelated next thought slipped
in. Correct a concrete fault you find. Do not restart the nomination debate.

<<<SECTION:CAT_MOTIVATIONAL>>>

Preserve the idea that gives agency or reframes the viewer's situation.
Keep the question when it supplies the meaning; an independent claim may stand
alone. End on the earned reassurance, instruction or quotable landing. A
one-sentence moment is normal, with no fixed number of seconds. Avoid swallowing
neighbouring complete claims merely because they share a belief or identity theme.


<<<SECTION:CAT_EMOTIONAL>>>

Preserve the relationship, detail or story build that earns the feeling.
Do not automatically extend the setup; include what the viewer actually needs.
Keep a difficult but meaningful sentence whole. Spoken poetry needs a finished
piece or a complete internal unit. A measured ending pause may help when it
really exists; never add the next question or sher to create a breath.


<<<SECTION:CAT_ENTERTAINMENT>>>

Keep the actual spoken setup and payoff. An exchange may need both speakers;
a monologue may supply both through one speaker. Include a follow-up reply when
it completes the reversal or joke. An escalating exchange may need its whole
ladder. End at its spoken landing, before unrelated conversation; do not extend
solely to chase an uncertain laughter tag. There is no forced short duration.


<<<SECTION:CAT_GENERAL>>>

Preserve the value of the nominated idea, story, explanation or exchange.
Necessary reasoning, evidence or demonstration can be the point; do not replace
it with a bare conclusion that loses the value. Remove unrelated padding while
keeping enough context for the relevant new viewer to follow. Long and niche
moments are eligible when their complete build earns attention.


<<<SECTION:CAT_AUDIENCE>>>

The nomination follows local viewer evidence. Preserve the moment those marks
actually refer to, confirming it in nearby speech. Comments and replay peaks
are not exact edges and do not guarantee standalone meaning. Keep the setup
and payoff the marked moment needs. If its meaning remains dependent on missing
context, say so for review rather than inventing a complete story.


<<<SECTION:CAT_ANY>>>

Use the nominated moment's actual structure. Preserve its necessary setup,
value and completed payoff, with no assumed genre, duration or delivery style.


