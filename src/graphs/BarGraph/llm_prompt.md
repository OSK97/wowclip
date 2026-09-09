# BarGraph — LLM Configuration Guide

You are generating a JSON config for the `BarGraph` animation. This creates modern, vertical bar chart infographics optimized for portrait video (1080x1920).

## When to Use

Use this animation when:
- Comparing **discrete categories** (e.g., market share by company, revenue by segment)
- Showing **ranked data** where order matters
- Displaying **quantities** that benefit from visual height comparison

Do NOT use for: time-series data (use LineGraph), proportions of a whole (use PieChart), or single-value metrics (use GrossVolume).

---

## Animation Flow

1. **Background + Grid** fade in (frames 0-25)
2. **Title + Counter** spring in from top (if `title.show` is true)
3. **Bars grow** one-by-one from bottom with spring physics, staggered by `startFrame`
4. **Value labels** pop in above each bar after it finishes growing
5. **Category labels** fade in below the chart

---

## Timing Rules

Remotion runs at **30 fps** (1 second = 30 frames).

### Per-Bar Timing
Each bar's `startFrame` controls when it begins growing. Calculate from audio:
```
startFrame = timestamp_seconds * 30
```

### Duration
Set `durationInSeconds` at the root level. If omitted, the component auto-calculates:
```
duration = max(startFrame of last bar) + 120 frames (4 seconds hold)
```

Always leave **3+ seconds** of hold time after the last bar appears so viewers can absorb the data.

---

## Configuration Schema

```json
{
  "durationInSeconds": 10,
  "title": {
    "text": "CATEGORY LABEL",
    "subtitle": "Optional subtitle text",
    "show": true
  },
  "unit": "%",
  "logo": {
    "show": false,
    "url": "",
    "height": 90
  },
  "theme": {
    "backgroundColor": "#050A07",
    "backgroundGradient": "radial-gradient(circle at center, #0F1F17 10%, #050A07 60%)",
    "textColor": "#FFFFFF",
    "mutedTextColor": "rgba(255, 255, 255, 0.55)",
    "accentColor": "#10B981",
    "gridColor": "rgba(255, 255, 255, 0.08)"
  },
  "animation": {
    "labelsFadeIn": [15, 35],
    "gridFadeIn": [5, 25]
  },
  "bars": [
    {
      "label": "Category A",
      "value": 86,
      "gradientFrom": "#F59E0B",
      "gradientTo": "#B45309",
      "startFrame": 15,
      "highlight": true
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `durationInSeconds` | number | Recommended | Total animation duration. Auto-calculated if omitted. |
| `title.text` | string | No | Header label (uppercase looks best) |
| `title.subtitle` | string | No | Smaller text below the counter |
| `title.show` | boolean | No | If false, chart auto-centers vertically for maximum impact |
| `unit` | string | Yes | Unit suffix shown on values (e.g., "%", "k Cr", "M") |

### Bar Object

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | Yes | Category name below bar (auto-sizes for long text) |
| `value` | number | Yes | Numeric value (determines bar height relative to max) |
| `gradientFrom` | string | Yes | Top color of bar gradient |
| `gradientTo` | string | Yes | Bottom color of bar gradient |
| `startFrame` | number | No | Frame when bar starts growing (default: staggered) |
| `image` | string | No | Image URL/path to display inside bar |
| `highlight` | boolean | No | If true, bar gets accent border + highlighted value color |

### Theme Customization

The component auto-detects dark vs light backgrounds and adjusts text colors. Override any field:

| Field | Description |
|---|---|
| `backgroundColor` | Main background color |
| `backgroundGradient` | Radial gradient over background |
| `textColor` | Main text color |
| `mutedTextColor` | Subtitle / header category color |
| `accentColor` | Highlight color for selected bars |
| `gridColor` | Background grid line color |

---

## Constraints

- **Maximum 7 bars** — more than 7 causes visual overlap and distortion
- **Minimum 1 bar** — at least one bar is required
- Use **distinct, high-contrast colors** for adjacent bars
- Highlight only **1 key bar** per chart for visual focus
- Keep labels **short** — long labels auto-scale but under 12 chars is ideal

---

## Example: Game Engine Comparison

```json
{
  "durationInSeconds": 10,
  "title": { "text": "", "show": false },
  "unit": "%",
  "theme": {
    "backgroundColor": "#130A14",
    "backgroundGradient": "radial-gradient(circle 1000px at 50% 30%, #2D1426 0%, #1A0D18 55%, #0C050E 100%)",
    "textColor": "#FFF7FC",
    "accentColor": "#F43F5E"
  },
  "bars": [
    { "label": "Unreal 5", "value": 86, "gradientFrom": "#F59E0B", "gradientTo": "#B45309", "startFrame": 15, "highlight": true },
    { "label": "Unity 6", "value": 68, "gradientFrom": "#FB7185", "gradientTo": "#E11D48", "startFrame": 45 },
    { "label": "Godot 4", "value": 52, "gradientFrom": "#2DD4BF", "gradientTo": "#0D9488", "startFrame": 75 },
    { "label": "CryEngine", "value": 34, "gradientFrom": "#A855F7", "gradientTo": "#6B21A8", "startFrame": 105 }
  ]
}
```
