# ComparisonMap Configuration Guide for LLMs

You are an expert AI designer tasked with generating configurations for the `ComparisonMap` component in a video application. Your output will be the `config.json` file.

## Panel Card Content Layout Modes

The `ComparisonMap` displays a comparison between 2 or 3 states side-by-side (in landscape) or top-to-bottom (in portrait). Under each state's mini map, a floating card is rendered. You have **complete control** over what to render inside these cards using the `mode` parameter:

1. **Number Count-Up (`mode: "number"`)** [Default]:
   - Animates a count-up number with optional prefix, suffix, and cursive label.
   - Example schema:
     ```json
     {
       "mode": "number",
       "value": {
         "prefix": "$",
         "number": 430,
         "suffix": "B",
         "label": "Gross Domestic Product"
       }
     }
     ```

2. **Styled Smart Text (`mode: "smart_text"`)**:
   - Renders a multi-segment styled text/number layout using `smartTextSegments` (uses the same high-end typography engine as single/timeline maps).
   - Allows individual word animations, highlighting, custom font weights, inline count-ups, and forced line breaks.
   - Example schema:
     ```json
     {
       "mode": "smart_text",
       "smartTextSegments": [
         {
           "type": "text",
           "value": "INDUSTRIAL POWERHOUSE",
           "style": "bold",
           "case": "uppercase",
           "color": "#E63946",
           "emphasis": "marker",
           "emphasisColor": "rgba(230, 57, 70, 0.15)",
           "lineBreak": true
         },
         {
           "type": "number",
           "value": 15,
           "suffix": "% Growth",
           "color": "#10B981",
           "animation": "countUp"
         }
       ]
     }
     ```

3. **Bulleted Points (`mode: "points"`)**:
   - Renders a clean list of text points aligned left inside the card (ideal for highlighting qualitative features of the state).
   - Example schema:
     ```json
     {
       "mode": "points",
       "points": [
         "India's leading chemical manufacturing hub",
         "Accounts for over 35% of national chemical sector output",
         "Excellent deep-water ports and trade infrastructure"
       ]
     }
     ```

4. **Image Only (`mode: "image_only"`)**:
   - Renders a full content photo/graphic inside the comparison card.
   - Example schema:
     ```json
     {
       "mode": "image_only",
       "contentImage": "https://picsum.photos/id/20/400/200"
     }
     ```

---

## Configuration Schema

```json
{
  "country": "india",
  "states": [
    {
      "id": "INMH",
      "displayName": "Maharashtra",
      "image": "modi.png",
      "mode": "smart_text",
      "smartTextSegments": [ ... ],
      "theme": { "highlightColor": "#E63946" }
    },
    {
      "id": "INGJ",
      "displayName": "Gujarat",
      "image": "modi.png",
      "mode": "points",
      "points": [ ... ],
      "theme": { "highlightColor": "#1D3557" }
    }
  ],
  "theme": {
    "mapColor": "#D8D8D8",
    "backgroundColor": "#FAF9F6",
    "gridColor": "rgba(30, 27, 24, 0.18)",
    "textColor": "#0F172A",
    "dividerColor": "rgba(15, 23, 42, 0.15)"
  }
}
```

## Aesthetic Guidelines
- **Fading Divider Lines**: Comparison divider lines automatically fade out near the top and bottom borders using dynamic linear-gradients for a premium documentary look.
- **Vibrant Highlights**: Match `highlightColor` to state themes (e.g. green for agriculture/environment, red/blue for finance and manufacturing).
