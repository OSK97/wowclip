import { PaperHighlightConfig, PageConfig } from "./types";
import defaultConfig from "./defaultConfig.json";

// Hard limits for the highlighted word's font size (in px).
// Prevents the highlight from being unreadably tiny or absurdly large.
const MIN_FOCUS_FONT_SIZE = 52;
const MAX_FOCUS_FONT_SIZE = 110;

// Recommended highlight text length range.
// Outside this range the component will still work but may look sub-optimal.
const MIN_HIGHLIGHT_LENGTH = 2;
const MAX_HIGHLIGHT_LENGTH = 20;

export const resolveConfig = (rawConfig: Record<string, unknown>): PaperHighlightConfig => {
  // Use the massive default config as the baseline
  const config = JSON.parse(JSON.stringify(defaultConfig)) as PaperHighlightConfig;
  
  // Merge the minimal user inputs into the config
  if (rawConfig.highlightText) {
    config.highlightText = rawConfig.highlightText as string;
  }
  if (rawConfig.durationSeconds !== undefined) {
    config.composition.durationSeconds = rawConfig.durationSeconds as number;
  }
  if (rawConfig.composition) {
    Object.assign(config.composition, rawConfig.composition);
  }

  const highlightText = config.highlightText || "Missing Highlight";

  // Warn on extreme lengths but still proceed gracefully
  if (highlightText.length < MIN_HIGHLIGHT_LENGTH) {
    console.warn(`PaperHighlight: highlightText "${highlightText}" is very short (${highlightText.length} chars). Minimum recommended: ${MIN_HIGHLIGHT_LENGTH}.`);
  }
  if (highlightText.length > MAX_HIGHLIGHT_LENGTH) {
    console.warn(`PaperHighlight: highlightText "${highlightText}" is very long (${highlightText.length} chars). Maximum recommended: ${MAX_HIGHLIGHT_LENGTH}.`);
  }

  // ── Dynamic Font Scaling ──────────────────────────────────────
  // Baseline: "Gaza War" = 8 chars at the default 82px focus font.
  // Scale proportionally using a gentle power curve, then hard-clamp.
  const baselineLength = 8;
  const currentLength = Math.max(1, highlightText.length);
  const rawScale = Math.pow(baselineLength / currentLength, 0.7);
  // Allow slight scale-up for very short words but cap it
  const scaleFactor = Math.min(1.35, Math.max(0.5, rawScale));

  if (config.focus && config.typography) {
    // Scale the focus (highlight) font size and hard-clamp to safe range
    const rawFocusFontSize = Math.round(config.focus.fontSize * scaleFactor);
    config.focus.fontSize = Math.min(MAX_FOCUS_FONT_SIZE, Math.max(MIN_FOCUS_FONT_SIZE, rawFocusFontSize));

    // Scale surrounding typography proportionally (gentler factor)
    const bodyScale = Math.min(1.2, Math.max(0.65, rawScale));
    config.typography.bodyFontSize = Math.round(config.typography.bodyFontSize * bodyScale);
    config.typography.headlineFontSize = Math.round(config.typography.headlineFontSize * bodyScale);

    // Dynamic marker padding: longer words need less proportional padding
    // so the highlight box doesn't become excessively wide
    const paddingScale = Math.min(1.3, Math.max(0.6, Math.pow(baselineLength / currentLength, 0.4)));
    config.focus.markerPaddingX = Math.round(config.focus.markerPaddingX * paddingScale);
  }

  // Replace the {{highlightText}} token in every page's focusLine
  config.pages = config.pages.map((page: PageConfig) => {
    if (page.focusLine && page.focusLine.highlight) {
      page.focusLine.highlight = page.focusLine.highlight.replace(
        "{{highlightText}}",
        highlightText
      );
    }
    return page;
  });

  return config;
};
