# LLM Guide — YearTimeline Overlay

This template overlays a 3D cylindrical Year timeline over the podcast video. 
It creates a cinematic time-travel effect as it scrolls from a `startYear` to a `targetYear`.

## JSON Properties (`year-timeline.json`)

### Timings (24 FPS)
- `scrollDelay`: How long to hold on the `startYear` before scrolling begins. Recommended: `30` frames (~1.25 seconds).
- `scrollDurationFrames`: How long the scroll animation takes to reach the target year.
  - **CRITICAL:** You must adjust the `scrollDurationFrames` based on the **gap** between the two years!
  - If the gap is small (e.g., 2020 to 2022), use a short duration like `48` frames.
  - If the gap is massive (e.g., 1990 to 2026), use a long duration like `144` frames so the animation doesn't look ridiculously fast.

### Theme
- `pinColor`: The color of the arrow pointing to the current year. You can customize this to match the brand or topic (e.g., `"#10b981"` for a financial timeline, `"#38bdf8"` for tech, `"#f97316"` for general).
- `highlightColor`: The color of the currently selected year in the center.

## Example Config
If the speaker says "Back in 2008, the market crashed... but fast forward to 2026", you would use:
```json
{
  "startYear": 2008,
  "targetYear": 2026,
  "scrollDelay": 30,
  "scrollDurationFrames": 120,
  "theme": {
    "pinColor": "#f43f5e"
  }
}
```
The engine automatically calculates the total video duration to include a 2-second buffer at the end so the user can read the target year before the video cuts!
