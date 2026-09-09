import React from "react";
import { spring, interpolate, Easing } from "remotion";

export type TextStyle = "normal" | "bold" | "italic" | "serif" | "italic-serif" | "cursive";
export type TextCase = "original" | "uppercase" | "lowercase" | "title";
export type EmphasisType = "none" | "marker" | "underline" | "box" | "textColor";

export interface TextSegment {
  type: "text";
  value: string;
  style?: TextStyle;
  case?: TextCase;
  color?: string;
  emphasis?: EmphasisType;
  emphasisColor?: string;
  fontSize?: number;
}

export interface NumberSegment {
  type: "number";
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  format?: "normal" | "comma" | "compact" | "currency" | "percentage";
  color?: string;
  fontSize?: number;
}

export type Segment = TextSegment | NumberSegment;

export interface TextSectionConfig {
  value?: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  marginTop?: number;
  marginSide?: number;
  entranceDelay?: number;
  staggerFrames?: number;
}

export interface TextSectionProps {
  segments?: Segment[];
  fallbackText?: string;
  textConfig: TextSectionConfig;
  fontFamilyMap: Record<string, string>;
  frame: number;
  fps: number;
}

// ─── Helpers for Styling & Sizing ───────────────────────────────────────────
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
  primary: "rgba(15, 23, 42, 0.08)",
  blue: "rgba(37, 99, 235, 0.15)",
  amber: "rgba(245, 158, 11, 0.20)",
  rose: "rgba(244, 63, 94, 0.15)",
  emerald: "rgba(16, 185, 129, 0.15)",
  violet: "rgba(139, 92, 246, 0.15)",
  teal: "rgba(20, 184, 166, 0.15)",
  orange: "rgba(249, 115, 22, 0.15)",
  cyan: "rgba(6, 182, 212, 0.15)",
  white: "rgba(255, 255, 255, 0.15)",
};

function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  if (/^#([0-9a-fA-F]{3,8})$/.test(color)) return color;
  if (color.startsWith("rgba(") || color.startsWith("rgb(") || color.startsWith("hsl")) return color;
  return fallback;
}

function resolveMarkerColor(color: string | undefined, emphasisColor?: string): string {
  if (emphasisColor) return resolveColor(emphasisColor, "rgba(253, 224, 71, 0.4)");
  if (!color) return "rgba(253, 224, 71, 0.4)";
  if (MARKER_COLORS[color]) return MARKER_COLORS[color];
  const resolved = resolveColor(color, "#2563eb");
  return resolved + "33"; // Hex opacity overlay
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

function formatNumber(
  value: number,
  format: "normal" | "comma" | "compact" | "currency" | "percentage" = "normal",
  decimals: number = 0
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
      return "$" + value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    case "percentage":
      return value.toFixed(decimals) + "%";
    default:
      return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  }
}

// ─── Word Span Component ─────────────────────────────────────────────────────
const WordSpan: React.FC<{
  word: string;
  startFrame: number;
  fontFamily: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  emphasis: EmphasisType;
  emphasisColor: string;
  fps: number;
  frame: number;
}> = ({
  word,
  startFrame,
  fontFamily,
  color,
  fontSize,
  fontWeight,
  fontStyle,
  emphasis,
  emphasisColor,
  fps,
  frame,
}) => {
  const wordSpring = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 85, mass: 0.8 },
  });

  const wordY = interpolate(wordSpring, [0, 1], [25, 0]);
  const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1]);
  const wordBlur = interpolate(wordSpring, [0, 1], [10, 0]);

  // Highlight line/box expansion spring
  const emphasisSpring = spring({
    frame: Math.max(0, frame - startFrame - 6),
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const hasMarker = emphasis === "marker";
  const hasUnderline = emphasis === "underline";
  const hasBox = emphasis === "box";

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        fontFamily,
        fontWeight,
        fontStyle,
        color: emphasis === "textColor" ? emphasisColor : color,
        opacity: wordOpacity,
        transform: `translateY(${wordY}px)`,
        filter: `blur(${wordBlur}px)`,
        padding: hasBox ? "4px 10px" : hasMarker ? "0 4px" : "0 2px",
        margin: "0 4px",
        borderRadius: hasBox ? "8px" : "0px",
        backgroundColor: hasBox ? emphasisColor : "transparent",
        boxSizing: "border-box",
        fontSize: `${fontSize}px`,
        letterSpacing: fontStyle === "italic" || fontFamily.includes("Dancing") ? "0.02em" : "-0.01em",
      }}
    >
      {/* Marker Highlight background overlay */}
      {hasMarker && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: emphasisColor,
            transform: `scaleX(${emphasisSpring})`,
            transformOrigin: "left center",
            zIndex: -1,
            borderRadius: "4px",
          }}
        />
      )}

      {/* Underline overlay */}
      {hasUnderline && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "2px",
            height: "4px",
            backgroundColor: emphasisColor,
            transform: `scaleX(${emphasisSpring})`,
            transformOrigin: "left center",
          }}
        />
      )}

      {word}
    </span>
  );
};

// ─── Number Span Component ───────────────────────────────────────────────────
const NumberSpan: React.FC<{
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  format: "normal" | "comma" | "compact" | "currency" | "percentage";
  startFrame: number;
  fontFamily: string;
  color: string;
  fontSize: number;
  fps: number;
  frame: number;
}> = ({
  value,
  prefix,
  suffix,
  decimals,
  format,
  startFrame,
  fontFamily,
  color,
  fontSize,
  fps,
  frame,
}) => {
  const numberSpring = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 15, stiffness: 85, mass: 0.8 },
  });

  const y = interpolate(numberSpring, [0, 1], [30, 0]);
  const opacity = interpolate(numberSpring, [0, 1], [0, 1]);
  const blur = interpolate(numberSpring, [0, 1], [15, 0]);

  // Countup animation starting at startFrame
  const countProgress = interpolate(frame, [startFrame, startFrame + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const currentValue = 0 + (value - 0) * countProgress;
  const formatted = formatNumber(currentValue, format, decimals);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        position: "relative",
        opacity,
        transform: `translateY(${y}px) scaleY(1.12)`,
        transformOrigin: "center center",
        lineHeight: 1,
        margin: "0 8px",
        filter: `blur(${blur}px)`,
      }}
    >
      {/* Prefix — accent colored, slightly smaller */}
      {prefix && (
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: `${fontSize * 0.85}px`,
            color,
            letterSpacing: "-0.02em",
            zIndex: 1,
            marginRight: 4,
            opacity: 0.9,
          }}
        >
          {prefix}
        </span>
      )}

      {/* Main number — bold, stretched, tight tracking */}
      <span
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: `${fontSize}px`,
          color,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.04em",
          zIndex: 1,
          textShadow: `0 8px 24px rgba(0, 0, 0, 0.06)`,
        }}
      >
        {formatted}
      </span>

      {/* Suffix — accent colored, slightly smaller */}
      {suffix && (
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: `${fontSize * 0.65}px`,
            color,
            marginLeft: 4,
            letterSpacing: "-0.01em",
            zIndex: 1,
            opacity: 0.85,
          }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
};

// ─── Main TextSection Component ──────────────────────────────────────────────
export const TextSection: React.FC<TextSectionProps> = ({
  segments,
  fallbackText,
  textConfig,
  fontFamilyMap,
  frame,
  fps,
}) => {
  const defaultFontFamily = fontFamilyMap[textConfig.fontFamily ?? "Inter"] || fontFamilyMap.Inter;
  const defaultColor = resolveColor(textConfig.color, "#0f172a");
  const defaultFontSize = textConfig.fontSize ?? 72;
  const txtDelay = 120 + (textConfig.entranceDelay ?? 15); // Stagger text start after image shrinks (at frame 120)
  const wordStagger = textConfig.staggerFrames ?? 4;

  let currentStaggerOffset = 0;

  // Render a fallback text segment if no segments are provided
  const resolvedSegments: Segment[] = segments && segments.length > 0
    ? segments
    : [
        {
          type: "text",
          value: fallbackText ?? "",
          style: "normal",
          case: "original",
          color: textConfig.color ?? "primary",
          emphasis: "none",
        },
      ];

  return (
    <div
      style={{
        position: "absolute",
        top: textConfig.marginTop ?? 100,
        left: textConfig.marginSide ?? 80,
        right: textConfig.marginSide ?? 80,
        textAlign: textConfig.textAlign ?? "center",
        zIndex: 10,
        lineHeight: 1.35,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: textConfig.textAlign === "left" ? "flex-start" : textConfig.textAlign === "right" ? "flex-end" : "center",
        alignItems: "center",
      }}
    >
      {resolvedSegments.map((segment, segIdx) => {
        if (segment.type === "text") {
          const words = segment.value.split(" ").filter(Boolean);
          const segmentCase = segment.case ?? "original";
          const segmentStyle = segment.style ?? "normal";
          
          let resolvedFont = defaultFontFamily;
          let weight = 500;
          let fontStyle: "normal" | "italic" = "normal";

          if (segmentStyle === "bold") {
            weight = 800;
          } else if (segmentStyle === "italic") {
            fontStyle = "italic";
          } else if (segmentStyle === "serif") {
            resolvedFont = fontFamilyMap.PlayfairDisplay || defaultFontFamily;
            weight = 600;
          } else if (segmentStyle === "italic-serif") {
            resolvedFont = fontFamilyMap.PlayfairDisplay || defaultFontFamily;
            weight = 600;
            fontStyle = "italic";
          } else if (segmentStyle === "cursive") {
            resolvedFont = fontFamilyMap.DancingScript || defaultFontFamily;
            weight = 700;
          }

          const resolvedColorStr = resolveColor(segment.color, defaultColor);
          const emphasisColorStr = resolveMarkerColor(segment.color, segment.emphasisColor);
          const segFontSize = segment.fontSize ?? defaultFontSize;

          return words.map((word, wordIdx) => {
            const startFrame = txtDelay + currentStaggerOffset * wordStagger;
            currentStaggerOffset++;

            return (
              <WordSpan
                key={`seg-${segIdx}-word-${wordIdx}`}
                word={applyCase(word, segmentCase)}
                startFrame={startFrame}
                fontFamily={resolvedFont}
                color={resolvedColorStr}
                fontSize={segFontSize}
                fontWeight={weight}
                fontStyle={fontStyle}
                emphasis={segment.emphasis ?? "none"}
                emphasisColor={emphasisColorStr}
                fps={fps}
                frame={frame}
              />
            );
          });
        } else if (segment.type === "number") {
          const startFrame = txtDelay + currentStaggerOffset * wordStagger;
          currentStaggerOffset += 3; // Give number rendering a small stagger buffer

          const numberFont = defaultFontFamily; // Number uses sans-serif (Inter)
          const numberColor = resolveColor(segment.color, "#2563eb");
          const numberFontSize = segment.fontSize ?? 110;

          return (
            <NumberSpan
              key={`seg-${segIdx}-num`}
              value={segment.value}
              prefix={segment.prefix ?? ""}
              suffix={segment.suffix ?? ""}
              decimals={segment.decimals ?? 0}
              format={segment.format ?? "normal"}
              startFrame={startFrame}
              fontFamily={numberFont}
              color={numberColor}
              fontSize={numberFontSize}
              fps={fps}
              frame={frame}
            />
          );
        }
        return null;
      })}
    </div>
  );
};
