# CaptionDirector — full-clip caption engine

Every other template in this repo is one moment: one hero word, one animation, one hand-placed
`syncFrame`. This one captions the **whole clip** and decides for itself where to escalate.

You give it a word-level transcript. It cuts the transcript into phrases on the speaker's own
breaths, scores each phrase for how much it carries, and promotes a rationed handful of them out
of a calm readable track into one of four bigger looks — spaced apart, never repeating
back-to-back, exactly one slam per clip.

You do **not** place beats. You do not pick looks per phrase. You supply the transcript, a mood,
and optionally a weight on the two or three words the clip actually turns on.

---

## The one design decision behind this

For a talking-head motivational reel there are three ways to do captions and only one of them
works.

**Plain subtitles the whole way.** Readable, invisible, and indistinguishable from every other
tool's output. Nothing is wrong with any single frame; the reel just has no moments in it.

**Heavy styling the whole way.** Every phrase gets a treatment — words flying, colours
switching, letters exploding. It looks like effort, and it is the worse failure of the two.
When everything is emphasised nothing is, so the viewer stops reading the words and starts
watching the animation. A reel whose captions are the most interesting thing on screen has
buried the speaker.

**A calm floor with rare, earned escalations.** This one. The quiet track runs about 80% of the
clip and is genuinely good at its job — the whole phrase visible, the spoken word lit, nothing
moving that does not need to. The other 20% are five or six moments where the type gets big and
does something, and they land on the lines the speaker leaned into.

The escalations only work *because* the floor is calm. A viewer who has been reading a steady
track for eight seconds feels a slam land. A viewer being shouted at continuously feels
nothing. So when you are tempted to raise `intensity`, remember you are not adding impact —
you are spending it.

---

## What you write

One JSON object. Only `words` is required; everything else keeps its default.

```json
{
  "background": { "src": "clip.mp4" },
  "theme": {
    "palette": "bone",
    "dim": 0.3,
    "scrim": 0.6,
    "casing": "upper",
    "stripPunctuation": true
  },
  "layout": {
    "trackFontSize": 78,
    "heroFontSize": 200,
    "supportRatio": 0.26,
    "leading": 0.34,
    "maxWidth": 0.86,
    "trackOffsetY": 0,
    "heroOffsetY": 0
  },
  "timing": { "wordIn": 4, "reveal": 11, "stagger": 3, "out": 7, "tailHold": 7 },
  "phrasing": { "maxWords": 5, "breathGap": 0.34, "maxSeconds": 3 },
  "plan": {
    "intensity": 0.2,
    "threshold": 0.42,
    "cooldown": 75,
    "pool": ["lit", "slam", "ribbon", "cascade"]
  },
  "words": [
    { "text": "you've", "punctuated": "You've", "start": 5.44, "end": 5.68 },
    { "text": "got", "punctuated": "got", "start": 5.68, "end": 5.84 },
    { "text": "the", "punctuated": "the", "start": 5.84, "end": 6.0 },
    { "text": "brains", "punctuated": "brains.", "start": 6.0, "end": 6.72, "weight": 0.92 }
  ]
}
```

## `words` — the transcript

This is exactly the shape WhisperX word-level output already has, so nothing needs reshaping.
`start` and `end` are seconds. `punctuated` is optional but worth supplying: punctuation is
never drawn, but a full stop is a free, perfectly reliable phrase boundary and a comma breaks
ties when the speaker leaves no gap.

### `weight` — the only creative input you give

`weight` is 0-1 on a **word**, and it promotes the phrase containing it. It overrides everything
the engine infers. Mark **two to four words in a 45-second clip** — the words the reel turns on.
Marking ten is the same as marking none, because the budget still only promotes about a fifth of
the phrases and you have just stopped telling it which fifth.

Use it for two things:

1. **Semantics the engine cannot hear.** The engine reads how a line was *said* — pause before,
   pause after, slowing down. That is real signal and it is language-independent, but it cannot
   tell that `a man without money is a man without a voice` is the line. You can.
2. **Fixing the hero word.** Within a phrase the engine rests on the longest non-structural
   word. Usually right, sometimes not: in `your personal dreams come true` it picks `personal`
   when the word is `dreams`. A `weight` on `dreams` fixes it, and the phrase gets promoted at
   the same time.

If you have PANNs or loudness data, a word inside a shouted or whispered stretch is a good
`weight` candidate — that is the speaker telling you directly.

## `theme`

`palette` is one of `bone`, `ember`, `acid`, `gold`, `ice`. Four of the five are close to
monochrome on purpose — emphasis here is carried by size, weight and light, not by hue, and a
caption track that changes colour every few seconds reads as a tool's output rather than an
edit. Default to `bone` (no colour at all) unless the clip has a reason:

| palette | accent | reach for it when |
|---|---|---|
| `bone` | white | almost always. Nothing to get wrong. |
| `ember` | hot red | anger, urgency, reality checks |
| `acid` | electric yellow | fast, loud, punchy delivery |
| `gold` | warm gold | slow, quiet, spoken-close-to-the-mic |
| `ice` | cold blue | money, numbers, clinical truths |

You can also pass an object to override individual colours: `{ "accent": "#ff3b2f" }`.

`dim` 0-0.9 is flat black over the whole frame; `scrim` 0-1 is a gradient rising from the
bottom behind the quiet track. **No type in this template has a shadow, stroke or glow**, so
these two are the entire legibility budget. Raise them for a bright or busy shot, lower them for
a dark one, never take both to zero.

`casing: "upper"` for anything punchy. `stripPunctuation: true` unless you have a reason —
commas at 80px do nothing for the viewer and add visual noise.

## `plan` — the rationing, and the only section worth thinking hard about

`intensity` 0-0.6 is roughly the fraction of phrases promoted. **0.2 is right for a
motivational reel.** 0.1 is nearly a pure clean track (good for emotional clips, where
restraint is the point). Above 0.35 the escalations stop reading as choices.

`threshold` 0-1 is the floor a phrase's weight must clear. It works *with* `intensity`: budget
says how many, threshold says never these. On a clip where nothing stands out, a high threshold
correctly produces a clean track rather than promoting mediocre lines to fill a quota.

`cooldown` is the minimum frames between two beats — 75 is two and a half seconds at 30fps.
This is the knob that most changes how the result *feels*. Two heavy beats four seconds apart
read as a template cycling through presets; the same two fifteen seconds apart read as an
editor making a choice twice.

`pool` is which looks it may reach for. Drop one to take it out of rotation.

## `phrasing`

`maxWords` 2-6 caps a phrase, `breathGap` 0.12-1.2 is the silence in seconds that always breaks
one, `maxSeconds` 1-6 caps its duration.

You rarely need to touch these. `breathGap` is the one that occasionally helps: lower it to
~0.25 for a fast speaker so the track keeps up, raise it to ~0.5 for a slow deliberate one so
short lines are not broken up.

## `layout` and `timing`

`trackFontSize` 40-120 and `heroFontSize` 110-320 are quoted in px at a 1080px-wide canvas and
scale from there. **The gap between them IS the escalation** — an emphasis beat that is not a
large jump in scale is not an escalation, it is a slightly different subtitle. Keep the hero at
least twice the track.

`supportRatio` 0.14-0.44 is the small type inside a beat, as a fraction of the hero. Capped well
under half deliberately.

`timing.wordIn` is the quiet track's entrance, `reveal`/`stagger` the beats', `out` how a beat
clears, and `tailHold` how long a phrase holds past its last word so a line never vanishes
mid-syllable.

---

## The five looks

You do not choose these per phrase — the director assigns them. Worth knowing what they are so
you understand what `pool` and `intensity` are buying.

**`baseline`** — the quiet track, ~80% of the clip. The whole phrase in the lower third, the
spoken word lit, the rest held back. Words already said sit slightly brighter than words not yet
said, so the eye is pulled forward through the line. A 3% lift and 3.5% scale on the active word
— enough to follow, not enough to wobble.

**`lit`** — one word per line on a shared left spine, large, and only the light moves. The
calmest escalation, so it is the right one for a line delivered quietly, where a bouncing word
would contradict the delivery. A tick travels down the left edge to the lit line.

**`slam`** — the hero word alone, as big as the frame allows, between two rules, with the rest of
the phrase shrunk underneath. Arrives oversized and scales *down* onto its mark with a ghost copy
blown outwards behind it. **Exactly one per clip, always on the heaviest phrase** — a clip has one
loudest moment by definition, and used twice it becomes a tic.

**`ribbon`** — lead-in above in small sans, hero heavy and huge, and the tail set in serif
italic tucked under the hero's *right* edge behind a hairline rule, drawn on left to right.
Mixed faces stop the tail competing with the punch while still letting it be read; flushing it
right rather than centring it is what makes the pair look composed instead of stacked.

**`cascade`** — words on their own lines, each stepped sideways, arriving on their own
timestamps so the stair builds at the speed of the sentence. For a fast run of words where
holding them still would waste the energy already in the delivery. Leans left or right based on
a hash of the phrase, so two cascades in one clip are different compositions.

---

## What the engine does for you

**Phrasing on breaths, not word counts.** Cuts are taken first only where the speaker actually
stopped — a full stop, or a gap past `breathGap`. Anything still too long is then broken at its
*weakest internal join*, preferring commas, biased toward the middle, and heavily penalised for
leaving a fragment of pure function words. That is the difference between `financial wall` /
`around your family` and `financial wall around your` / `family`. Never cut at word N.

**Weighting from delivery.** Pause before, pause after, and slowing below the speaker's own
median rate — normalised per clip, so a naturally fast speaker is measured against themselves.
Short phrases score higher because short phrases punch. A phrase of pure function words is held
down hard, because a speaker pauses before a thought as readily as inside one.

**Rationing.** Budget from `intensity`, floor from `threshold`, spacing from `cooldown`, no look
twice running, exactly one slam. When a phrase's shape leaves no alternative to repeating, it
stays on the quiet track instead — a missed emphasis costs nothing, a visible repeat costs the
illusion that any of it was chosen.

**One measurement pass for the whole clip.** Every phrase is measured and solved once, behind a
single `delayRender`, so frame 300 is identical whether or not frame 299 was rendered. Geometry
is a constant the animation reads from.

**Real glyph metrics.** Every position comes from `actualBoundingBox*` ink and is spaced off cap
height rather than font size, then snapped to whole pixels. Composing against the font's line box
instead of its ink puts every edge a few pixels out, and at 200px a few pixels is visible.

**Graceful degradation.** Out-of-range numbers are clamped. A solver that throws falls back to
the quiet track rather than taking the render down. A missing font file falls back through the
stack. Exactly one phrase is ever live at a time, enforced when the phrases are built rather
than hoped for at render.

Do not try to hand-place anything. Choose the transcript, the mood, and the two or three words
that matter, and leave the geometry and the schedule alone.

---

## Checking it without rendering

The schedule is pure arithmetic on the timings — no fonts, no DOM — so it can be printed:

```
npx tsc --project scripts/tsconfig.inspect.json
node scripts/out/scripts/inspect_caption_plan.js
```

That prints every phrase with its weight, pauses, rate, hero word and assigned look, plus
assertions that no two phrases overlap and no two beats land inside the cooldown. Tuning
`intensity`, `threshold` and `cooldown` off that table is much faster than tuning them off a
preview, and the numbers behind each decision are otherwise invisible.

The `CaptionDirectorDebug` composition overlays the same information on the video while you
scrub.
