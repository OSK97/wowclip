# Single Map - LLM Instructions

You are an AI tasked with generating JSON configuration for a premium map visualization component. This component displays a country map, highlights a specific state, and orchestrates a highly-timed sequence of image layers (satellite, stylized, or PNG overlays). 

Your job is to read the podcast script or input text and generate a corresponding `config.json` file.
**CRITICAL**: You have FULL time control. You define the exact frame when elements animate in using `startFrame`.

## 1. Highlighting a State
- `"country"`: Set to the country code (e.g., `"india"`, `"usa"`).
- `"mode"`: Always set to `"highlight_state"` for focusing on a single state.
- `"states"`: Defines the state to highlight.
  ```json
  "states": [
    {
      "id": "INGJ", // E.g., INGJ for Gujarat
      "displayName": "Gujarat",
      "theme": {
        "highlightColor": "#0F172A"
      }
    }
  ]
  ```

## 2. Full Time Control (Step Sequence)
You control the visual progression of the map by defining `steps`. Steps dictate what is displayed inside or above the state boundaries.

- `"mode": "image"`: Fills the entire state boundary with an image.
- `"mode": "png"`: Overlays one or multiple PNG images (e.g., people, icons, objects) inside the state boundary.
- `"startFrame"`: The exact frame this step becomes active.
- `"blurBackground"`: Set to `true` on a PNG step to blur the image from the previous step, ensuring the PNG stands out.

### Timing & Sequence Control
As an AI designer, you have complete freedom over the pacing and sequencing:
- **FPS Standard**: The video runs at **30 frames per second (fps)**. Therefore, `30` frames equal exactly `1` second.
- **Dynamic Video Duration**: The total video duration is dynamically calculated based on the start frame of your final step plus a 1-second safety buffer. You can explicitly override this by setting `totalDurationInFrames` at the root of the JSON. If your requested duration is less than the minimum time required to show all steps, the engine will automatically extend it to prevent cutting off the animation.
- **Custom Sequences**: You can define any step sequence.:
```json
"steps": [
  {
    "startFrame": 0,
    "mode": "image",
    "image": "https://example.com/industry-background.jpg"
  },
  {
    "startFrame": 60,
    "mode": "png",
    "blurBackground": true,
    "pngs": [
      {
        "image": "https://example.com/person1.png",
        "scale": 0.85
      },
      {
        "image": "https://example.com/person2.png",
        "scale": 0.85,
        "offsetX": 100
      }
    ]
  }
]
```

### Dynamic PNG Sizing & Constraints
- **CRITICAL**: NEVER place more than 2 PNGs in a single step! If you place 3 or more PNGs side-by-side, the irregular borders of the state map will crop them out and they will become invisible or distorted.
- If you supply multiple PNGs in a single step (up to 2), the component will automatically shrink them slightly so they fit better, but you can override this by setting `"scale"`.
- `"offsetX"` and `"offsetY"` can be used to manually adjust the position of each PNG relative to the center bottom of the state.

## 3. Theme & Aesthetics
- `"mapColor"`: Base color of the unhighlighted country map.
- `"highlightColor"`: Accent color for the state stroke.
- `"backgroundColor"`: The overall environment color.

## 4. Scenario Example (Narendra Modi in Gujarat)
If the user script says: *"Gujarat is booming in the oil industry, spearheaded by Narendra Modi..."*
Your JSON could look like this:
```json
{
  "totalDurationInFrames": 600,
  "country": "india",
  "mode": "highlight_state",
  "states": [
    {
      "id": "INGJ",
      "displayName": "Gujarat",
      "theme": {
        "highlightColor": "#10B981"
      }
    }
  ],
  "steps": [
    {
      "startFrame": 0,
      "mode": "image",
      "image": "path_to_oil_refinery.jpg"
    },
    {
      "startFrame": 72,
      "mode": "png",
      "blurBackground": true,
      "pngs": [
        {
          "image": "path_to_narendra_modi_cutout.png",
          "scale": 0.9
        }
      ]
    }
  ],
  "theme": {
    "mapColor": "#E2E8F0",
    "highlightColor": "#10B981",
    "backgroundColor": "#0F172A",
    "gridColor": "rgba(255, 255, 255, 0.05)",
    "textColor": "#F8FAFC"
  }
}
```

**Note**: You completely control the narrative pacing. If you want the background to show for exactly 3 seconds before Modi pops up, set `startFrame` of the PNG step to `72` (assuming 24fps).
