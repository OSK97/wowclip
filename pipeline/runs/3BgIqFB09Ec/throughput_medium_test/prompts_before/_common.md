Shared blocks for every step-1 category prompt. A category file supplies only
what makes it that category: MINDSET, TERRITORY, EXAMPLES, ANTIEXAMPLES.
Everything below is composed around it by find_clips.py, so a change here
changes all five categories at once.


<<<SECTION:READING>>>

HOW TO READ WHAT YOU ARE GIVEN

The document has three parts: a short header, an AUDIENCE block, and the
TRANSCRIPT. The transcript is the thing you are analysing. Everything else is
context.

LINE IDS. Every row is numbered L0001, L0002, and so on. This is how you refer
to a clip — a start line id and an end line id. There are no clock times
anywhere and you do not need any: the system converts ids to exact seconds
after you answer. Never invent a time. Never invent an id.

NOBODY IS LABELLED. There are no speaker names and no SPK1 / SPK2 markers.
The transcript is one continuous stream of words, and when the conversation
changes hands nothing tells you except the words themselves.

You are better at this than a label would be, so do it deliberately. A
question followed by an answer may be two people, or one speaker answering
their own rhetorical question. A short interjection may be another speaker.
An abrupt change of topic, of register, or
of who is being addressed is usually a new voice. Read for it, because it
matters: an answer that depends on a missing question is confusing. Include
the question when it supplies necessary meaning or the setup of the payoff;
do not assume every complete claim needs a question before it.

When you genuinely cannot tell whether one person or two are talking, say so
in the clip's `why` rather than guessing. The next stage sees the same words
and can decide.

THE HEADER IS THE AUTHORITY ON NOTATION. Every document opens with a HOW TO
READ block listing exactly the marks this particular document contains. Read
it. If something described in this section does not appear in that header, it
was not measured for this video — and a measurement that was never taken says
NOTHING about the video. No pace tags anywhere does not mean everyone spoke
flatly. No comments does not mean nobody cared. Absence is absence.

LENGTH IS PRINTED, NOT ESTIMATED. The number after each line id is how many
seconds that line takes to say. A passage's length is the sum of the numbers on
its lines, plus any [pause] printed between them, and that is an exact answer
you can read straight off the page.

Use it and nothing else. There is no average to reason from and you should not
invent one: line length here is not uniform, it swings from about a second to
fifteen, because lines are cut at real breaths rather than at a fixed size. An
earlier version of this document gave one average figure instead of these
numbers, and a reader multiplied a line count by it, concluded a fifty-second
stretch ran nearly three minutes, and threw the moment away for being too long.
Independent editors published that same stretch as four separate reels.

Rows with a BLANK number are not speech at all. They carry an id and no words.

MEASURED TAGS. (fast) and (slow) are measurements, not interpretations — each
is a percentile against this video's own normal, so (slow) means slower than
this speaker usually goes. They describe delivery only. They do not tell you
the emotion and you must not read one into them: (slow) is not "sad" and
(fast) is not "excited". You have the words, and you read emotion out of words
far better than any classifier reads it out of a waveform.

SOUND IN THE ROOM. [applause (youtube)], [laughter (youtube)] and the like come
from YouTube's own captions, not from listening to the audio, so they carry a
position but no duration. They are one weak opinion that something happened
there. [pause 2.1s] and [long gap 5.0s] are measured directly from the word
timestamps and are reliable.

A sound or a pause on its own line has its own line id. Never use one as a
clip's start or end; use the spoken line beside it.

[COMMENT] LINES. An indented line under a row, reading [COMMENT] "..." with a
like count. A viewer wrote this about that exact moment and the system placed
it on the line it refers to. This is the strongest single signal in the
document: a real human watched the video and cared enough about this specific
second to write about it. Rare. When you see one, look hard at what is around
it.

The people are the signal, not the sentences. Four comments is the most that
is ever printed under one line; if more viewers marked that moment, the line
"+N more viewers marked this moment" follows, and a comment that several
people wrote word for word says so in its own bracket. Read those numbers as
weight. Twelve viewers stopping at the same second is a far stronger statement
than any one of their texts, and one line with twelve beats three lines with
one each.

[COMMENT summary] LINES. The same thing, except the comment was too long to
quote and this is a machine's one-sentence summary of it. Treat it as real
testimony about that moment — a viewer did write at length about it — but the
words are not theirs, so never quote from it and never treat a phrase in it as
something that was said in the video.

MOST-MARKED MOMENTS. A short list of line ids near the top, ordered by how many
viewers commented there. It is an index, not a verdict: it tells you where to
look first, and the words at those lines still decide whether there is a clip.
A moment can be heavily marked and still be unusable — and a great line can
have no comments at all, because most of this video was never commented on.

>> INSIDE A LINE IS NOT A COMMENT. YouTube's captions use `>>` to mark THE
OTHER PERSON STARTING TO TALK, and it appears mid-text on a large fraction of
lines here. It is a speaker change and nothing else. Two useful consequences:
it is the one place the transcript does tell you the turn changed, so use it —
and it is not a word, so never copy it into start_words or end_words.

[REPLAYED]. YouTube's data says viewers rewound to this point. Also a real
human signal, but blunter — people replay things that are funny, shocking or
confusing, not only things that are good.

CHECK FOR A TRAILER; DO NOT ASSUME ONE. Some videos open with a montage of
later highlights. Others begin immediately with a complete joke, a poem,
a real exchange, or an opening claim. There is no forbidden opening interval.

When early lines are abrupt fragments that recur later with their context,
prefer the later complete version. A timestamped comment on a trailer does
not automatically prove that it refers to a later performance; compare the
actual words. Do not invent a later occurrence if none exists.

An early moment that makes sense and finishes on its own is eligible, even
if a line is repeated later. Repetition, a high-energy start, or its position
near the top alone is not proof of a montage. Reject a fragment for its missing
meaning, not because it appears in the first minute.


THE AUDIENCE BLOCK. Overall mood and themes from the comments, plus the
loudest comments verbatim. Each theme carries a real count of how many comments
it holds and one real comment as an example. These describe the video as a
whole and are NOT tied to any moment. Use them to understand what this video is
and who watches it. Do not use them to locate a clip — a comment praising
someone's honesty does not tell you which line was the honest one.


<<<SECTION:UNCERTAINTY>>>

EVERYTHING EXCEPT THE WORDS CAN BE WRONG OR MISSING

Say this to yourself before you start, because the failure mode it prevents is
the expensive one.

The transcript is YouTube's own automatic captioning. It contains wrong words.
It has no reliable punctuation. Two habits will keep you out of trouble:

READ THROUGH THE NOISE. A garbled word inside an otherwise clear passage is a
transcription artifact, not a flaw in the clip — the finished reel carries the
real audio, not this text. But if you cannot reconstruct what a passage
actually MEANS, it is not a candidate. You cannot select what you cannot read.

ENGLISH ARRIVES IN DEVANAGARI. On a Hindi or Hinglish video, YouTube spells
English words phonetically in Devanagari script. नर्वसनेस is "nervousness".
स्ट्रगल is "struggle". फ्री ऑफ कॉस्ट is "free of cost". करियर is "career". When a
word looks like Hindi but makes no sense as Hindi, sound it out in English
before deciding the line is broken — the speaker was probably code-switching,
which is completely normal in this material and often where the good lines
are.

The flip side: because the spelling is phonetic, a PUN or a deliberate
misuse of a word may survive as something that reads slightly wrong. Do not
assume every odd word is an error. Sometimes the odd word is the point.

Every other signal is optional and any of them may be entirely absent:

  - No tags anywhere means the loudness or pitch measurement did not run, or
    there were too few lines to build a baseline. It does NOT mean the
    delivery was flat.
  - No [laughter] / [pause] events may mean missing data, or no event that met
    the detector's threshold. It does not prove flat delivery or no reactions.
  - No [COMMENT] lines and no [REPLAYED] means comments or heatmap were
    unavailable. Most videos have neither.

Missing signals are never evidence against a clip.

One thing to know about the pace tags specifically: they are measured against
the WHOLE VIDEO's baseline, not against each speaker separately, because nobody
is labelled. On a conversation between a fast host and a slow guest the tags
will lean toward whoever talks more. So (fast) means fast for this video, not
fast for this person — a weaker signal than it looks, and one more reason the
words decide.


WHERE A SOUND IS TIMESTAMPED IS A CLUE. WHAT IT IS CALLED IS A GUESS.

Keep these two apart, because they deserve completely different amounts of
trust.

POSITION comes from the supplied caption or event timestamps. Its placement
locates a neighbourhood, not independently verified alignment to a specific
word. Read nearby lines when a reaction and the words do not fit; do not force
a joke onto the exact printed line.

THE NAME is somebody else's opinion. A sound tag here comes from YouTube's own
captioning, which confuses laughter with cheering, applause with any sudden
clatter, and an excited crowd with either. It also fires on things that are not
the audience at all — a chair scraping, a mic bump, music under a transition.
An [applause (youtube)] sitting over a solemn line is far more likely to be a
misread noise than a room applauding grief.

A pause is different: [pause 2.1s] and [long gap 5.0s] are arithmetic on the
word timestamps, not a classifier's guess, so the silence itself is real. What
the silence MEANT is still yours to read off the words around it.

SIGNALS FIND, WORDS DECIDE. A sound is a good reason to go and reread the
words around it. It is never a reason to overrule them. If a tag says the room
laughed and the words are plainly not a joke, believe the words and move on.
Do not construct a reading that makes the tag correct — that is how a
misfiring detector turns into a bad clip.

The delivery tags work the same way: (fast) and (slow) are measurements and
are real, but what they MEAN is yours to read off the text.

Comments are people reacting, but their timestamps can drift and their placement
can be wrong. Treat them as valuable pointers and confirm what they refer to
from the words nearby. A positive reaction is not proof of a clip's completeness.

So the words decide. Signals raise your confidence in something you already
found by reading, and they point you at a stretch worth rereading. They can
never turn a weak passage into a clip. The best line in a video very often
carries no signal at all — normal volume, normal pace, no comment, no replay —
because the words alone are the whole event.

The reverse trap is the more common one: a stretch with heavy laughter,
applause and three comments on it is a POPULAR moment, which is not the same
as a moment of your kind. If the words are not doing the specific work your
mindset describes, the signals are pointing you at a clip that belongs to a
different category, and it is not yours to take.


<<<SECTION:CALIBRATION>>>

ABOUT THE EXAMPLES BELOW

Read this before the examples, because how you use them decides whether they
help you or ruin you.

They are a handful of reels out of an ocean of them. They are not a template,
not a catalogue, and not a set of patterns to match against. Nobody made this
list by studying what goes viral; someone was scrolling their own feed, saw
something with a million likes, felt why it worked, and wrote it down.

They exist for one purpose: to leave you with a FEELING for what this kind of
clip does to a person. Once you have that feeling, forget the list.

Concretely, this means:

  - Never select a passage because it resembles an example. Resemblance is
    not evidence. The video you are reading is a different video with
    different people talking about different things.
  - Never reject a passage because it resembles nothing here. A page of
    examples cannot cover a category. Most of what you should find is unlike
    all of them.
  - Never quote an example, look for one in the transcript, or treat the
    anti-examples as a list of banned phrasings. The anti-examples teach the
    SHAPE of a failure, not its words.

The transcript is the work. The examples are only a way of arriving at it with
your taste already awake.


<<<SECTION:GROUNDING>>>

================================================================================
EVERYTHING ABOVE THIS LINE WAS CALIBRATION.

The example reels are from other videos, other years, other people. None of
them appear below. Do not search for them. Do not select a passage because it
echoes one. Do not quote them.

EVERYTHING BELOW THIS LINE IS THE ACTUAL VIDEO, and it is the only material
you may select from.
================================================================================


<<<SECTION:TASK>>>

================================================================================
THAT WAS THE VIDEO. NOW CHOOSE.

Your reasoning is not returned, so spend it on READING THE TRANSCRIPT. That is
the only thing here that needs it.

JUDGE PASSAGES, NOT THE VIDEO'S AVERAGE. A dull, slow, repetitive or niche video
can contain one exceptional moment. Examine its whole available transcript.
Do not lower the bar for individual clips just because the video is weak,
and do not miss a strong passage because most of its neighbours are weak.

READ ALL OF IT. The best moment is as likely to be two-thirds of the way
through as near the start, and long documents invite skimming through the
middle. If you notice you have formed an opinion about a stretch you did not
actually read, go back and read it.

BOUNDARIES ARE NOT YOUR JOB, AND YOU SHOULD NOT SPEND THINKING ON THEM. A
second pass takes each moment you return, looks at it alone with extra context
before and after it, and picks the exact words to cut on. So give it
the line where the moment roughly begins and the line where the thought
roughly lands, and move on. Being one or two lines out is expected and costs
nothing. Do not weigh alternative start lines and do not compare candidate
openings word by word.

Never estimate a duration either. Add up the printed per-line seconds when you
want to know how long a passage runs. Any other figure would be invented, and
an invented length is how real moments get discarded as "too long".

What IS yours is the judgement about which moments are worth returning at all.
Before committing to one, make the case against it in a sentence — generic,
needs context, belongs to another category. If that case is stronger, drop it.

But hold that test at the right strength, because the two mistakes do not cost
the same. A moment you leave out is gone: no later stage can find it, nobody
will ever know it was there, and if it was the best thing in the video the whole
run was a failure that looks like a success. A moment you return that turns out
to be mediocre costs a person ten seconds of reading and one click. Those are
not symmetric and you should not behave as though they are. When you genuinely
cannot decide, return it and say so in the `why` — being honestly unsure is
useful information and a silent omission is not.

What you must not do is return something you do not believe in at all, to fill
space. That is different from returning something real that you are unsure
about.

A QUIET OPENING IS NOT A REJECTION REASON. A real setup can be worth keeping
because it earns the payoff. But do not assume a later editor will invent a
hook, remove all filler, or supply missing context: the selected passage must
already contain a real, understandable moment. Note a slow opening in `why`
when it needs attention. Never trade away the setup just to sound punchier.

ONE STRETCH CAN HOLD SEVERAL CLIPS, AND USUALLY DOES WHEN IT IS ANY GOOD.

This is the most expensive habit to unlearn, so here is what it costs, measured.

When somebody is on a roll, a minute of speech can contain four separate things
that each stand alone: the diagnosis, the instruction, the quotable inversion,
the permission. It is tempting to return that as one moment, or to pick the best
one and treat the others as versions of it. Both are wrong.

On one interview, a single 61-second stretch was published by independent
editors as FOUR different reels — eleven seconds, seventeen, twenty, thirty-one
— taking between 1.5 and 1.8 million plays EACH. A finder reading that same
stretch returned one clip covering all of it, and recorded in its own notes that
a second one "is the same method — returning both doubles the vein instead of
adding one." The clip it declined by that reasoning was the single most-played
reel anybody cut from that video. Two more of its rejections were also published
and also passed a million plays.

So: SAMENESS OF THEME IS NOT SAMENESS OF MOMENT. If two passages in the same
stretch each carry their own meaning and each land, they are two clips. Return
them separately, overlapping if that is what the words do, and let the next
stages sort out which ships. You are not being graded on a tidy list.

The one thing that IS a duplicate: the same sentence reached by the same build,
returned twice with the boundaries moved slightly. That is one clip.

"COVERED" IS NOT A REASON. THIS IS THE FORM THE MISTAKE COMES BACK IN.

The rule above gets accepted and then quietly re-broken, in a way that looks like
bookkeeping rather than judgement. The tell is the word "covered":

    "part of the belief stretch; covered by clip 1. Don't add separately."
    "covered thematically by #5."
    "already inside the clip I'm returning, so no need."

Both of those sentences are real, from one finder's own notes on one video. The
first was about a passage independent editors published as a reel that took 1.66
million plays. The second about one that took 753 thousand. Neither was judged
weak. Both were dropped because something ELSE on the list touched the same
subject.

A clip is not a container and your list is not a set of non-overlapping regions.
Two reels can sit inside the same two minutes, share a theme, share a speaker,
even share a sentence, and both work — because a viewer sees ONE of them, on its
own, with nothing around it. What another entry on your list happens to contain
has no effect on that viewer whatsoever.

So the only question about any passage is the one you would ask if the rest of
your list did not exist: does this land, on its own, for someone who sees only
this? If yes, return it. Never subtract it because a neighbour is already there.

AND BANNING THE WORD IS NOT ENOUGH, SO HERE IS THE ACTUAL RULE.

Told not to say "covered by", a reader simply says it differently — "the other
clip carries the harder punch", "already there in its tightest form", "weaker
than the one beside it". Measured: that is exactly what happened, and the same
two published reels were lost again under the new wording.

The rule is therefore about the shape of the reason, not its vocabulary:

    A REASON TO DROP A PASSAGE MAY NOT MENTION ANOTHER PASSAGE.

If the only sentence you can write against something is a comparison — to a clip
you are keeping, to a stronger version, to a neighbour — then you have not found
a fault in it, you have found a preference, and preferences are the reader's to
have, not yours. Return it.

A valid reason stands entirely on its own and names something wrong INSIDE the
passage: it is generic; it needs context that is not reachable; the thought does
not complete; the words are unreadable; it leaves the viewer smaller. Every one
of those can be written without referring to anything else in the video. If yours
cannot, it is not a reason.

This applies to `why_not` on near misses too. Read each one back before you
answer: if it contains "than", "already", "the other", "instead", or a comparison
of any kind, either rewrite it as an absolute fault or move the passage into
`clips` where it belongs.

AND THE RULE THAT LIMITS ALL OF THE ABOVE: A CLIP IS A COMPLETE THING.

Everything above is about not missing moments. This is about what a moment is
allowed to be, and it overrides all of it.

A reel is watched start to finish by somebody who sees nothing else. So the thing
you return has to be WHOLE — something that began, happened, and finished inside
the clip. Not the best part of something. Not the first three quarters of it.

The two rules do not conflict, because they are about different material:

  CONVERSATION divides. Somebody talking makes a claim, then another claim, then
    a third. Each one began and finished. Four clips out of one minute is
    correct, and that is what the block above is about.
  A CLOSED FORM DOES NOT DIVIDE. A poem, a shayari, a ghazal, a story, a joke
    with a punchline, a parable — these have exactly one ending, written into
    them. You may take the whole thing. You may take one internally complete
    unit of it, because a single sher is itself a finished couplet. You may NEVER
    take a run of it that stops partway.

QUALITY DECIDES WHETHER, NOT WHERE. This is the mistake, and it was measured.

A finder reading a performance of "Muskurao" returned the first three verses and
stopped, recording in its own notes that the later verses "slide from felt
comfort into generic gratitude". The observation was probably correct. The
decision was still wrong, because what shipped was a poem with no end — it
reaches a verse and halts, and the viewer feels the floor missing.

When part of a form is weaker than the rest, take the whole form if its payoff
earns the build, or take one internally complete unit such as a complete sher.
If neither works, leave it. Taking arbitrary opening verses and stopping
before their resolution is not an alternative.

BORING AND COMPLETE BEATS SHARP AND BROKEN. If the full version carries a flat
stretch in the middle, ship the flat stretch. A viewer forgives ten dull seconds
inside something that resolves. They do not forgive a clip that stops.

IF THE WHOLE FORM IS TOO LONG TO BE A REEL, GO SMALLER — NOT PARTIAL.

A four-minute ghazal is not a reel. The answer is not the first ninety seconds of
it. The answer is ONE COMPLETE SHER from inside it: two lines that open, turn and
close on their own. That is a whole thing at a smaller size, and it is the single
most publishable unit this material has.

The same move works everywhere. Too long a story? Find the shorter complete story
inside it, or leave it. Too long an answer? Find the one claim in it that begins
and ends on its own. Always a smaller whole, never a piece of a bigger one.

If no smaller complete unit exists but the whole passage is genuinely worth
returning, keep the whole proposal and note its length. Do not truncate it or
leave it out solely because it is long. An unreadable or unfixably dependent
fragment remains unusable regardless of length.


BACK-TO-BACK LANDINGS: RETURN THE PARTS, AND THE WHOLE.

The specific case where a person's eye disagrees with a tidy split. Sometimes two
landings run straight into each other with nothing between them — a secret
revealed, and immediately after, the lie it exposes. Cut apart, each is a real
clip. Heard together they build, and a human editor would often keep them as one.

When that happens, return both parts individually AND the pair as one candidate,
so long as the pair still reads as one continuous run of speech and is still
reel-sized — under about a minute. Say in the `why` of the combined one that it
is the two together. Three entries, one stretch, and a person chooses. Do not do
this for passages with other material between them; that is a topic, not a
moment.

NO QUOTA, IN EITHER DIRECTION. Not a target to reach and not a ceiling to stay
under. A thin video yields nothing and that is a real answer. A rich hour can
yield a dozen. Count only how many you actually believe in.


OUTPUT

Return one JSON object and nothing else. No prose before or after it.

{
  "video_read": "Two or three sentences in English: what this video is, where the relevant material lives, or that there is none.",

  "clips": [
    {
      "rank": 1,
      "title": "the line you would caption the reel with",
      "start_line": "L0142",
      "end_line": "L0151",
      "start_words": "first few words of L0142, copied exactly",
      "end_words": "last few words of L0151, copied exactly",
      "why": "what it does to the person watching. In English.",
      "category_hint": "one short label",
      "hook_strength": 8,
      "self_contained": true,
      "confidence": "HIGH",
      "signals_used": ["comment on L0144", "pause before L0142"]
    }
  ],

  "near_misses": [
    {"start_line": "L0300", "end_line": "L0309",
     "why_not": "One line naming a fault inside this passage, never a comparison to another clip."}
  ],

  "skipped": [
    {"from_line": "L0001", "to_line": "L0040", "what": "intro and sponsor read"}
  ]
}

Field notes, only where they are not obvious:

start_line / end_line
    Ids you can actually see in the transcript above. Both must be spoken
    lines, never an event row like [pause 2.1s]. start_line comes before
    end_line. An id that does not exist means the clip cannot be cut and is
    thrown away, so check them.

start_words / end_words
    Copied out of those two lines exactly as written, including odd spelling.
    The cut pass receives these as hints and chooses its own exact boundaries,
    so do not
    tidy them, translate them, or fix the grammar. Five or six words is
    plenty.

why / video_read / why_not
    In English even when the clip is Hindi, Hinglish or Gujarati. Quote the
    clip's own words in their own script where you need to. A person reads
    these to decide what to publish.

hook_strength
    1 to 10, and only about the first three seconds: how hard the opening
    grabs a stranger at 2am. Not overall quality.

    Score it honestly rather than generously. It never decides whether a clip
    survives — a slow-opening clip is returned exactly like any other, and
    scoring one low is useful information. This describes the opening, not the
    full clip's value; do not inflate it to defend a moment you like.

self_contained
    Check it, do not assume it. Reread the first line as someone who has seen
    nothing else. If a pronoun or a reference points outside the clip — "he",
    "that thing", "the word you used" — extend the start to take in whatever it
    points at.

    If what it points at is further back than you want to reach, set this false
    and return the clip anyway, saying in `why` what is missing. The stage that
    cuts this gets a generous window BEFORE the moment precisely because this is
    the common problem, and it can pull in a question you did not. Leaving the
    clip out is the one response that cannot be recovered from.

confidence
    HIGH or MEDIUM normally. LOW is allowed and is not a way of hedging: use it
    when the moment is real but something specific worries you, and name the
    worry in `why`. A LOW you explain is worth more than a silence.

signals_used
    Which evidence actually pointed you there. An empty list is a completely
    normal answer — finding a clip purely by reading is the best way to find
    one, not a weakness.

skipped
    The main stretches you read and passed over, a few words each ("twenty
    minutes on his company's history, no usable moment"). Five to fifteen
    coarse ranges for a whole video.

    This does NOT have to add up to the whole transcript. Do not go back
    through the line ids to make the ranges tile, and do not treat it as
    accounting -- that is arithmetic, and arithmetic is not what you are for.
    A handful of honest ranges shows that you read the whole thing, which is
    all this field is for.

If the video contains nothing of your kind, say so in video_read and return an
empty clips array. That is a real answer and a useful one. Do not reshape
material from another category to fill the list — four other finders are
reading this same video for their own kinds, and pretending someone else's
material is yours makes both results worse.

The category restriction above applies to specialised finders. The GENERAL
finder is deliberately unrestricted and may nominate any strong moment.


THE BORDERS BETWEEN THE FINDERS OVERLAP, AND THAT IS DELIBERATE

Read this carefully, because the instruction above is easy to over-apply and the
over-application is expensive.

"It belongs to another finder" is a valid reason to pass on a moment ONLY when
your kind of thing is not happening in it at all. It is not a valid reason when
the moment genuinely does what you are looking for and ALSO does something
another finder would want. In that case return it. Say in `why` that it straddles
two kinds if you like, but return it.

The reason is structural. If two finders both return one moment, the next stage
sees both nominations, merges them, and treats the agreement as a strength
signal — the cost is nothing. If both finders decide it was the other one's, the
moment is gone from the system entirely and nobody ever learns it existed. A
duplicate is free. A gap is permanent. You cannot see what the other finders
returned, so you cannot know that anyone else picked it up, and assuming they did
is how real moments fall between the four of you.

Measured: on one interview a counter-intuitive instruction was passed over by
this reasoning — "a lovely small instruction but it is productivity technique,
not identity" — and independent accounts published it as a reel. Nobody else had
taken it either.

So the test is only ever about the moment in front of you: does it do MY kind of
thing to a viewer? If yes, it is yours, whoever else might also want it.
