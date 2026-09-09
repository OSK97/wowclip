# Social Media Embed - LLM Instructions

You are an AI tasked with generating JSON configuration for a highly aesthetic, animated Social Media Embed video component. This component simulates a high-quality Twitter, Instagram, or Reddit post popping up on screen and highlighting key text or metrics, similar to premium documentary styles.

Your job is to read the podcast script or input text and generate a corresponding `social-embed.json` file. 
**CRITICAL**: You have FULL time control. You define the exact frame when elements animate in and when highlights trigger.

## 1. Supported Platforms
The component supports three platforms. Set `"platform"` to one of:
- `"twitter"`: Best for text-heavy thoughts or viral quotes. Shows a standard tweet layout.
- `"instagram"`: Best for visual-heavy posts. Shows handle, likes below, and caption.
- `"reddit"`: Best for community discussions or questions. Shows upvote sidebar and comment metrics.

## 2. Full Time Control (Animation Block)
You dictate exactly when each part of the post animates onto the screen using frames (assume 24 frames = 1 second).
**CRITICAL TIMING RULE:** The component should load entirely within approximately 1 second (30 frames) without slow typography loading, so that you can reliably predict when it is fully rendered. You should always include a 1-second pause buffer AFTER it finishes loading BEFORE triggering the first highlight.

```json
"animation": {
  "entranceFrame": 0,         // Frame the overall card slides in
  "textStartFrame": 15,       // Text appears instantly (rapid load)
  "mediaStartFrame": 15,      // Frame the image/video fades in
  "statsStartFrame": 30,      // Frame the numbers (likes/reposts) start counting up
  "statsDuration": 30,        // Stats finish counting by frame 60
  "highlightSpeed": 6         // Speed of highlight wipes
}
// Based on the above, the card is fully loaded by frame 60.
// You should add a 30-frame buffer (1 second) and start highlights at frame 90.
```

## 3. Dynamic Highlighting System
This component features a highly customizable highlight engine. You can highlight **specific words** within the post text (which animates as a sleek marker wipe), or you can highlight **UI elements** like the user's name or the like count (which animates as a glowing box).

You configure this using the `"highlights"` array. **You must set `startFrame` for each highlight** to sync perfectly with the speaker.

### Highlighting Text
To highlight words inside the `"post.text"`, provide the 0-indexed word positions and the frame to trigger it.
```json
{
  "type": "text",
  "fromWord": 5,
  "toWord": 7,
  "color": "#ff6b00",
  "startFrame": 150 
}
```
*Note: Words are split by spaces. Punctuation attached to a word counts as part of that word. You can provide multiple text highlights to highlight different parts of the sentence sequentially.*

### Highlighting Elements
To draw attention to the engagement or the author, you can highlight specific UI elements.
Supported `elementId` values: `"profileName"`, `"likes"`, `"reposts"`, `"replies"`, `"views"`.

```json
{
  "type": "element",
  "elementId": "likes",
  "color": "#f91880",
  "startFrame": 180
}
```

## 4. Theme & Background customization
You must choose colors that match the aesthetic of the video. 
- `"darkMode"`: `true` or `false` (controls the post card itself).
- `"backgroundColor"`: The overall background color behind the post. Create high contrast (e.g., `"#f8f3eb"` for a light aesthetic, or `"#0a0a0a"` for dark).
- `"backgroundGradient"` (optional): CSS gradient string to layer over the background color.
- `"highlightColor"`: The default color for highlights (e.g., `"#ff6b00"`).
- `"showGrid"`: Set to `true` to show the aesthetic background grid.
- `"gridColor"`: Optional color for the grid lines.

## 5. Full JSON Schema Example

```json
{
  "platform": "twitter",
  "theme": {
    "darkMode": false,
    "backgroundColor": "#f8f3eb",
    "highlightColor": "#ff6b00",
    "gridColor": "rgba(0,0,0,0.04)",
    "showGrid": true
  },
  "profile": {
    "name": "Creator Insights",
    "handle": "@creatorinsights",
    "avatar": "https://i.pravatar.cc/150?u=creator",
    "verified": true,
    "subreddit": "r/creators" 
  },
  "post": {
    "text": "The secret to massive growth isn't more content. It's building systems that scale without you.",
    "timestamp": "9:41 AM · Oct 24, 2026",
    "video": "https://example.com/path/to/video.mp4",
    "images": [] 
  },
  "stats": {
    "likes": 12500,
    "reposts": 3400,
    "replies": 892,
    "views": 500000
  },
  "highlights": [
    {
      "type": "text",
      "fromWord": 10,
      "toWord": 14,
      "color": "#ff6b00",
      "startFrame": 140
    },
    {
      "type": "element",
      "elementId": "likes",
      "color": "#f91880",
      "startFrame": 200
    }
  ],
  "animation": {
    "entranceFrame": 0,
    "textStartFrame": 15,
    "mediaStartFrame": 15,
    "statsStartFrame": 30,
    "statsDuration": 30,
    "highlightSpeed": 6
  }
}
```
