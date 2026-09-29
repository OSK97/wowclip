# AnchorStack — caption template

Milkyrain against Open Sans. One big word carries the line. One or two much smaller
fragments are set into the gaps in its letters — dropped into the low run of `ngs` in
`things`, tucked under the `th` where nothing descends. Each line rises into place behind a
mask, out of focus for a few frames, then settles. Fast, calm, no colour, and no shadow or
outline on the type at all.

**Milkyrain is a licensed face and is not in the repo.** Put the file at
`public/fonts/Milkyrain/Milkyrain.woff2` (`.otf` and `.ttf` also work) and it is picked up
automatically. Without it the hero falls back to Poppins 900.

Use it as a caption track for a talking-head clip: one group per spoken phrase, timed to
the word-level timestamps. It carries a phrase, not a sentence.

## What you write

One JSON object. Every field except `groups` is optional; anything you leave out keeps its
default.

```json
{
  "background": { "src": "clip.mp4" },
  "theme": { "textColor": "#ffffff", "backdropDim": 0.46 },
  "layout": {
    "heroFontSize": 210,
    "midRatio": 0.32,
    "softRatio": 0.28,
    "nestleAbove": 0.14,
    "nestleBelow": 0.16,
    "hunt": 0.16,
    "maxWidth": 0.84,
    "offsetY": 0,
    "heroTracking": -0.05,
    "supportTracking": -0.012
  },
  "timing": { "reveal": 11, "stagger": 3, "out": 7 },
  "groups": [
    {
      "at": 62,
      "hold": 44,
      "lines": [
        { "text": "avoid hard", "role": "mid" },
        { "text": "things", "role": "hero" },
        { "text": "it gets harder", "role": "soft" }
      ]
    }
  ]
}
```

## Groups

One group is one phrase on screen. `at` is the frame the first line lands on — use the
word-level timestamp of the first word in the phrase, converted to frames. `hold` is how
long the finished stack sits there before it clears; set it so the group ends around the
time the next phrase starts.

`lines` runs top to bottom, which is also the order the words are spoken and the order they
land. At most 4 lines; each is cut at 26 characters. Three is the shape that reads best.

## Roles

`hero` is the word the phrase rests on — the noun or verb that carries the meaning. Set in
Milkyrain, tightly tracked, optically centred. Exactly one per group. If you do not mark
one, the longest line is used.

`mid` is a supporting fragment in Open Sans Semibold at about a third of the hero's size.
Use it for the run-up — `feels like`, `avoid hard`, `nobody is`.

`soft` is a supporting fragment in Open Sans Regular, slightly smaller again. Use it for the
tail that lands after the hero — `you would`, `to save you`, `was the price`. It is the
quiet one; it should never be the most important words in the group.

Supporting lines are small on purpose. They are not a second headline — they are set into
the gaps in the hero's own letters, which only works at this scale.

The natural shape is `mid` above the hero and `soft` below it, because the run-up is said
first and the tail is said last. A two-line group of just `mid` + `hero` is also strong.

## Writing the lines

Break the phrase where a person would breathe, not where the width runs out. `because /
you said / you would` works because each break is a beat in the sentence. `beca / use you
said` would not.

Keep the hero to one word, or two or three very short ones. Keep supporting lines to two or
three words — a long supporting line has to be slid across the hero to find a pocket, and a
line wider than the hero has nowhere to go.

## How the fit works, and why the words matter

The hero's skyline is measured letter by letter. `things` is tall on the left — `t`, `h`,
the dot of the `i` — and then drops to x-height across `n`, `s`, with the `g` hanging below.
So there is a pocket above `ngs` and a pocket below `th`. The supporting lines are slid
across the hero and dropped into the deepest pocket they fit in, sitting just clear of the
letters that are actually there rather than clear of the tallest letter in the word.

This is why supporting lines are small: a line at 34% of the hero fits inside those pockets,
a line at 60% does not and just ends up stacked above the whole word.

It also means the hero's letters change the layout. A hero of all short letters — `success`,
`money`, `alone` — is one long open pocket, so the supporting line drops right down against
its x-height. A hero that is tall throughout — `hustle`, `faith` — leaves no pocket and the
line sits above the ascenders. Both look deliberate. Pick the hero for its meaning; the
engine handles the rest.

## Everything else

`layout.heroFontSize` 90-320, measured at a 1080px-wide canvas and scaled from there.
`midRatio` 0.2-0.46 and `softRatio` 0.18-0.42 are fractions of the hero. They are capped
under half deliberately — a supporting line big enough to compete with the hero is also too
big to sit in its gaps.

`nestleAbove` and `nestleBelow` -0.1 to 0.5 are the clearance left between a supporting
line's ink and the hero's letters, as a fraction of that line's own size. Negative lets them
touch.

`hunt` 0-0.4 is how far past the hero's left and right edges a supporting line may slide
while looking for a pocket, as a fraction of hero width. `maxWidth` 0.5-0.94 is the widest
the stack may get as a fraction of the canvas. `offsetY` moves the whole block in px.

`heroTracking` -0.09 to 0.04 and `supportTracking` -0.06 to 0.08 are letter-spacing in em.
The hero is set tight; that tightness is most of what makes it look set rather than typed.

`timing.reveal` 5-30 is how long one line takes to rise, `stagger` 0-14 the beat between
lines, `out` 3-24 how long the group takes to clear. The defaults land a three-line group
in about 17 frames.

`theme.backdropDim` 0-1 is a flat black field over the footage. Since the type carries no
shadow, stroke or glow, this is the only thing keeping it legible — raise it for a bright or
busy shot, lower it for a dark one, but do not take it to zero.

## What the engine does for you

Every line is measured against the real font, and the hero is measured letter by letter, so
placement works off the actual glyph shapes rather than line boxes. Each supporting line is
slid across the hero to find its deepest pocket, then set just clear of whatever is under
it. Lines placed earlier become obstacles for the ones after them, so a second supporting
line on the same side nests against the first instead of colliding with it. Where two
pockets are equally deep the tie is broken from a hash of the line's own text — the run-up
leans left, the tail leans right — so placement varies word to word and never collides.

When there is no real pocket to find — a hero that is tall the whole way across, or a
supporting line too wide to sit inside anything — the hunt is abandoned and the line is set
flush to the hero's optical edge instead: left if it leads into the hero, right if it trails
out. An arbitrary offset is only worth having when it buys a tighter fit; without one it
just looks careless.

Out-of-range numbers are clamped, text is trimmed to its limits, the whole stack shrinks
together if it would run off the canvas, and final positions are held inside a page margin.
A bad value degrades; it never produces a broken frame. Do not try to hand-fit the layout —
choose the words and the breaks well and leave the geometry alone.
