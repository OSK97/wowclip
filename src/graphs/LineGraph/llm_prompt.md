# LineGraph — LLM Configuration Guide

You are generating a JSON config for the `LineGraph` animation. This creates premium, cinematic trend line visualizations optimized for portrait video (1080x1920). Features smooth bezier curves, rich area gradients, keyframe-controlled drawing, and interactive tooltips.

## When to Use

Use this animation when:
- Showing **trends over time** (stock prices, revenue growth, user metrics)
- Visualizing **continuous data** with temporal progression
- Comparing **multiple time-series** on the same chart (multi-line support)

Do NOT use for: discrete category comparisons (use BarGraph), parts of a whole (use PieChart), or single-value displays (use GrossVolume).

---

## Animation Flow

1. **Background + Grid** fade in
2. **Legend pills** slide in from the top
3. **Lines draw** left-to-right with smooth bezier easing, controlled by keyframes
4. **Active dots** appear at the drawing tip of each line
5. **Tooltip** floats near the active dots showing current values
6. **Bottom heading** slides up
7. **Large indicator number** fades in at bottom-left

---

## Keyframe Animation (Audio Sync)

The most powerful feature is the `keyframes` array on each data series. This gives you **absolute control** over the speed and pacing of the line's drawing.

### How Keyframes Work

A keyframe is `{ "frame": number, "progress": number }` where:
- `frame` = the video frame number (at 30fps: 1 second = 30 frames)
- `progress` = how far the line has drawn, from `0` (start) to `1` (end)

### Pausing the Animation

You can **hold** the line at any progress point while the speaker talks:

```json
"keyframes": [
  { "frame": 30, "progress": 0 },      // Start drawing at 1 second
  { "frame": 60, "progress": 0.5 },    // Draw halfway by 2 seconds
  { "frame": 120, "progress": 0.5 },   // PAUSE at halfway for 2 seconds
  { "frame": 150, "progress": 1 }      // Finish drawing in last 1 second
]
```

### Timing Buffer Rule

Always ensure the final keyframe (`progress: 1.0`) completes at least **1 second** before the video ends. This gives viewers time to absorb the full chart.

---

## Configuration Schema

```json
{
  "durationInSeconds": 8,
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationSeconds": 8
  },
  "logo": { "show": false, "url": "", "height": 90 },
  "theme": {
    "backgroundColor": "#0A0A0A",
    "backgroundGradient": "radial-gradient(ellipse 120% 80% at 50% 35%, #1A1F14 0%, #0E110A 50%)",
    "textColor": "#F0F5E8",
    "subtextColor": "#6B8A5E",
    "gridColor": "rgba(118, 185, 0, 0.05)",
    "fontPrimary": "Inter",
    "fontDisplay": "Outfit"
  },
  "legend": {
    "position": "top-right",
    "layout": "column",
    "items": [
      {
        "label": "Revenue ($B)",
        "color": "#76B900",
        "colorGradient": ["#A3E635", "#76B900", "#4D7C0F"],
        "dotSize": 22
      }
    ],
    "fontSize": 28,
    "fontWeight": 700,
    "gap": 18,
    "marginTop": 120,
    "marginRight": 70
  },
  "bottomHeading": {
    "show": true,
    "text": "NVIDIA Gross Revenue",
    "fontSize": 64,
    "fontWeight": 800,
    "letterSpacing": -2,
    "lineHeight": 1.05,
    "marginBottom": 170
  },
  "indicator": {
    "show": true,
    "fontSize": 120,
    "fontWeight": 800,
    "suffix": "B",
    "color": "#76B900",
    "opacity": 0.12,
    "position": "bottom-left",
    "marginBottom": 280,
    "marginLeft": 60
  },
  "graph": {
    "marginX": 60,
    "marginY": 80,
    "gridWidth": 920,
    "gridHeight": 850,
    "positionY": "46%",
    "strokeWidth": 6,
    "dotRadius": 15,
    "dotPulseRadius": 34,
    "showArea": true,
    "areaOpacityStart": 0.18,
    "areaOpacityEnd": 0.0,
    "showTooltip": true,
    "showGridLines": true,
    "gridLineWidth": 1.2
  },
  "data": {
    "series": [
      {
        "name": "Gross Revenue",
        "values": [11, 17, 27, 27, 61, 96, 130, 200, 260],
        "keyframes": [
          { "frame": 18, "progress": 0 },
          { "frame": 50, "progress": 0.45 },
          { "frame": 100, "progress": 1 }
        ],
        "color": "#76B900",
        "strokeGradient": ["#A3E635", "#76B900", "#4D7C0F"],
        "areaColor": "#76B900",
        "shadowColor": "rgba(118, 185, 0, 0.35)"
      }
    ],
    "maxValue": 280,
    "timeline": ["FY20", "FY21", "FY22", "FY23", "FY24", "Q2 25", "Q3 25", "Q1 26", "Q3 26"],
    "yLabels": [
      { "value": 100, "label": "$280B" },
      { "value": 75, "label": "$210B" },
      { "value": 50, "label": "$140B" },
      { "value": 25, "label": "$70B" },
      { "value": 0, "label": "0" }
    ]
  },
  "animation": {
    "gridFadeIn": [5, 30],
    "legendFadeIn": [8, 25],
    "drawLineRange": [18, 100],
    "drawLineEasing": "easeOutCubic",
    "bottomTextFadeIn": [10, 30],
    "indicatorFadeIn": [15, 35],
    "dotAppearFrame": 22,
    "tooltipAppearFrame": 22,
    "labelsFadeIn": [12, 35],
    "breathingAmplitude": 0.003,
    "breathingSpeed": 50
  }
}
```

### Key Fields

| Field | Description |
|---|---|
| `durationInSeconds` | Total animation length (set at root level) |
| `data.series[].keyframes` | Per-series keyframe array for drawing control |
| `data.series[].values` | The actual Y-axis data points |
| `data.maxValue` | The maximum Y-axis value (used for normalization) |
| `data.timeline` | X-axis labels (should match values array length) |
| `data.yLabels` | Y-axis label positions (value 0-100 as percentage of maxValue) |
| `bottomHeading.text` | Main chart title (auto-scales if >40 chars) |
| `legend.layout` | `"row"` for horizontal, `"column"` for vertical legend |

### Multi-Series Support

Add multiple items to `data.series` for comparison charts. Each series has independent:
- Colors and gradients
- Keyframe timing (so you can draw one line, pause, then draw another)
- Area fills

---

## Constraints

- Keep `bottomHeading.text` **under 40 characters** for maximum impact
- `data.yLabels[].value` uses a 0-100 scale (percentage of maxValue)
- `data.timeline` length should match `data.series[].values` length
- Always set `maxValue` to be slightly higher than the largest data point
- Leave **1+ second buffer** at end of video after final keyframe progress reaches 1.0

---

## Prompt Design Rules

1. **Use keyframes for audio sync** — map speaker timestamps to keyframe frames
2. **Pause during emphasis** — hold progress constant while speaker elaborates on a data point
3. **Match theme to brand** — use company's brand colors for the line gradient
4. **Keep data readable** — 5-12 data points is ideal, more gets crowded
