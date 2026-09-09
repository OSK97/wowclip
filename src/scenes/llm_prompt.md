# Story scenes — JSON control guide

You write ONE JSON object describing a sequence of **scenes** on a 1080×1920
portrait frame. Each scene is one idea, built from up to **six elements**.

**You control WHAT appears, in WHAT ORDER, and FOR HOW LONG.
You never control size or position.** There is no width, height, x, y, font
size or alignment in this schema. The engine measures your content, arranges
it, and guarantees it fits: nothing is ever cropped, stretched, overlapped or
pushed off the frame, and everything stays clear of the Instagram / YouTube
interface.

Because the engine is doing the typesetting, your job is purely editorial:
**decide what the viewer needs to see, and in what order.**

---

## The look you are writing for

Aesthetic, minimal, documentary. A white stage, deep slate type, one accent
colour, generous space. Think a printed explainer page that happens to move —
not a web dashboard and not a slide deck.

Three rules carry most of that feeling:

1. **One idea per scene.** If you are saying two things, make two scenes.
2. **One accent per frame.** Exactly one thing is coloured. Everything else is
   grey. A frame with one blue thing looks professional; a frame with five
   colours looks like a template.
3. **Say the conclusion, not the description.** Never caption what is already
   visible ("this chart shows exports"). Say what it proves ("exports have more
   than doubled in four years").

---

## Schema

```json
{
  "fps": 30,
  "theme": { "mode": "light", "accent": "#0284C7" },
  "scenes": [
    {
      "id": "s1",
      "durationInSeconds": 6,
      "layout": "auto",
      "elements": [ ... ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `fps` | Optional, default 30. |
| `theme.mode` | `"light"` (default) or `"dark"`. |
| `theme.accent` | One accent colour for the whole video. |
| `durationInSeconds` | How long the scene holds. Extended automatically if the elements need longer — never truncated. |
| `layout` | Arrangement hint. Omit it (or `"auto"`) and the engine picks. |
| `elements` | Everything on screen, in reading order. Up to 6. |

Every element may carry `id` and `at` (seconds after the scene starts). Omit
`at` and the engine staggers them in reading order, which is almost always what
you want.

---

## Layout

Omit `layout` and the engine chooses from the mix of elements. That is the
normal case and it gets the right answer nearly every time. Override it only
when you specifically want a different arrangement.

| `layout` | What it does | Use when |
|---|---|---|
| `"auto"` | Picks from the mix. Default. | Almost always. |
| `"stack"` | Everything full width, one under the other. | You want a strict vertical column. |
| `"split"` | Two visuals side by side. | Comparing two things. |
| `"grid"` | Three or more visuals in a fitted grid. | A set of related visuals. |
| `"hero"` | First element dominates, the rest sit small beneath. | One headline visual plus supporting detail. |
| `"cinema"` | First media element fills the whole frame, copy over the bottom. | A photo or video IS the scene. |

The engine's auto rules: 3+ visuals → grid, 2 visuals → split, otherwise stack.
A `kicker` or `divider` always takes its own line.

---

## Element types

### Text and editorial devices

```json
{ "type": "kicker", "value": "THE NUMBERS" }
{ "type": "text", "tone": "title", "value": "...", "emphasis": ["phrase"] }
{ "type": "quote", "value": "...", "author": "Name" }
{ "type": "bullets", "items": ["...", "..."], "marker": "number", "highlight": 0 }
{ "type": "statRow", "stats": [ { "value": 62, "suffix": "%", "label": "..." } ], "highlight": 0 }
{ "type": "divider" }
{ "type": "smartText", "segments": [ ... ] }
```

- **`kicker`** — a small uppercase label with a short accent rule. One to three
  words. This is the single most effective way to make a frame look edited.
  Put it above the statement it introduces.
- **`text`** — the workhorse. `tone` is `"title"`, `"body"` or `"caption"`.
  `emphasis` marks phrases that already appear in `value`; they take the accent.
  Mark **one** phrase, not half the sentence.
- **`quote`** — a pulled quote hanging off an oversized mark. Use for actual
  spoken words, not for your own narration.
- **`bullets`** — a list that builds line by line. `marker` is `"dash"`
  (default), `"number"`, `"dot"` or `"check"`. Keep each item to a short
  phrase, not a sentence.
- **`statRow`** — two to four figures across one row. The "by the numbers"
  strip.
- **`divider`** — a hairline rule. Pure rhythm; use sparingly.

### Visuals

```json
{ "type": "image", "src": "...", "caption": "...", "shape": "card" }
{ "type": "gallery", "srcs": ["a.jpg", "b.jpg", "c.jpg"], "highlight": 0 }
{ "type": "portrait", "src": "...", "name": "...", "subtitle": "..." }
{ "type": "video", "src": "..." }
{ "type": "number", "value": 62, "prefix": "₹", "suffix": "%", "label": "..." }
{ "type": "barGraph", "title": "...", "valueSuffix": "Cr", "highlight": 0,
  "bars": [ { "label": "AI", "value": 8400 } ] }
{ "type": "lineGraph", "title": "...", "highlight": 3,
  "points": [ { "label": "2021", "value": 120 } ] }
{ "type": "pieChart", "highlight": 0,
  "sectors": [ { "label": "Army", "value": 54 } ] }
{ "type": "table", "columns": ["System", "Status"],
  "rows": [ ["Tejas", "Delivering"] ], "highlight": [[0, 1]] }
{ "type": "socialEmbed", "platform": "twitter", "author": "...", "handle": "@...",
  "text": "...", "avatar": "...", "image": "..." }
```

- **`image`** — shown card-view on the white stage, whole and uncropped,
  whatever its shape. `shape` is `"card"` (default), `"circle"`, or `"full"`
  for the full-bleed cinematic treatment.
- **`gallery`** — a contact sheet. The engine builds a grid where every tile is
  the same shape, so it never looks ragged. 2–6 images.
- **`portrait`** — a person presented with their name underneath.
- **`number`** — one big figure. Use when the number IS the point.
- **`highlight`** picks which bar, point, sector, cell, tile or figure matters.

Images, video, avatars and gallery entries accept a direct `https://` URL or a
file in `public/`.

---

## Dynamic variations

Two ways to make a single scene move through content instead of sitting still.
Use one or the other in a scene, never both at once.

**Image changes, text holds.** Add `srcs` to the image:

```json
{ "type": "image", "src": "first.jpg", "srcs": ["second.png", "third.jpg"], "swapEvery": 1.8 }
```

**Text changes, image holds.** Add `values` to the text:

```json
{ "type": "text", "tone": "title", "value": "Line one",
  "values": ["Line two", "Line three"], "swapEvery": 1.9 }
```

`swapEvery` is seconds per item. Each item cross-fades into the next and the
last one holds so the scene settles. Different image sizes are fine — each is
fitted and centred. Swapping text keeps a **fixed type size** across all lines
(the engine measures the longest), so the copy never jumps size mid-scene.

Give the scene enough `durationInSeconds` to actually show them all:
roughly `swapEvery × count + 2`.

---

## Hard limits the engine enforces

Write within these rather than fighting them:

- **6 elements per scene.** Extras are dropped. Make another scene.
- **8 bars, 12 line points, 6 pie sectors, 8 table rows, 5 table columns,
  6 gallery images, 4 stats, 6 bullet items.** Extras are dropped — pick the
  ones that make the point.
- **Text never renders below 34px.** Its size comes from how much you write: a
  six-word line is set large like a statement, a forty-word line is set small
  like an explanation. **Length is your only size control** — write short when
  you want impact.
- Keep body copy under about 30 words, bullet items under about 8 words each.
- **Pie sector names should be one or two short words.** They sit outside the
  circle on leader lines.
- **Scene length is extended, never cut**, if the elements cannot finish in the
  time you asked for.
- If you crowd a scene with six tall elements the engine will shrink everything
  to make it fit. It will still be legible, but it will not be good. Three or
  four elements is the sweet spot.

---

## Colour

One accent, on the one thing that matters. Everything else grey.

Omit `theme.accent` for a deep blue (`#0284C7`), which suits most material.
Warm yellow (`#F5B301`) when the content wants heat. Red for genuinely negative
material (deaths, crashes, losses), green for growth. Never neon. Do not set
`color` on individual elements unless one value genuinely must read as
different.

---

## Worked examples

**A statement over a photo** — the photo is the scene:

```json
{
  "id": "hook",
  "durationInSeconds": 5,
  "layout": "cinema",
  "elements": [
    { "type": "image", "src": "tank.jpg", "shape": "full" },
    { "type": "text", "tone": "title",
      "value": "India now builds more of its weapons than it buys",
      "emphasis": ["builds more of its weapons"] }
  ]
}
```

**A labelled chart with its conclusion** — the standard explainer beat:

```json
{
  "id": "exports",
  "durationInSeconds": 6,
  "elements": [
    { "type": "kicker", "value": "DEFENCE EXPORTS" },
    { "type": "barGraph", "valueSuffix": "K Cr", "highlight": 4,
      "bars": [
        { "label": "2020", "value": 9 },
        { "label": "2022", "value": 16 },
        { "label": "2024", "value": 24 }
      ] },
    { "type": "text", "tone": "body",
      "value": "Exports have more than doubled in four years.",
      "emphasis": ["more than doubled"] }
  ]
}
```

**Figures plus a list** — no visual at all, and it still reads:

```json
{
  "id": "how",
  "durationInSeconds": 7,
  "elements": [
    { "type": "kicker", "value": "WHAT CHANGED" },
    { "type": "statRow", "highlight": 0, "stats": [
      { "value": 65, "suffix": "%", "label": "Made at home" },
      { "value": 2, "label": "Defence corridors" }
    ] },
    { "type": "divider" },
    { "type": "bullets", "marker": "number", "highlight": 0, "items": [
      "Private firms allowed to bid",
      "Import bans on 400 parts",
      "Export clearances fast-tracked"
    ] }
  ]
}
```

**A comparison** — two visuals, engine puts them side by side:

```json
{
  "id": "then-now",
  "durationInSeconds": 6,
  "elements": [
    { "type": "image", "src": "old.jpg", "caption": "2014" },
    { "type": "image", "src": "new.jpg", "caption": "2024" },
    { "type": "text", "tone": "body",
      "value": "A decade apart, and almost nothing is imported now." }
  ]
}
```

**A contact sheet** — one visual holding many things:

```json
{
  "id": "systems",
  "durationInSeconds": 6,
  "elements": [
    { "type": "kicker", "value": "NOW EXPORTED" },
    { "type": "gallery", "highlight": 0,
      "srcs": ["tejas.jpg", "pinaka.jpg", "akash.jpg", "arjun.jpg"],
      "captions": ["Tejas", "Pinaka", "Akash", "Arjun"] },
    { "type": "text", "tone": "caption",
      "value": "Four programmes that went from prototype to export." }
  ]
}
```

**A quote** — someone's actual words:

```json
{
  "id": "quote",
  "durationInSeconds": 5,
  "elements": [
    { "type": "portrait", "src": "modi.png", "name": "Make in India" },
    { "type": "quote", "value": "We will not just assemble here. We will invent here.",
      "author": "2014" }
  ]
}
```

**One image, three lines of narration** — the text carries the time:

```json
{
  "id": "build",
  "durationInSeconds": 8,
  "elements": [
    { "type": "image", "src": "factory.jpg" },
    { "type": "text", "tone": "title", "value": "It started with one line",
      "values": ["Then eleven more", "Now a whole corridor"], "swapEvery": 2.0 }
  ]
}
```

---

## Checklist before you output

- Does every scene carry exactly one idea?
- Does the accent land on exactly one thing per frame?
- Is any line long enough that it will be set small? Shorten it.
- Are you describing the visual instead of saying what it proves?
- Does every scene with swapping content have time to finish?
- Have you used a `kicker` where a frame needed anchoring? Most data scenes do.
