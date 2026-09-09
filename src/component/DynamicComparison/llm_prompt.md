# Dynamic Comparison — LLM Configuration Guide

You generate a JSON config for a side-by-side comparison animation (1080×1920, 30 fps).

## Design
- **Warm white background** `#FAF9F6` — clean canvas, no grid, no cards
- **Center divider** with top/bottom fade — separates left vs right
- **Two columns** each with: header (image + name), then sequential content blocks
- **Auto-scroll** if content overflows the visible area

---

## JSON Structure

```json
{
  "theme": {
    "backgroundColor": "#FAF9F6",
    "textColor": "#0F172A",
    "dividerColor": "rgba(15, 23, 42, 0.12)"
  },
  "scroll": {
    "safeZoneHeight": 1200
  },
  "left": { "name": "...", "image": "...", "accentColor": "#2563eb", "blocks": [...] },
  "right": { "name": "...", "image": "...", "accentColor": "#8b5cf6", "blocks": [...] }
}
```

### Theme (global)
| Key              | Type   | Description                              |
|------------------|--------|------------------------------------------|
| backgroundColor  | string | Background color (`#FAF9F6` for warm white) |
| textColor        | string | Default text color (`#0F172A` for dark)  |
| dividerColor     | string | Center divider color with transparency   |

### Scroll (global)
| Key              | Type   | Description                              |
|------------------|--------|------------------------------------------|
| safeZoneHeight   | number | Visible area in px before scroll starts (default 1200) |

### Side Config (`left` / `right`)
| Key         | Type     | Description                              |
|-------------|----------|------------------------------------------|
| name        | string   | Product/entity name (shown as header)    |
| image       | string   | Filename in `/public` for header image   |
| accentColor | string   | Color used for markers, emphasis, badges |
| blocks      | Block[]  | Array of content blocks (see below)      |

---

## Block Types

You have **full control** over the sequence and type of blocks. Mix and repeat them in any order.

### 1. `smart_text` — Rich Text (SmartTextView format)

```json
{
  "type": "smart_text",
  "startFrame": 90,
  "segments": [
    {
      "type": "text",
      "value": "HEADING TEXT",
      "style": "bold",
      "case": "uppercase",
      "color": "#2563eb",
      "emphasis": "marker",
      "emphasisColor": "rgba(37, 99, 235, 0.15)",
      "lineBreak": true
    },
    {
      "type": "text",
      "value": "Regular body text follows.",
      "style": "normal",
      "color": "#0F172A"
    },
    {
      "type": "number",
      "value": 99.9,
      "suffix": "%",
      "format": "normal",
      "decimals": 1,
      "color": "#2563eb",
      "animation": "countUp"
    }
  ],
  "theme": {
    "textFontSize": 38,
    "numberFontSize": 62,
    "wordStaggerFrames": 3,
    "emphasisDelay": 10,
    "countUpDuration": 30,
    "lineHeight": 1.45,
    "textAlign": "left"
  }
}
```

#### Text Segment Fields
| Field         | Options                                                | Default   |
|---------------|--------------------------------------------------------|-----------|
| style         | `normal`, `bold`, `italic`, `serif`, `italic-serif`, `cursive` | `normal` |
| case          | `original`, `uppercase`, `lowercase`, `title`          | `original`|
| color         | Any CSS color or: `primary`, `blue`, `amber`, `rose`, `emerald`, `violet`, `teal`, `orange`, `cyan`, `white`, `black`, `slate` | `#0F172A` |
| emphasis      | `none`, `marker`, `underline`, `box`, `textColor`      | `none`    |
| emphasisColor | CSS color for marker/highlight background              | auto      |
| animation     | `fadeUp`, `wordReveal`, `scaleIn`, `slideUp`, `none`   | `fadeUp`  |
| fontSize      | number (overrides theme default)                       | theme     |
| lineBreak     | `true` to force new line after this segment            | `false`   |

#### Number Segment Fields
| Field     | Options                                            | Default    |
|-----------|----------------------------------------------------|------------|
| value     | number                                             | required   |
| prefix    | string before number (e.g. `"$"`)                  | none       |
| suffix    | string after number (e.g. `"%"`, `"M"`)            | none       |
| decimals  | number of decimal places                           | 0          |
| format    | `normal`, `comma`, `compact`, `currency`, `percentage` | `normal` |
| animation | `countUp`, `pop`, `static`                         | `countUp`  |
| color     | CSS color or palette name                          | `#2563eb`  |
| fontSize  | number (overrides theme default)                   | theme      |

#### Smart Text Theme
| Field             | Type   | Default | Notes                    |
|-------------------|--------|---------|--------------------------|
| textFontSize      | number | 48      | Big enough for mobile video |
| numberFontSize    | number | 80      | Large animated numbers   |
| wordStaggerFrames | number | 3       | Frames between each word appearing |
| emphasisDelay     | number | 10      | Frames to wait before emphasis effect |
| countUpDuration   | number | 30      | Frames for number count-up |
| lineHeight        | number | 1.45    | Line height multiplier   |
| textAlign         | string | "left"  | `left`, `center`, `right`|

### 2. `image` — Direct Image

```json
{
  "type": "image",
  "startFrame": 150,
  "url": "filename.png",
  "height": 300,
  "borderRadius": 20
}
```

| Field        | Type   | Default | Notes                           |
|--------------|--------|---------|----------------------------------|
| url          | string | required| Filename from `/public` folder   |
| height       | number | 300     | Image height in pixels           |
| borderRadius | number | 20      | Corner rounding                  |

### 3. `checklist` — List Items (ChecklistView format)

```json
{
  "type": "checklist",
  "startFrame": 210,
  "items": [
    {
      "marker": "check",
      "text": "Feature Name",
      "description": "Short explanation",
      "markerColor": "#2563eb",
      "checked": true
    }
  ],
  "theme": {
    "textFontSize": 32,
    "descriptionFontSize": 23,
    "markerSize": 36,
    "staggerFrames": 10,
    "itemGap": 28
  }
}
```

#### Checklist Item Fields
| Field            | Options                           | Default   |
|------------------|-----------------------------------|-----------|
| marker           | `check`, `bullet`, `number`       | required  |
| text             | string (main text)                | required  |
| description      | string (subtitle, optional)       | none      |
| markerColor      | CSS color                         | `#3b82f6` |
| textColor        | CSS color                         | theme     |
| descriptionColor | CSS color                         | `#64748b` |
| checked          | boolean (for check animation)     | `true`    |
| value            | number (for number markers)       | index+1   |

#### Checklist Theme
| Field             | Type   | Default | Notes                    |
|-------------------|--------|---------|--------------------------|
| textFontSize      | number | 42      | Large for mobile video   |
| descriptionFontSize | number | 32    | Subtitle size            |
| markerSize        | number | 48      | Marker circle/bullet size|
| staggerFrames     | number | 10      | Delay between items      |
| itemGap           | number | 36      | Spacing between items    |

---

## Rules

1. **Time Control (`startFrame`)**: You **MUST** provide a `startFrame` integer for every single block (text, image, checklist). This syncs the visuals perfectly with the podcast transcript. The UI will automatically smoothly scroll the page down individually per column as blocks appear.
2. **Minimalism & Structure**: Do not place text randomly. Create a highly structured, systematic specification layout. Use `lineBreak: true` thoughtfully to stack text lines like a clean table. Keep text concise.
3. **Typography**: Text must be large (minimum 32px for body, 38px+ for headers). Use emphasis (`marker`, `underline`, `box`) for key terms only.
4. **Use accent colors** consistently per side (left = blue, right = purple by default).
5. **Mix block types** freely — text, images, checklists in any order and count.
6. **Images come from `/public`** — reference by filename only (e.g. `"building1.png"`).
7. **Handle Edge Cases**: Since columns scroll independently based on `startFrame`, you can fill one side entirely, then the other, or weave them back and forth. The auto-scroller will gracefully handle any sequence.
