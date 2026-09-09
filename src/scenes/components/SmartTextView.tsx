import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

import { loadInter, loadPlayfair, loadDancingScript } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const { fontFamily: playfairFamily } = loadPlayfair("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

loadPlayfair("italic", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

const { fontFamily: cursiveFamily } = loadDancingScript("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

// ─── Types ───────────────────────────────────────────────────────────────────

type TextStyle =
  | "normal"
  | "bold"
  | "italic"
  | "serif"
  | "italic-serif"
  | "cursive";

type TextCase = "original" | "uppercase" | "lowercase" | "title";

type EmphasisType = "none" | "marker" | "underline" | "box" | "textColor";

type TextAnimation = "fadeUp" | "wordReveal" | "scaleIn" | "slideUp" | "none";

type NumberFormat = "normal" | "comma" | "compact" | "currency" | "percentage";

type NumberAnimation = "countUp" | "pop" | "static";

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
  delayFrames?: number;
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
  delayFrames?: number;
}

export type Segment = TextSegment | NumberSegment;

export interface ThemeConfig {
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  orb1Color?: string;
  orb2Color?: string;
  orb3Color?: string;
  showOrbs?: boolean;
  gridColor?: string;
  showGrid?: boolean;
  gridOpacity?: number;
  textFontSize?: number;
  numberFontSize?: number;
  wordStaggerFrames?: number;
  emphasisDelay?: number;
  countUpDuration?: number;
  contentPaddingX?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
}

interface SmartTextConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  theme?: ThemeConfig;
  segments: Segment[];
}

export interface SmartTextViewProps {
  segments?: Segment[];
  theme?: ThemeConfig;
  isOverlay?: boolean;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_THEME: Required<ThemeConfig> = {
  backgroundColor: "#fcfcfd",
  backgroundGradient: "",
  backgroundImage: "",
  orb1Color: "rgba(37, 99, 235, 0.12)",
  orb2Color: "rgba(139, 92, 246, 0.08)",
  orb3Color: "rgba(244, 63, 94, 0.06)",
  showOrbs: true,
  gridColor: "#94a3b8",
  showGrid: true,
  gridOpacity: 0.15,
  textFontSize: 72,
  numberFontSize: 110,
  wordStaggerFrames: 4,
  emphasisDelay: 12,
  countUpDuration: 35,
  contentPaddingX: 100,
  lineHeight: 1.45,
  textAlign: "center",
};

const CANVAS_WIDTH = 1080;

// ── Portrait Screen Guardrails ─────────────────────────────────────────────
// At 72px font, ~6 words fit per line. 4 visible lines = ~24 words max.
// At 56px font, ~8 words fit per line. 4 visible lines = ~32 words max.
// Adding generous headroom for numbers/emphasis → cap at 40 total words.
const MAX_TOTAL_WORDS = 40;
const MAX_SEGMENTS = 10;

// ─── Color Palette ───────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveColor(color: string | undefined, fallback?: string): string {
  if (!color) return fallback || COLOR_MAP.primary;
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  // Accept any valid CSS color string (hex, rgba, hsl, etc.)
  if (/^#([0-9a-fA-F]{3,8})$/.test(color)) return color;
  if (
    color.startsWith("rgba(") ||
    color.startsWith("rgb(") ||
    color.startsWith("hsl")
  )
    return color;
  return fallback || COLOR_MAP.primary;
}

function resolveMarkerColor(
  color: string | undefined,
  emphasisColor?: string,
): string {
  if (emphasisColor) return resolveColor(emphasisColor);
  if (!color) return "rgba(253, 224, 71, 0.4)";
  if (MARKER_COLORS[color]) return MARKER_COLORS[color];
  const resolved = resolveColor(color);
  return resolved + "33";
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
        "₹" +
        value.toLocaleString("en-IN", {
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

function validateSegment(seg: unknown, _index: number): Segment | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;

  if (s.type === "text") {
    return {
      type: "text",
      value: (s.value as string) || "",
      style: (s.style as TextStyle) || "normal",
      case: (s.case as TextCase) || "original",
      color: (s.color as string) || "primary",
      emphasis: (s.emphasis as EmphasisType) || "none",
      emphasisColor: (s.emphasisColor as string) || undefined,
      animation: (s.animation as TextAnimation) || "fadeUp",
      fontSize: typeof s.fontSize === "number" ? s.fontSize : undefined,
      lineBreak: !!s.lineBreak,
      delayFrames: typeof s.delayFrames === "number" ? s.delayFrames : undefined,
    };
  }

  if (s.type === "number") {
    return {
      type: "number",
      value: (s.value as number) || 0,
      prefix: (s.prefix as string) || "",
      suffix: (s.suffix as string) || "",
      decimals: (s.decimals as number) || 0,
      format: (s.format as NumberFormat) || "normal",
      animation: (s.animation as NumberAnimation) || "countUp",
      color: (s.color as string) || "blue",
      fontSize: typeof s.fontSize === "number" ? s.fontSize : undefined,
      lineBreak: !!s.lineBreak,
      delayFrames: typeof s.delayFrames === "number" ? s.delayFrames : undefined,
    };
  }

  return null;
}

function mergeTheme(jsonTheme?: ThemeConfig): Required<ThemeConfig> {
  return { ...DEFAULT_THEME, ...(jsonTheme || {}) };
}

// ─── Animated Background Component ─────────────────────────────────────────────

const AnimatedBackground: React.FC<{ theme: Required<ThemeConfig> }> = ({
  theme,
}) => {
  const frame = useCurrentFrame();

  const orb1X = Math.sin(frame / 60) * 120;
  const orb1Y = Math.cos(frame / 50) * 100;
  const orb2X = Math.cos(frame / 70) * -150;
  const orb2Y = Math.sin(frame / 55) * 120;
  const orb3X = Math.sin(frame / 45) * 80;
  const orb3Y = Math.cos(frame / 65) * -140;

  const hasBgImage = !!theme.backgroundImage;
  const baseStyle: React.CSSProperties = {
    overflow: "hidden",
    backgroundColor: hasBgImage
      ? "#000"
      : theme.backgroundGradient
        ? undefined
        : theme.backgroundColor,
    background:
      !hasBgImage && theme.backgroundGradient
        ? theme.backgroundGradient
        : undefined,
  };

  return (
    <AbsoluteFill style={baseStyle}>
      {hasBgImage && (
        <Img
          src={theme.backgroundImage}
          style={{
            position: "absolute",
            top: "-10%",
            left: "-10%",
            width: "120%",
            height: "120%",
            objectFit: "cover",
            filter: "blur(30px)",
            opacity: 0.9,
            translate: "106.1px 184.9px",
          }}
          from={-208}
        />
      )}
      {/* Tint overlay over the image */}
      {hasBgImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.backgroundGradient || theme.backgroundColor,
            opacity: 0.85, // Shade opacity to blend the image with theme colors
          }}
        />
      )}
      {/* Dynamic light orbs — fully controlled by theme */}
      {theme.showOrbs && (
        <>
          <div
            style={{
              position: "absolute",
              width: 900,
              height: 900,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.orb1Color} 0%, transparent 60%)`,
              filter: "blur(60px)",
              top: "-10%",
              left: "-10%",
              transform: `translate(${orb1X}px, ${orb1Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 1200,
              height: 1200,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.orb2Color} 0%, transparent 60%)`,
              filter: "blur(80px)",
              bottom: "-20%",
              right: "-20%",
              transform: `translate(${orb2X}px, ${orb2Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 800,
              height: 800,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.orb3Color} 0%, transparent 60%)`,
              filter: "blur(50px)",
              top: "40%",
              left: "40%",
              transform: `translate(${orb3X}px, ${orb3Y}px)`,
            }}
          />
        </>
      )}
      {/* Studio line-mesh grid with radial fade mask */}
      {theme.showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(to right, ${theme.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${theme.gridColor} 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            opacity: theme.gridOpacity,
            maskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 90%)",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const WordRenderer: React.FC<{
  word: string;
  startFrame: number;
  anim: TextAnimation;
  isLast: boolean;
}> = ({ word, startFrame, anim, isLast }) => {
  const frame = useCurrentFrame();

  // Spring-physics entrance: natural overshoot then gentle settle
  const t = interpolate(frame, [startFrame, startFrame + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1.15, 0.36, 1), // subtle spring overshoot
  });

  // Smooth opacity ramp (faster than position so text is readable early)
  const opacityT = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  let opacity = 1;
  let translateY = 0;
  let scale = 1;
  let blur = 0;

  if (anim === "fadeUp") {
    opacity = opacityT;
    translateY = interpolate(t, [0, 1], [22, 0]);
    blur = interpolate(opacityT, [0, 1], [4, 0]);
  } else if (anim === "slideUp") {
    opacity = opacityT;
    translateY = interpolate(t, [0, 1], [32, 0]);
  } else if (anim === "scaleIn") {
    opacity = opacityT;
    scale = interpolate(t, [0, 1], [0.82, 1]);
    blur = interpolate(opacityT, [0, 1], [6, 0]);
  } else if (anim === "wordReveal") {
    opacity = opacityT;
    translateY = interpolate(t, [0, 1], [16, 0]);
    blur = interpolate(opacityT, [0, 1], [3, 0]);
  } else {
    opacity = 1;
  }

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "bottom center",
        marginRight: isLast ? 0 : "0.25em",
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
      }}
    >
      {word}
    </span>
  );
};

const TextSegmentRenderer: React.FC<{
  segment: TextSegment;
  startFrame: number;
  theme: Required<ThemeConfig>;
}> = ({ segment, startFrame, theme }) => {
  const frame = useCurrentFrame();

  const fontProps = getFontProps(segment.style);
  const textColor = resolveColor(segment.color);
  const displayText = applyCase(segment.value, segment.case);
  const words = displayText.split(" ").filter((w) => w.trim() !== "");
  const anim = segment.animation || "fadeUp";
  const fontSize = segment.fontSize || theme.textFontSize;

  // ── Emphasis Physics ──
  const emphasisStart =
    startFrame + words.length * theme.wordStaggerFrames + theme.emphasisDelay;
  const emphasis = segment.emphasis || "none";

  // Smooth emphasis progress — no spring bounce
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
        display: "inline",
        position: "relative",
        ...fontProps,
        fontSize,
        color: textColor,
        lineHeight: theme.lineHeight,
        letterSpacing: segment.style === "cursive" ? "0.02em" : "-0.015em",
        margin: "0 4px",
        // Inline pill-style highlight that wraps correctly per word on multi-line
        ...(emphasis === "marker" ? {
          backgroundImage: `linear-gradient(to right, ${markerColor} 0%, ${markerColor} 100%)`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center",
          backgroundSize: `${emphasisProgress * 100}% 90%`,
          borderRadius: 6,
          padding: "2px 6px",
          boxDecorationBreak: "clone" as any,
          WebkitBoxDecorationBreak: "clone" as any,
        } : {}),
      }}
    >
      {/* Proportional underline that matches actual text width */}
      {emphasis === "underline" && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 2,
            height: Math.max(3, Math.round(fontSize * 0.06)),
            backgroundColor: textColor,
            borderRadius: 2,
            transform: `scaleX(${emphasisProgress})`,
            transformOrigin: "left center",
            zIndex: 0,
            opacity: 0.6,
          }}
        />
      )}

      {/* Refined box emphasis with rounded corners */}
      {emphasis === "box" && (
        <span
          style={{
            position: "absolute",
            left: -8,
            right: -8,
            top: "5%",
            bottom: "5%",
            border: `2px solid ${textColor}`,
            borderRadius: 8,
            opacity: emphasisProgress * 0.5,
            zIndex: 0,
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
            startFrame={startFrame + i * theme.wordStaggerFrames}
            anim={anim}
            isLast={i === words.length - 1}
          />
        ))}
      </span>
    </span>
  );
};

const NumberSegmentRenderer: React.FC<{
  segment: NumberSegment;
  startFrame: number;
  theme: Required<ThemeConfig>;
}> = ({ segment, startFrame, theme }) => {
  const frame = useCurrentFrame();

  const textColor = resolveColor(segment.color);
  const prefix = segment.prefix || "";
  const suffix = segment.suffix || "";
  const decimals = segment.decimals || 0;
  const targetValue = segment.value;
  const format = segment.format || "normal";
  const anim = segment.animation || "countUp";
  const fontSize = segment.fontSize || theme.numberFontSize;

  // Clean smooth entrance — no spring, no bounce
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

  // Count-up animation
  let displayValue: number;
  if (anim === "countUp") {
    const countProgress = interpolate(
      frame,
      [startFrame, startFrame + theme.countUpDuration],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      },
    );
    displayValue = countProgress * targetValue;
  } else if (anim === "pop") {
    // For pop: just appear at full value, the entrance handles the visual
    displayValue = targetValue;
  } else {
    displayValue = targetValue;
  }

  const formattedNumber = formatNumber(displayValue, format, decimals);
  let displayString: string;

  if (
    format === "compact" &&
    anim === "countUp" &&
    frame < startFrame + theme.countUpDuration
  ) {
    displayString =
      decimals > 0
        ? displayValue.toFixed(decimals)
        : String(Math.round(displayValue));
  } else {
    displayString = formattedNumber;
  }

  // Detect if bg is dark for adaptive glow
  const bgColor = theme.backgroundColor || "#fcfcfd";
  const isDark = bgColor.startsWith("#0") || bgColor.startsWith("#1") || bgColor.startsWith("#2") || bgColor === "#000" || bgColor === "#000000";
  const glowShadow = isDark
    ? `0 0 40px ${textColor}22, 0 4px 20px rgba(0,0,0,0.3)`
    : `0 8px 24px rgba(0, 0, 0, 0.06)`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        position: "relative",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "center center",
        lineHeight: 1.1,
        margin: "0 6px",
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* Prefix — accent colored, slightly smaller */}
      {prefix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            fontSize: fontSize * 0.75,
            color: textColor,
            letterSpacing: "-0.02em",
            zIndex: 1,
            marginRight: 4,
            opacity: 0.85,
          }}
        >
          {prefix}
        </span>
      )}

      {/* Main number — bold, tight tracking with adaptive glow */}
      <span
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          fontSize,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.04em",
          zIndex: 1,
          textShadow: glowShadow,
        }}
      >
        {displayString}
      </span>

      {/* Suffix — accent colored, proportionally smaller */}
      {suffix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 800,
            fontSize: fontSize * 0.55,
            color: textColor,
            marginLeft: 4,
            letterSpacing: "-0.01em",
            zIndex: 1,
            opacity: 0.75,
          }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const SmartTextView: React.FC<SmartTextViewProps> = (props) => {
  let config: SmartTextConfig;
  try {
    config = require("./smart-text.json") as SmartTextConfig;
  } catch {
    config = { segments: [] };
  }

  const rawSegments = props.segments || config.segments || [];
  const theme = mergeTheme({ ...(config.theme || {}), ...(props.theme || {}) });

  const validatedSegments: Segment[] = rawSegments
    .map((seg, i) => validateSegment(seg, i))
    .filter((s): s is Segment => s !== null);

  // Enforce segment count limit — prevents LLM hallucination of mega-configs
  const segments = validatedSegments.slice(0, MAX_SEGMENTS);
  if (validatedSegments.length > MAX_SEGMENTS) {
    console.warn(`SmartTextView: ${validatedSegments.length} segments exceeds max ${MAX_SEGMENTS}. Truncated.`);
  }

  // Count total words across all segments and warn if exceeding portrait screen capacity
  const totalWords = segments.reduce((acc, seg) => {
    if (seg.type === 'text') return acc + seg.value.split(' ').filter(Boolean).length;
    return acc + 1; // numbers count as 1 word
  }, 0);
  if (totalWords > MAX_TOTAL_WORDS) {
    console.warn(`SmartTextView: ${totalWords} words may overflow portrait screen (max recommended: ${MAX_TOTAL_WORDS}).`);
  }

  if (segments.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme.backgroundColor,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: interFamily,
          color: "#ef4444",
          fontSize: 36,
        }}
      >
        ⚠ No valid segments found. Check smart-text.json
      </AbsoluteFill>
    );
  }

  // Pre-calculate start frames so each word staggers sequentially
  let currentStartFrame = 0;
  const segmentsWithTiming = segments.map((segment) => {
    if (segment.delayFrames) {
      currentStartFrame += segment.delayFrames;
    }
    const startFrame = currentStartFrame;
    if (segment.type === "text") {
      const words = segment.value.split(" ").filter((w) => w.trim() !== "");
      currentStartFrame += words.length * theme.wordStaggerFrames;
    } else {
      currentStartFrame += 1 * theme.wordStaggerFrames;
    }
    return { segment, startFrame };
  });

  return (
    <AbsoluteFill style={props.isOverlay ? { backgroundColor: "transparent" } : {}}>
      {!props.isOverlay && <AnimatedBackground theme={theme} />}

      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          perspective: 1000,
          ...(props.isOverlay ? { backgroundColor: "transparent" } : {}),
        }}
      >
        <div
          style={{
            width: CANVAS_WIDTH - theme.contentPaddingX * 2,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent:
              theme.textAlign === "left"
                ? "flex-start"
                : theme.textAlign === "right"
                  ? "flex-end"
                  : "center",
            textAlign: theme.textAlign,
          }}
        >
          {segmentsWithTiming.map(({ segment, startFrame }, index) => {
            let node = null;
            if (segment.type === "text") {
              node = (
                <TextSegmentRenderer
                  key={`text-${index}`}
                  segment={segment}
                  startFrame={startFrame}
                  theme={theme}
                />
              );
            } else if (segment.type === "number") {
              node = (
                <NumberSegmentRenderer
                  key={`num-${index}`}
                  segment={segment}
                  startFrame={startFrame}
                  theme={theme}
                />
              );
            }

            if (!node) return null;

            return (
              <React.Fragment key={`frag-${index}`}>
                {node}
                {segment.lineBreak && (
                  <div style={{ flexBasis: "100%", height: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default SmartTextView;

export const getSmartTextDuration = () => {
  let config: SmartTextConfig;
  try {
    config = require("./smart-text.json") as SmartTextConfig;
  } catch {
    config = { segments: [] };
  }

  // Allow explicit duration override from JSON
  const comp = (config as any).composition;
  const fps = comp?.fps ?? 60;
  if (comp?.durationSeconds) return Math.round(comp.durationSeconds * fps);
  if (comp?.durationInFrames) return comp.durationInFrames;

  const rawSegments = config.segments || [];
  const theme = mergeTheme(config.theme || {});

  let currentStartFrame = 0;
  rawSegments.forEach((seg: any) => {
    if (typeof seg.delayFrames === "number") {
      currentStartFrame += seg.delayFrames;
    }
    if (seg.type === "text") {
      const words = (seg.value || "").split(" ").filter((w: string) => w.trim() !== "");
      currentStartFrame += words.length * theme.wordStaggerFrames;
    } else if (seg.type === "number") {
      currentStartFrame += 1 * theme.wordStaggerFrames;
    }
  });

  // Add the count-up duration if there's a number segment, plus a 2-second cinematic hold (60 frames)
  return currentStartFrame + theme.countUpDuration + 60;
};
