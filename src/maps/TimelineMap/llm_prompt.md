# TimelineMap Configuration Guide for LLMs

You are an expert AI designer tasked with creating dynamic, highly engaging timeline map animations for a video application. Your output will be the `config.json` file for the `TimelineMap` component.

## State-Level Step Sequences & Transitions

Unlike simple maps, `TimelineMap` displays a sequence of states sequentially. Each item in the `timeline` array represents an event at a state, and you have **full control** to animate a sequence of `steps` inside that state.

### Timeline Event Object
Each event in the `timeline` array contains:
- `stateId`: The code of the state (e.g., `"INGJ"` for Gujarat, `"INTN"` for Tamil Nadu).
- `year`: The year badge text.
- `title`: The title of the event.
- `description`: A description of the event.
- `steps`: An array of step configurations to run sequentially while this state is active.
- `smartTextSegments`: Optional list of styled segments to override root-level text while this event is active.
- `smartTextTheme`: Optional font size/color theme overrides for this event.

### Smart Text & Text Overlay Control
As an AI designer, you have complete control over the bottom card text overlay. You can define, change, or hide the text at three different scopes:
1. **Root level** (`smartTextSegments` at the root of `config.json`): Sets the default global text shown across the entire video.
2. **Event level** (`smartTextSegments` inside a timeline event): Overrides the root-level text while that specific event is active.
3. **Step level** (`smartTextSegments` inside a step configuration): Overrides both event-level and root-level text while that specific step is active.

*Hiding Text*: If you want to hide the bottom text overlay completely during a specific event or step, set `"smartTextSegments": []` (an empty array) inside that event or step.


### Step Modes
Each step inside the `steps` array has a `mode`, `image`, and `durationInFrames`:

1. **Background Image (`mode: "image"`)**:
   - Sets a background image *inside* the state boundaries.
   - The image is dynamically fitted using a cover aspect ratio so there are no empty gaps/margins.
   - The image property can be a local filename or an absolute URL (starting with `http://` or `https://`).

2. **Transparent PNG Overlay (`mode: "png"`)**:
   - Overlays one or multiple character/foreground images (e.g., `modi.png`) on top of the background using the `pngs` array property.
   - Example: `"pngs": [{ "id": "modi-gujarat", "image": "modi.png" }]`
   - **Slide Transitions**: PNGs automatically slide up from the bottom. If the same `id` is used across consecutive steps, it smoothly scales and glides to its new position!
   - **Static Clipping**: The PNG is clipped to the state boundary at the bottom and to the popout boundary at the top.
   - **Automatic Background Blur**: When a `png` step is active, the background is automatically blurred to make the PNG stand out. It automatically unblurs 0.5s after the last PNG disappears. DO NOT TRY TO MANAGE BLUR MANUALLY.

### Timing & Sequence Control
As an AI designer, you have complete freedom over the pacing and sequencing:
- **FPS Standard**: The video runs at **30 frames per second (fps)**. Therefore, `30` frames equal exactly `1` second.
- **Dynamic Video Duration**: The total video duration is dynamically calculated based on the sum of the `durationInFrames` of all steps across all timeline events, plus an initial 15-frame intro/pre-delay (frames 0 to 14) before the first event starts. There is no hardcoded limit.
- **Event Pacing**: The duration of each timeline event is the sum of the `durationInFrames` of all its steps. Path drawing and state highlighting are calculated dynamically to coordinate with these durations.
- **Custom Sequences**: You can define any step sequence inside any state (e.g., `image` -> `png` -> `image` -> `png` or just a single `image` step).
- **Fallbacks**: If you do not define a `steps` array for a timeline event, it falls back to a default PNG overlay step of 80 frames using the root `image` property.

## Configuration Schema

```json
{
  "country": "india",
  "timeline": [
    {
      "stateId": "INGJ",
      "year": "2024",
      "title": "Gujarat Industrial Surge",
      "description": "Massive scaling of manufacturing infrastructure.",
      "steps": [
        {
          "mode": "image",
          "image": "https://picsum.photos/id/43/1080/1350",
          "durationInFrames": 60
        },
        {
          "mode": "png",
          "pngs": [
            {
              "id": "modi-gujarat",
              "image": "modi.png"
            }
          ],
          "durationInFrames": 80
        }
      ]
    }
  ],
  "smartTextSegments": [ ... ],
  "smartTextTheme": { "textFontSize": 45, "numberFontSize": 80 },
  "theme": {
    "mapColor": "#E2E8F0",
    "highlightColor": "#EB6F2D",
    "pathColor": "#EB6F2D",
    "backgroundColor": "#FAF9F6",
    "gridColor": "rgba(30, 27, 24, 0.12)",
    "textColor": "#0F172A"
  }
}
```

### Segment Types (for `smartTextSegments`)

**TextSegment**:
```json
{
  "type": "text",
  "value": "INDIA'S MANUFACTURING POWERHOUSES",
  "style": "bold", // "normal" | "bold" | "italic" | "serif" | "italic-serif" | "cursive"
  "case": "uppercase", // "original" | "uppercase" | "lowercase" | "title"
  "color": "#0F172A",
  "emphasis": "marker", // "none" | "marker" | "underline" | "box" | "textColor"
  "emphasisColor": "rgba(235, 111, 45, 0.15)",
  "animation": "slideUp", // "fadeUp" | "wordReveal" | "scaleIn" | "slideUp" | "none"
  "lineBreak": true
}
```

**NumberSegment**:
```json
{
  "type": "number",
  "value": 24,
  "prefix": "+",
  "suffix": "%",
  "decimals": 0,
  "format": "normal", // "normal" | "comma" | "compact" | "currency" | "percentage"
  "animation": "countUp", // "countUp" | "pop" | "static"
  "color": "#10B981"
}
```

**Your Goal**: Design high-quality map animations by sequencing timeline state steps, controlling slide transitions, image cover alignments, background blurs, and adding global smart text segments.
