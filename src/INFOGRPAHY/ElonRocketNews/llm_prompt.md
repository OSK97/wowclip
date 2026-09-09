# PersonNewsOverlay (ElonRocketNews) — LLM Configuration Guide

You are generating a JSON config for the `PersonNewsOverlay` animation. This animation is used when a **specific person is mentioned** in the clip — it shows their photo with a contextual background, then reveals a news headline and description about them.

## When to Use

Use this animation when:
- A person is **named or referenced** in the video clip (e.g., "Modi said...", "Elon Musk announced...")
- You want to show the person's photo with a related background image (e.g., party logo, company logo)
- There is a **related news story** to display alongside the person's image

Do NOT use this for abstract concepts, data visualizations, or when no specific person is referenced.

---

## Animation Flow

1. **Phase 1 — Person Photo** (frames 0 → `newsAppearFrame`): The person's photo fills the lower portion of the screen over a blurred background image. Cinematic fade-in.
2. **Phase 2 — News Reveal** (frames `newsAppearFrame` → end): The photo shrinks upward, and the news headline + description slide in from the top. Optional word-by-word highlighting syncs with the speaker's narration.
3. **Phase 3 — Hold & Fade** (last ~1 second): Animation holds the final state, then fades out.

---

## Timing Rules (CRITICAL)

Remotion runs at **30 fps** (1 second = 30 frames).

### Minimum Timing Requirements
| Phase | Minimum Duration | Reason |
|---|---|---|
| Photo display before news | **1.5 seconds** (45 frames) | Viewer needs time to recognize the person |
| News visible on screen | **2.0 seconds** (60 frames) | Reader needs time to process the headline |
| Overall animation | **4.0 seconds** (120 frames) | Prevents flash-card effect |

### Buffer Rules
- The animation **auto-enforces** these minimums. If you set `newsAppearFrame: 10`, it will be bumped to `45`.
- Always leave **1 second** of hold time at the end before the video ends.
- Calculate `newsAppearFrame` from the audio timestamp: `newsAppearFrame = timestamp_seconds * 30`.

---

## Configuration Schema

```json
{
  "publisher": "NEWS OUTLET NAME",
  "topic": "CATEGORY",
  "dateStr": "Month DD, YYYY",
  "headline": "The Main News Headline Text",
  "description": "A longer description paragraph that provides context about the news story.",
  "upfrontImage": "path/to/person-photo.png",
  "backgroundImage": "path/to/context-background.jpg",
  "durationInSeconds": 10,
  "timing": {
    "newsAppearFrame": 60,
    "photoShrinkDuration": 20,
    "initialPhotoHeight": 65,
    "targetPhotoHeight": 45
  },
  "script": {
    "instructions": [
      {
        "target": "description",
        "startFrame": 90,
        "endFrame": 160,
        "fromWord": 16,
        "toWord": 29,
        "cameraMode": "wide"
      }
    ]
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `publisher` | string | No | News outlet name (displayed top-left). Auto-sizes for long names. |
| `topic` | string | No | Category label (displayed top-right, e.g., "POLITICS", "TECH") |
| `dateStr` | string | No | Date string shown below description |
| `headline` | string | **Yes** | Main headline text. Keep under 80 characters for best readability. |
| `description` | string | **Yes** | Extended description. Can be 1-3 sentences. |
| `upfrontImage` | string | No | Path to the person's photo (PNG with transparency works best) |
| `backgroundImage` | string | No | Path to contextual background (party logo, company HQ, etc.) |
| `durationInSeconds` | number | **Yes** | Total animation duration in seconds. Minimum: 4 seconds. |
| `logoUrl` | string | No | URL/path to publisher's logo (replaces text publisher name) |

### Timing Object

| Field | Default | Description |
|---|---|---|
| `newsAppearFrame` | 60 | Frame when news section appears (min: 45 frames / 1.5s) |
| `photoShrinkDuration` | 20 | Frames for photo shrink transition (min: 10) |
| `initialPhotoHeight` | 65 | Photo height % before shrinking |
| `targetPhotoHeight` | 45 | Photo height % after shrinking |

### Script Instructions (Word Highlighting)

The `script.instructions` array controls word-by-word highlighting that syncs with the speaker's narration:

| Field | Description |
|---|---|
| `target` | Which text to highlight: `"headline"` or `"description"` |
| `startFrame` | Frame to start highlighting |
| `endFrame` | Frame to end highlighting |
| `fromWord` | Starting word index (0-based) |
| `toWord` | Ending word index (exclusive) |

---

## Example: Political Figure

```json
{
  "publisher": "BHARAT NEWS",
  "topic": "POLITICS",
  "dateStr": "Sep 4, 2026",
  "headline": "PM Modi Announces Major Economic Reform",
  "description": "Prime Minister Narendra Modi announced a sweeping economic reform package aimed at boosting manufacturing and creating 10 million new jobs over the next five years.",
  "upfrontImage": "assets/modi.png",
  "backgroundImage": "assets/bjp-flag.jpg",
  "durationInSeconds": 10,
  "timing": {
    "newsAppearFrame": 60,
    "photoShrinkDuration": 20,
    "initialPhotoHeight": 65,
    "targetPhotoHeight": 45
  },
  "script": {
    "instructions": [
      {
        "target": "description",
        "startFrame": 90,
        "endFrame": 180,
        "fromWord": 0,
        "toWord": 15,
        "cameraMode": "wide"
      }
    ]
  }
}
```

## Prompt Design Rules

1. **Always set `durationInSeconds`** — this is the primary duration control.
2. **Calculate `newsAppearFrame`** from the audio: when does the speaker START talking about the news? That's your `newsAppearFrame`.
3. **Keep headlines short** — under 80 characters. Long headlines wrap awkwardly.
4. **Keep descriptions to 1-3 sentences** — this isn't an article, it's a visual summary.
5. **Match background to person** — if talking about a politician, use their party's imagery. For a CEO, use their company's branding.
