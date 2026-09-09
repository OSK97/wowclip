import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

import { loadInter } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComparisonTheme {
  backgroundColor?: string;
  backgroundGradient?: string;
  showGrid?: boolean;
  gridColor?: string;
  gridOpacity?: number;
  cardBg?: string;
  cardBorder?: string;
  cardRadius?: number;
  vsColor?: string;
  vsBg?: string;
  vsBorderColor?: string;
  winnerHighlight?: string;
  headerFontSize?: number;
  headerColor?: string;
  labelColor?: string;
  valueColor?: string;
  labelFontSize?: number;
  valueFontSize?: number;
}

interface ComparisonSide {
  name: string;
  image?: string;
  color?: string;
}

interface ComparisonRow {
  label: string;
  leftValue: string;
  rightValue: string;
  winner?: "left" | "right" | "tie";
}

interface ComparisonAnimation {
  columnEntranceFrames?: number;
  rowStaggerFrames?: number;
  vsDelay?: number;
}

interface ComparisonTitle {
  text?: string;
  fontSize?: number;
  color?: string;
  entranceDelay?: number;
}

export interface ComparisonViewConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  theme?: ComparisonTheme;
  title?: ComparisonTitle;
  left: ComparisonSide;
  right: ComparisonSide;
  rows: ComparisonRow[];
  animation?: ComparisonAnimation;
}

export interface ComparisonViewProps {
  config?: ComparisonViewConfig;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ComparisonView: React.FC<ComparisonViewProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ─── Defaults ───────────────────────────────────────────────────────────

  const theme = config?.theme ?? {};
  const left = config?.left ?? { name: "Option A" };
  const right = config?.right ?? { name: "Option B" };
  const rows = config?.rows ?? [];
  const anim = config?.animation ?? {};
  const titleConfig = config?.title ?? {};

  const bgGradient = theme.backgroundGradient ?? "linear-gradient(170deg, #0f172a 0%, #1a1a2e 40%, #16213e 100%)";
  const showGrid = theme.showGrid ?? false;
  const gridColor = theme.gridColor ?? "#334155";
  const gridOpacity = theme.gridOpacity ?? 0.05;
  const cardBg = theme.cardBg ?? "rgba(30, 41, 59, 0.6)";
  const cardBorder = theme.cardBorder ?? "rgba(100, 116, 139, 0.15)";
  const cardRadius = theme.cardRadius ?? 24;
  const vsColor = theme.vsColor ?? "#f59e0b";
  const vsBg = theme.vsBg ?? "rgba(245, 158, 11, 0.15)";
  const vsBorderColor = theme.vsBorderColor ?? "rgba(245, 158, 11, 0.3)";
  const winnerHighlight = theme.winnerHighlight ?? "#22c55e";
  const headerFontSize = theme.headerFontSize ?? 32;
  const headerColor = theme.headerColor ?? "#ffffff";
  const labelColor = theme.labelColor ?? "#94a3b8";
  const valueColor = theme.valueColor ?? "#e2e8f0";
  const labelFontSize = theme.labelFontSize ?? 22;
  const valueFontSize = theme.valueFontSize ?? 28;

  const leftColor = left.color ?? "#3b82f6";
  const rightColor = right.color ?? "#a855f7";

  const colEntranceFrames = anim.columnEntranceFrames ?? 25;
  const rowStagger = anim.rowStaggerFrames ?? 12;
  const vsDelay = anim.vsDelay ?? 15;

  // ─── Auto-Scaling ──────────────────────────────────────────────────────

  const contentPadding = 50;
  const headerAreaHeight = 180; // space for header names + images
  const vsAreaHeight = 80;
  const rowHeight = 90;
  const totalContentHeight = headerAreaHeight + vsAreaHeight + (rows.length * rowHeight) + 100;
  const availableHeight = height - contentPadding * 2;
  let fitScale = availableHeight / totalContentHeight;
  if (fitScale > 1.2) fitScale = 1.2;
  if (fitScale < 0.6) fitScale = 0.6;

  // ─── Animations ─────────────────────────────────────────────────────────

  // Background fade
  const bgFade = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Left column entrance (slide from left)
  const leftSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 100 },
  });
  const leftTranslateX = interpolate(leftSpring, [0, 1], [-80, 0]);
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);

  // Right column entrance (slide from right)
  const rightSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 100 },
  });
  const rightTranslateX = interpolate(rightSpring, [0, 1], [80, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);

  // VS badge
  const vsSpring = spring({
    frame: frame - vsDelay,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 180 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);

  // VS pulse glow
  const vsPulse = Math.sin(frame * 0.08) * 0.15 + 0.85;

  const cardWidth = (width - contentPadding * 2 - 30) / 2; // 30px gap

  return (
    <AbsoluteFill
      style={{
        background: bgGradient,
        opacity: bgFade,
        fontFamily: interFamily,
        overflow: "hidden",
      }}
    >
      {/* Grid */}
      {showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: gridOpacity,
            backgroundImage: `
              linear-gradient(${gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      )}

      {/* Accent glow behind each column */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "5%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${leftColor}22 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          right: "5%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rightColor}22 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${contentPadding}px`,
          transform: `scale(${fitScale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Optional title */}
        {titleConfig.text && (
          <div
            style={{
              fontSize: titleConfig.fontSize ?? 40,
              fontWeight: 700,
              color: titleConfig.color ?? "#ffffff",
              textAlign: "center",
              marginBottom: 40,
              opacity: interpolate(frame, [0, 20], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {titleConfig.text}
          </div>
        )}

        {/* Headers — two columns side by side */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 30,
            width: "100%",
            marginBottom: 20,
          }}
        >
          {/* Left header */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              opacity: leftOpacity,
              transform: `translateX(${leftTranslateX}px)`,
            }}
          >
            {left.image && (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `3px solid ${leftColor}44`,
                }}
              >
                <Img
                  src={staticFile(left.image)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: headerFontSize,
                fontWeight: 700,
                color: headerColor,
                textAlign: "center",
                padding: "8px 20px",
                borderRadius: 12,
                background: `${leftColor}15`,
                border: `1px solid ${leftColor}30`,
              }}
            >
              {left.name}
            </div>
          </div>

          {/* Right header */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              opacity: rightOpacity,
              transform: `translateX(${rightTranslateX}px)`,
            }}
          >
            {right.image && (
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `3px solid ${rightColor}44`,
                }}
              >
                <Img
                  src={staticFile(right.image)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: headerFontSize,
                fontWeight: 700,
                color: headerColor,
                textAlign: "center",
                padding: "8px 20px",
                borderRadius: 12,
                background: `${rightColor}15`,
                border: `1px solid ${rightColor}30`,
              }}
            >
              {right.name}
            </div>
          </div>
        </div>

        {/* VS badge — floating between columns */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 30,
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: vsBg,
              border: `2px solid ${vsBorderColor}`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 28,
              fontWeight: 800,
              color: vsColor,
              transform: `scale(${vsScale * vsPulse})`,
              boxShadow: `0 0 30px ${vsColor}30`,
            }}
          >
            VS
          </div>
        </div>

        {/* Comparison rows */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {rows.map((row, rowIndex) => {
            const rowStartFrame =
              colEntranceFrames + rowIndex * rowStagger;

            const rowSpring = spring({
              frame: frame - rowStartFrame,
              fps,
              config: { damping: 18, mass: 0.5, stiffness: 120 },
            });

            const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
            const rowTranslateY = interpolate(rowSpring, [0, 1], [25, 0]);

            const isLeftWinner = row.winner === "left";
            const isRightWinner = row.winner === "right";

            // Winner highlight shimmer appears after row enters
            const winnerDelay = rowStartFrame + 25;
            const winnerGlow = interpolate(
              frame,
              [winnerDelay, winnerDelay + 20],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={`row-${rowIndex}`}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  gap: 10,
                  opacity: rowOpacity,
                  transform: `translateY(${rowTranslateY}px)`,
                }}
              >
                {/* Left value */}
                <div
                  style={{
                    flex: 1,
                    background: cardBg,
                    border: `1px solid ${isLeftWinner ? `${winnerHighlight}${Math.round(winnerGlow * 60).toString(16).padStart(2, "0")}` : cardBorder}`,
                    borderRadius: cardRadius,
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Winner glow bg */}
                  {isLeftWinner && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `radial-gradient(ellipse at center, ${winnerHighlight}08 0%, transparent 70%)`,
                        opacity: winnerGlow,
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: valueFontSize,
                      fontWeight: 700,
                      color: isLeftWinner
                        ? interpolate(winnerGlow, [0, 1], [0, 1]) > 0.5
                          ? winnerHighlight
                          : valueColor
                        : valueColor,
                      textAlign: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {row.leftValue}
                  </div>
                </div>

                {/* Center label */}
                <div
                  style={{
                    width: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: labelFontSize,
                      fontWeight: 600,
                      color: labelColor,
                      textAlign: "center",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {row.label}
                  </div>
                </div>

                {/* Right value */}
                <div
                  style={{
                    flex: 1,
                    background: cardBg,
                    border: `1px solid ${isRightWinner ? `${winnerHighlight}${Math.round(winnerGlow * 60).toString(16).padStart(2, "0")}` : cardBorder}`,
                    borderRadius: cardRadius,
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isRightWinner && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `radial-gradient(ellipse at center, ${winnerHighlight}08 0%, transparent 70%)`,
                        opacity: winnerGlow,
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: valueFontSize,
                      fontWeight: 700,
                      color: isRightWinner
                        ? interpolate(winnerGlow, [0, 1], [0, 1]) > 0.5
                          ? winnerHighlight
                          : valueColor
                        : valueColor,
                      textAlign: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {row.rightValue}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.25) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export default ComparisonView;
