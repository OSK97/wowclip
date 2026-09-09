# LargeNumber LLM Integration Guide

You are an LLM generating JSON configuration for the `LargeNumber` animation component in Remotion. This guide explains how this component visually feels, its text constraints, and how to control its timings to sync perfectly with a spoken transcript.

## Visual Aesthetic & Constraints

This component creates a **premium, highly-impactful 3D-styled typographic animation**. It consists of three visual layers stacked vertically:
1. **Top Text**: Clean, spaced-out sans-serif (Montserrat).
2. **The Number**: Massive, bold, punchy central element with drop shadows (Inter).
3. **Bottom Text**: An elegant cursive font (Dancing Script).

> [!CAUTION]
> **TEXT LENGTH WARNING**
> This component is designed EXCLUSIVELY for **short, punchy headings**. 
> - **Top Text**: 1 to 5 words max.
> - **Bottom Text**: 1 to 5 words max.
> Do NOT pass long sentences or descriptive paragraphs. If you provide a long description, the text will scale down so drastically that it will look incredibly cheap, ugly, and unreadable. If you need to convey a lot of information, use a different component or rely on the voiceover.

## Global Timing & Visibility Toggles

- **Total Duration**: You must specify `durationInSeconds` at the root level of the JSON. This tells the video builder exactly how long this scene should stay on screen.
- Sometimes you just want to emphasize a single metric. You can hide the upper or lower text completely using toggles. The number itself is compulsory.

```json
"durationInSeconds": 6,
"content": {
  "showTopText": false, 
  "topText": "", // Will be ignored
  "prefix": "$",
  "number": 215938,
  "suffix": "M",
  "showBottomText": true,
  "bottomText": "Record Revenue"
}
```

## Animation Styles & Timings

You have absolute control over how the text enters the screen using the `animation` block.

```json
"animation": {
  "topText": {
    "style": "word-by-word-fade",
    "startFrame": 10,
    "staggerFrames": 5
  },
  "number": {
    "startFrame": 45,
    "durationFrames": 40
  },
  "bottomText": {
    "style": "line-slide-up",
    "startFrame": 95,
    "staggerFrames": 0
  }
}
```

### Style Options
You must choose one of the following for `style`:
- `"word-by-word-fade"`: Words smoothly fade in one after another. Best for syncing directly to the speaker saying the phrase.
- `"word-by-word-slide-up"`: Words slide up from below with motion blur. Very punchy and energetic.
- `"line-fade"`: The entire line of text fades in at the exact same moment.
- `"line-slide-up"`: The entire line of text slides up in one solid block.

### Synchronizing with Transcripts
Remotion runs at **30 frames per second (fps)**.
- If the speaker says the top text 1.5 seconds into the video, set `startFrame` to `45` (1.5 * 30).
- If they speak slowly, increase `staggerFrames` (e.g. `10` or `15` frames between each word).
- If they speak quickly, decrease `staggerFrames` (e.g. `3` or `5`).
- If you select a `line-*` style, `staggerFrames` is ignored because the entire line appears at `startFrame`.

### The Number Count-Up
The number uses a high-energy count-up animation (like a slot machine).
- `startFrame`: When the count-up begins.
- `durationFrames`: How fast the counter reaches the final value. A short duration (e.g. `20`) is extremely fast and aggressive. A long duration (e.g. `60`) is suspenseful.

### Background and Colors
You can fully control the background via the `theme` object.
- `backgroundColor` / `backgroundGradient`: Set the tone (dark mode, vibrant colors, etc.).
- `accentColor`: This is the color applied to the `prefix` (e.g., "$") and `suffix` (e.g., "M"). Make sure it contrasts well with the text and background.
