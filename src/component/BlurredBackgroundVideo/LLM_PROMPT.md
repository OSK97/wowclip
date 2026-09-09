# LLM Guide — BlurredBackgroundVideo

This guide explains how you (the LLM) should convert a voiceover narration into the `blurred-video.json` configuration file. 
This template is used to **introduce a person, place, or object** (like a Car, a CEO, a City). It uses a dynamic cutout over a blurred background.

## CRITICAL: Video Framerate (24 FPS)

The video runs at exactly **24 frames per second**. 
You are fully responsible for calculating the precise frames (`cutoutEnterFrame`, `textEnterFrame`, `cutoutExitFrame`) based on the speaker's audio timeline.

- 1 Second = 24 frames
- 2 Seconds = 48 frames
- 3 Seconds = 72 frames
- 4.5 Seconds = 108 frames

If the speaker says the person's name at exactly 2.5 seconds into the video, then the text should appear at frame `60` (2.5 * 24).

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

```json
{
  "theme": {
    "backgroundImage": "path/to/background.jpg",
    "cutoutImage": "path/to/cutout.png"
  },
  "timing": {
    "cutoutEnterFrame": 15,
    "textEnterFrame": 50
  },
  "text": {
    "line1": "ELON",
    "line2": "MUSK",
    "line3": "FOUNDER"
  }
}
```

---

## JSON Properties

### 1. `theme`
This controls the visual assets. You must choose images that fit the context. If introducing a Car, the background should be a Garage or a Road.
- `backgroundImage`: The absolute URL or Remotion `staticFile` path to the background image. (It will be automatically blurred).
- `cutoutImage`: The absolute URL or Remotion `staticFile` path to the subject. This MUST be a transparent PNG cutout.

### 2. `timing` (The Timeline)
You have absolute control over the timeline. You must synchronize this perfectly with the voiceover!
- `cutoutEnterFrame`: When the main subject (cutout) slides up onto the screen. Usually happens slightly before or exactly when they are mentioned.
- `textEnterFrame`: When the massive text (name) fades in. It can happen *after* the cutout enters for dramatic suspense. (Note: The cutout will automatically slide down slightly exactly when the text enters to make room).

### 3. `text`
The massive, glowing text that appears behind the subject. It auto-scales.
- `line1`: (Required) The main word (e.g. "ELON", "FERRARI").
- `line2`: (Optional) Can be left empty `""`. Second word (e.g. "MUSK").
- `line3`: (Optional) A glowing, golden subtitle below the name (e.g. "CEO", "V8 ENGINE").

---

## Timing Examples & Strategy

**Example 1: The Suspense Reveal**
The speaker says: *"But there is one man... [pause]... Elon Musk."*
- `cutoutEnterFrame`: 24 (The man appears as "one man" is spoken).
- `textEnterFrame`: 72 (The name "ELON MUSK" slams onto the screen during the pause).

**Example 2: The Object Showcase**
The speaker says: *"Enter the Porsche 911 GT3."*
- `cutoutEnterFrame`: 10 (The car slides up almost immediately).
- `textEnterFrame`: 15 (The text fades in right as the car stops moving).
