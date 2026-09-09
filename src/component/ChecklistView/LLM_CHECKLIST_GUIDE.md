# LLM Checklist Guide — ChecklistView

This guide explains how an LLM should generate the `checklist.json` format for the **ChecklistView** Remotion component.

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

```json
{
  "theme": { ... },
  "items": [ ... ]
}
```

Both blocks are optional. Omit any to use defaults.

---

## Theme Block

Full control over the visual design. Every property is optional.

```json
{
  "theme": {
    "backgroundColor": "#0f172a",
    "backgroundGradient": "",
    "showOrbs": true,
    "orb1Color": "rgba(59, 130, 246, 0.1)",
    "orb2Color": "rgba(139, 92, 246, 0.08)",
    "showGrid": true,
    "gridColor": "#334155",
    "gridOpacity": 0.08,
    "itemGap": 36,
    "textFontSize": 48,
    "descriptionFontSize": 34,
    "numberFontSize": 72,
    "markerSize": 64,
    "staggerFrames": 15,
    "contentPaddingX": 80,
    "contentPaddingY": 200,
    "showDividers": false,
    "dividerColor": "rgba(255,255,255,0.08)",
    "textAlign": "left"
  }
}
```

| Field               | Type   | Default                         | Description                                                    |
| ------------------- | ------ | ------------------------------- | -------------------------------------------------------------- |
| `backgroundColor`   | string | `"#0f172a"`                     | Solid background color                                         |
| `backgroundGradient`| string | `""`                            | CSS gradient. Overrides backgroundColor                        |
| `showOrbs`          | bool   | `true`                          | Show animated light orbs                                       |
| `orb1Color`         | string | `"rgba(59, 130, 246, 0.1)"`    | First orb color                                                |
| `orb2Color`         | string | `"rgba(139, 92, 246, 0.08)"`   | Second orb color                                               |
| `showGrid`          | bool   | `true`                          | Show dot grid overlay                                          |
| `gridColor`         | string | `"#334155"`                     | Grid dot color                                                 |
| `gridOpacity`       | number | `0.08`                          | Grid opacity (0–1)                                             |
| `itemGap`           | number | `36`                            | Vertical gap between items (px)                                |
| `textFontSize`      | number | `48`                            | Default title font size (px)                                   |
| `descriptionFontSize`| number| `34`                            | Default description font size (px)                             |
| `numberFontSize`    | number | `72`                            | Font size for number markers (px)                              |
| `markerSize`        | number | `64`                            | Size of check/bullet markers (px)                              |
| `staggerFrames`     | number | `15`                            | Frames between each item appearing                             |
| `contentPaddingX`   | number | `80`                            | Horizontal padding on each side (px)                           |
| `contentPaddingY`   | number | `200`                           | Vertical padding (px)                                          |
| `showDividers`      | bool   | `false`                         | Show horizontal lines between items                            |
| `dividerColor`      | string | `"rgba(255,255,255,0.08)"`      | Color of divider lines                                         |
| `textAlign`         | string | `"left"`                        | `"left"` or `"center"`                                         |

---

## Item Types

### Numbered Item

Use for ordered lists where position matters.

```json
{
  "marker": "number",
  "value": 1,
  "text": "Marketplace Strategy",
  "description": "Connecting lakhs of sellers across India.",
  "markerColor": "#ffe600",
  "textColor": "#ffffff",
  "descriptionColor": "#94a3b8",
  "animation": "slideUp"
}
```

| Field              | Required | Values                              | Default      |
| ------------------ | -------- | ----------------------------------- | ------------ |
| `marker`           | ✅        | `"number"`                          | —            |
| `value`            | ✅        | Any integer                         | —            |
| `text`             | ✅        | Main title text                     | —            |
| `description`      | ❌        | Subtitle / detail text              | —            |
| `markerColor`      | ❌        | Color for the number                | `"#3b82f6"`  |
| `textColor`        | ❌        | Title text color                    | `"#ffffff"`  |
| `descriptionColor` | ❌        | Description text color              | `"#94a3b8"`  |
| `textFontSize`     | ❌        | Override title font size            | theme value  |
| `descriptionFontSize`| ❌      | Override description font size      | theme value  |
| `animation`        | ❌        | `slideUp`, `fadeUp`, `scaleIn`, `none` | `"slideUp"` |

### Checkmark Item

Use for completed tasks, verified items, or boolean achievements.

```json
{
  "marker": "check",
  "markerShape": "circle",
  "text": "Supply chain optimized",
  "description": "Ekart engine powers hyper-local delivery.",
  "markerColor": "#10b981",
  "textColor": "#ffffff",
  "animation": "slideUp"
}
```

| Field         | Required | Values                | Default      |
| ------------- | -------- | --------------------- | ------------ |
| `marker`      | ✅        | `"check"`             | —            |
| `markerShape` | ❌        | `"circle"`, `"square"`| `"circle"`   |
| `text`        | ✅        | Main title text       | —            |
| `description` | ❌        | Subtitle text         | —            |
| `markerColor` | ❌        | Checkmark + border    | `"#10b981"`  |
| `animation`   | ❌        | `slideUp`, `fadeUp`, `scaleIn`, `none` | `"slideUp"` |

#### Checkmark Timing & State Control

For `"marker": "check"`, you can control whether the checkbox gets checked and exactly when it animates:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `checked` | boolean | Set to `false` to keep the checkbox empty (unchecked) throughout the entire video. Defaults to `true`. |
| `checkFrame` | number | Specify an absolute frame number at which the checkmark animation starts drawing. |
| `checkDelay` | number | Specify a delay in frames after the item enters the screen before starting the checkmark animation. |
| `checkDelayAfterList` | number | Specify a delay in frames after the entire stagger list finishes entering the screen before checking. |
| `checkAtProgress` | number | A fraction between `0` and `1` representing when to check relative to the video duration (e.g. `0.85` checks at 85% progress). |


### Bullet Item

Use for unordered lists or general points.

```json
{
  "marker": "bullet",
  "bulletStyle": "dot",
  "text": "AI-powered recommendations",
  "markerColor": "#8b5cf6",
  "textColor": "#ffffff",
  "animation": "fadeUp"
}
```

| Field         | Required | Values                              | Default    |
| ------------- | -------- | ----------------------------------- | ---------- |
| `marker`      | ✅        | `"bullet"`                          | —          |
| `bulletStyle` | ❌        | `"dot"`, `"arrow"`, `"dash"`, `"star"` | `"dot"` |
| `text`        | ✅        | Main title text                     | —          |
| `description` | ❌        | Subtitle text                       | —          |
| `markerColor` | ❌        | Bullet color                        | `"#8b5cf6"`|
| `animation`   | ❌        | `slideUp`, `fadeUp`, `scaleIn`, `none` | `"fadeUp"` |

---

## Color Palette

| Name      | Hex       | Use for                           |
| --------- | --------- | --------------------------------- |
| `white`   | `#ffffff` | Default text on dark backgrounds  |
| `blue`    | `#2563eb` | Primary accent, tech topics       |
| `emerald` | `#10b981` | Checkmarks, success, growth       |
| `amber`   | `#f59e0b` | Warnings, financial highlights    |
| `rose`    | `#f43f5e` | Important, emotional emphasis     |
| `violet`  | `#8b5cf6` | Creative, tech, secondary accent  |
| `teal`    | `#14b8a6` | Calm, institutional               |
| `orange`  | `#f97316` | Urgency, attention                |
| `cyan`    | `#06b6d4` | Data, cool-toned accents          |
| `slate`   | `#94a3b8` | Muted, secondary text             |

You may also use any CSS color (hex, rgba, hsl).

---

## Styling Rules

### DO

- ✅ Output only valid JSON
- ✅ Use `"number"` markers for ordered/sequential lists
- ✅ Use `"check"` markers for completed/verified items
- ✅ Use `"bullet"` markers for general unordered points
- ✅ Keep items to **max 6–7** to fit the screen
- ✅ Use `description` for additional context below the title
- ✅ Use consistent `markerColor` within a category
- ✅ Set theme to match the content mood (dark for dramatic, blue for corporate)
- ✅ Use `"slideUp"` animation for most items — it feels cleanest

### DO NOT

- ❌ Mix more than 2 marker types in one composition
- ❌ Use very long text — keep titles under 40 characters
- ❌ Use more than 3 different marker colors
- ❌ Output anything except the JSON object
- ❌ Add `\n` or line breaks inside text values

---

## Complete Example

**Input narration:**
> "Flipkart's 5-pillar strategy includes: marketplace connectivity, supply chain excellence, mega sale events, advertising revenue, and generative AI integration."

**Output JSON:**

```json
{
  "theme": {
    "backgroundGradient": "linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)",
    "numberFontSize": 68,
    "staggerFrames": 18
  },
  "items": [
    {
      "marker": "number",
      "value": 1,
      "text": "Marketplace Strategy",
      "description": "Connecting lakhs of sellers across India.",
      "markerColor": "#ffe600",
      "textColor": "#ffffff",
      "descriptionColor": "#94a3b8",
      "animation": "slideUp"
    },
    {
      "marker": "number",
      "value": 2,
      "text": "Supply Chain Excellence",
      "description": "Ekart powers hyper-local fast delivery.",
      "markerColor": "#ffe600",
      "textColor": "#ffffff",
      "descriptionColor": "#94a3b8",
      "animation": "slideUp"
    },
    {
      "marker": "number",
      "value": 3,
      "text": "Mega Sale Events",
      "description": "Big Billion Days drives massive volume.",
      "markerColor": "#ffe600",
      "textColor": "#ffffff",
      "descriptionColor": "#94a3b8",
      "animation": "slideUp"
    },
    {
      "marker": "number",
      "value": 4,
      "text": "Ad Revenue Engine",
      "description": "High-growth engine fueling profitability.",
      "markerColor": "#ffe600",
      "textColor": "#ffffff",
      "descriptionColor": "#94a3b8",
      "animation": "slideUp"
    },
    {
      "marker": "number",
      "value": 5,
      "text": "Generative AI",
      "description": "Smart tech for direct customer discovery.",
      "markerColor": "#ffe600",
      "textColor": "#ffffff",
      "descriptionColor": "#94a3b8",
      "animation": "slideUp"
    }
  ]
}
```
