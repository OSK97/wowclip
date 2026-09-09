# GrossVolume / Stock Price Card — LLM Configuration Guide

You are generating a JSON config for the `GrossVolume` animation. This creates a sleek, modern stock/volume tracking card with a floating 3D card over a deep bokeh background. Features a glowing chart line, animated dollar counter, and percentage badge.

## When to Use

Use this animation when:
- Showing a **single metric's progression** (stock price, revenue, volume)
- Displaying **percentage change** (profit/loss with auto green/red theming)
- Presenting **financial data** with a premium, minimal aesthetic

Do NOT use for: comparing multiple categories (use BarGraph), trend comparisons (use LineGraph), or proportional breakdowns (use PieChart).

---

## Animation Flow

1. **Card entrance** — 3D perspective rotation + scale spring (frames 0-45)
2. **Company name + badge** fade in on the card header
3. **Dollar amount** counts up from `startValue` to `endValue` as chart progresses
4. **Chart line draws** from left to right with glowing tip, controlled by keyframes
5. **Area fill** fades in under the line
6. **Floating card** gently bobs with a subtle idle animation throughout
7. **Bokeh orbs** drift in the background for depth

---

## Timing & Keyframe Control

The chart drawing is controlled by `animation.keyframes`. This is identical to LineGraph keyframes:

```json
"animation": {
  "keyframes": [
    { "frame": 0, "progress": 0.0 },
    { "frame": 40, "progress": 0.2 },
    { "frame": 90, "progress": 0.45 },
    { "frame": 130, "progress": 0.45 },
    { "frame": 168, "progress": 1.0 }
  ]
}
```

### Critical Rules

1. You **MUST** leave at least **1 second buffer** at the end where `progress: 1.0` holds. For an 8-second video at 24fps (192 frames), the final keyframe must reach 1.0 by frame 168.
2. Progress must eventually reach `1.0` — the chart must finish drawing by the end of the video.
3. You can **pause** progress (same value on consecutive keyframes) while the speaker elaborates.

### Auto-Theming

If you omit `theme.accentColor`, the component **automatically** picks:
- **Green** (`#34C759`) if `endPercentage >= 0` (profit)
- **Red** (`#E8364E`) if `endPercentage < 0` (loss)

The entire background, bokeh, badge, and chart line will match.

---

## Configuration Schema

```json
{
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 24,
    "durationSeconds": 8
  },
  "company": {
    "name": "Gross Volume",
    "ticker": "NASDAQ: GOOGL",
    "currency": "$"
  },
  "theme": {
    "backgroundColor": "#051A0A",
    "accentColor": "#34C759"
  },
  "data": {
    "startValue": 1046020,
    "endValue": 1046658,
    "startPercentage": 302.08,
    "endPercentage": 350.08,
    "points": [
      [0, 0.42], [0.1, 0.38], [0.25, 0.28], [0.5, 0.50], [0.75, 0.55], [1.0, 0.62]
    ],
    "xLabels": ["Jan 25", "Jan 26"]
  },
  "animation": {
    "entranceDurationFrames": 45,
    "keyframes": [
      { "frame": 0, "progress": 0.0 },
      { "frame": 50, "progress": 0.3 },
      { "frame": 120, "progress": 0.7 },
      { "frame": 168, "progress": 1.0 }
    ]
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `composition.fps` | number | Yes | Use **24** for cinematic, **30** for standard |
| `composition.durationSeconds` | number | Yes | Total animation length in seconds |
| `company.name` | string | No | Label on the card (default: "Gross Volume") |
| `company.ticker` | string | No | Stock ticker symbol |
| `company.currency` | string | No | Currency prefix for dollar amount (default: "$") |

### Data Object

| Field | Type | Description |
|---|---|---|
| `startValue` | number | Starting dollar/number value |
| `endValue` | number | Final dollar/number value (counter animates between these) |
| `startPercentage` | number | Starting % for the badge |
| `endPercentage` | number | Final % for the badge (negative = red/loss) |
| `points` | number[][] | Chart curve points as `[x, y]` pairs. Both x and y must be 0.0-1.0. x = left-to-right, y = bottom-to-top. |
| `xLabels` | string[] | Labels below the chart (dates, periods) |

### Theme Object (Optional)

| Field | Description |
|---|---|
| `backgroundColor` | Deep background color (auto-calculated from accent if omitted) |
| `accentColor` | Main color for chart line, badge, and glow. Auto-detected green/red if omitted. |

---

## Constraints

- `data.points` must have at least **2 points** for a valid curve
- Both `x` and `y` in points must be between **0.0 and 1.0**
- Points should be **sorted by x** (left to right)
- Use **24 fps** for the most cinematic look (the card float and bokeh look best at 24fps)
- Keep `xLabels` to **2-6 items** — too many crowds the bottom axis
- The `currency` field is just a prefix string — use "$", "₹", "€", etc.

---

## Prompt Design Rules

1. **Always set `composition.durationSeconds`** — this is required
2. **Use keyframes for audio sync** — calculate: `frame = timestamp_seconds * fps`
3. **Leave 1-second end buffer** — final keyframe must finish 1 second before video ends
4. **Let auto-theming work** — omit `theme.accentColor` to get automatic green/red based on profit/loss
5. **Keep points smooth** — 6-10 points creates a nice curve, too few looks angular
