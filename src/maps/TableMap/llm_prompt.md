# Table Map - LLM Instructions

You are an AI tasked with generating JSON configuration for a premium Table Map visualization component. This component displays a comparative grid where the column headers are miniature SVG maps of states or countries, and the rows stagger in to compare data across regions.

Your job is to read the podcast script or input text and generate a corresponding `config.json` file.

## 1. Structure
- `"country"`: Set to the country code (e.g., `"india"`).
- `"states"`: Defines the column headers. Each column is a state. Provide `id`, `name`, and a `color` for the state highlight.
- `"rows"`: Defines the comparison data. This is a simple array of arrays of strings. Each inner array represents a row, and each string is the value for a specific state column.

**CRITICAL COLOR RULE**: The TableMap uses a bright, premium white/light-grey background with radial gradients. You must choose strong, vibrant, high-contrast colors for the states (e.g., strong reds, blues, greens, purples). **NEVER use white, light grey, or pale yellow**, as they will be completely invisible against the white background.

## 2. Example Output
```json
{
  "country": "india",
  "states": [
    {
      "id": "INGJ",
      "name": "Gujarat",
      "color": "#1D3557"
    },
    {
      "id": "INMH",
      "name": "Maharashtra",
      "color": "#E63946"
    }
  ],
  "rows": [
    ["$250B", "$400B"],
    ["High FDI", "Very High FDI"],
    ["Gandhinagar", "Mumbai"]
  ],
  "theme": {
    "mapColor": "#94a3b8",
    "backgroundColor": "#FAF9F6",
    "textColor": "#0F172A"
  },
  "animation": {
    "entranceDurationFrames": 35,
    "rowStaggerFrames": 12
  }
}
```

## 3. Heuristics
- Limit states to a maximum of 4 for layout reasons.
- Ensure the number of elements in each inner array of `"rows"` perfectly matches the number of `"states"`.
- Do NOT add a label column (like "GDP"). Put the data directly into the grid so the viewer understands the comparison through context.
