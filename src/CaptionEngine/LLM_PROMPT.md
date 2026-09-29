# Caption Engine — input contract

You supply a word-level transcript. The engine decides phrasing, which word carries each phrase,
how it is cased, and where every fragment sits. You do **not** author captions word by word, and
you do not hand-place anything.

## Minimum input

```json
[
  { "text": "do",     "punctuated": "Do",      "start": 0.40, "end": 0.68 },
  { "text": "not",    "punctuated": "not",     "start": 0.70, "end": 0.95 },
  { "text": "judge",  "punctuated": "judge",   "start": 0.97, "end": 1.42, "emphasis": 0.85 },
  { "text": "people", "punctuated": "people.", "start": 1.44, "end": 1.98 }
]
```

| Field | Required | Meaning |
|---|---|---|
| `text` | yes | Bare token, no trailing punctuation. Used for scoring. |
| `punctuated` | no | Display form: original casing + punctuation. Defaults to `text`. |
| `start`, `end` | yes | Seconds. |
| `emphasis` | no | `0..1`. Supply it — see below. |

Punctuation in `punctuated` is load-bearing: `.` `!` `?` `।` end a phrase, and `,` `;` `:` end one
once it already has two words. An unpunctuated transcript still works, but phrases then break only
on pauses and budgets, which reads worse.

## `emphasis` is the highest-value field you can provide

It dominates hero-word selection, and hero-word selection is what the caption is *about*. Anything
that knows which word matters should write it:

- loudness percentile from the FFmpeg `ebur128` pass
- PANNs / YAMNet energy peaks
- an LLM marking the keyword of each line

Without it the engine falls back to heuristics — not a stopword, not a vague word, right length,
drawn-out delivery, final position. Those are decent, and they correctly pick `judge` out of "do not
judge people" and `news` out of "best news you will ever hear". They are still guesses.

## What the layout actually does

The hero word's skyline is measured letter by letter against the real font. `judge` is tall on the
left (`j`, `d`) then drops to x-height across `ge`, with `j` and `g` hanging below. That gives a
pocket above `ge` and a pocket below `ud`. The small fragments are dropped into the deepest pocket
they fit in, aligned hard against the letter that closes it.

A helper line is also **broken across pockets** when that threads it further through the hero. For
"Do not judge people.", `Do` lands in the gap between the `j` and the `d`, `not` goes after the `d`
over the `ge`, and `people.` tucks up under the `ud` between the two descenders — one shared
baseline each, so a broken line still reads as one line with the big word growing through it.

This is why supporting fragments are small (~30% of the hero): a fragment at that size fits inside
those pockets, one at 60% does not and just ends up stacked above the whole word.

It also means the hero's letters change the layout, and that is the source of the variety:

- A hero of all short letters — `money`, `alone`, `success` — is one long open pocket, so the
  fragment drops right down against its x-height.
- A hero that is tall throughout — `faith`, `truth` — leaves no pocket, and the fragment is set
  flush to its optical edge instead. Also deliberate.

Pick the words. The engine handles the geometry. Do not try to hand-fit it.

## Output

`buildCaptionPlan(words, config)` returns a `CaptionPlan`: phrasing, hero words, casing and timing,
as plain JSON with no geometry. Build it server-side, inspect it, persist it, hand it to the render
as `captionPlan`. Pixel placement happens in the renderer, because it needs real glyph metrics.

`summarizePlan(plan)` gives counts per mode, per casing, per fallback reason — a cheap sanity check
before paying for a render.

## Config

Full field list with defaults: `caption-engine.config.json`. The knobs worth touching:

| Field | Default | Effect |
|---|---|---|
| `segmenter.maxWords` | `5` | Words per caption. |
| `segmenter.heroScoreThreshold` | `3.2` | Raise it and more phrases render flat. |
| `segmenter.heroMinWordLength` | `4` | Shortest word allowed to be a hero. |
| `layout.heroSize` | `210` | Hero size in px at a 1080-wide canvas. |
| `layout.leadRatio` / `tailRatio` | `0.30` / `0.27` | Fixed helper sizes as fractions of the hero. Helper text never shrinks because the phrase is longer. |
| `layout.supportMinScale` | `0.90` | If fitting the complete anchored block would make helper text smaller than 90%, use the readable flat fallback instead. |
| `layout.nestleAbove` / `nestleBelow` | `0.18` / `0.20` | Clearance from the hero's letters, in the fragment's own cap heights. Lower is tighter. |
| `layout.sideClear` | `0.32` | Sideways clearance from the letter closing a pocket. Too small and they touch. |
| `layout.minGain` | `0.18` | How much depth a pocket must buy before it beats the flush position. Lower it for more interlocking, raise it for more restraint. |
| `layout.splitPenalty` | `0` | What breaking a helper line across pockets costs. Zero by default — the break *is* the look. Raise it if splits start happening where a whole line read fine. |
| `layout.coverageBonus` | `0.6` | Reward for threading a line further across the hero. This is what decides break-vs-whole. |
| `layout.enclosureBonus` | `0.25` | Reward for landing in a pocket closed on both sides by hero letters, rather than one running off the end of the word. |
| `layout.anchorY` | `0.66` | Vertical centre of the block. |
| `layout.heroMinScale` | `0.70` | How much the hero may shrink before the chunk gives up and goes flat. |
| `style.backdropDim` | `0.46` | Flat black over the footage. The only thing keeping the type legible — do not take it to zero. |
| `variation.seed` | `"wowclip-v1"` | Reshuffles every style choice. Same seed = same video. |
| `variation.powerUpperChance` | `0.20` | Rare ALL-CAPS poster beat for a high-impact word, allowed with at most one helper side. Ordinary helper-bearing heroes remain lowercase so their pockets survive. |
| `variation.accentChance` | `0` | Probability of a flat coloured hero. Off by default. |
| `forceFlat` | `false` | Disables the anchored look entirely. |
| `blackoutRanges` | `[]` | Frame ranges where captions hide for an overlay. |

## Two ways to render

```tsx
// Plan on the fly — fine for preview and single renders
<CaptionEngine transcript={words} config={captionConfig} />

// Plan ahead of time — preferred for Lambda
const plan = buildCaptionPlan(words, captionConfig);
<CaptionEngine plan={plan} />
```

Or the whole scene, which adds the full-screen stage:

```tsx
<FullScreenReel
  mediaSrc="clip.mp4"        // omit for a flat black stage
  transcript={words}
  captionConfig={captionConfig}
/>
```

## What the engine will refuse to do

It will not blow up a word that cannot carry it. Words under 4 or over 11 letters, vague words,
stopword-only phrases and unsupported scripts all degrade to a plain centred line, with the reason
recorded. Full table in `EDGE_CASES.md`.

## Faces

Hero is Poppins ExtraBold, support is Inter, both registered under private family names
(`ReelHero`, `ReelText`) so they cannot affect other templates.

Poppins is not a style preference. The layout needs a face with deep, wide hollows, which means a
small x-height and tall ascenders. Grotesques — Inter, Helvetica, Archivo, Anton — have large
x-heights, so their ascenders barely clear them and the pockets come out shallow and narrow. The
first version of this engine used Inter 900 and that is a large part of why it looked like generic
auto-captions: there was nothing to nest into. Weight 800 rather than 900 because at 200px+ the
Black closes up its own counters, which muddies the very hollows the layout depends on.
