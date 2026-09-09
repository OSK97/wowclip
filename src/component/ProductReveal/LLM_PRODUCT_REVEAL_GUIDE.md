# LLM Product Reveal Guide — ProductReveal

This guide explains how an LLM should generate the `product-reveal.json` format for the **ProductReveal** Remotion component.

---

## What This Component Does

A cinematic product introduction animation:

1. **Phase 1** — Full-screen colored background with the product image centered and large
2. **Phase 2** — Background smoothly morphs; the image cinematically shrinks into a floating card
3. **Phase 3** — Card is fully formed with editable footer blocks (name, price, badge, etc.), floating gently

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

```json
{
  "theme": { ... },
  "image": { ... },
  "footer": [ ... ]
}
```

All blocks are optional. Omit any to use defaults.

---

## Theme Block

Controls backgrounds, card appearance, and animation timing.

```json
{
  "theme": {
    "initialBg": "#2563eb",
    "initialBgShade": "rgba(0,0,0,0.1)",
    "cardBg": "hsl(0, 0%, 16%)",
    "cardRadius": 40,
    "cardWidth": 680,
    "cardHeight": 880,
    "imageAreaHeight": 520,
    "finalBg": "#000000",
    "finalBgGradient": "",
    "showGrid": true,
    "gridColor": "rgba(255,255,255,0.5)",
    "gridOpacity": 0.06,
    "showOrbs": true,
    "orb1Color": "rgba(59, 130, 246, 0.08)",
    "orb2Color": "rgba(139, 92, 246, 0.06)",
    "floatAmplitude": 8,
    "floatFrequency": 0.04,
    "shrinkStartFrame": 60,
    "shrinkDurationFrames": 60
  }
}
```

| Field                 | Type   | Default                        | Description                                                    |
| --------------------- | ------ | ------------------------------ | -------------------------------------------------------------- |
| `initialBg`           | string | `"#2563eb"`                    | Phase 1 background color (solid color while image is centered) |
| `initialBgShade`      | string | `"rgba(0,0,0,0.1)"`           | Subtle vignette shade over initial background                  |
| `cardBg`              | string | `"hsl(0, 0%, 16%)"`           | Card background color                                          |
| `cardRadius`          | number | `40`                           | Card border radius (px)                                        |
| `cardWidth`           | number | `680`                          | Final card width (px)                                          |
| `cardHeight`          | number | *dynamic*                      | Final card height (px). If omitted/undefined, the card automatically fits all footer content perfectly (wrap-content/match-parent). |
| `imageAreaHeight`     | number | `520`                          | Height of the image area inside the card (px)                  |
| `finalBg`             | string | `"#000000"`                    | Phase 2/3 background color                                     |
| `finalBgGradient`     | string | `""`                           | CSS gradient for final background (overrides finalBg)          |
| `showGrid`            | bool   | `true`                         | Show grid pattern in final background                          |
| `gridColor`           | string | `"rgba(255,255,255,0.5)"`      | Grid line color                                                |
| `gridOpacity`         | number | `0.06`                         | Grid opacity                                                   |
| `showOrbs`            | bool   | `true`                         | Show animated light orbs in final background                   |
| `orb1Color`           | string | `"rgba(59, 130, 246, 0.08)"`   | First orb color                                                |
| `orb2Color`           | string | `"rgba(139, 92, 246, 0.06)"`   | Second orb color                                               |
| `floatAmplitude`      | number | `8`                            | Card floating amplitude (px)                                   |
| `floatFrequency`      | number | `0.04`                         | Card floating speed                                            |
| `shrinkStartFrame`    | number | `60`                           | Frame when the shrink transition begins                        |
| `shrinkDurationFrames`| number | `60`                           | Duration of the shrink transition in frames                    |

---

## Image Block

```json
{
  "image": {
    "src": "product.png",
    "objectFit": "contain"
  }
}
```

| Field       | Type   | Default     | Description                                  |
| ----------- | ------ | ----------- | -------------------------------------------- |
| `src`       | string | `""`        | Image URL or staticFile path                 |
| `objectFit` | string | `"contain"` | `"contain"` or `"cover"`                     |

---

## Footer Blocks

The footer is an **array** of blocks that appear in the card's lower section after the transition. Each block is rendered in order from top to bottom.

### Block Types

#### `label` — Small uppercase text (brand name, category)
```json
{ "type": "label", "value": "APPLE", "color": "#9a9a99" }
```

#### `title` — Large product name
```json
{ "type": "title", "value": "MacBook Pro", "color": "#cfcfce", "fontSize": 38 }
```

#### `price` — Price display
```json
{ "type": "price", "value": "$1,999", "color": "#91918f" }
```

#### `description` — Smaller descriptive text
```json
{ "type": "description", "value": "M3 chip, 18-hour battery life", "color": "#7a7a79" }
```

#### `badge` — Pill-shaped badge
```json
{ "type": "badge", "value": "NEW", "bgColor": "rgba(59, 130, 246, 0.3)", "color": "#93c5fd" }
```

#### `button` — Call to action button
```json
{ "type": "button", "value": "Buy Now", "bgColor": "#2563eb", "color": "#ffffff" }
```

#### `rating` — Star rating display
```json
{ "type": "rating", "ratingValue": 4.5, "ratingColor": "#f59e0b", "value": "4.5 (2.3k reviews)" }
```

#### `spacer` — Empty vertical space
```json
{ "type": "spacer", "fontSize": 12 }
```

### Footer Block Properties

| Field         | Type   | Default         | Description                               |
| ------------- | ------ | --------------- | ----------------------------------------- |
| `type`        | string | —               | Block type (required)                     |
| `value`       | string | `""`            | Display text                              |
| `fontSize`    | number | varies by type  | Override font size                        |
| `fontWeight`  | number | varies by type  | Override font weight                      |
| `color`       | string | varies by type  | Text color                                |
| `bgColor`     | string | —               | Background color (badge, button)          |
| `align`       | string | `"left"`        | `"left"`, `"center"`, `"right"`           |
| `ratingValue` | number | `4.5`           | Stars (out of 5, for rating type)         |
| `ratingColor` | string | `"#f59e0b"`     | Star fill color                           |

---

## Styling Rules

### DO

- ✅ Output only valid JSON
- ✅ Match `initialBg` to the product's brand/topic color for maximum visual impact
- ✅ Leverage the dynamic height wrapping: omit `cardHeight` from the theme to let the card height scale exactly to wrap your footer items. If you only provide a single big keyword or a title + review, the card will shrink to wrap them perfectly and center them vertically.
- ✅ Use the component for generic layouts beyond shopping (quotes, news highlights, profile reveals, single big words/messages). Omit elements like price/rating for non-shopping use cases.
- ✅ Keep footer blocks to **max 5** to fit the card
- ✅ Use `label` → `title` → `price` as the standard order
- ✅ Add `badge` for "NEW", "SALE", "TRENDING" etc.
- ✅ Use `description` for short feature highlights
- ✅ Set `shrinkStartFrame` to at least 45 so the initial view has time to breathe
- ✅ Use an image with a transparent background (PNG) for best results

### DO NOT

- ❌ Use more than 5 footer blocks
- ❌ Put very long text in `title` or `description` — keep titles under 25 chars
- ❌ Set `shrinkDurationFrames` below 30 — it will look jerky
- ❌ Set a hardcoded `cardHeight` unless you explicitly want to override the automatic content-wrapping sizing.
- ❌ Output anything except the JSON object

---

## Complete Example

**Input:** "Show a Flipkart product reveal for the iPhone 15 Pro at ₹1,34,900"

```json
{
  "theme": {
    "initialBg": "#1a1a2e",
    "cardBg": "hsl(0, 0%, 14%)",
    "finalBgGradient": "linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 100%)",
    "orb1Color": "rgba(99, 102, 241, 0.1)",
    "orb2Color": "rgba(168, 85, 247, 0.08)"
  },
  "image": {
    "src": "https://example.com/iphone15pro.png",
    "objectFit": "contain"
  },
  "footer": [
    { "type": "label", "value": "APPLE" },
    { "type": "title", "value": "iPhone 15 Pro", "fontSize": 40 },
    { "type": "price", "value": "₹1,34,900" },
    { "type": "rating", "ratingValue": 4.5, "value": "4.5 (12k reviews)" },
    { "type": "badge", "value": "BESTSELLER", "bgColor": "rgba(16, 185, 129, 0.25)", "color": "#6ee7b7" }
  ]
}
```
