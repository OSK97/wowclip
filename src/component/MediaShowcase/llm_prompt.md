# MediaShowcase — LLM Configuration Guide

You generate a JSON configuration for the `MediaShowcase` component in Remotion (1080×1920 portrait aspect ratio, 30 fps, 10 seconds default duration).

This component creates a **minimalist, calm, high-end Instagram Reel showcase**:
- **Background Video**: Runs your background video (`planner_bg.mp4` or external URL) with an aesthetic overlay (`whiteOverlayOpacity` or `overlayOpacity`).
- **Foreground Spotlight Image**: A clean image card styled with a soft multi-layered studio shadow and spring physics entrance.
- **Kinetic Diagonal Clip-Path Typography**: Title lines reveal sequentially with a dynamic angled polygon clip-path slice and vertical slide.
- **Guaranteed Animation Hierarchy**: Headline lines reveal line-by-line first; the description / subtitle appears strictly *after* the headline is fully delivered.
- **Accent Color**: The final headline line (or selected line) highlights in a striking accent color for maximum visual impact.

---

## JSON Schema Example

```json
{
  "fps": 30,
  "durationInSeconds": 10,
  "backgroundVideo": "planner_bg.mp4",
  "whiteOverlayOpacity": 0.55,
  "image": {
    "url": "book_cover.jpg",
    "width": 380,
    "borderRadius": 20
  },
  "text": {
    "titleLines": [
      "LESSONS IN",
      "CHEMISTRY"
    ],
    "description": "A novel by Bonnie Garmus",
    "titleColor": "#0F172A",
    "accentColor": "#E11D48",
    "descriptionColor": "#475569",
    "titleFontSize": 74,
    "descriptionFontSize": 30,
    "textTransform": "uppercase"
  }
}
```

---

## Parameter Fields

1. **`backgroundVideo`** *(string)*: MP4 video filename in `/public` or external video URL (default `"planner_bg.mp4"`).
2. **`whiteOverlayOpacity`** *(number)*: Opacity of the bright overlay gradient (default `0.55`).
3. **`image`**:
   - `url` *(string)*: Spotlight image URL or filename.
   - `width` *(number)*: Card width in px (default `380`, max `75vw`).
   - `borderRadius` *(number)*: Corner rounding in px (default `20`).
4. **`text`**:
   - `titleLines` *(string[])*: Array of headline lines revealed sequentially with kinetic diagonal slice (e.g. `["LESSONS IN", "CHEMISTRY"]` or `["Hi, nice", "to see", "you here"]`).
   - `title` *(string, optional)*: Single string fallback if `titleLines` is not provided.
   - `description` *(string)*: Supporting description sentence right below the title.
   - `titleColor` *(string)*: Primary color for the headline (`#0F172A` in light mode, `#FFFFFF` in dark mode).
   - `accentColor` *(string)*: Vibrant accent color for the highlighted headline line (defaults to `#E11D48` or `#FFE221`).
   - `accentLineIndex` *(number, optional)*: Zero-based index of the line that receives the accent color (defaults to the last line).
   - `descriptionColor` *(string)*: CSS color for description (`#475569` or `rgba(255, 255, 255, 0.82)`).
   - `titleFontSize` *(number)*: Headline font size in px (default `72`–`74`).
   - `descriptionFontSize` *(number)*: Subtitle font size in px (default `30`–`32`).
   - `textTransform` *(string)*: `"uppercase"` (default), `"none"`, or `"capitalize"`.
   - `titleStartFrame` *(number, optional)*: Frame at which title entrance begins (default `12`).
   - `titleStaggerFrames` *(number, optional)*: Gap in frames between consecutive title lines (default `10`).
   - `descriptionStartFrame` *(number, optional)*: Frame for description entrance (automatically defaults to 10 frames after title finishes).
   - `exitAnimation` *(boolean, optional)*: Whether to play a diagonal slice exit in the final seconds (default `false`).
