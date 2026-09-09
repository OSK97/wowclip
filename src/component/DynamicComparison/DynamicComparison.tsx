// src/component/DynamicComparison/DynamicComparison.tsx
// Warm white comparison layout — no grid, no cards, just clean content on canvas
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";
import {
  loadInter,
  loadOutfit,
  loadPlayfair,
  loadDancingScript,
} from "../../utils/localFonts";
import configJson from "./dynamic-comparison.json";

// ─── Font Loading ────────────────────────────────────────────────────────────
const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: outfitFamily } = loadOutfit();
const { fontFamily: playfairFamily } = loadPlayfair("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});
loadPlayfair("italic", { weights: ["400", "600"], subsets: ["latin"] });
const { fontFamily: cursiveFamily } = loadDancingScript("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

// ─── Types — SmartTextView-compatible segment format ─────────────────────────
export type TextStyle =
  | "normal"
  | "bold"
  | "italic"
  | "serif"
  | "italic-serif"
  | "cursive";
export type TextCase = "original" | "uppercase" | "lowercase" | "title";
export type EmphasisType =
  | "none"
  | "marker"
  | "underline"
  | "box"
  | "textColor";
export type TextAnimation =
  | "fadeUp"
  | "wordReveal"
  | "scaleIn"
  | "slideUp"
  | "none";
export type NumberFormat =
  | "normal"
  | "comma"
  | "compact"
  | "currency"
  | "percentage";
export type NumberAnimation = "countUp" | "pop" | "static";

export interface TextSegment {
  type: "text";
  value: string;
  style?: TextStyle;
  case?: TextCase;
  color?: string;
  emphasis?: EmphasisType;
  emphasisColor?: string;
  animation?: TextAnimation;
  fontSize?: number;
  lineBreak?: boolean;
}

export interface NumberSegment {
  type: "number";
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  format?: NumberFormat;
  animation?: NumberAnimation;
  color?: string;
  fontSize?: number;
  lineBreak?: boolean;
}

export type Segment = TextSegment | NumberSegment;

// ─── Types — ChecklistView-compatible item format ────────────────────────────
export interface ChecklistItem {
  marker: "check" | "bullet" | "number";
  text: string;
  description?: string;
  markerColor?: string;
  textColor?: string;
  descriptionColor?: string;
  checked?: boolean;
  value?: number;
}

// ─── Block types ─────────────────────────────────────────────────────────────
export interface SmartTextBlock {
  type: "smart_text";
  startFrame?: number;
  segments: Segment[];
  theme?: {
    textFontSize?: number;
    numberFontSize?: number;
    wordStaggerFrames?: number;
    emphasisDelay?: number;
    countUpDuration?: number;
    lineHeight?: number;
    textAlign?: "left" | "center" | "right";
  };
}

export interface ImageBlock {
  type: "image";
  startFrame?: number;
  url: string;
  height?: number;
  borderRadius?: number;
}

export interface ChecklistBlock {
  type: "checklist";
  startFrame?: number;
  items: ChecklistItem[];
  theme?: {
    textFontSize?: number;
    descriptionFontSize?: number;
    markerSize?: number;
    staggerFrames?: number;
    itemGap?: number;
  };
}

export type Block = SmartTextBlock | ImageBlock | ChecklistBlock;

export interface SideConfig {
  name: string;
  image?: string;
  accentColor?: string;
  blocks: Block[];
}

export interface DynamicComparisonConfig {
  theme?: {
    backgroundColor?: string;
    textColor?: string;
    dividerColor?: string;
  };
  scroll?: {
    scrollStartFrame?: number;
    scrollEndFrame?: number;
    safeZoneHeight?: number;
  };
  left: SideConfig;
  right: SideConfig;
}

const config = configJson as unknown as DynamicComparisonConfig;

const resolveSrc = (url: string) => {
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return staticFile(url);
};

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_TEXT_SIZE = 48;
const DEFAULT_NUMBER_SIZE = 80;
const DEFAULT_WORD_STAGGER = 3;
const DEFAULT_EMPHASIS_DELAY = 10;
const DEFAULT_COUNTUP_DURATION = 30;
const DEFAULT_LINE_HEIGHT = 1.45;
const DEFAULT_CHECKLIST_TEXT = 42;
const DEFAULT_CHECKLIST_DESC = 32;
const DEFAULT_MARKER_SIZE = 48;
const DEFAULT_CHECKLIST_STAGGER = 10;
const DEFAULT_CHECKLIST_GAP = 36;

// ─── Color Helpers (same palette as SmartTextView) ───────────────────────────
const COLOR_MAP: Record<string, string> = {
  primary: "#0f172a",
  slate: "#64748b",
  blue: "#2563eb",
  amber: "#f59e0b",
  rose: "#f43f5e",
  emerald: "#10b981",
  violet: "#8b5cf6",
  teal: "#14b8a6",
  orange: "#f97316",
  cyan: "#06b6d4",
  white: "#ffffff",
  black: "#000000",
};

const MARKER_COLORS: Record<string, string> = {
  primary: "rgba(15, 23, 42, 0.1)",
  blue: "rgba(37, 99, 235, 0.2)",
  amber: "rgba(245, 158, 11, 0.25)",
  rose: "rgba(244, 63, 94, 0.2)",
  emerald: "rgba(16, 185, 129, 0.2)",
  violet: "rgba(139, 92, 246, 0.2)",
  teal: "rgba(20, 184, 166, 0.2)",
  orange: "rgba(249, 115, 22, 0.2)",
  cyan: "rgba(6, 182, 212, 0.2)",
  white: "rgba(255, 255, 255, 0.15)",
};

function resolveColor(color?: string, fallback: string = "#0f172a"): string {
  if (!color) return fallback;
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  if (/^#|^rgba?\(|^hsl/.test(color)) return color;
  return fallback;
}

function resolveMarkerColor(color?: string, emphasisColor?: string): string {
  if (emphasisColor) return resolveColor(emphasisColor);
  if (!color) return "rgba(253, 224, 71, 0.4)";
  if (MARKER_COLORS[color]) return MARKER_COLORS[color];
  return resolveColor(color) + "33";
}

function applyCase(value: string, textCase?: TextCase): string {
  switch (textCase) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "title":
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return value;
  }
}

function getFontProps(style: TextStyle = "normal"): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
} {
  switch (style) {
    case "bold":
      return { fontFamily: interFamily, fontWeight: 800, fontStyle: "normal" };
    case "italic":
      return { fontFamily: interFamily, fontWeight: 500, fontStyle: "italic" };
    case "serif":
      return {
        fontFamily: playfairFamily,
        fontWeight: 600,
        fontStyle: "normal",
      };
    case "italic-serif":
      return {
        fontFamily: playfairFamily,
        fontWeight: 600,
        fontStyle: "italic",
      };
    case "cursive":
      return {
        fontFamily: cursiveFamily,
        fontWeight: 700,
        fontStyle: "normal",
      };
    default:
      return { fontFamily: interFamily, fontWeight: 500, fontStyle: "normal" };
  }
}

function formatNumber(
  value: number,
  format: NumberFormat = "normal",
  decimals: number = 0,
): string {
  switch (format) {
    case "comma":
      return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    case "compact": {
      if (value >= 1_000_000_000)
        return (value / 1_000_000_000).toFixed(decimals) + "B";
      if (value >= 1_000_000)
        return (value / 1_000_000).toFixed(decimals) + "M";
      if (value >= 1_000) return (value / 1_000).toFixed(decimals) + "K";
      return value.toFixed(decimals);
    }
    case "currency":
      return (
        "$" +
        value.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      );
    case "percentage":
      return value.toFixed(decimals) + "%";
    default:
      return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  }
}

// ─── Height Estimation ───────────────────────────────────────────────────────
function estimateBlockHeight(block: Block): number {
  const gap = 40;
  if (block.type === "smart_text") {
    const fontSize = block.theme?.textFontSize || DEFAULT_TEXT_SIZE;
    let totalChars = 0;
    block.segments.forEach((seg) => {
      totalChars += seg.type === "text" ? seg.value.length : 8;
    });
    const charsPerLine = Math.floor(410 / (fontSize * 0.52));
    const lines = Math.max(1, Math.ceil(totalChars / charsPerLine));
    return lines * fontSize * 1.5 + gap;
  }
  if (block.type === "image") return (block.height || 450) + gap;
  if (block.type === "checklist") {
    const textSize = block.theme?.textFontSize || DEFAULT_CHECKLIST_TEXT;
    const descSize = block.theme?.descriptionFontSize || DEFAULT_CHECKLIST_DESC;
    const itemGap = block.theme?.itemGap || DEFAULT_CHECKLIST_GAP;
    let h = 0;
    block.items.forEach((item) => {
      h += textSize * 1.3 + (item.description ? descSize * 1.4 : 0) + itemGap;
    });
    return h + gap;
  }
  return 120;
}

// ─── Word Renderer (identical to SmartTextView) ──────────────────────────────
const WordRenderer: React.FC<{
  word: string;
  startFrame: number;
  anim: TextAnimation;
  isLast: boolean;
}> = ({ word, startFrame, anim, isLast }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  let opacity = 1,
    translateY = 0,
    scale = 1;
  if (anim === "fadeUp") {
    opacity = progress;
    translateY = interpolate(progress, [0, 1], [30, 0]);
  } else if (anim === "slideUp") {
    opacity = progress;
    translateY = interpolate(progress, [0, 1], [40, 0]);
  } else if (anim === "scaleIn") {
    opacity = progress;
    scale = interpolate(progress, [0, 1], [0.85, 1]);
  } else if (anim === "wordReveal") {
    opacity = progress;
    translateY = interpolate(progress, [0, 1], [20, 0]);
  }

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "bottom center",
        marginRight: isLast ? 0 : "0.25em",
      }}
    >
      {word}
    </span>
  );
};

// ─── Text Segment Renderer (identical to SmartTextView) ──────────────────────
const TextSegmentInline: React.FC<{
  segment: TextSegment;
  startFrame: number;
  textFontSize: number;
  wordStagger: number;
  emphasisDelay: number;
  lineHeight: number;
}> = ({
  segment,
  startFrame,
  textFontSize,
  wordStagger,
  emphasisDelay,
  lineHeight,
}) => {
  const frame = useCurrentFrame();
  const fontProps = getFontProps(segment.style);
  const textColor = resolveColor(segment.color);
  const displayText = applyCase(segment.value, segment.case);
  const words = displayText.split(" ").filter((w) => w.trim() !== "");
  const anim = segment.animation || "fadeUp";
  const fontSize = segment.fontSize || textFontSize;

  const emphasisStart = startFrame + words.length * wordStagger + emphasisDelay;
  const emphasis = segment.emphasis || "none";
  const emphasisProgress = interpolate(
    frame,
    [emphasisStart, emphasisStart + 18],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 1, 0.4, 1),
    },
  );
  const markerColor = resolveMarkerColor(segment.color, segment.emphasisColor);

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        ...fontProps,
        fontSize,
        color: textColor,
        lineHeight,
        margin: "0 5px",
        letterSpacing: segment.style === "cursive" ? "0.02em" : "-0.01em",
      }}
    >
      {emphasis === "marker" && (
        <span
          style={{
            position: "absolute",
            left: -6,
            right: -6,
            top: "10%",
            bottom: "5%",
            backgroundImage: `linear-gradient(to right, ${markerColor} 0%, ${markerColor} 100%)`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left center",
            backgroundSize: `${emphasisProgress * 100}% 100%`,
            borderRadius: 6,
            zIndex: 0,
          }}
        />
      )}
      {emphasis === "underline" && (
        <span
          style={{
            position: "absolute",
            left: -2,
            right: -2,
            bottom: 4,
            height: 5,
            backgroundColor: textColor,
            borderRadius: 3,
            transform: `scaleX(${emphasisProgress})`,
            transformOrigin: "left center",
            opacity: 0.75,
          }}
        />
      )}
      {emphasis === "box" && (
        <span
          style={{
            position: "absolute",
            left: -10,
            right: -10,
            top: "2%",
            bottom: "2%",
            border: `2.5px solid ${textColor}`,
            borderRadius: 10,
            opacity: emphasisProgress * 0.6,
          }}
        />
      )}
      <span
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          flexWrap: "wrap",
        }}
      >
        {words.map((word, i) => (
          <WordRenderer
            key={i}
            word={word}
            startFrame={startFrame + i * wordStagger}
            anim={anim}
            isLast={i === words.length - 1}
          />
        ))}
      </span>
    </span>
  );
};

// ─── Number Segment Renderer (identical to SmartTextView) ────────────────────
const NumberSegmentInline: React.FC<{
  segment: NumberSegment;
  startFrame: number;
  numberFontSize: number;
  countUpDuration: number;
}> = ({ segment, startFrame, numberFontSize, countUpDuration }) => {
  const frame = useCurrentFrame();
  const textColor = resolveColor(segment.color, "#2563eb");
  const fontSize = segment.fontSize || numberFontSize;
  const anim = segment.animation || "countUp";

  const entranceProgress = interpolate(
    frame,
    [startFrame, startFrame + 15],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const opacity = entranceProgress;
  const translateY = interpolate(entranceProgress, [0, 1], [35, 0]);
  const blur = interpolate(entranceProgress, [0, 1], [12, 0]);
  const scale = interpolate(entranceProgress, [0, 1], [0.9, 1]);

  let displayValue: number;
  if (anim === "countUp") {
    const countProgress = interpolate(
      frame,
      [startFrame, startFrame + countUpDuration],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      },
    );
    displayValue = countProgress * segment.value;
  } else {
    displayValue = segment.value;
  }
  const formattedNumber = formatNumber(
    displayValue,
    segment.format,
    segment.decimals,
  );

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        position: "relative",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale}) scaleY(1.12)`,
        transformOrigin: "center center",
        lineHeight: 1,
        margin: "0 6px",
        filter: `blur(${blur}px)`,
      }}
    >
      {segment.prefix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            fontSize: fontSize * 0.85,
            color: textColor,
            letterSpacing: "-0.02em",
            marginRight: 4,
            opacity: 0.9,
          }}
        >
          {segment.prefix}
        </span>
      )}
      <span
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          fontSize,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.04em",
          textShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        {formattedNumber}
      </span>
      {segment.suffix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            fontSize: fontSize * 0.65,
            color: textColor,
            marginLeft: 4,
            letterSpacing: "-0.01em",
            opacity: 0.85,
          }}
        >
          {segment.suffix}
        </span>
      )}
    </span>
  );
};

// ─── Smart Text Block ────────────────────────────────────────────────────────
const SmartTextBlockRenderer: React.FC<{
  block: SmartTextBlock;
  startFrame: number;
  accentColor: string;
}> = ({ block, startFrame }) => {
  const t = block.theme || {};
  const textSize = t.textFontSize || DEFAULT_TEXT_SIZE;
  const numberSize = t.numberFontSize || DEFAULT_NUMBER_SIZE;
  const wordStagger = t.wordStaggerFrames || DEFAULT_WORD_STAGGER;
  const emphasisDelay = t.emphasisDelay || DEFAULT_EMPHASIS_DELAY;
  const countUpDuration = t.countUpDuration || DEFAULT_COUNTUP_DURATION;
  const lineHeight = t.lineHeight || DEFAULT_LINE_HEIGHT;
  const align = t.textAlign || "left";

  // Pre-calculate segment timings (same as SmartTextView)
  let currentFrame = startFrame;
  const segmentsWithTiming = block.segments.map((seg) => {
    const sf = currentFrame;
    if (seg.type === "text") {
      const words = seg.value.split(" ").filter((w) => w.trim() !== "");
      currentFrame += words.length * wordStagger;
    } else {
      currentFrame += wordStagger;
    }
    return { segment: seg, sf };
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        width: "100%",
        justifyContent:
          align === "left"
            ? "flex-start"
            : align === "right"
              ? "flex-end"
              : "center",
        textAlign: align,
      }}
    >
      {segmentsWithTiming.map(({ segment, sf }, idx) => {
        let node = null;
        if (segment.type === "text") {
          node = (
            <TextSegmentInline
              key={`t-${idx}`}
              segment={segment}
              startFrame={sf}
              textFontSize={textSize}
              wordStagger={wordStagger}
              emphasisDelay={emphasisDelay}
              lineHeight={lineHeight}
            />
          );
        } else if (segment.type === "number") {
          node = (
            <NumberSegmentInline
              key={`n-${idx}`}
              segment={segment}
              startFrame={sf}
              numberFontSize={numberSize}
              countUpDuration={countUpDuration}
            />
          );
        }
        if (!node) return null;
        return (
          <React.Fragment key={`f-${idx}`}>
            {node}
            {segment.lineBreak && (
              <div style={{ flexBasis: "100%", height: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Image Block ─────────────────────────────────────────────────────────────
const ImageBlockRenderer: React.FC<{
  block: ImageBlock;
  startFrame: number;
}> = ({ block, startFrame }) => {
  const frame = useCurrentFrame();
  const scaleSpring = spring({
    frame: frame - startFrame,
    fps: 30,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.9, 1]);
  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "auto",
        borderRadius: block.borderRadius ?? 20,
        overflow: "hidden",
        transform: `scale(${scale})`,
        opacity,
        boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Img
        src={resolveSrc(block.url)}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </div>
  );
};

// ─── Checklist Block ─────────────────────────────────────────────────────────
const ChecklistBlockRenderer: React.FC<{
  block: ChecklistBlock;
  startFrame: number;
  defaultTextColor: string;
}> = ({ block, startFrame, defaultTextColor }) => {
  const frame = useCurrentFrame();
  const t = block.theme || {};
  const textSize = t.textFontSize || DEFAULT_CHECKLIST_TEXT;
  const descSize = t.descriptionFontSize || DEFAULT_CHECKLIST_DESC;
  const markerSize = t.markerSize || DEFAULT_MARKER_SIZE;
  const stagger = t.staggerFrames || DEFAULT_CHECKLIST_STAGGER;
  const itemGap = t.itemGap || DEFAULT_CHECKLIST_GAP;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: itemGap,
        width: "100%",
      }}
    >
      {block.items.map((item, index) => {
        const itemStart = startFrame + index * stagger;
        const progress = interpolate(
          frame,
          [itemStart, itemStart + 16],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          },
        );
        const opacity = progress;
        const translateY = interpolate(progress, [0, 1], [30, 0]);
        const markerColor = resolveColor(item.markerColor, "#3b82f6");
        const textColor = resolveColor(item.textColor, defaultTextColor);
        const descColor = resolveColor(item.descriptionColor, "#64748b");

        const checkStart = itemStart + 10;
        const checkProgress =
          item.checked !== false
            ? interpolate(frame, [checkStart, checkStart + 15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              })
            : 0;
        const checkScale = interpolate(
          checkProgress,
          [0, 0.5, 1],
          [1, 1.15, 1],
        );
        const fillScale = interpolate(checkProgress, [0, 1], [0, 1]);

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              opacity,
              transform: `translateY(${translateY}px)`,
              width: "100%",
            }}
          >
            {/* Marker */}
            <div style={{ flexShrink: 0, marginTop: 4 }}>
              {item.marker === "check" && (
                <div
                  style={{
                    width: markerSize,
                    height: markerSize,
                    borderRadius: "50%",
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: `scale(${checkScale})`,
                    boxShadow:
                      checkProgress > 0
                        ? `0 0 ${checkProgress * 14}px ${markerColor}50`
                        : "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: markerColor,
                      borderRadius: "50%",
                      transform: `scale(${fillScale})`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: `2.5px solid ${checkProgress > 0 ? markerColor : "rgba(15,23,42,0.2)"}`,
                      borderRadius: "50%",
                      opacity: checkProgress > 0 ? checkProgress : 1,
                    }}
                  />
                  <svg
                    width={markerSize * 0.5}
                    height={markerSize * 0.5}
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ zIndex: 1 }}
                  >
                    <path
                      d="M5 12.5 L10 17.5 L19 6.5"
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={30}
                      strokeDashoffset={interpolate(
                        checkProgress,
                        [0, 1],
                        [30, 0],
                      )}
                    />
                  </svg>
                </div>
              )}
              {item.marker === "bullet" && (
                <div
                  style={{
                    width: markerSize * 0.35,
                    height: markerSize * 0.35,
                    borderRadius: "50%",
                    backgroundColor: markerColor,
                    marginTop: markerSize * 0.2,
                  }}
                />
              )}
              {item.marker === "number" && (
                <span
                  style={{
                    fontFamily: interFamily,
                    fontWeight: 900,
                    fontSize: markerSize * 0.85,
                    color: markerColor,
                    lineHeight: 1,
                  }}
                >
                  {item.value || index + 1}
                </span>
              )}
            </div>
            {/* Text */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: interFamily,
                  fontWeight: 700,
                  fontSize: textSize,
                  color: textColor,
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.text}
              </div>
              {item.description && (
                <div
                  style={{
                    fontFamily: interFamily,
                    fontWeight: 400,
                    fontSize: descSize,
                    color: descColor,
                    lineHeight: 1.35,
                    letterSpacing: "0.01em",
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Auto-Scroll Calculator ──────────────────────────────────────────────────
function calculateGlobalScrollY(
  leftBlocks: Block[],
  rightBlocks: Block[],
  frame: number,
  fps: number,
  safeZone: number
) {
  let events: { frame: number; top: number; bottom: number }[] = [];
  
  // Approx header height + top padding
  const headerHeight = 120 + 240 + 40 + 60; 
  
  let leftY = headerHeight;
  for (let i = 0; i < leftBlocks.length; i++) {
    const b = leftBlocks[i];
    const h = estimateBlockHeight(b);
    const startF = b.startFrame ?? (8 + 15 + i * 18);
    events.push({ frame: startF, top: leftY, bottom: leftY + h });
    leftY += h + 40; // 40 is the gap
  }
  
  let rightY = headerHeight;
  for (let i = 0; i < rightBlocks.length; i++) {
    const b = rightBlocks[i];
    const h = estimateBlockHeight(b);
    const startF = b.startFrame ?? (12 + 15 + i * 18);
    events.push({ frame: startF, top: rightY, bottom: rightY + h });
    rightY += h + 40; // 40 is the gap
  }

  events.sort((a, b) => a.frame - b.frame);

  let milestones: { frame: number; scrollY: number }[] = [{ frame: 0, scrollY: 0 }];
  let currentScrollY = 0;

  for (const ev of events) {
    let targetY = currentScrollY;
    
    if (ev.bottom + currentScrollY > safeZone) {
      targetY = safeZone - ev.bottom;
    }
    
    if (ev.top + targetY < 120) {
      if (ev.top < 800) {
        targetY = 0;
      } else {
        targetY = 120 - ev.top;
        if (targetY > 0) targetY = 0;
      }
    }
    
    if (targetY !== currentScrollY) {
      milestones.push({ frame: ev.frame + 5, scrollY: targetY });
      currentScrollY = targetY;
    }
  }

  let totalScroll = 0;
  for (let i = 1; i < milestones.length; i++) {
    const prevM = milestones[i - 1];
    const m = milestones[i];
    const diff = m.scrollY - prevM.scrollY;
    const progress = spring({
      frame: frame - m.frame,
      fps,
      config: { damping: 18, stiffness: 70, mass: 1 },
    });
    totalScroll += diff * progress;
  }
  return totalScroll;
}

// ─── Header Wrapper ──────────────────────────────────────────────────────────
const HeaderWrapper: React.FC<{
  side: SideConfig;
  textColor: string;
  entranceDelay: number;
}> = ({ side, textColor, entranceDelay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const headerSpring = spring({
    frame: frame - entranceDelay,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
  });
  const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1]);
  const headerY = interpolate(headerSpring, [0, 1], [-30, 0]);
  const headerScale = interpolate(headerSpring, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 20,
        width: "100%",
      }}
    >
      {side.image && (
        <div
          style={{
            opacity: headerOpacity,
            transform: `translateY(${headerY}px) scale(${headerScale})`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 240,
          }}
        >
          <Img
            src={resolveSrc(side.image)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: `${outfitFamily}, sans-serif`,
            fontSize: 56,
            fontWeight: 900,
            color: textColor,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "1px",
            lineHeight: 1.15,
          }}
        >
          {side.name}
        </div>
        <div
          style={{
            width: "40%",
            height: 2,
            backgroundColor: textColor,
            opacity: 0.15,
            marginTop: 15,
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
};

// ─── Block Wrapper ───────────────────────────────────────────────────────────
const BlockWrapper: React.FC<{
  block: Block;
  entranceDelay: number;
  bIdx: number;
  accentColor: string;
  textColor: string;
}> = ({ block, entranceDelay, bIdx, accentColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const blockStart = block.startFrame ?? (entranceDelay + 15 + bIdx * 18);
  const blockSpring = spring({
    frame: frame - blockStart,
    fps,
    config: { damping: 16, stiffness: 85, mass: 0.8 },
  });
  const blockOpacity = interpolate(blockSpring, [0, 1], [0, 1]);
  const blockY = interpolate(blockSpring, [0, 1], [40, 0]);

  return (
    <div
      style={{
        opacity: blockOpacity,
        transform: `translateY(${blockY}px)`,
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {block.type === "smart_text" && (
        <SmartTextBlockRenderer block={block} startFrame={blockStart + 8} accentColor={accentColor} />
      )}
      {block.type === "image" && (
        <ImageBlockRenderer block={block} startFrame={blockStart + 8} />
      )}
      {block.type === "checklist" && (
        <ChecklistBlockRenderer block={block} startFrame={blockStart + 8} defaultTextColor={textColor} />
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const DynamicComparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();

  const bgColor = config.theme?.backgroundColor || "#FAF9F6";
  const textColor = config.theme?.textColor || "#0F172A";
  const dividerColor = config.theme?.dividerColor || "rgba(15, 23, 42, 0.12)";

  const safeZone = config.scroll?.safeZoneHeight || 1200;

  const globalScrollY = calculateGlobalScrollY(config.left.blocks, config.right.blocks, frame, fps, safeZone);
  const numRows = Math.max(config.left.blocks.length, config.right.blocks.length);

  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dividerOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // VS Badge
  const vsSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily: `${interFamily}, sans-serif`,
        overflow: "hidden",
        opacity: bgOpacity,
      }}
    >
      {/* Subtle warm vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.03) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Center Divider — fading at top and bottom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 2,
          background: `linear-gradient(to bottom, transparent, ${dividerColor} 15%, ${dividerColor} 85%, transparent)`,
          zIndex: 10,
          opacity: dividerOpacity,
        }}
      />

      {/* VS Badge */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 195,
          transform: "translate(-50%, -50%)",
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            border: `1.5px solid ${dividerColor}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${vsScale})`,
            boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
          }}
        >
          <span
            style={{
              fontFamily: `${outfitFamily}, sans-serif`,
              fontSize: 24,
              fontWeight: 900,
              color: textColor,
              letterSpacing: "-1px",
              marginTop: -2,
            }}
          >
            VS
          </span>
        </div>
      </div>

      {/* Sync-Free Independent Columns Layout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${globalScrollY}px)`,
        }}
      >
        {/* Header Row */}
        <div style={{ display: "flex", flexDirection: "row", width: "100%", paddingTop: 120, paddingBottom: 40 }}>
          <div style={{ width: "50%", paddingLeft: 55, paddingRight: 55, display: "flex", justifyContent: "center" }}>
            <HeaderWrapper side={config.left} textColor={textColor} entranceDelay={8} />
          </div>
          <div style={{ width: "50%", paddingLeft: 55, paddingRight: 55, display: "flex", justifyContent: "center" }}>
            <HeaderWrapper side={config.right} textColor={textColor} entranceDelay={12} />
          </div>
        </div>

        {/* Independent Content Columns */}
        <div style={{ display: "flex", flexDirection: "row", width: "100%" }}>
          {/* Left Column */}
          <div style={{ width: "50%", paddingLeft: 55, paddingRight: 55, display: "flex", flexDirection: "column", gap: 40 }}>
            {config.left.blocks.map((block, bIdx) => (
              <BlockWrapper 
                key={`left-${bIdx}`}
                block={block} 
                entranceDelay={8} 
                bIdx={bIdx} 
                accentColor={config.left.accentColor || "#3b82f6"} 
                textColor={textColor} 
              />
            ))}
          </div>
          
          {/* Right Column */}
          <div style={{ width: "50%", paddingLeft: 55, paddingRight: 55, display: "flex", flexDirection: "column", gap: 40 }}>
            {config.right.blocks.map((block, bIdx) => (
              <BlockWrapper 
                key={`right-${bIdx}`}
                block={block} 
                entranceDelay={12} 
                bIdx={bIdx} 
                accentColor={config.right.accentColor || "#8b5cf6"} 
                textColor={textColor} 
              />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default DynamicComparison;
