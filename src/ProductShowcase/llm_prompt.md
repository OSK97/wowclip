# LLM Guide — ProductShowcase Animation

This guide explains how you (the LLM) should construct the `showcase-config.json` file for the `ProductShowcase` template.

The template renders a central showcase subject (like an Apple or any product/concept image) with multiple details branching out in circular nodes. The camera pans and zooms onto each node one by one, then zooms out at the end to show the full tree.

---

## 1. Timing & Durations

You do **not** have control over the transition speeds (zoom in / zoom out speeds) to prevent camera distortion. The React component manages these transitions automatically.

### Hardcoded Speeds (Internal)
* **Zoom-In Transition:** `1.5` seconds
* **Zoom-Out Transition:** `0.67` seconds

### Your Timing Controls
For each point/branch, you specify `durationSeconds` (how long the camera holds on that branch details).
* **`introDurationSeconds`:** The initial entrance phase displaying the central image before branching starts. (Default: `2.0`s)
* **`finalBufferSeconds`:** The ending phase where the camera zooms out completely, showing the entire tree/diagram. (Default: `3.0`s)
* **`durationSeconds` (per point):** The hold time for that specific branch. (Default: `2.5`s)

### Auto-Calculated Total Time
The total animation duration in seconds is automatically computed as:
$$\text{Total Duration} = \text{introDurationSeconds} + \sum_{i=1}^{N} (2.17 + \text{point}_i.\text{durationSeconds}) + \text{finalBufferSeconds}$$
*(where 2.17s is the combined zoom-in + zoom-out animation overhead per branch)*

---

## 2. JSON Structure

Generate a JSON object with the following fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `backgroundImage` | `string` | Path to a background pattern overlay (e.g. `"ProductShowcase_assets/texture.jpg"`). |
| `centerImage` | `string` | Path to the central product/concept image (e.g. `"ProductShowcase_assets/apple.png"`). |
| `showNumbers` | `boolean` | If `true`, titles are prefixed with numbers automatically (`1. Title`, `2. Title`). |
| `fps` | `number` | Framerate of the video (always set to `24`). |
| `introDurationSeconds` | `number` | Duration of the intro entrance sequence. |
| `finalBufferSeconds` | `number` | Duration of the final zoomed-out full-tree sequence. |
| `points` | `array` | List of branching nodes to show. |

### Each item in `points` can contain:

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | `string` | Title of the detail/branch (EB Garamond Serif Font). |
| `description` | `string` | *(Optional)* Subtitle/description of the detail (Inter Sans-Serif Font). |
| `image` | `string` | *(Optional)* Image to render alongside this detail. |
| `video` | `string` | *(Optional)* Video to render alongside this detail. |
| `durationSeconds` | `number` | The time (in seconds) the camera stays focused on this detail. |

---

## 3. Example JSON Output

```json
{
  "backgroundImage": "ProductShowcase_assets/texture.jpg",
  "centerImage": "ProductShowcase_assets/apple.png",
  "showNumbers": true,
  "fps": 24,
  "introDurationSeconds": 2.0,
  "finalBufferSeconds": 3.0,
  "points": [
    {
      "title": "Rich in Nutrients",
      "description": "Apples are packed with essential vitamins, minerals, and antioxidants.",
      "image": "ProductShowcase_assets/dummy_image_1.jpg",
      "durationSeconds": 3.0
    },
    {
      "title": "Supports Heart Health",
      "description": "Contains soluble fiber which helps lower blood cholesterol levels.",
      "image": "ProductShowcase_assets/dummy_image_1.jpg",
      "durationSeconds": 2.5
    },
    {
      "title": "Hydration Support",
      "description": "Composed of about 86% water to help keep you hydrated.",
      "image": "ProductShowcase_assets/dummy_image_1.jpg",
      "durationSeconds": 2.0
    }
  ]
}
```
