# Government Document Template - Production LLM Instructions

This template renders a highly realistic, classified "Government Document" and dynamically highlights specific word targets with an official yellow redaction marker while simulating a cinematic camera sweeping across the page.

---

## How It Works: The Center Register

To optimize tokens and composition rendering, the header metadata, classification markings, top boilerplate paragraphs, and bottom official sign-offs are pre-filled by the engine.

**You ONLY control the "Center Register" of the document** by supplying an array of `documentBlocks`.

### 1. Document Blocks & Formatting
Available block types for `documentBlocks`:
- `heading`: Centered, uppercase bold official typography.
- `normal`: Standard paragraph text, justified formatting.
- `bold`: Bold emphasis paragraph text.
- `spacer`: Emits a clean vertical section gap.
- `separator`: Renders a formal horizontal divider line.

Example:
```json
"documentBlocks": [
  { "type": "heading", "content": "SECTION IV: COMPLIANCE DIRECTIVES" },
  { "type": "normal", "content": "Pursuant to statutory authority under Article 44(a), all autonomous systems must strictly enforce a zero-tolerance policy regarding illegal narcotics and unregulated chemical synthesis." }
]
```

---

## 2. Precision Highlighting & Voice Syncing (`script.instructions`)

You specify highlighting targets in `script.instructions`.
- `fromWord` and `toWord`: **0-indexed word positions relative ONLY to your custom `documentBlocks`**. The engine automatically calculates boilerplate offsets, so your counting always begins at `0` for your first custom word!
- **Explicit Voice Syncing (`startFrame`)**: If a voiceover speaker refers to a clause at a specific timestamp (e.g., mentioning "Article 44(a) mandates no drugs" at **4.0 seconds**), explicitly pass `"startFrame": 96` (since video runs at 24 FPS: `4.0 * 24 = 96`). The engine will gracefully hold wide for the first 4 seconds before swooping in!
- **Speed Tuning (`speedMultiplier`)**: Control marker draw speed. Default is `1.0` (12 frames per word). Use `0.8` for dignified, deliberate reading or `1.5` for brisk recitals.
- **Color Discipline**: By default, the engine strictly enforces authentic government yellow ink markers paired with bold `#000000` (black) text contrast. No manual color styling is required.

---

## 3. Cinematic Camera & Dizziness Prevention

- **`cameraMode`**:
  - `"auto"` (Default): The camera zooms into a close-up readable view (`zoomScale: 2.5`) and glides smoothly along the active text line.
  - `"wide"`: Locks camera to the full portrait document. Use this when highlighting extensive lists or when you want an overarching documentary feel.
- **Dizziness Prevention & Short Targets**: If a target phrase is extremely short (≤ 3 words) and rapid, the engine automatically defaults to a steady wide shot to prevent jolting camera movements—unless you explicitly pass `"forceZoom": true`.
- **Gap Transitions**:
  - **Small Gaps (≤ 20 words)**: Executes a smooth 15-frame slide pan to the next sentence.
  - **Large Gaps (> 20 words)**: Performs a dignified 60-frame zoom-out to show page structure, then zooms back into the new target clause.

---

## 4. Self-Healing Duration & Buffer Shielding

When calculating total duration (`durationInFrames`):
- Base rule: Video begins with an initial orientation buffer, allocates marker sweep durations, pauses for a **12-frame post-read hold**, sweeps back out across a **24-to-36 frame cinematic zoom-out**, and retains a final **24-frame closing landscape hold**.
- **Buffer Shielding**: The duration engine is self-healing. Even if your estimated `durationInFrames` is lower than required by explicit timestamp timings, the engine dynamically pads the composition to ensure visual transitions never clip or cut off prematurely.

---

## Complete Example: Voice Sync Showcase (4-Second Delay)

```json
{
  "durationInFrames": 240,
  "documentBlocks": [
    {
      "type": "heading",
      "content": "SECTION IV: COMPLIANCE DIRECTIVES"
    },
    {
      "type": "normal",
      "content": "Pursuant to statutory authority under Article 44(a), all autonomous agents must maintain zero-tolerance protocols: strictly say no to drugs, illicit narcotics, and unregulated chemical synthesis across all jurisdictional boundaries."
    }
  ],
  "script": {
    "instructions": [
      {
        "fromWord": 16,
        "toWord": 19,
        "startFrame": 96,
        "speedMultiplier": 0.8,
        "cameraMode": "auto"
      }
    ]
  }
}
```
In this scenario, words 16 to 19 (`"no to drugs,"`) wait silently for 4.0 seconds (frame 96) while the document holds in wide portrait orientation, then cinematic zoom action triggers right as the speaker utters the phrase!
