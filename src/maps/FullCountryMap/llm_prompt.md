# LLM System Prompt & Dynamic Control Specification: FullCountryMap

## Overview
`FullCountryMap` is a specialized broadcast-grade video generation engine designed for Remotion.
It treats an entire country map (e.g., India or any supported country SVG) as **one unified vector silhouette** without inner state boundaries.

---

## Key Features
1. **Unified Silhouette Masking**: No inner state lines. The entire country acts as a single vector canvas.
2. **Step Modes**:
   - `color`: Fills the entire country silhouette with a custom solid color (e.g., `#EF4444`, `#F97316`).
   - `image`: Crops a background image (e.g., party flag, landscape, texture) strictly inside the entire country outline.
   - `png`: Pops out 3D leader/person PNG overlays (e.g., Narendra Modi, ISRO rockets) with spring physics centered on the country silhouette.
   - `smart_text`: Displays animated broadcast badge subtitles and text cards.
3. **Dynamic Frame Control**: Total video duration and individual step timing (`startFrame`, `durationInFrames`) are controlled entirely via `config.json`.

---

## Dynamic JSON Schema (`config.json`)

```json
{
  "durationInSeconds": 8,
  "country": "india",
  "displayName": "India",
  "theme": {
    "countryColor": "#EF4444",
    "backgroundColor": "#FAF9F6",
    "gridColor": "rgba(30, 27, 24, 0.12)",
    "textColor": "#0F172A"
  },
  "steps": [
    {
      "mode": "color",
      "color": "#EF4444",
      "startFrame": 0,
      "durationInFrames": 60
    },
    {
      "mode": "image",
      "image": "Documnetry_Info_assets/bjp.jpg",
      "startFrame": 60,
      "durationInFrames": 60
    },
    {
      "mode": "png",
      "pngs": [
        {
          "id": "modi-full-country",
          "image": "modi.png",
          "scale": 0.85
        }
      ],
      "startFrame": 120,
      "durationInFrames": 60
    },
    {
      "mode": "smart_text",
      "startFrame": 180,
      "durationInFrames": 60,
      "smartTextSegments": [
        { "type": "highlight", "value": "BHARAT" },
        { "type": "text", "value": "Fastest Growing Economy" }
      ],
      "smartTextTheme": {
        "badgeBg": "#F97316",
        "badgeText": "#FFFFFF"
      }
    }
  ]
}
```

---

## Rules for LLM Video Generators
1. **Frames Calculation**: `FPS = 30`. Multiply target seconds by 30 to get `durationInFrames` (e.g., 2 seconds = 60 frames).
2. **Country Selection**: Supported country SVG keys under `public/maps/countries/` (e.g., `"india"`).
3. **Image Paths**: Use relative paths from `public/` (e.g., `"Documnetry_Info_assets/bjp.jpg"`, `"modi.png"`).
4. **Step Sequences**: Chain multiple steps in `steps` array to create dynamic multi-stage storytelling sequences.
