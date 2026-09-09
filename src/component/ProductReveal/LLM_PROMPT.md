# LLM Guide — ProductReveal Animation

This guide explains how you (the LLM) should use the `product-reveal.json` file.
This template is a cinematic product/subject reveal. It starts with the subject alone on a colored background, and then smoothly shrinks down into a sleek "Card View" where you can construct ANY layout (E-commerce, Wikipedia entry, Profile card, etc.) using `footer` blocks.

## CRITICAL: Video Framerate (24 FPS)

The video runs at exactly **24 frames per second**. 
You must calculate timings (`enterFrame`, `transitionFrame`) based on the speaker's voiceover timeline.
- 1 Second = 24 frames
- 2 Seconds = 48 frames
- 3 Seconds = 72 frames
- 4.5 Seconds = 108 frames

---

## JSON Properties

### 1. `theme`
- `initialBg`: The starting solid background color (e.g. orange `#f97316` or blue `#2563eb`).
- `imageHoldFrames`: How long (in frames) the product stays alone on screen before shrinking into a card. (e.g., if the speaker says "Look at this...", and it takes 2 seconds before they describe it, set this to `48`).

### 2. `image`
- `src`: The image URL or local path. Must be a transparent PNG for the best effect.

### 3. `footer` (The Layout Blocks)
You are the designer! You can build ANY vertical layout by stacking blocks. You are NOT limited to shopping cards. 
**Spacing:** The code automatically adds vertical safe margins (padding) between components to prevent overlap, so do not worry about crowding.

Each block has these core properties:
- `type`: Can be `"label"`, `"title"`, `"description"`, `"price"`, `"rating"`, `"badge"`, `"button"`, `"spacer"`.
- `value`: The text content.
- `enterFrame`: **(CRITICAL)** The absolute frame when this specific block smoothly slides up into view. You MUST align this with the voiceover! 
  - *Example:* The card finishes forming around `imageHoldFrames + 60`. If `imageHoldFrames` is 48, the card forms by frame 108. You should start fading text in at frame 120.
- `fontSize`, `fontWeight`, `color`, `align`: Fully customizable styling.

#### Dynamic Transitions (Simultaneous Animations)
You can change the text value and color of a block *live* while it's on screen!
- `transitionFrame`: The absolute frame when the change happens.
- `transitionValue`: The new text string.
- `transitionColor`: The new color.
  - *Example:* The speaker says "It used to be 249 dollars... but now it's just 199!". 
  - You set `value: "$249"`, `enterFrame: 120`. 
  - Then set `transitionFrame: 180`, `transitionValue: "$199"`, `transitionColor: "#10b981"` (Green). The price will instantly update and turn green exactly when the speaker says it!

## Layout Inspiration

**The E-Commerce Card:**
- `label` ("AMAZON EXCLUSIVE", orange)
- `title` ("AirPods Pro")
- `rating` (4.8 stars)
- `price` ("$249")
- `button` ("Add to Cart", yellow background)

**The Executive Profile Card:**
- `title` ("Satya Nadella")
- `label` ("CEO, MICROSOFT", blue)
- `description` ("Satya Narayana Nadella is an Indian-American business executive.")
- `spacer`
- `price` ("Tenure: 10 Years") -> You can misuse types! A "price" block is just large thin text.

**The Feature Highlight Card:**
- `badge` ("NEW UPDATE", green background)
- `title` ("M3 Max Chip")
- `description` ("14-core CPU, 30-core GPU, up to 128GB unified memory.")

Be creative. Use colors wisely, ensure high contrast against the dark `cardBg` (which is dark grey `#1e1e1e`), and perfectly time your `enterFrame` drops to match the audio!
