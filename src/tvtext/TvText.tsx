import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { Video } from '@remotion/media';
import { loadInter } from "../utils/localFonts";
import crtFrame from '../../public/tvtext_assets/crt.png';

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
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

interface TextSegment {
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
  startFrame?: number;
}

interface NumberSegment {
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
  startFrame?: number;
}

type Segment = TextSegment | NumberSegment;

interface ThemeConfig {
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

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_THEME: Required<ThemeConfig> = {
  backgroundColor: "#000000",
  backgroundGradient: "",
  backgroundImage: "",
  orb1Color: "rgba(37, 99, 235, 0.12)",
  orb2Color: "rgba(139, 92, 246, 0.08)",
  orb3Color: "rgba(244, 63, 94, 0.06)",
  showOrbs: false,
  gridColor: "#94a3b8",
  showGrid: false,
  gridOpacity: 0.15,
  textFontSize: 64,
  numberFontSize: 80,
  wordStaggerFrames: 6,
  emphasisDelay: 12,
  countUpDuration: 35,
  contentPaddingX: 60,
  lineHeight: 1.4,
  textAlign: "left",
};

// ─── Color Palette ───────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  primary: "#ffffff",
  slate: "#64748b",
  blue: "#0284c7",
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
  primary: "rgba(255, 255, 255, 0.15)",
  blue: "rgba(2, 132, 199, 0.25)",
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
  if (!color) return "rgba(2, 132, 199, 0.25)";
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
  return { fontFamily: interFamily, fontWeight: 700, fontStyle: "normal" };
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

const isVideoFile = (src: string) => {
  const ext = src.split('.').pop()?.toLowerCase();
  return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext || '');
};

const parseNumericToken = (val: string) => {
  const match = val.match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
  if (match) {
    return {
      prefix: match[1] || "",
      numStr:  match[2],
      suffix:  match[3] || "",
      value:   parseFloat(match[2].replace(/,/g, "")) || 0,
    };
  }
  return { prefix: "", numStr: "", suffix: "", value: 0 };
};

function parseTextToSegments(text: string): Segment[] {
  const words = text.split(/\s+/).filter(w => w.trim() !== "");
  const segments: Segment[] = [];
  let currentTextWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isNumber = /[\d]/.test(word);
    if (isNumber) {
      if (currentTextWords.length > 0) {
        segments.push({
          type: "text",
          value: currentTextWords.join(" "),
          style: "italic-serif",
          color: "white",
          animation: "slideUp",
        });
        currentTextWords = [];
      }
      const parsed = parseNumericToken(word);
      segments.push({
        type: "number",
        value: parsed.value,
        prefix: parsed.prefix,
        suffix: parsed.suffix,
        animation: "countUp",
        color: "blue",
      });
    } else {
      currentTextWords.push(word);
    }
  }

  if (currentTextWords.length > 0) {
    segments.push({
      type: "text",
      value: currentTextWords.join(" "),
      style: "italic-serif",
      color: "white",
      animation: "slideUp",
    });
  }

  return segments;
}

function validateSegment(seg: unknown, _index: number): Segment | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;

  if (s.type === "text") {
    return {
      type: "text",
      value: (s.value as string) || "",
      style: (s.style as TextStyle) || "italic-serif",
      case: (s.case as TextCase) || "original",
      color: (s.color as string) || "primary",
      emphasis: (s.emphasis as EmphasisType) || "none",
      emphasisColor: (s.emphasisColor as string) || undefined,
      animation: (s.animation as TextAnimation) || "slideUp",
      fontSize: typeof s.fontSize === "number" ? s.fontSize : undefined,
      lineBreak: !!s.lineBreak,
      startFrame: typeof s.startFrame === "number" ? s.startFrame : undefined,
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
      startFrame: typeof s.startFrame === "number" ? s.startFrame : undefined,
    };
  }

  return null;
}

function mergeTheme(jsonTheme?: ThemeConfig): Required<ThemeConfig> {
  return { ...DEFAULT_THEME, ...(jsonTheme || {}) };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

  let opacity = 1;
  let translateY = 0;
  let scale = 1;

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
  const textColor = "#ffffff";
  const displayText = applyCase(segment.value, segment.case);
  const words = displayText.split(" ").filter((w) => w.trim() !== "");
  const anim = segment.animation || "slideUp";
  const fontSize = segment.fontSize || theme.textFontSize;

  const emphasisStart = startFrame + theme.emphasisDelay;
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
        lineHeight: theme.lineHeight,
        letterSpacing: segment.style === "cursive" ? "0.02em" : "-0.01em",
        margin: "0 6px",
      }}
    >
      {/* Gradient wipe highlight */}
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

      {/* Clean underline draw */}
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
            zIndex: 0,
            opacity: 0.75,
          }}
        />
      )}

      {/* Clean box emphasis */}
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
  const { fps } = useVideoConfig();

  const textColor = "#ffffff";
  const prefix = segment.prefix || "";
  const suffix = segment.suffix || "";
  const decimals = segment.decimals || 0;
  const targetValue = segment.value;
  const format = segment.format || "normal";
  const anim = segment.animation || "countUp";
  const fontSize = segment.fontSize || theme.numberFontSize;

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

  // Spring behavior for pop
  const popSpring = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 1.0 },
  });

  let scale = interpolate(entranceProgress, [0, 1], [0.9, 1]);
  if (anim === "pop") {
    scale = interpolate(popSpring, [0, 1], [0.8, 1.0]);
  }

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

  // Simple subtle shadow for readability on any background
  const textShadow = `0 4px 12px rgba(0, 0, 0, 0.5)`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        position: "relative",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "center center",
        lineHeight: 1,
        margin: "0 8px",
        filter: `blur(${blur}px)`,
      }}
    >
      {prefix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 700,
            fontSize: fontSize * 0.85,
            color: textColor,
            letterSpacing: "-0.02em",
            zIndex: 1,
            marginRight: 4,
            opacity: 0.9,
          }}
        >
          {prefix}
        </span>
      )}

      <span
        style={{
          fontFamily: interFamily,
          fontWeight: 700,
          fontSize,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          zIndex: 1,
          textShadow,
        }}
      >
        {displayString}
      </span>

      {suffix && (
        <span
          style={{
            fontFamily: interFamily,
            fontWeight: 700,
            fontSize: fontSize * 0.65,
            color: textColor,
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

// ─── Main Component ──────────────────────────────────────────────────────────

interface TvTextProps {
  mediaSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  mediaScale?: number;
  text?: string;
  segments?: Segment[];
  theme?: ThemeConfig;
}

export const TvText: React.FC<TvTextProps> = ({
  mediaSrc = 'tvtext_assets/final_result.mp4',
  objectFit = 'cover',
  mediaScale,
  text = 'Desh ma 2 crore log 80% offline chhe',
  segments: propSegments,
  theme: propTheme,
}) => {
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const resolvedScale = mediaScale ?? 1.0;
  const isColor = (str: string) => str.startsWith('#') || str.startsWith('rgb') || ['white', 'black', 'transparent'].includes(str.toLowerCase());
  const resolvedSrc = isColor(mediaSrc) ? "" : staticFile(mediaSrc);

  // Preserving standard 1082x812 aspect ratio of crt.png
  const tvAspectRatio = 1082 / 812;

  let tvWidth = compWidth;
  let tvHeight = compWidth / tvAspectRatio;

  if (tvHeight > compHeight) {
    tvHeight = compHeight;
    tvWidth = compHeight * tvAspectRatio;
  }

  // Scale down to 80% width (decreasing size from the right side)
  const scaleFactor = 0.80;
  tvWidth = Math.round(tvWidth * scaleFactor);
  tvHeight = Math.round(tvHeight * scaleFactor);

  // Resolve theme
  const theme = mergeTheme(propTheme);

  // Parse segments or fall back to parsing text prop
  const rawSegments = propSegments || (text ? parseTextToSegments(text) : []);
  
  const segments: Segment[] = rawSegments
    .map((seg, i) => validateSegment(seg, i))
    .filter((s): s is Segment => s !== null);

  // If JSON config has segments with their own startFrames, use those.
  // Otherwise fallback to stagger.
  let currentStartFrame = 15;
  const segmentsWithTiming = segments.map((segment) => {
    const startFrame = segment.startFrame ?? currentStartFrame;
    if (segment.startFrame === undefined) {
      if (segment.type === "text") {
        const words = segment.value.split(" ").filter((w) => w.trim() !== "");
        currentStartFrame += words.length * theme.wordStaggerFrames;
      } else {
        currentStartFrame += 1 * theme.wordStaggerFrames;
      }
    }
    return { segment, startFrame };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#121212', // Slightly lighter than pure black so TV frame is visible
        alignItems: 'center', // Centers vertically
        justifyContent: 'flex-start', // Aligns to the left side
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* TV screen mockup container */}
      <div
        style={{
          width: tvWidth,
          height: tvHeight,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000000',
          marginLeft: theme.contentPaddingX, // Align exactly with text
          transform: 'translateY(-150px)', // Pushes the TV mockup upward slightly
        }}
      >
        {/* Screen Media Content — forced cover via wrapper */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            zIndex: 1,
            backgroundColor: isColor(mediaSrc) ? mediaSrc : '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 22,
          }}
        >
          {!isColor(mediaSrc) && (
            isVideoFile(mediaSrc) ? (
              <Video
                src={resolvedSrc}
                style={{
                  minWidth: '100%',
                  minHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  flexShrink: 0,
                }}
              />
            ) : (
              <img
                src={resolvedSrc}
                style={{
                  minWidth: '100%',
                  minHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  flexShrink: 0,
                }}
              />
            )
          )}
        </div>

        {/* Static TV Bezel frame on top — slightly enlarged to cover edge bleed */}
        <div
          style={{
            position: 'absolute',
            left: -6,
            top: -6,
            right: -6,
            bottom: -6,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <Img
            src={crtFrame}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
            }}
          />
        </div>
      </div>

      {/* Kinetic text container anchored from top to prevent vertical layout shift / reflow when text wraps */}
      <div
        style={{
          position: 'absolute',
          left: theme.contentPaddingX,
          right: theme.contentPaddingX,
          top: 1160,
          zIndex: 20000,
        }}
      >
        <div
          style={{
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
            width: "100%",
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
      </div>
    </AbsoluteFill>
  );
};

export default TvText;

export const getTvTextDuration = () => {
  let config: any;
  try {
    config = require("./tvtext-config.json");
  } catch {
    config = {};
  }
  
  const comp = config?.composition;
  const fps = comp?.fps ?? 24;
  if (comp?.durationSeconds) return Math.round(comp.durationSeconds * fps);
  if (comp?.durationInFrames) return comp.durationInFrames;

  const segments = config.captions || [];
  let maxFrame = 0;
  
  if (Array.isArray(segments)) {
    segments.forEach((seg: any) => {
      const start = seg.startFrame ?? 0;
      const wordCount = seg.value ? String(seg.value).split(" ").length : 1;
      const end = start + wordCount * 6 + 30;
      if (end > maxFrame) {
        maxFrame = end;
      }
    });
  }
  
  return Math.max(120, maxFrame + 60);
};
