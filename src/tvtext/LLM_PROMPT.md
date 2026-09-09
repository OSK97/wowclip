# LLM Guide — TvText Animation (Captions)

This template shows a retro TV playing a video with dynamic, word-by-word captions underneath.
You are responsible for taking the speaker's voiceover timeline and mapping it into the `tvtext-config.json` file.

## CRITICAL: Video Framerate (24 FPS)
All timings MUST be based on exactly **24 frames per second**. 
- 1 Second = 24 frames
- 2 Seconds = 48 frames
- 3 Seconds = 72 frames

## JSON Properties

### 1. `media`
- `src`: The background video/image path (e.g., `tvtext_assets/final_result.mp4`).
- `objectFit`: Use `"contain"` so the video fits on the screen without stretching or being cut off, or `"cover"` if you want it to fill the screen completely (can crop edges). 
- *Note:* Try to select landscape videos for the TV to prevent black bars, but if a portrait video is requested, use `"contain"`.

### 2. `captions`
This is an array of segments. You must map each word (or small phrase) to an absolute `startFrame`.

#### Caption Constraints (2-Line Maximum)
Captions should not exceed 2 lines on the screen at a time.
- **Top Line:** Maximum ~22 characters (including spaces).
- **Bottom Line:** Maximum ~12 characters (including spaces).
- If the text goes over this limit, use the `lineBreak: true` property on a segment to force a new line.
- If you exceed both lines, you must clear the screen (by controlling the overall video composition or splitting into separate compositions).

#### Absolute Timestamps
You have **word-level absolute timestamp control**. If the speaker pauses, the words should pause! 
You control this by explicitly setting the `startFrame` for every single segment in the `captions` array.

#### Example Segment
```json
{ 
  "type": "text", 
  "value": "Desh", 
  "startFrame": 24 
}
```
If the speaker waits 2 seconds before saying the next word, the next segment should be:
```json
{ 
  "type": "text", 
  "value": "ma", 
  "startFrame": 72 
}
```

#### Animations & Styling
- You can mix `"text"` and `"number"` types.
- Numbers can have `"format": "percentage"` and `"animation": "pop"`.
- Text can have `"emphasis": "underline"` or `"emphasis": "marker"`.
- Use colors like `"blue"`, `"rose"`, `"amber"` to highlight keywords!
