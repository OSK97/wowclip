# LLM Text Guide — SmartTextView

This guide explains how an LLM should convert narration text into the `smart-text.json` format for the **SmartTextView** Remotion component.

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

The top-level structure:

```json
{
  "composition": { ... },
  "theme": { ... },
  "segments": [ ... ]
}
```

All three blocks are optional. Omit any to use defaults.

---

## Composition Block

Controls video dimensions and timing. Optional — defaults shown below.

```json
{
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "durationSeconds": 8
  }
}
```

> **Note**: Setting `durationSeconds` will override the auto-calculated duration. Use this for precise video length control.

| Field             | Default | Description                    |
| ----------------- | ------- | ------------------------------ |
| `width`           | `1080`  | Video width in px              |
| `height`          | `1920`  | Video height in px             |
| `fps`             | `60`    | Frames per second              |
| `durationSeconds` | `8`     | Total video duration (seconds) |

---

## Theme Block

**You have FULL control over the visual design.** Every property below is optional — omit any to use the default.

```json
{
  "theme": {
    "backgroundColor": "#fcfcfd",
    "backgroundGradient": "",
    "backgroundImage": "",
    "orb1Color": "rgba(37, 99, 235, 0.12)",
    "orb2Color": "rgba(139, 92, 246, 0.08)",
    "orb3Color": "rgba(244, 63, 94, 0.06)",
    "showOrbs": true,
    "gridColor": "#94a3b8",
    "showGrid": true,
    "gridOpacity": 0.15,
    "textFontSize": 72,
    "numberFontSize": 110,
    "wordStaggerFrames": 4,
    "emphasisDelay": 12,
    "countUpDuration": 35,
    "contentPaddingX": 100,
    "lineHeight": 1.45,
    "textAlign": "center"
  }
}
```

| Field               | Type    | Default                           | Description                                                                 |
| ------------------- | ------- | --------------------------------- | --------------------------------------------------------------------------- |
| `backgroundColor`   | string  | `"#fcfcfd"`                       | Solid background color. Ignored if `backgroundGradient` is set.             |
| `backgroundGradient` | string | `""`                              | CSS gradient for bg (e.g. `"linear-gradient(135deg, #030712, #1e1b4b)"`). Overrides `backgroundColor`. |
| `backgroundImage`    | string | `""`                              | URL of an image to use as a heavily blurred background. It will be tinted by `backgroundColor` or `backgroundGradient`. |
| `orb1Color`          | string | `"rgba(37, 99, 235, 0.12)"`      | Color of the first floating light orb (top-left).                           |
| `orb2Color`          | string | `"rgba(139, 92, 246, 0.08)"`     | Color of the second floating light orb (bottom-right).                      |
| `orb3Color`          | string | `"rgba(244, 63, 94, 0.06)"`      | Color of the third floating light orb (center).                             |
| `showOrbs`           | bool   | `true`                            | Show/hide the animated light orbs.                                          |
| `gridColor`          | string | `"#94a3b8"`                       | Color of the studio line-mesh grid overlay with radial fade mask.           |
| `showGrid`           | bool   | `true`                            | Show/hide the studio line-mesh grid.                                        |
| `gridOpacity`        | number | `0.15`                            | Opacity of the grid overlay (0–1). Use low values (0.04–0.12) for subtle elegance. |
| `textFontSize`       | number | `72`                              | Default font size for text segments (px).                                   |
| `numberFontSize`     | number | `110`                             | Default font size for number segments (px). Numbers are visually larger.    |
| `wordStaggerFrames`  | number | `4`                               | Frames between each word appearing. Lower = faster cascade.                 |
| `emphasisDelay`      | number | `12`                              | Frames after a segment finishes loading before emphasis (highlight/underline) triggers. |
| `countUpDuration`    | number | `35`                              | Frames for number count-up animation.                                       |
| `contentPaddingX`    | number | `100`                             | Horizontal padding (px) on each side of the text area.                      |
| `lineHeight`         | number | `1.45`                            | CSS line-height for text segments.                                          |
| `textAlign`          | string | `"center"`                        | Text alignment: `"left"`, `"center"`, or `"right"`.                        |

### Theme Examples

**Dark mode (cinematic):**
```json
{
  "theme": {
    "backgroundColor": "#030712",
    "orb1Color": "rgba(16, 185, 129, 0.12)",
    "orb2Color": "rgba(255, 255, 255, 0.04)",
    "orb3Color": "rgba(59, 130, 246, 0.05)",
    "gridColor": "#1f2937"
  }
}
```

**Warm gradient:**
```json
{
  "theme": {
    "backgroundGradient": "linear-gradient(160deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)",
    "showOrbs": false,
    "showGrid": false
  }
}
```

**Minimal white (no effects):**
```json
{
  "theme": {
    "backgroundColor": "#ffffff",
    "showOrbs": false,
    "showGrid": false
  }
}
```

---

## Segment Types

### Text Segment

```json
{
  "type": "text",
  "value": "some words here",
  "style": "normal",
  "case": "original",
  "color": "primary",
  "emphasis": "none",
  "emphasisColor": "",
  "animation": "fadeUp",
  "fontSize": 72,
  "lineBreak": false
}
```

| Field           | Required | Values                                                       | Default      |
| --------------- | -------- | ------------------------------------------------------------ | ------------ |
| `type`          | ✅        | `"text"`                                                     | —            |
| `value`         | ✅        | Any non-empty string                                         | —            |
| `style`         | ❌        | `normal`, `bold`, `italic`, `serif`, `italic-serif`, `cursive` | `"normal"`   |
| `case`          | ❌        | `original`, `uppercase`, `lowercase`, `title`                | `"original"` |
| `color`         | ❌        | Theme name or any hex/rgba/hsl color                         | `"primary"`  |
| `emphasis`      | ❌        | `none`, `marker`, `underline`, `box`, `textColor`            | `"none"`     |
| `emphasisColor` | ❌        | Custom color for the emphasis effect (overrides auto)        | auto         |
| `animation`     | ❌        | `fadeUp`, `wordReveal`, `scaleIn`, `slideUp`, `none`         | `"fadeUp"`   |
| `fontSize`      | ❌        | Number (px). Overrides `theme.textFontSize` for this segment | theme value  |
| `lineBreak`     | ❌        | `true` or `false`. Forces a line break *after* this segment. | `false`      |
| `delayFrames`   | ❌        | Number. Cinematic pause BEFORE this segment begins animating | `0`          |

### Number Segment

```json
{
  "type": "number",
  "value": 900,
  "prefix": "",
  "suffix": "M+",
  "decimals": 0,
  "format": "normal",
  "animation": "countUp",
  "color": "blue",
  "fontSize": 110,
  "lineBreak": false
}
```

| Field       | Required | Values                                                | Default     |
| ----------- | -------- | ----------------------------------------------------- | ----------- |
| `type`      | ✅        | `"number"`                                            | —           |
| `value`     | ✅        | Any finite number                                     | —           |
| `prefix`    | ❌        | String prefix (e.g., `"₹"`, `"$"`, `"+"`)            | `""`        |
| `suffix`    | ❌        | String suffix (e.g., `"M+"`, `"B"`, `"%"`, `"crore"`) | `""`        |
| `decimals`  | ❌        | Integer ≥ 0                                           | `0`         |
| `format`    | ❌        | `normal`, `comma`, `compact`, `currency`, `percentage` | `"normal"`  |
| `animation` | ❌        | `countUp`, `pop`, `static`                            | `"countUp"` |
| `color`     | ❌        | Theme name or any hex/rgba/hsl color                  | `"blue"`    |
| `fontSize`  | ❌        | Number (px). Overrides `theme.numberFontSize`         | theme value |
| `lineBreak` | ❌        | `true` or `false`. Forces a line break *after* this segment. | `false`      |
| `delayFrames` | ❌      | Number. Cinematic pause BEFORE this segment begins animating | `0`          |

---

## Color Palette

| Name      | Hex       | Use for                            |
| --------- | --------- | ---------------------------------- |
| `primary` | `#0f172a` | Default dark text                  |
| `slate`   | `#64748b` | Secondary / muted text             |
| `blue`    | `#2563eb` | Numbers, key statistics            |
| `amber`   | `#f59e0b` | Warm highlights, financial data    |
| `rose`    | `#f43f5e` | Emotional emphasis, warnings       |
| `emerald` | `#10b981` | Positive metrics, growth           |
| `violet`  | `#8b5cf6` | Creative, tech-related emphasis    |
| `teal`    | `#14b8a6` | Calm, institutional emphasis       |
| `orange`  | `#f97316` | Urgency, attention                 |
| `cyan`    | `#06b6d4` | Data, cool-toned accents           |
| `white`   | `#ffffff` | Light text on dark backgrounds     |
| `black`   | `#000000` | Maximum contrast                   |

You may also use any valid CSS color (e.g., `"#FF5733"`, `"rgba(255,0,0,0.5)"`, `"hsl(210, 100%, 50%)"`).

---

## Number Examples

| Display      | JSON                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| `₹45B`       | `{ "type": "number", "value": 45, "prefix": "₹", "suffix": "B" }`     |
| `$2.5M`      | `{ "type": "number", "value": 2.5, "prefix": "$", "suffix": "M", "decimals": 1 }` |
| `+120%`      | `{ "type": "number", "value": 120, "prefix": "+", "suffix": "%" }`    |
| `9.8x`       | `{ "type": "number", "value": 9.8, "suffix": "x", "decimals": 1 }`   |
| `2 crore`    | `{ "type": "number", "value": 2, "suffix": " crore" }`               |
| `900M+`      | `{ "type": "number", "value": 900, "suffix": "M+" }`                 |

**Important**: Prefix and suffix remain fixed on screen. Only the numeric value animates during count-up. Numbers are displayed visually larger and bolder than regular text.

---

## Emphasis (Highlight) Options

Use the `emphasis` field on text segments to draw attention. These are **optional** — use sparingly for maximum impact.

| Value        | Visual Effect                                                      |
| ------------ | ------------------------------------------------------------------ |
| `"none"`     | No emphasis (default)                                              |
| `"marker"`   | Background highlight wipe that fills from left to right            |
| `"underline"`| Animated underline that draws from left to right                   |
| `"box"`      | Subtle border box appears around the text                          |
| `"textColor"`| (reserved) Text color change                                      |

You can override the emphasis color with `emphasisColor`:
```json
{
  "type": "text",
  "value": "important phrase",
  "emphasis": "marker",
  "emphasisColor": "rgba(245, 158, 11, 0.2)"
}
```

## 🎨 AESTHETICS, COLOR THEORY, & LEGIBILITY (CRITICAL RULES)

You MUST act as a professional graphic designer. The generated typography MUST be visually stunning and easily legible. Do NOT make poor color choices!

1. **Background Contrast**:
   - If the background is light (e.g., `#ffffff`, `#fcfcfd`), you MUST use dark text (e.g., `#0f172a`, `primary`, `#000000`).
   - If the background is dark (e.g., `#030712`, `#000000`), you MUST use light text (e.g., `#ffffff`, `white`).
   - **NEVER** use light gray text on a white background. It is unreadable!
   - **NEVER** use white text on a white background.

2. **Highlight Contrast (`marker` emphasis)**:
   - The text color inside a highlighted cell MUST contrast strongly with the highlight color itself.
   - For example, if you use a light green highlight `rgba(16, 185, 129, 0.2)`, the text inside it should be dark green or black, NOT light green.
   - **NEVER** use red text on a pink/red highlight.

3. **Cinematic Timing (`delayFrames`)**:
   - You can hold suspense by adding `"delayFrames": 30` (or more) to a segment. This forces the engine to pause for that many frames before revealing the text or number. Use this right before revealing a massive statistic or a punchline!

---

## Portrait Screen Limits (CRITICAL)

This component renders on a **1080×1920 portrait screen**. You MUST respect these hard limits:

| Limit | Max Value | Why |
|---|---|---|
| **Total words** | **~40** | At 72px, ~6 words/line × 4 lines. More words overflow off-screen. |
| **Segments** | **10** | More than 10 segments will be silently truncated. |
| **Visible lines** | **4** | Content that exceeds 4 lines will overflow below the viewport. |
| **Number font size** | max **130px** | Larger numbers with prefix+suffix won't fit horizontally. |

### How to Stay Within Limits
1. **Count your words** across all segments before outputting. If you have 50 words of narration, you MUST cut it down.
2. **Condense phrases** — "making it the world's largest connected democracy" → "world's largest connected democracy"
3. **Use `lineBreak: true`** strategically to control where text wraps, don't let it auto-wrap randomly
4. **Reduce font size** for longer content — set `theme.textFontSize: 56` for 6+ word segments

---

## Styling Rules

### DO

- ✅ Output only valid JSON
- ✅ Preserve the original meaning of the narration
- ✅ Keep connected phrases inside one segment (e.g., `"internet users"` not `"internet"` + `"users"`)
- ✅ Use `countUp` only for meaningful statistics (revenue, users, growth)
- ✅ Use `"lineBreak": true` to force a new line after a segment (e.g., when creating lists or forcing layout structure)
- ✅ Keep years, dates, phone numbers, and IDs as **static** numbers
- ✅ Use **at most 3** emphasis types per composition
- ✅ Use **at most 3** different colors per composition
- ✅ Use **cursive** for at most **one** short emotional phrase
- ✅ Leave most words as `"normal"` style — styling should highlight, not overwhelm
- ✅ Select styling based on **meaning**, not randomly
- ✅ Keep total content under 4 visible lines
- ✅ Set `theme` to match the mood (dark for dramatic, light for clean, warm for emotional)
- ✅ Use `emphasisColor` when you want a specific highlight tint
- ✅ Increase `numberFontSize` for hero statistics that need to dominate the screen
- ✅ Use `backgroundImage` to pass an image URL (e.g. `staticFile("path/to/img.jpg")` or an absolute URL) to show a blurred background tinted by the theme colors.

### DO NOT

- ❌ Style every single word — most should be plain
- ❌ Provide raw positions, coordinates, or CSS outside the theme block
- ❌ Invent style names, emphasis types, or animation names not listed above
- ❌ Use `Math.random()` or any randomization
- ❌ Output anything except the JSON object
- ❌ Use more than **10 segments** total (hard limit — extras get truncated)
- ❌ Put single words in separate segments unless they need different styling
- ❌ Use `\n` in the `value` string. Instead, use `"lineBreak": true` on the segment to wrap text to the next line.
- ❌ Use more than **40 total words** — count them before outputting!

---

## Decision Framework

When converting narration to segments, think about:

1. **What is the key statistic?** → Make it a `number` segment with `countUp`
2. **What is the emotional core?** → Consider `cursive` style (max 1)
3. **What needs visual emphasis?** → Use `marker`, `underline`, or `bold` (max 3 total)
4. **What is supporting context?** → Keep as `normal` or `italic-serif` in `slate` color
5. **Everything else** → Leave as `normal` style, `primary` color, `fadeUp` animation
6. **What mood?** → Set `theme.backgroundColor` and orb colors accordingly

---

## Complete Example

**Input narration:**
> "India reached a historic milestone of 900 million internet users, making it the world's largest connected democracy."

**Output JSON:**

```json
{
  "theme": {
    "backgroundColor": "#fcfcfd",
    "numberFontSize": 120,
    "showOrbs": true
  },
  "segments": [
    {
      "type": "text",
      "value": "India reached",
      "style": "normal",
      "color": "primary",
      "animation": "fadeUp"
    },
    {
      "type": "text",
      "value": "a historic milestone of",
      "style": "italic-serif",
      "color": "slate",
      "animation": "fadeUp"
    },
    {
      "type": "number",
      "value": 900,
      "suffix": "M+",
      "decimals": 0,
      "format": "normal",
      "animation": "countUp",
      "color": "blue"
    },
    {
      "type": "text",
      "value": "internet users",
      "style": "bold",
      "color": "primary",
      "emphasis": "marker",
      "animation": "wordReveal"
    },
    {
      "type": "text",
      "value": "making it the world's",
      "style": "normal",
      "color": "slate",
      "animation": "fadeUp"
    },
    {
      "type": "text",
      "value": "largest connected",
      "style": "bold",
      "color": "amber",
      "emphasis": "underline",
      "animation": "scaleIn"
    },
    {
      "type": "text",
      "value": "democracy",
      "style": "cursive",
      "color": "rose",
      "animation": "fadeUp"
    }
  ]
}
```

**Why these choices:**
- "India reached" — plain opener, no styling needed
- "a historic milestone of" — italic-serif in muted color for editorial context
- 900M+ — the key statistic, animated with count-up in blue, visually largest element
- "internet users" — bold with marker highlight to draw attention to the subject
- "making it the world's" — supporting context in muted color
- "largest connected" — bold with underline, amber color for warm emphasis on the achievement
- "democracy" — cursive for the single emotional/aspirational word, in rose

---

## Dark Mode Example

**Input narration:**
> "You are closer than you think, just 1% more effort changes everything."

```json
{
  "theme": {
    "backgroundColor": "#030712",
    "orb1Color": "rgba(16, 185, 129, 0.12)",
    "orb2Color": "rgba(255, 255, 255, 0.04)",
    "orb3Color": "rgba(59, 130, 246, 0.05)",
    "gridColor": "#1f2937",
    "numberFontSize": 130
  },
  "segments": [
    {
      "type": "text",
      "value": "You are closer than you think, just",
      "style": "normal",
      "color": "#ffffff",
      "animation": "fadeUp"
    },
    {
      "type": "number",
      "value": 1,
      "suffix": "%",
      "decimals": 0,
      "format": "normal",
      "animation": "countUp",
      "color": "#10b981"
    },
    {
      "type": "text",
      "value": "more effort changes",
      "style": "normal",
      "color": "#9ca3af",
      "animation": "fadeUp"
    },
    {
      "type": "text",
      "value": "everything.",
      "style": "bold",
      "color": "#ffffff",
      "emphasis": "marker",
      "emphasisColor": "rgba(16, 185, 129, 0.15)",
      "animation": "scaleIn"
    }
  ]
}
```
