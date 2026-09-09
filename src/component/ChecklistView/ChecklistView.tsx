import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  interpolate,
} from "remotion";

import { loadInter } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// ─── Types ───────────────────────────────────────────────────────────────────

type MarkerType = "number" | "check" | "bullet";
type MarkerShape = "circle" | "square";
type BulletStyle = "dot" | "arrow" | "dash" | "star";
type ItemAnimation = "slideUp" | "fadeUp" | "scaleIn" | "none";

interface ChecklistItem {
  marker: MarkerType;
  value?: number; // For numbered markers
  text: string;
  description?: string;
  markerColor?: string;
  markerShape?: MarkerShape; // For checkmarks
  bulletStyle?: BulletStyle; // For bullet markers
  textColor?: string;
  descriptionColor?: string;
  textFontSize?: number;
  descriptionFontSize?: number;
  animation?: ItemAnimation;
  checked?: boolean;
  checkFrame?: number;
  checkDelay?: number;
  checkDelayAfterList?: number;
  checkAtProgress?: number; // Value between 0 and 1
  startFrame?: number;
  endFrame?: number;
  wordStaggerFrames?: number;
  wordHighlights?: { wordMatch: string; color: string }[];
}

interface ChecklistTheme {
  backgroundColor?: string;
  backgroundGradient?: string;
  showOrbs?: boolean;
  orb1Color?: string;
  orb2Color?: string;
  showGrid?: boolean;
  gridColor?: string;
  gridOpacity?: number;
  itemGap?: number;
  textFontSize?: number;
  descriptionFontSize?: number;
  numberFontSize?: number;
  markerSize?: number;
  staggerFrames?: number;
  contentPaddingX?: number;
  contentPaddingY?: number;
  showDividers?: boolean;
  dividerColor?: string;
  textAlign?: "left" | "center";
  fontFamily?: string;
}

interface ChecklistConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  theme?: ChecklistTheme;
  items: ChecklistItem[];
}

export interface ChecklistViewProps {
  items?: ChecklistItem[];
  theme?: ChecklistTheme;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_THEME: Required<ChecklistTheme> = {
  backgroundColor: "#0f172a",
  backgroundGradient: "",
  showOrbs: true,
  orb1Color: "rgba(59, 130, 246, 0.1)",
  orb2Color: "rgba(139, 92, 246, 0.08)",
  showGrid: true,
  gridColor: "#334155",
  gridOpacity: 0.08,
  itemGap: 36,
  textFontSize: 48,
  descriptionFontSize: 34,
  numberFontSize: 72,
  markerSize: 64,
  staggerFrames: 15,
  contentPaddingX: 80,
  contentPaddingY: 200,
  showDividers: false,
  dividerColor: "rgba(255,255,255,0.08)",
  textAlign: "left",
  fontFamily: "Inter",
};

// ─── Font Size Helper ────────────────────────────────────────────────────────

function getDynamicFontSize(text: string, baseFontSize: number, maxWidth: number): number {
  // Text will wrap via CSS, no need to aggressively shrink the font size.
  // We keep this function signature for backwards compatibility but just return baseFontSize.
  return baseFontSize;
}

// ─── Color Helper ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  blue: "#2563eb",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  teal: "#14b8a6",
  orange: "#f97316",
  cyan: "#06b6d4",
  slate: "#94a3b8",
};

function resolveColor(color?: string, fallback: string = "#ffffff"): string {
  if (!color) return fallback;
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  if (/^#|^rgba?\(|^hsl/.test(color)) return color;
  return fallback;
}

function mergeTheme(jsonTheme?: ChecklistTheme): Required<ChecklistTheme> {
  return { ...DEFAULT_THEME, ...(jsonTheme || {}) };
}

// ─── Animated Checkmark SVG ──────────────────────────────────────────────────

const AnimatedCheck: React.FC<{
  progress: number;
  checkProgress: number;
  color: string;
  size: number;
  shape: MarkerShape;
  isLightBackground?: boolean;
}> = ({ progress, checkProgress, color, size, shape, isLightBackground }) => {
  const bgOpacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bgScale = interpolate(progress, [0, 0.4], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Micro-animation: Pop scale when checked
  const checkScale = interpolate(checkProgress, [0, 0.5, 1], [1, 1.12, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grow background fill from the center
  const fillScale = interpolate(checkProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const strokeDashoffset = interpolate(checkProgress, [0, 1], [30, 0]);
  const borderRadius = shape === "circle" ? "50%" : size * 0.2;
  const shadowGlow = checkProgress > 0 ? `0 0 ${checkProgress * 12}px ${color}60` : "none";

  const uncheckedBorderColor = isLightBackground ? "rgba(15, 23, 42, 0.25)" : "rgba(255, 255, 255, 0.25)";

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
        transform: `scale(${bgScale * checkScale})`,
        boxShadow: shadowGlow,
        borderRadius,
      }}
    >
      {/* Background shape - grows from center when checked */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: color,
          borderRadius,
          transform: `scale(${fillScale})`,
          opacity: bgOpacity,
        }}
      />
      {/* Unchecked Border - clean semi-transparent border that fades out when checked */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `2.5px solid ${uncheckedBorderColor}`,
          borderRadius,
          opacity: bgOpacity * (1 - checkProgress),
        }}
      />
      {/* Checked Border - fades in with full category color */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `2.5px solid ${color}`,
          borderRadius,
          opacity: bgOpacity * checkProgress,
        }}
      />
      {/* Checkmark SVG - draws white stroke */}
      <svg
        width={size * 0.5}
        height={size * 0.5}
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
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
    </div>
  );
};

// ─── Number Marker ───────────────────────────────────────────────────────────

const NumberMarker: React.FC<{
  value: number;
  color: string;
  fontSize: number;
  progress: number;
}> = ({ value, color, fontSize, progress }) => {
  const scale = interpolate(progress, [0, 0.5], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: interFamily,
        fontWeight: 900,
        fontSize,
        color,
        lineHeight: 1,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        flexShrink: 0,
        minWidth: fontSize * 0.8,
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
  );
};

// ─── Bullet Marker ───────────────────────────────────────────────────────────

const BulletMarker: React.FC<{
  style: BulletStyle;
  color: string;
  size: number;
  progress: number;
}> = ({ style: bulletStyle, color, size, progress }) => {
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(progress, [0, 0.4], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let content: React.ReactNode;

  if (bulletStyle === "dot") {
    content = (
      <div
        style={{
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    );
  } else if (bulletStyle === "arrow") {
    content = (
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8h10M9 4l4 4-4 4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  } else if (bulletStyle === "dash") {
    content = (
      <div
        style={{
          width: size * 0.4,
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    );
  } else if (bulletStyle === "star") {
    content = (
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {content}
    </div>
  );
};

// ─── Single Item Renderer ────────────────────────────────────────────────────

const ChecklistItemRenderer: React.FC<{
  item: ChecklistItem;
  index: number;
  startFrame: number;
  theme: Required<ChecklistTheme>;
  maxTextWidth: number;
  itemsCount: number;
}> = ({ item, startFrame: autoStartFrame, theme, maxTextWidth, itemsCount }) => {
  const frame = useCurrentFrame();

  const startFrame = item.startFrame ?? autoStartFrame;

  const anim = item.animation || "slideUp";

  // Entrance animation
  let opacity = 1;
  let translateY = 0;
  let scale = 1;

  if (anim !== "none") {
    const progress = interpolate(
      frame,
      [startFrame, startFrame + 18],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    if (anim === "slideUp") {
      opacity = progress;
      translateY = interpolate(progress, [0, 1], [50, 0]);
    } else if (anim === "fadeUp") {
      opacity = progress;
      translateY = interpolate(progress, [0, 1], [30, 0]);
    } else if (anim === "scaleIn") {
      opacity = progress;
      scale = interpolate(progress, [0, 1], [0.85, 1]);
    }
  }

  // Exit animation
  let exitOpacity = 1;
  let exitScale = 1;
  if (item.endFrame !== undefined && frame >= item.endFrame) {
    const exitProgress = interpolate(
      frame,
      [item.endFrame, item.endFrame + 15],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
    );
    exitOpacity = 1 - exitProgress;
    exitScale = 1 - exitProgress * 0.15; // scale down slightly
  }

  // Marker base animation progress (when the border/empty box appears)
  const markerProgress = interpolate(
    frame,
    [startFrame, startFrame + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Checkmark animation progress
  let checkStartFrame = startFrame + 8; // default: draw checkmark 8 frames after item entrance starts
  let shouldCheck = true;

  const { durationInFrames } = useVideoConfig();

  if (item.checked === false) {
    shouldCheck = false;
  } else {
    if (typeof item.checkAtProgress === "number") {
      checkStartFrame = Math.round(item.checkAtProgress * durationInFrames);
    } else if (typeof item.checkFrame === "number") {
      checkStartFrame = item.checkFrame;
    } else if (typeof item.checkDelayAfterList === "number") {
      const listLoadedFrame = (itemsCount - 1) * theme.staggerFrames + 20;
      checkStartFrame = listLoadedFrame + item.checkDelayAfterList;
    } else if (typeof item.checkDelay === "number") {
      checkStartFrame = startFrame + item.checkDelay;
    }
  }

  const checkProgress = shouldCheck
    ? interpolate(
        frame,
        [checkStartFrame, checkStartFrame + 15],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
      )
    : 0;

  const isLightBackground =
    theme.backgroundColor === "#ffffff" ||
    theme.backgroundColor === "white" ||
    theme.backgroundColor === "#fff" ||
    theme.backgroundColor.startsWith("rgba(255, 255, 255");

  const textColor = resolveColor(item.textColor, isLightBackground ? "#0f172a" : "#ffffff");
  const descColor = resolveColor(item.descriptionColor, isLightBackground ? "#475569" : "#94a3b8");
  const markerColor = resolveColor(item.markerColor, isLightBackground ? "#10b981" : "#3b82f6");

  const textFontSize = getDynamicFontSize(
    item.text,
    item.textFontSize || theme.textFontSize,
    maxTextWidth
  );

  const descFontSize = item.descriptionFontSize || theme.descriptionFontSize;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: Math.max(12, Math.round(24 * (theme.markerSize / 64))),
        opacity: opacity * exitOpacity,
        transform: `translateY(${translateY}px) scale(${scale * exitScale})`,
        transformOrigin: "left center",
        width: "100%",
      }}
    >
      {/* Marker */}
      <div style={{ paddingTop: item.marker === "number" ? 0 : 4, flexShrink: 0 }}>
        {item.marker === "number" && (
          <NumberMarker
            value={item.value || 0}
            color={markerColor}
            fontSize={theme.numberFontSize}
            progress={markerProgress}
          />
        )}
        {item.marker === "check" && (
          <AnimatedCheck
            progress={markerProgress}
            checkProgress={checkProgress}
            color={markerColor}
            size={theme.markerSize}
            shape={item.markerShape || "circle"}
            isLightBackground={isLightBackground}
          />
        )}
        {item.marker === "bullet" && (
          <BulletMarker
            style={item.bulletStyle || "dot"}
            color={markerColor}
            size={theme.markerSize}
            progress={markerProgress}
          />
        )}
      </div>

      {/* Text content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: interFamily,
            fontWeight: 700,
            fontSize: textFontSize,
            color: textColor,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            display: "flex",
            flexWrap: "wrap",
            columnGap: "0.25em",
          }}
        >
          {item.text.split(" ").map((word, wIdx) => {
             // Find highlight match ignoring punctuation and case
             const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
             const highlight = item.wordHighlights?.find(
               h => h.wordMatch.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanWord
             );
             const wordColor = highlight ? highlight.color : "inherit";
             
             const wordStagger = item.wordStaggerFrames ?? 2;
             const wordStart = startFrame + 10 + (wIdx * wordStagger);
             
             const wProgress = interpolate(
               frame,
               [wordStart, wordStart + 12],
               [0, 1],
               { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)) }
             );
             
             const wTranslateY = interpolate(wProgress, [0, 1], [25, 0]);
             const wOpacity = interpolate(wProgress, [0, 1], [0, 1]);

             return (
               <div key={wIdx} style={{ overflow: "hidden", display: "inline-block" }}>
                 <div
                   style={{
                     transform: `translateY(${wTranslateY}px)`,
                     opacity: wOpacity,
                     color: wordColor,
                   }}
                 >
                   {word}
                 </div>
               </div>
             );
          })}
        </div>
        {item.description && (
          <div
            style={{
              fontFamily: interFamily,
              fontWeight: 400,
              fontSize: descFontSize,
              color: descColor,
              lineHeight: 1.4,
              letterSpacing: "0.01em",
            }}
          >
            {item.description}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Animated Background ─────────────────────────────────────────────────────

const AnimatedBackground: React.FC<{ theme: Required<ChecklistTheme> }> = ({ theme }) => {
  const frame = useCurrentFrame();

  const orb1X = Math.sin(frame / 60) * 120;
  const orb1Y = Math.cos(frame / 50) * 100;
  const orb2X = Math.cos(frame / 70) * -150;
  const orb2Y = Math.sin(frame / 55) * 120;

  const bgStyle: React.CSSProperties = theme.backgroundGradient
    ? { background: theme.backgroundGradient, overflow: "hidden" }
    : { backgroundColor: theme.backgroundColor, overflow: "hidden" };

  return (
    <AbsoluteFill style={bgStyle}>
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
        </>
      )}

      {theme.showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(${theme.gridColor} 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            opacity: theme.gridOpacity,
            transform: `translateY(${(frame * 0.5) % 48}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ChecklistView: React.FC<ChecklistViewProps> = (props) => {
  const { width: compWidth, height: compHeight } = useVideoConfig();

  let config: ChecklistConfig;
  try {
    config = require("./checklist.json") as ChecklistConfig;
  } catch {
    config = { items: [] };
  }

  const rawItems = props.items || config.items || [];
  const theme = mergeTheme({ ...(config.theme || {}), ...(props.theme || {}) });

  const items = rawItems.filter((item) => item && item.text);

  if (items.length === 0) {
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
        ⚠ No valid items found. Check checklist.json
      </AbsoluteFill>
    );
  }

  // ─── Dynamic Scaling Engine based on Composition Size and Item Count ───
  const basePaddingY = theme.contentPaddingY;
  const basePaddingX = theme.contentPaddingX;
  const baseGap = theme.itemGap;
  const baseMarkerSize = theme.markerSize;
  const baseTextFontSize = theme.textFontSize;
  const baseDescFontSize = theme.descriptionFontSize;

  // Scale padding to composition dimension proportions
  const padX = basePaddingX * Math.min(1.5, compWidth / 1080);
  const padY = basePaddingY * Math.min(1.5, compHeight / 1920);

  // Height-based scale factor to fit all checklist items vertically
  const estimatedItemHeight = Math.max(baseMarkerSize, baseTextFontSize + baseDescFontSize + 12);
  const totalContentHeight = items.length * estimatedItemHeight + (items.length - 1) * baseGap;
  const availableHeight = compHeight - padY * 2;

  let heightScale = 1;
  if (totalContentHeight > availableHeight) {
    heightScale = availableHeight / totalContentHeight;
  }

  // Uniform scale factor based only on vertical height to fit all items.
  // We DO NOT scale down based on width because we want text to wrap naturally instead of becoming tiny.
  const finalScale = Math.max(0.5, Math.min(heightScale, 1.2));

  const scaledGap = baseGap * finalScale;
  const scaledTheme = {
    ...theme,
    itemGap: scaledGap,
    markerSize: baseMarkerSize * finalScale,
    textFontSize: baseTextFontSize * finalScale,
    descriptionFontSize: baseDescFontSize * finalScale,
    numberFontSize: theme.numberFontSize * finalScale,
    contentPaddingX: padX,
    contentPaddingY: padY,
  };

  // Available text width after spacing/marker
  const maxTextWidth = compWidth - padX * 2 - scaledTheme.markerSize - 32;

  return (
    <AbsoluteFill>
      <AnimatedBackground theme={scaledTheme} />

      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: compWidth - scaledTheme.contentPaddingX * 2,
            display: "flex",
            flexDirection: "column",
            gap: scaledTheme.itemGap,
            alignItems: scaledTheme.textAlign === "center" ? "center" : "flex-start",
          }}
        >
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <ChecklistItemRenderer
                item={item}
                index={index}
                startFrame={index * scaledTheme.staggerFrames}
                theme={scaledTheme}
                maxTextWidth={maxTextWidth}
                itemsCount={items.length}
              />
              {scaledTheme.showDividers && index < items.length - 1 && (
                <div
                  style={{
                    width: "100%",
                    height: 1,
                    backgroundColor: scaledTheme.dividerColor,
                    opacity: 0.5,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ChecklistView;
