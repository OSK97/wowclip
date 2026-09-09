import React from 'react';

// Shared marker renderer. ElonRocketNews, CommanderTable and GovernmentDocument
// all build on this, so the props shape here is a contract — AestheticNews has
// its own NewsHighlighter and no longer uses this file.
export interface HighlightInstruction {
  target?: string;
  startFrame: number;
  endFrame: number;
  fromWord: number;
  toWord: number;
  cameraMode?: "auto" | "wide";
  wordDurations?: number | string | number[];
  speedMultiplier?: number;
  forceZoom?: boolean;
  highlightColor?: string;
  color?: string;
  theme?: string;
  accentColor?: string;
}

export interface HighlightScript {
  instructions: HighlightInstruction[];
}

interface Props {
  body: string;
  script: HighlightScript;
  frame: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  accentColor: string;
  idPrefix?: string;
  targetName?: string;
  fontWeight?: number;
  letterSpacing?: number | string;
}

export const getNormalizedWordDurations = (wordDurations: any, len: number): number[] => {
  const defaultDur = 12; // default frames per word if everything fails

  if (typeof wordDurations === 'number') {
    return Array(len).fill(wordDurations > 0 ? wordDurations : defaultDur);
  }

  let arr: any[] = [];
  if (typeof wordDurations === 'string') {
    // split by comma or space
    const parts = wordDurations.trim().split(/[\s,]+/);
    arr = parts.map(p => {
      const val = parseInt(p, 10);
      return isNaN(val) ? defaultDur : val;
    });
  } else if (Array.isArray(wordDurations)) {
    arr = wordDurations.map(v => {
      const val = typeof v === 'number' ? v : parseInt(v, 10);
      return isNaN(val) ? defaultDur : val;
    });
  }

  if (arr.length === 0) {
    return Array(len).fill(defaultDur);
  }

  // Pad or truncate to match len
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i < arr.length) {
      result.push(arr[i] > 0 ? arr[i] : defaultDur);
    } else {
      // Pad with the last element's value
      result.push(result[result.length - 1]);
    }
  }
  return result;
};

export const getPenPosition = (inst: any, frame: number): number => {
  const len = inst.toWord - inst.fromWord + 1;

  if (inst.wordDurations !== undefined && inst.wordDurations !== null) {
    const durs = getNormalizedWordDurations(inst.wordDurations, len);
    const relFrame = frame - inst.startFrame;
    if (relFrame <= 0) return 0;

    let cumulative = 0;
    for (let idx = 0; idx < len; idx++) {
      const dur = durs[idx];
      if (relFrame < cumulative + dur) {
        const wordProg = (relFrame - cumulative) / dur;
        return idx + wordProg;
      }
      cumulative += dur;
    }
    return len;
  }

  // Fallback to linear interpolation
  if (frame <= inst.startFrame) return 0;
  if (frame >= inst.endFrame) return len;
  const duration = inst.endFrame - inst.startFrame;
  if (duration <= 0) return len;
  return ((frame - inst.startFrame) / duration) * len;
};

// Semantic marker color mapping for intelligent LLM interpretation & contrast control
export const resolveMarkerColor = (
  colorInput: string | undefined,
  fallback: string
): { bgColor: string; textColor: string } => {
  if (!colorInput || colorInput.trim() === "") {
    colorInput = fallback;
  }
  const clean = colorInput.trim().toLowerCase();

  let hex = colorInput;
  // Map semantic sentiment keywords and simple color names to vibrant, curated authentic marker colors
  if (
    ["yellow", "default", "normal", "neutral", "highlight"].includes(clean)
  ) {
    hex = "#FFEB3B"; // Classic bright yellowish marker color
  } else if (
    [
      "red",
      "danger",
      "death",
      "fatal",
      "loss",
      "decline",
      "crash",
      "negative",
      "bearish",
      "war",
      "crisis",
      "fall",
    ].includes(clean)
  ) {
    hex = "#FF3B30"; // Vibrant Apple/Neon Coral Red for critical / fatal / loss concepts
  } else if (
    [
      "green",
      "success",
      "profit",
      "growth",
      "gain",
      "surge",
      "positive",
      "bullish",
      "boom",
      "win",
      "rise",
    ].includes(clean)
  ) {
    hex = "#00E676"; // Vibrant Mint/Marker Green for financial growth & positive concepts
  } else if (
    ["blue", "info", "tech", "water", "cold", "sky"].includes(clean)
  ) {
    hex = "#38BDF8"; // Sky Blue Highlighter
  } else if (
    ["orange", "warning", "caution", "alert", "fire"].includes(clean)
  ) {
    hex = "#FB923C"; // Vibrant Orange Highlighter
  } else if (
    ["purple", "violet", "premium", "royal", "magic"].includes(clean)
  ) {
    hex = "#C084FC"; // Vibrant Violet/Purple Highlighter
  }

  // Ensure opaque if rgba is passed, so overlapping letters/padding don't double-render transparency
  const opaqueBg = hex.startsWith("rgba")
    ? hex.replace(/[\d.]+\)$/, "1)")
    : hex;

  // Compute perceived brightness / luminance to dynamically select crisp white vs dark black text
  let textColor = "#111111"; // Default dark black text for yellow and light green markers

  try {
    let r = 255,
      g = 235,
      b = 59;
    if (opaqueBg.startsWith("#")) {
      const hexClean = opaqueBg.replace("#", "");
      if (hexClean.length === 3) {
        r = parseInt(hexClean[0] + hexClean[0], 16);
        g = parseInt(hexClean[1] + hexClean[1], 16);
        b = parseInt(hexClean[2] + hexClean[2], 16);
      } else if (hexClean.length >= 6) {
        r = parseInt(hexClean.substring(0, 2), 16);
        g = parseInt(hexClean.substring(2, 4), 16);
        b = parseInt(hexClean.substring(4, 6), 16);
      }
    } else if (opaqueBg.startsWith("rgb")) {
      const match = opaqueBg.match(/\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(/[\s,]+/).map(Number);
        if (parts.length >= 3) {
          [r, g, b] = parts;
        }
      }
    }
    // Perceived luminance formula (ITU-R BT.601)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    // If luminance is under 145 (e.g. Red #FF3B30 has luminance ~116), use crisp white text for striking legibility!
    if (luminance < 145) {
      textColor = "#FFFFFF";
    }
  } catch (e) {
    // default to #111111 on error
  }

  return { bgColor: opaqueBg, textColor };
};

export const AestheticHighlighter: React.FC<Props> = ({
  body,
  script,
  frame,
  fontSize,
  lineHeight,
  color,
  accentColor,
  idPrefix = "description-word-",
  targetName = "description",
  fontWeight = 400,
  letterSpacing = 0.2,
}) => {
  const words = body.split(/\s+/);

  const instructionFills = script.instructions
    .filter((inst) => inst.target === targetName)
    .map((inst) => {
      const penPosition = getPenPosition(inst, frame);
      return {
        inst,
        penPosition,
      };
    });

  return (
    <span style={{
      fontSize,
      lineHeight,
      color,
      fontWeight,
      letterSpacing,
      display: 'inline-block',
      textShadow: "1px 0px 2px rgba(255,0,0,0.4), -1px 0px 2px rgba(0,255,255,0.4), 0px 0px 10px rgba(255,255,255,0.12), 0px 0px 20px rgba(255,255,255,0.06)",
      filter: "contrast(1.05) brightness(1.05)",
      verticalAlign: 'baseline',
    }}>
      {words.map((word, i) => {
        const fillData = instructionFills.find((f) => i >= f.inst.fromWord && i <= f.inst.toWord);

        if (!fillData) {
          return (
            <span
              key={i}
              id={`${idPrefix}${i}`}
              style={{
                display: 'inline',
                verticalAlign: 'baseline',
              }}
            >
              {word}{i < words.length - 1 ? ' ' : ''}
            </span>
          );
        }

        const wordIndex = i - fillData.inst.fromWord;
        let wordFill = (fillData.penPosition - wordIndex) * 100;
        wordFill = Math.max(0, Math.min(100, wordFill));

        const isFirstWord = i === fillData.inst.fromWord;
        const isLastWord = i === fillData.inst.toWord;

        let bRadius = "0px";
        const padTopBottom = "3px";
        const padLeft = isFirstWord ? "6px" : "0px";
        const padRight = isLastWord ? "6px" : "0px";
        const pad = `${padTopBottom} ${padRight} ${padTopBottom} ${padLeft}`;

        if (isFirstWord && isLastWord) {
          bRadius = "255px 15px 225px 15px/15px 225px 15px 255px";
        } else if (isFirstWord) {
          bRadius = "255px 0px 0px 15px/15px 0px 0px 255px";
        } else if (isLastWord) {
          bRadius = "0px 15px 225px 0px/0px 225px 15px 0px";
        }

        const customColorInput = fillData.inst.highlightColor || (fillData.inst as any).color || (fillData.inst as any).theme || fillData.inst.accentColor || accentColor;
        const { bgColor: opaqueInstColor, textColor: dynamicTextColor } = resolveMarkerColor(customColorInput, accentColor);

        // Negative margins exactly counteract initial marker bubble padding, guaranteeing 100% perfect start-of-line alignment!
        const wrapperMarginLeft = isFirstWord ? "-6px" : "0px";
        const wrapperMarginRight = isLastWord ? "-2px" : "-1px";

        return (
          <React.Fragment key={i}>
            <span
              style={{
                position: 'relative',
                display: 'inline-block',
                verticalAlign: 'baseline',
                marginLeft: wrapperMarginLeft,
                marginRight: wrapperMarginRight,
              }}
            >
              {/* Layer 1: Base Un-highlighted Text */}
              <span
                id={`${idPrefix}${i}`}
                style={{
                  display: 'inline-block',
                  verticalAlign: 'baseline',
                  padding: pad,
                  color: color,
                  textShadow: "1px 0px 2px rgba(255,0,0,0.4), -1px 0px 2px rgba(0,255,255,0.4), 0px 0px 10px rgba(255,255,255,0.12), 0px 0px 20px rgba(255,255,255,0.06)",
                  fontWeight,
                  whiteSpace: 'pre',
                }}
              >
                {word}{isLastWord ? '' : ' '}
              </span>

              {/* Layer 2: Highlighted Text (Clipped) */}
              {wordFill > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: wordFill === 100 && !isLastWord ? 'calc(100% + 1.5px)' : `${wordFill}%`,
                    overflow: 'hidden',
                    backgroundColor: opaqueInstColor,
                    backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(0, 0, 0, 0.12) 100%)',
                    borderRadius: bRadius,
                    display: 'inline-block',
                    verticalAlign: 'baseline',
                    padding: pad,
                    color: dynamicTextColor,
                    textShadow: dynamicTextColor === '#FFFFFF'
                      ? "0 1px 2px rgba(0, 0, 0, 0.45)"
                      : "none",
                    fontWeight,
                    whiteSpace: 'pre',
                    boxSizing: 'border-box',
                    boxShadow: (() => {
                      const shadows = [
                        "inset 0 2px 3px -1px rgba(255, 255, 255, 0.8)", // top catch light highlight
                        "inset 0 -2px 3px -1px rgba(0, 0, 0, 0.25)"      // bottom shadow edge
                      ];
                      if (isFirstWord) {
                        shadows.push("inset 3px 0 3px -2px rgba(0, 0, 0, 0.15)"); // left edge start shadow
                      }
                      if (isLastWord) {
                        shadows.push("inset -3px 0 3px -2px rgba(0, 0, 0, 0.15)"); // right edge end shadow
                      }
                      return shadows.join(", ");
                    })(),
                    filter: 'drop-shadow(0px 1.5px 3px rgba(0,0,0,0.15))',
                  }}
                >
                  {word}{isLastWord ? '' : ' '}
                </span>
              )}
            </span>
            {isLastWord && i < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </span>
  );
};
