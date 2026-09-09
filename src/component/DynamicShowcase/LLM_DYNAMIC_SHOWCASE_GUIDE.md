# LLM Dynamic Showcase Guide — DynamicShowcase

This guide explains how an LLM should convert custom content or scripts into the `dynamic-showcase.json` format for the **DynamicShowcase** Remotion component.

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

The top-level structure:

```json
{
  "composition": { ... },
  "background": { ... },
  "floating": { ... },
  "image": { ... },
  "text": { ... },
  "segments": [ ... ]
}
```

All blocks are optional. Omit any property or block to fall back to default values.

---

## Composition Block

Controls video dimensions and frame-rate parameters.

```json
{
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "durationSeconds": 5
  }
}
```

---

## Background Block

Controls background colors, gradients, moving grid overlay, and pulsing glowing orbs.

```json
{
  "background": {
    "backgroundColor": "#f8fafc",
    "backgroundGradient": "radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f1f5f9 40%, #e2e8f0 70%, #cbd5e1 100%)",
    "showGrid": true,
    "gridColor": "rgba(99, 102, 241, 0.05)",
    "gridSize": 60,
    "gridOpacity": 1,
    "showOrbs": true,
    "orb1Color": "rgba(59, 130, 246, 0.08)",
    "orb2Color": "rgba(99, 102, 241, 0.06)",
    "orb3Color": "rgba(244, 63, 94, 0.05)"
  }
}
```

---

## Floating Block

Controls the slow organic float and tilt swim animation of the entire composition container.

```json
{
  "floating": {
    "enable": true,
    "floatAmplitudeY": 10,
    "floatFrequencyY": 0.04,
    "rotateAmplitude": 1.2,
    "rotateFrequency": 0.025
  }
}
```

---

## Image Block

Controls the showcase image sizing, layout constraints, margins, shadows, and entry animations.

```json
{
  "image": {
    "src": "Components/iphone.png",
    "heightPercent": 0.65,
    "marginTop": 80,
    "marginSide": 60,
    "marginBottom": 100,
    "borderRadius": 28,
    "showShadow": true,
    "shadowColor": "rgba(15, 23, 42, 0.12)",
    "shadowBlur": 70,
    "entranceDelay": 0
  }
}
```

- **Two-Phase Animation**: The image slides up from the bottom (frame 0-60). In the first 2 seconds, it occupies the center as a large Hero block. At frame 120 (2 seconds), it automatically scales down and slides to attach to the bottom, aligning perfectly to touch the left and right side margins (`marginSide`).

---

## Text Block

Controls fallback formatting for typography.

```json
{
  "text": {
    "fontFamily": "Inter",
    "fontSize": 56,
    "color": "#0f172a",
    "textAlign": "center",
    "marginTop": 140,
    "marginSide": 80,
    "entranceDelay": 15,
    "staggerFrames": 4
  }
}
```

- **Delayed Stagger**: The text container remains hidden for the first 2 seconds. When the image shrinks and attaches to the bottom (starting at frame 120), the text slides/fades in staggered word-by-word.

---

## Segments Array (Smart Text Integration)

Allows rich, formatted headers by breaking sentences down into styled text blocks or animating count-up metrics.

```json
"segments": [
  {
    "type": "text",
    "value": "Introducing the",
    "style": "normal",
    "case": "uppercase",
    "color": "slate"
  },
  {
    "type": "text",
    "value": "iPhone 16 Pro",
    "style": "bold",
    "color": "blue",
    "emphasis": "marker",
    "emphasisColor": "rgba(37, 99, 235, 0.15)"
  },
  {
    "type": "text",
    "value": "with cursive highlight",
    "style": "cursive",
    "color": "rose",
    "emphasis": "underline",
    "emphasisColor": "rgba(244, 63, 94, 0.4)"
  },
  {
    "type": "number",
    "value": 120,
    "suffix": " Hz",
    "format": "normal",
    "color": "emerald"
  }
]
```

### Text Segment Options
- `type`: `"text"` (required)
- `value`: string to render (words will split and slide-up stagger automatically).
- `style`: `"normal"`, `"bold"`, `"italic"`, `"serif"`, `"italic-serif"`, or `"cursive"`.
  - `"cursive"` loads the flowing handwritten font (`DancingScript`).
  - `"serif"` / `"italic-serif"` load the literary serif font (`PlayfairDisplay`).
- `case`: `"original"`, `"uppercase"`, `"lowercase"`, or `"title"`.
- `color`: CSS color string or preset keywords (`primary`, `slate`, `blue`, `amber`, `rose`, `emerald`, `violet`, `teal`, `orange`, `cyan`, `white`, `black`).
- `emphasis`: `"none"`, `"marker"` (highlighter backdrop), `"underline"`, `"box"` (background capsule block), or `"textColor"`.
- `emphasisColor`: Color overlay for the highlighting markers or underlines.

### Number Segment Options
- `type`: `"number"` (required)
- `value`: numerical target to count up to. (Count-up executes dynamically starting at frame 120).
- `prefix` / `suffix`: prefix strings (e.g. `"$"`), suffix strings (e.g. `" Hz"`).
- `decimals`: number of decimal points to render.
- `format`: `"normal"`, `"comma"`, `"compact"`, `"currency"` (rupee ₹ symbol), or `"percentage"` (`%` suffix).
- `color`: text color preset/hex string.
