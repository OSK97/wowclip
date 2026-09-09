# Calendar Animation JSON Configuration Guide

This guide explains how to generate the `calendar.config.json` to control the calendar animation sequence.

## Timing Rules (24 FPS)

The animation runs at **24 frames per second**. You have full control over the sequence of events by defining the start frames. The durations of the animations themselves are fixed to ensure they are always smooth and undistorted, but you can control the delays between them and the total length of the scene.

### 1. Initial Buffer
- **Mandatory Buffer:** You MUST leave at least a 1-second buffer (24 frames) at the beginning of the video for the calendar to animate into the frame and settle.
- Therefore, the earliest you can start the "mark" animation is `frame 24`.

### 2. Timings Object
You must provide a `timings` object in the JSON with the following keys:
- `zoomStartFrame` (number): The frame when the camera starts zooming into the marked date and the circle begins drawing. This animation takes 36 frames (1.5 seconds). Minimum value: `24`.
- `diveStartFrame` (number): The frame when the cinematic portal window opens. This animation takes 48 frames (2 seconds). Must be strictly after the zoom completes (`zoomStartFrame + 36`).
- `totalDurationInFrames` (number): The total duration of the scene in frames. Must be large enough to let the dive finish (`diveStartFrame + 48`) plus any ending buffer you want.

### 3. Days Array
You must manage the dates of the month! A month doesn't always have 31 days. For example, February might have 28 days.
- Provide a `days` array containing 35 (or 42) objects with `{ "value": number, "isCurrentMonth": boolean }`.
- Ensure correct padding for the days of the week from the previous and next months so the 1st starts on the correct weekday.

## Example JSON

```json
{
  "month": "Feb",
  "year": "2026",
  "highlightedDate": 1,
  "timings": {
    "zoomStartFrame": 96,
    "diveStartFrame": 160,
    "totalDurationInFrames": 260
  },
  "days": [
    { "value": 28, "isCurrentMonth": false },
    { "value": 29, "isCurrentMonth": false },
    { "value": 30, "isCurrentMonth": false },
    { "value": 31, "isCurrentMonth": false },
    { "value": 1, "isCurrentMonth": true },
    { "value": 2, "isCurrentMonth": true }
  ]
}
```
