# LLM Portrait Animation Guide — PortraitAnimation

This guide explains how an LLM should convert custom content or scripts into the `portrait-animation.json` format for the **PortraitAnimation** Remotion component.

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

The top-level structure:

```json
{
  "composition": { ... },
  "background": { ... },
  "floating": { ... },
  "avatar": { ... },
  "text": { ... }
}
```

All blocks are optional. Omit any property or block to fall back to default values.

---

## Composition Block

Controls the total duration of the animation.

```json
{
  "composition": {
    "durationSeconds": 5
  }
}
```

| Field             | Type   | Default | Description                    |
| ----------------- | ------ | ------- | ------------------------------ |
| `durationSeconds` | number | `5`     | Total video duration (seconds). **Must be calculated dynamically.** |

### ⚠️ DURATION CALCULATION RULES ⚠️
You MUST calculate the `durationSeconds` to ensure the animation finishes correctly without cutting off:
1. **Base Entrance Time:** The portrait image takes about `1` second to slide up.
2. **Text Entrance Time:** 
   - If `text.animationMode` is `"fade"`, text takes `0.5` seconds.
   - If `text.animationMode` is `"word-level"`, the text stagger takes `~0.16` seconds per word + `0.5` seconds fade. (e.g. 4 words = `0.64s + 0.5s = 1.14s`).
3. **MANDATORY PAUSE:** You **MUST** add exactly `1` second of empty pause at the end of the animation after all entrances finish so the user can read the final frame.
*Example (4 word name, word-level mode):* `1s (image) + 1.14s (text) + 1s (pause) = 3.14s`. Round up to `4` or `5` seconds to be safe. Never output durations that are too low.

---

## Background Block

Controls background colors, gradients, grids, and lighting highlights.

```json
{
  "background": {
    "backgroundColor": "#ffffff",
    "backgroundGradient": "radial-gradient(circle at 50% 50%, #ffffff 20%, #e2e8f0 70%, #cbd5e1 100%)",
    "showGrid": true,
    "gridLineColor": "rgba(15, 23, 42, 0.02)",
    "gridSize": 60,
    "showSpotlight": true,
    "spotlightColor": "rgba(15, 23, 42, 0.06)"
  }
}
```

---

## Avatar Block

Controls the central image circular masking, borders, glow rings, and Ken Burns camera animation.

```json
{
  "avatar": {
    "imagePath": "modi.png",
    "circleBg": "radial-gradient(circle at 50% 30%, #1e3a8a 0%, #0f172a 100%)",
    "glowColor": "rgba(56, 189, 248, 0.25)",
    "glowColorOuter": "rgba(30, 58, 138, 0)",
    "borderColor": "#1e40af",
    "borderWidth": 10
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `imagePath` | string | `"modi.png"` | Path or URL to the avatar image (local files in `public/` folder). Default is `modi.png`. |
| `circleBg` | string | `"radial-gradient(...)"` | Base background color/gradient inside the circle. |
| `glowColor` | string | `"rgba(56, 189, 248, 0.25)"` | Inner glow color behind the circle. |
| `borderColor` | string | `"#1e40af"` | Primary border color overlaying the circle. |

---

## Text Block

Controls typography, dynamic slide-up entrances, and text string constraints.

```json
{
  "text": {
    "value": "Narendra Damodardas Modi",
    "fontFamily": "Outfit",
    "animationMode": "word-level",
    "color": "#1e40af",
    "textTransform": "uppercase"
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `value` | string | `"Narendra Damodardas Modi"` | The name or headline text. **Max 5-6 words, ideally 3-4 words.** If 1 word, provide just the name. Do NOT use long sentences. |
| `animationMode` | string | `"word-level"` | Entrance style: `"fade"` (fades entire block simultaneously) or `"word-level"` (words slide up one-by-one with timestamps). |
| `color` | string | `"#1e40af"` | Solid text color. **CRITICAL:** Ensure this perfectly matches the theme of `circleBg` and `borderColor` while remaining readable. |

---

### 🎨 COLOR STRATEGY (CRITICAL)
To ensure the animation always looks premium and highly readable, **you must follow this exact color hierarchy**:
1. **Background (`background.backgroundColor` & `background.backgroundGradient`)**: Generally use **light colors** (e.g., whites, light grays, soft cool/warm off-whites). This makes the central circle pop.
2. **Circle Background (`avatar.circleBg`)**: Use **dark colors with black shades** (e.g., dark navy, deep slate, dark rich accents fading to black). This creates intense contrast with the light background.
3. **Border & Glow (`avatar.borderColor`, `avatar.glowColor`)**: Use a vibrant accent color (e.g., bright amber, electric blue, neon green).
4. **Text Color (`text.color`)**: **WARNING**: Do NOT just blindly use the same bright color as the border. Because the background is light, a bright/light text color will be unreadable! Choose a **dark or intensely saturated color** that complements the border but maintains extremely high contrast against the light background.

### DO
- ✅ Keep `value` concise: **1–4 words fit best**.
- ✅ Match the background design mood to the text topic, but keep the overall canvas light.
- ✅ Set `animationMode: "word-level"` for names with multiple words for a premium discovery effect, and `"fade"` for extremely short single-word brands.
- ✅ Ensure `durationSeconds` leaves a 1-second pause at the end!

### DO NOT
- ❌ Do not use extremely long text blocks (like addresses).
- ❌ Do not set a duration too low that cuts off the entrance animation.
- ❌ Do not make the text gradient the exact same color as the border if that color is too light to be read against the background!
