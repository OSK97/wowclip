# PieChart — LLM Configuration Guide

You are generating a JSON config for the `PieChart` animation. This creates elegant, circular data visualizations with animated wedge reveals, leader lines, and percentage labels. Optimized for portrait video (1080x1920).

## When to Use

Use this animation when:
- Showing **parts of a whole** (e.g., market share breakdown, budget allocation)
- Displaying **proportional data** where all segments sum to 100%
- Comparing **2-8 categories** as portions of a total

Do NOT use for: trends over time (use LineGraph), absolute value comparisons (use BarGraph), or single-value metrics (use GrossVolume).

---

## Animation Flow

1. **Background + Grid** fade in (frames 0-25)
2. **Sectors draw** clockwise from 12 o'clock, each with a staggered reveal
3. **Percentage labels** pop inside each sector with spring physics
4. **Leader lines** shoot out from each sector to connect to...
5. **Sector names** fade in at the end of each leader line
6. **White dividers** fade in between sectors for clean separation

---

## Timing Control

Remotion runs at **30 fps** (1 second = 30 frames).

### Per-Sector Timing Overrides

You have **complete control** over the timing of every element in every sector. This is critical for syncing with spoken audio.

For each sector, you can define four timing arrays `[startFrame, endFrame]`:

| Field | What it controls |
|---|---|
| `drawRange` | When the pie wedge draws in |
| `labelRange` | When the percentage number appears inside the wedge |
| `lineRange` | When the leader line shoots out |
| `textRange` | When the outer sector name fades in |

### Default Timing

If you omit these fields, sectors are auto-staggered: each sector starts 8 frames after the previous one. This works well for quick reveals. Use custom timing only when you need to sync with specific audio timestamps.

### Buffer Rule

Always leave **1+ second** of hold time after the last sector finishes animating. The viewer needs time to absorb the full chart.

---

## Configuration Schema

```json
{
  "durationInSeconds": 6,
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationSeconds": 6
  },
  "logo": { "show": false, "url": "", "height": 90 },
  "theme": {
    "backgroundColor": "#FAF9F6",
    "backgroundGradient": "radial-gradient(circle at center, #FFFFFF 20%, #F5F3ED 70%, #EAE7DC 100%)",
    "textColor": "#0F172A",
    "subtextColor": "#475569",
    "gridColor": "rgba(0, 0, 0, 0.04)"
  },
  "elements": {
    "showTitles": true
  },
  "chart": {
    "cx": 540,
    "cy": 960,
    "radius": 300,
    "gridWidth": 960,
    "gridHeight": 1680
  },
  "sectors": [
    {
      "id": "segment-1",
      "name": "Model Training",
      "percentage": 40,
      "color": "#00A5DF",
      "drawRange": [10, 32],
      "labelRange": [24, 34],
      "lineRange": [30, 42],
      "textRange": [36, 46]
    },
    {
      "id": "segment-2",
      "name": "Data Cleaning",
      "percentage": 35,
      "color": "#FFA000"
    },
    {
      "id": "segment-3",
      "name": "Inference",
      "percentage": 25,
      "color": "#E91E63"
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `durationInSeconds` | number | Yes | Total animation duration |
| `elements.showTitles` | boolean | No | Set `false` to hide outer labels (ultra-minimalist mode) |
| `chart.cx` / `chart.cy` | number | Yes | Center point of the pie (540, 960 = exact center) |
| `chart.radius` | number | Yes | Pie radius in pixels (250-350 recommended) |

### Sector Object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier (use kebab-case) |
| `name` | string | Yes | Sector label displayed outside the pie |
| `percentage` | number | Yes | Percentage value (all sectors MUST sum to 100) |
| `color` | string | Yes | Sector fill color |
| `drawRange` | [number, number] | No | Custom [start, end] frame for wedge animation |
| `labelRange` | [number, number] | No | Custom [start, end] frame for percentage label |
| `lineRange` | [number, number] | No | Custom [start, end] frame for leader line |
| `textRange` | [number, number] | No | Custom [start, end] frame for sector name |

---

## Constraints

- **Percentages MUST sum to 100** — the pie will look broken otherwise
- **2-8 sectors** recommended — fewer than 2 is pointless, more than 8 gets unreadable
- Sectors with **less than 5%** will have cramped labels — consider merging small segments into "Other"
- Use **high-contrast colors** between adjacent sectors
- Keep sector names **short** (under 20 chars) — they display in a single line

---

## Prompt Design Rules

1. **Sync drawRange with audio** — delay a sector's `drawRange` until the speaker mentions it
2. **Create dramatic reveals** — draw the largest sector first, pause, then reveal others
3. **Validate percentages** — always double-check they sum to exactly 100
4. **Use distinct colors** — avoid similar hues for adjacent sectors
5. **Match theme to context** — use light theme for business/corporate, dark for tech/gaming
