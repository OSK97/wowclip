# LLM Showcase Card Guide — ShowcaseCard

This guide explains how an LLM should convert custom content or scripts into the `showcase-card.json` format for the **ShowcaseCard** Remotion component.

---

## Output Format

Output **only** valid JSON. No markdown, no code fences, no commentary.

The top-level structure:

```json
{
  "composition": { ... },
  "background": { ... },
  "floating": { ... },
  "image": { ... },
  "text": { ... }
}
```

All blocks are optional. Omit any property or block to fall back to default values.

---

## Composition Block

Controls video dimensions and frame-rate parameters.

```json
{
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "durationSeconds": 5
  }
}
```

| Field             | Type   | Default | Description                    |
| ----------------- | ------ | ------- | ------------------------------ |
| `width`           | number | `1080`  | Video width in pixels          |
| `height`          | number | `1920`  | Video height in pixels         |
| `fps`             | number | `60`    | Frames per second              |
| `durationSeconds` | number | `5`     | Total video duration (seconds) |

---

## Background Block

Controls background colors, gradients, moving grid overlay, and pulsing glowing orbs.

```json
{
  "background": {
    "backgroundColor": "#f0f4ff",
    "backgroundGradient": "radial-gradient(ellipse at 50% 30%, #ffffff 0%, #e8eeff 40%, #dbe4ff 70%, #c7d4f5 100%)",
    "showGrid": true,
    "gridColor": "rgba(59, 130, 246, 0.04)",
    "gridSize": 50,
    "gridOpacity": 1,
    "showOrbs": true,
    "orb1Color": "rgba(59, 130, 246, 0.08)",
    "orb2Color": "rgba(99, 102, 241, 0.06)",
    "orb3Color": "rgba(147, 197, 253, 0.1)"
  }
}
```

| Field                | Type    | Default | Description                                                     |
| -------------------- | ------- | ------- | --------------------------------------------------------------- |
| `backgroundColor`    | string  | `"#f0f4ff"` | Solid background color fallback.                                |
| `backgroundGradient` | string  | `"radial-gradient(...)"` | Premium CSS radial or linear gradient for background. |
| `showGrid`           | boolean | `true`  | Show/hide a moving dot grid structure.                         |
| `gridColor`          | string  | `"rgba(59, 130, 246, 0.04)"` | Color of grid dots.                                             |
| `gridSize`           | number  | `50`    | Spacing between grid dots in pixels.                            |
| `gridOpacity`        | number  | `1`     | Opacity of grid lines (0 to 1).                                 |
| `showOrbs`           | boolean | `true`  | Enable floating, blurred light orbs in the background.          |
| `orb1Color`          | string  | `"rgba(59, 130, 246, 0.08)"` | Color of the top-left floating orb.                             |
| `orb2Color`          | string  | `"rgba(99, 102, 241, 0.06)"` | Color of the bottom-right floating orb.                         |
| `orb3Color`          | string  | `"rgba(147, 197, 253, 0.1)"` | Color of the center floating orb.                               |

---

## Floating Block

Controls the slow organic float and tilt swim animation of the entire composition container.

```json
{
  "floating": {
    "enable": true,
    "floatAmplitudeY": 12,
    "floatFrequencyY": 0.05,
    "rotateAmplitude": 1.5,
    "rotateFrequency": 0.03
  }
}
```

| Field             | Type    | Default | Description                                             |
| ----------------- | ------- | ------- | ------------------------------------------------------- |
| `enable`          | boolean | `true`  | Turn floating on/off.                                   |
| `floatAmplitudeY` | number  | `12`    | Vertical translation magnitude in px.                   |
| `floatFrequencyY` | number  | `0.05`  | Speed coefficient of the vertical float.                |
| `rotateAmplitude` | number  | `1.5`   | Rotational angle magnitude in degrees.                  |
| `rotateFrequency` | number  | `0.03`  | Speed coefficient of the rotational swing.              |

---

## Image Block

Controls the showcase image sizing, layout constraints, shadows, and entry animations.

```json
{
  "image": {
    "src": "Components/iphone.png",
    "heightPercent": 0.75,
    "marginTop": 80,
    "marginSide": 60,
    "borderRadius": 24,
    "objectFit": "contain",
    "showShadow": true,
    "shadowColor": "rgba(30, 64, 175, 0.18)",
    "shadowBlur": 60,
    "entranceType": "springUp",
    "entranceDelay": 0
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `src` | string | `"Components/iphone.png"` | Path or URL to the showcase image (local files in `public/` folder, or remote URLs). |
| `heightPercent` | number | `0.75` | The height percentage (0.0 to 1.0) of the composition reserved for the image area. |
| `marginTop` | number | `80` | Margin between the top of the canvas and the image area. |
| `marginSide` | number | `60` | Side margins constraining the maximum width of the image area. |
| `borderRadius` | number | `24` | Border radius in pixels for the image corners. |
| `objectFit` | string | `"contain"` | Image scaling mode: `"contain"`, `"cover"`, or `"fill"`. |
| `showShadow` | boolean | `true` | Show/hide shadow underneath the image. |
| `shadowColor` | string | `"rgba(30, 64, 175, 0.18)"` | Shadow backdrop color. |
| `shadowBlur` | number | `60` | Blur radius of the shadow in pixels. |
| `entranceType` | string | `"springUp"` | Image entrance style: `"springUp"`, `"fadeIn"`, `"scaleIn"`, `"slideDown"`, `"none"`. |
| `entranceDelay` | number | `0` | Delay in frames before the image begins its entrance. |

---

## Text Block

Controls typography, margins, alignment, and staggered word entrance animations. By default, the text container is dynamically attached directly below the bottom of the rendered photo and horizontally centered relative to the photo width.

```json
{
  "text": {
    "value": "iPhone 16 Pro Max",
    "fontFamily": "Inter",
    "fontSize": 64,
    "fontWeight": 800,
    "color": "#0f172a",
    "textAlign": "center",
    "letterSpacing": -1,
    "lineHeight": 1.2,
    "marginTop": 40,
    "marginSide": 60,
    "entranceDelay": 15,
    "staggerFrames": 5
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `value` | string | `"iPhone 16 Pro Max"` | Text label / copy to render below the image area. |
| `fontFamily` | string | `"Inter"` | Font family to use: `"Inter"`, `"Outfit"`, `"Playfair"`, `"Montserrat"`, or `"DancingScript"`. |
| `fontSize` | number | `64` | Font size in px. |
| `fontWeight` | number | `800` | Font weight (e.g. `400`, `500`, `600`, `700`, `800`, `900`). |
| `color` | string | `"#0f172a"` | Color of the text. |
| `textAlign` | string | `"center"` | Alignment of the text inside the image width bounding box: `"left"`, `"center"`, `"right"`. |
| `letterSpacing` | number | `-1` | Character letter spacing adjustments. |
| `lineHeight` | number | `1.2` | CSS line height factor. |
| `marginTop` | number | `40` | Padding distance separating the image area from the text. |
| `marginSide` | number | `60` | Side margin boundary for the text box. |
| `entranceDelay` | number | `15` | Delay in frames before the first word animates. |
| `staggerFrames` | number | `5` | Delay in frames between each word's spring entrance animation. |

---

## Styling Guidelines

### DO
- ✅ Use high-quality image paths or remote links.
- ✅ Match the background design gradient to the colors of the image for a premium, integrated look.
- ✅ Choose cohesive font families: use `"Montserrat"` for modern geometric headlines or `"DancingScript"` for cursive statements.
- ✅ Stagger the entrance delay to allow the image to enter first (`entranceDelay: 0`), followed by the text words starting at `15` frames.

### DO NOT
- ❌ Do not write extremely long text strings that might wrap and bleed off the bottom edges of portrait templates.
- ❌ Do not match high-contrast background shades that conflict with text colors (always ensure strong readability).
- ❌ Do not use non-imported Google Font families (only `"Inter"`, `"Outfit"`, `"Playfair"`, `"Montserrat"`, and `"DancingScript"` are supported).
