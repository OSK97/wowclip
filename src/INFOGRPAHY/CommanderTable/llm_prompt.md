# CommanderTable LLM Prompt Guidelines

You are tasked with generating the JSON configuration for the **CommanderTable** video template. This template displays a top-down view of a document on a tactical desk, with a highly dynamic camera that zooms in and highlights text seamlessly as it is read aloud.

Because the document layout is generated in real-time, you have the power to define the typography, structure, and pacing of the document using `documentBlocks`. **NOTE:** All visual styles (fonts, sizes, colors) are rigidly pre-defined by the engine to maintain aesthetic consistency. You simply select the components (headings, text, separators) and the engine styles them perfectly.

## JSON Structure

Your output MUST be a valid JSON object matching this schema:

```json
{
  "durationInFrames": 600,
  "documentBlocks": [
    { "type": "heading", "content": "MEMORANDUM FOR RECORD" },
    { "type": "separator", "content": "" },
    { "type": "bold", "content": "DATE: 24 JUNE 2026\nTO: HQ\nFROM: COMMAND" },
    { "type": "spacer", "content": "" },
    { "type": "normal", "content": "This is a normal paragraph with standard font weight." }
  ],
  "script": {
    "instructions": [
      {
        "startFrame": 60,
        "fromWord": 0,
        "toWord": 5
      }
    ]
  }
}
```

## `documentBlocks` Options

You can structure the text into an array of blocks. The renderer automatically strings them together into a continuous document while preserving the global word index for highlighting.
Available `type` values:
- `"heading"`: Renders as large, bold, uppercase, centered text with extra bottom margin. Use for the top title.
- `"separator"`: Renders a horizontal divider line.
- `"bold"`: Renders standard-sized bold, left-aligned text. Good for letter headers (DATE, TO, FROM). Note: You can use `\n` line breaks freely inside the `content` string to stack items seamlessly!
- `"normal"`: Renders standard-sized, normal-weight, justified text. Use for paragraph body text. You can also use `\n` here.
- `"spacer"`: Adds vertical whitespace between paragraphs.

**CRITICAL LAYOUT LIMIT**: The physical "paper" space in the template is limited. 
Do NOT generate a document exceeding **~120-150 words** or it will overflow the bottom of the paper and be cut off. Keep it concise.

## The Camera & Highlighting Engine

The camera tracks words perfectly and seamlessly zooms around the document line by line.

### `script.instructions`
This array defines the exact sequence of highlights.
- `fromWord`: The 0-indexed starting word (global across ALL text blocks).
- `toWord`: The 0-indexed ending word.
- `startFrame`: The exact frame this highlight begins.

### Timing Formula (24 fps)
To perfectly synchronize the highlights without overlapping, use this strict visual duration formula:
- **Speed**: Locked to **2.5 frames per character**.
- **Formula**: `Instruction Duration ≈ Total Characters in highlighted words * 2.5`.

Use this formula to calculate exactly how many frames an instruction will take. Add this duration to the `startFrame` (plus any desired pause, usually 10-30 frames) to determine the accurate `startFrame` for your next instruction so they don't overlap!

### `durationInFrames`
Because you control the timing, you can explicitly set the `"durationInFrames"` at the root of the JSON. If the template naturally finishes its animations before your requested duration, it will simply hold on the final frame until the time is up. If you omit it, the engine calculates the minimum safe duration automatically.

## Example Generation Workflow
1. Plan the content (e.g., a formal memo).
2. Split it into `documentBlocks` (heading -> separator -> bold header -> spacer -> normal paragraph).
3. Count the words to ensure it's under ~130 words.
4. Calculate the indices of the words you want to highlight. Note: Punctuation attached to a word counts as part of that word.
5. Create `script.instructions` using the timing formulas to sequence them perfectly.
