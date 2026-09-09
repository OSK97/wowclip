# AestheticNews — JSON control guide

You write ONE JSON object. It renders a 1080×1920 dark news/fact card that sits
over the speaker's clip: a headline, a body paragraph, and a neon marker that
sweeps across chosen words while the camera pushes in on them.

Use it for: a news item, a statistic, a claim, a quote, a fact the speaker
states. It does not need to be real news — with no logo and no byline it reads
as a clean fact card.

---

## Schema

```json
{
  "durationInSeconds": 8,
  "fps": 24,

  "kicker": "Breaking",
  "logoUrl": "zee.png",
  "bgImageUrl": "",
  "accentColor": "#C084FC",

  "headline": "Global Aerospace Venture Reveals Orbital Timeline",
  "description": "Industry leaders gathered today in Washington to discuss commercial space colonization.",
  "author": "By Space & Aviation Radar",
  "dateStr": "September 30, 2026",

  "highlights": [
    {
      "target": "description",
      "at": 1.5,
      "until": 3.4,
      "fromWord": 11,
      "toWord": 16,
      "color": "yellow",
      "zoom": "auto",
      "speed": 1
    }
  ]
}
```

Every field is optional except `headline`. Leave a field out (or pass `""`) and
that element disappears — no logo, no kicker, no byline, no description, no
highlights are all valid cards.

| Field | Meaning |
|---|---|
| `durationInSeconds` | How long the card stays on screen. Match it to how long the speaker talks about this point. The engine only ever extends it — never shortens it — so the last camera move is never cut off. |
| `fps` | Optional, defaults to 24. Leave it alone unless you have a reason. |
| `kicker` | Small pill label above the headline: `Breaking`, `Fact`, `Report`, `Data`. Omit for a plain card. |
| `logoUrl` | Publisher logo, filename in `public/` or an `https://` URL. Omit when it is a fact card rather than a news channel. |
| `bgImageUrl` | Optional photo behind the card. It is blurred and darkened heavily — it sets mood, it is never readable. |
| `accentColor` | Hex. Tints the kicker pill, the rule under the headline, the byline bar and the logo glow. Default `#C084FC`. |
| `headline` | The main line. **Max 15 words.** |
| `description` | Body paragraph. **Max 70 words.** Omit it entirely for a headline-only card. |
| `author`, `dateStr` | Byline block. Omit both for a fact card. |
| `highlights` | The marker sweeps, in time order. |

Text longer than the limits shrinks its own font a step at a time, but past the
limit the layout gets ugly. Stay inside them.

---

## Highlights

`fromWord` / `toWord` are **0-indexed word positions in that exact string**.
Count the words yourself, splitting on spaces, and count punctuation as part of
the word it is attached to.

```
"Industry leaders gathered today in Washington to discuss commercial"
    0       1        2       3    4      5      6     7        8
```

| Field | Meaning |
|---|---|
| `target` | `"headline"` or `"description"`. Default `"description"`. |
| `at` | Start time **in seconds** from the beginning of the card. |
| `until` | Optional end time in seconds. Given both, the marker is spread across exactly that window — this is how you sync a sweep to what the speaker is saying. |
| `fromWord`, `toWord` | Inclusive word range to paint. |
| `color` | See palette below. Default yellow. |
| `zoom` | `"auto"` (default), `true`, or `false`. |
| `speed` | Only used when `until` is absent. `1` is normal, `0.5` is twice as fast, `2` is half speed. |

Rules the engine enforces, so you do not have to:

- The first highlight can never start before **1.0s** — the card is still
  animating in before that. An earlier `at` is pushed to 1.0s.
- Highlights never overlap. If one would start before the previous finished, it
  is pushed later. Order your list by time and leave real gaps.
- Without `until`, a word takes roughly `0.1 × characters` seconds, so a
  six-word sentence runs about 2 seconds.

---

## Colours

Use the meaning, not the hex: `yellow` (default — facts, names, dates),
`red` (death, loss, crash, crisis, war), `green` (profit, growth, success,
surge), `blue` (tech, info), `orange` (warning), `purple` (premium, legal).
Any hex value also works. Text on the marker automatically flips between black
and white for contrast.

A sentence in yellow with one word in red is the strongest look this template
has. To do it, write three highlights over adjacent word ranges — the camera
treats touching ranges as one continuous move and will not jump between them:

```json
[
  { "target": "description", "at": 2.0, "fromWord": 4, "toWord": 7, "color": "yellow" },
  { "target": "description", "at": 3.2, "fromWord": 8, "toWord": 8, "color": "red" },
  { "target": "description", "at": 3.6, "fromWord": 9, "toWord": 12, "color": "yellow" }
]
```

Touching ranges are judged as **one** move, so the zoom decision below is made
on the combined pace of the whole run, not on the single red word in the middle.
Give the run as a whole enough time and all three parts zoom together.

---

## Zoom — read this before setting it

`"auto"` is correct almost always. Leave it alone unless you have a reason.

When a highlight zooms, the camera magnifies the card and travels word by word
along the marker. That looks cinematic at a reading pace and unwatchable when
it is fast — a fast pan across a magnified crop is unreadable and physically
unpleasant. The engine therefore refuses to zoom below a readability floor:

- **`"auto"`** — zooms only if the sweep spends at least **0.4s per word**.
  Faster than that, it stays wide and lets the marker sweep quickly instead.
- **`true`** — asks for zoom even on a quicker sweep, but it is still refused
  below **0.22s per word**. You cannot force an unreadable shot.
- **`false`** — never zoom. The whole card stays in frame.

So the way to get a zoom is not to set `zoom: true` — it is to **give the
highlight enough time**. Widen the `at` → `until` window, or raise `speed`.

Use `zoom: false` deliberately when the viewer should read the whole card at
once — a short punchy headline, or a card where the paragraph matters more than
one phrase in it. Zoom scale adapts to text size on its own, so a headline
zooms gently and small body text zooms further.

---

## Choosing the length

`durationInSeconds` should cover the speaker's point. Rough shape:

- last highlight ends around 1.5–2.5s before the end, so the card can pull back
  out and settle before it disappears;
- a card with no highlights just holds — fine for a quick 3–4s cutaway.

If your highlights need more time than you asked for, the engine extends the
card rather than truncating the animation. It never shortens it, so do not pad
`durationInSeconds` "just in case" — you will get dead air at the end.

---

## Worked example

Speaker says, over about 9 seconds: *"India's startup funding fell 62% last
year — but AI startups actually tripled their share."*

```json
{
  "durationInSeconds": 9,
  "kicker": "Data",
  "accentColor": "#38BDF8",
  "headline": "Indian Startup Funding Fell 62% Last Year",
  "description": "Overall venture funding dropped to its lowest level since 2016 as late-stage cheques disappeared. Artificial intelligence startups moved the other way, tripling their share of every rupee invested.",
  "highlights": [
    { "target": "headline", "at": 1.2, "until": 3.0, "fromWord": 3, "toWord": 4, "color": "red" },
    { "target": "description", "at": 4.0, "until": 6.4, "fromWord": 20, "toWord": 24, "color": "green" }
  ]
}
```

Why it works: no logo, so it reads as a fact card. The red marker lands on the
loss and the green one on the reversal. Both windows are wide enough per word
that `auto` gives them a zoom, and the last one ends at 6.4s, leaving room to
pull back out before 9s.
