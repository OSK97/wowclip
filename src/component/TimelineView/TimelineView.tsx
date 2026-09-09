import React from "react";
import {
  AbsoluteFill,
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

interface TimelineTheme {
  backgroundColor?: string;
  backgroundGradient?: string;
  spineColor?: string;
  spineWidth?: number;
  nodeColor?: string;
  nodeSize?: number;
  activeNodeColor?: string;
  activeNodeGlow?: string;
  dateColor?: string;
  dateFontSize?: number;
  titleColor?: string;
  titleFontSize?: number;
  descriptionColor?: string;
  descriptionFontSize?: number;
  connectorColor?: string;
  cardBg?: string;
  cardBorder?: string;
  cardRadius?: number;
}

interface TimelineTitle {
  text?: string;
  fontSize?: number;
  color?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: number;
}

interface Milestone {
  date: string;
  title: string;
  description?: string;
  isActive?: boolean;
}

interface TimelineAnimation {
  spineDrawFrames?: number;
  nodeStaggerFrames?: number;
  nodeEntranceDelay?: number;
}

export interface TimelineViewConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  theme?: TimelineTheme;
  title?: TimelineTitle;
  milestones: Milestone[];
  animation?: TimelineAnimation;
}

export interface TimelineViewProps {
  config?: TimelineViewConfig;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TimelineView: React.FC<TimelineViewProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ─── Defaults ───────────────────────────────────────────────────────────

  const theme = config?.theme ?? {};
  const titleConfig = config?.title ?? {};
  const milestones = config?.milestones ?? [];
  const anim = config?.animation ?? {};

  const bgGradient = theme.backgroundGradient ?? "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)";
  const spineColor = theme.spineColor ?? "rgba(148, 163, 184, 0.2)";
  const spineWidth = theme.spineWidth ?? 3;
  const nodeColor = theme.nodeColor ?? "#3b82f6";
  const nodeSize = theme.nodeSize ?? 22;
  const activeNodeColor = theme.activeNodeColor ?? "#22c55e";
  const activeNodeGlow = theme.activeNodeGlow ?? "rgba(34, 197, 94, 0.3)";
  const dateColor = theme.dateColor ?? "#94a3b8";
  const dateFontSize = theme.dateFontSize ?? 24;
  const titleColor = theme.titleColor ?? "#ffffff";
  const titleFontSize = theme.titleFontSize ?? 30;
  const descColor = theme.descriptionColor ?? "#94a3b8";
  const descFontSize = theme.descriptionFontSize ?? 22;
  const cardBg = theme.cardBg ?? "rgba(30, 41, 59, 0.5)";
  const cardBorder = theme.cardBorder ?? "rgba(100, 116, 139, 0.15)";
  const cardRadius = theme.cardRadius ?? 16;

  const spineDrawFrames = anim.spineDrawFrames ?? 30;
  const nodeStagger = anim.nodeStaggerFrames ?? 20;
  const nodeEntranceDelay = anim.nodeEntranceDelay ?? 15;

  // ─── Auto-Scaling ──────────────────────────────────────────────────────

  const titleAreaHeight = titleConfig.text ? 140 : 0;
  const milestoneHeight = 130;
  const totalContentHeight = titleAreaHeight + milestones.length * milestoneHeight + 100;
  const availableHeight = height - 120;
  let fitScale = availableHeight / totalContentHeight;
  if (fitScale > 1.15) fitScale = 1.15;
  if (fitScale < 0.55) fitScale = 0.55;

  // ─── Animations ─────────────────────────────────────────────────────────

  // Background fade
  const bgFade = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title entrance
  const titleSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 18, mass: 0.6, stiffness: 100 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleTranslateY = interpolate(titleSpring, [0, 1], [25, 0]);

  // Spine draw progress (0 → 1)
  const spineProgress = interpolate(
    frame,
    [10, 10 + spineDrawFrames + milestones.length * nodeStagger],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) }
  );

  // Spine positioning
  const spineX = width * 0.18; // Spine on the left ~18% of width
  const spineTopY = titleAreaHeight + 30;
  const spineBottomY = titleAreaHeight + milestones.length * milestoneHeight;

  return (
    <AbsoluteFill
      style={{
        background: bgGradient,
        opacity: bgFade,
        fontFamily: interFamily,
        overflow: "hidden",
      }}
    >
      {/* Subtle accent glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "0%",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${nodeColor}15 0%, transparent 70%)`,
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
          padding: "60px 40px",
          transform: `scale(${fitScale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Title */}
        {titleConfig.text && (
          <div
            style={{
              textAlign: "center",
              marginBottom: 40,
              opacity: titleOpacity,
              transform: `translateY(${titleTranslateY}px)`,
            }}
          >
            <div
              style={{
                fontSize: titleConfig.fontSize ?? 44,
                fontWeight: 800,
                color: titleConfig.color ?? "#ffffff",
                letterSpacing: -0.5,
              }}
            >
              {titleConfig.text}
            </div>
            {titleConfig.subtitle && (
              <div
                style={{
                  fontSize: titleConfig.subtitleFontSize ?? 26,
                  fontWeight: 400,
                  color: titleConfig.subtitleColor ?? "#94a3b8",
                  marginTop: 10,
                }}
              >
                {titleConfig.subtitle}
              </div>
            )}
          </div>
        )}

        {/* Timeline container */}
        <div
          style={{
            position: "relative",
            flex: 1,
          }}
        >
          {/* Spine line (vertical) */}
          <div
            style={{
              position: "absolute",
              left: spineX,
              top: 20,
              width: spineWidth,
              height: `${spineProgress * 100}%`,
              maxHeight: spineBottomY - spineTopY + 40,
              background: `linear-gradient(to bottom, ${nodeColor}60, ${spineColor})`,
              borderRadius: spineWidth,
              transformOrigin: "top",
            }}
          />

          {/* Milestones */}
          {milestones.map((milestone, i) => {
            const milestoneStartFrame = nodeEntranceDelay + i * nodeStagger;

            // Node entrance
            const nodeSpring = spring({
              frame: frame - milestoneStartFrame,
              fps,
              config: { damping: 12, mass: 0.5, stiffness: 160 },
            });

            const nodeScale = interpolate(nodeSpring, [0, 1], [0, 1]);
            const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1]);

            // Card entrance (slightly after node)
            const cardSpring = spring({
              frame: frame - milestoneStartFrame - 5,
              fps,
              config: { damping: 16, mass: 0.5, stiffness: 100 },
            });
            const cardTranslateX = interpolate(cardSpring, [0, 1], [40, 0]);
            const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);

            // Date entrance (slightly before card)
            const dateOpacity = interpolate(
              frame,
              [milestoneStartFrame, milestoneStartFrame + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const isActive = milestone.isActive ?? false;
            const currentNodeColor = isActive ? activeNodeColor : nodeColor;

            // Active node pulse
            const activePulse = isActive
              ? Math.sin(frame * 0.06) * 3 + 3
              : 0;

            const milestoneY = i * milestoneHeight;

            return (
              <div
                key={`milestone-${i}`}
                style={{
                  position: "absolute",
                  top: milestoneY,
                  left: 0,
                  right: 0,
                  height: milestoneHeight,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* Date label — left of spine */}
                <div
                  style={{
                    position: "absolute",
                    right: width - spineX + 20,
                    width: spineX - 50,
                    textAlign: "right",
                    opacity: dateOpacity,
                  }}
                >
                  <div
                    style={{
                      fontSize: dateFontSize,
                      fontWeight: 700,
                      color: isActive ? activeNodeColor : dateColor,
                      letterSpacing: 1,
                    }}
                  >
                    {milestone.date}
                  </div>
                </div>

                {/* Node dot */}
                <div
                  style={{
                    position: "absolute",
                    left: spineX - nodeSize / 2 + spineWidth / 2,
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: "50%",
                    background: currentNodeColor,
                    transform: `scale(${nodeScale})`,
                    opacity: nodeOpacity,
                    boxShadow: isActive
                      ? `0 0 ${activePulse + 15}px ${activeNodeGlow}, 0 0 ${activePulse + 30}px ${activeNodeGlow}`
                      : `0 0 10px ${currentNodeColor}30`,
                    border: `3px solid ${isActive ? activeNodeColor : `${nodeColor}60`}`,
                    zIndex: 2,
                  }}
                >
                  {/* Inner dot */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 4,
                      borderRadius: "50%",
                      background: isActive ? "#ffffff" : `${currentNodeColor}80`,
                    }}
                  />
                </div>

                {/* Horizontal connector line */}
                <div
                  style={{
                    position: "absolute",
                    left: spineX + nodeSize / 2 + spineWidth / 2 + 5,
                    top: "50%",
                    width: 25,
                    height: 1,
                    background: `${currentNodeColor}40`,
                    opacity: cardOpacity,
                    transform: "translateY(-50%)",
                  }}
                />

                {/* Card — right of spine */}
                <div
                  style={{
                    position: "absolute",
                    left: spineX + nodeSize / 2 + spineWidth / 2 + 35,
                    right: 30,
                    background: cardBg,
                    border: `1px solid ${isActive ? `${activeNodeColor}30` : cardBorder}`,
                    borderRadius: cardRadius,
                    padding: "18px 24px",
                    opacity: cardOpacity,
                    transform: `translateX(${cardTranslateX}px)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: titleFontSize,
                      fontWeight: 700,
                      color: isActive ? activeNodeColor : titleColor,
                      marginBottom: milestone.description ? 6 : 0,
                    }}
                  >
                    {milestone.title}
                  </div>
                  {milestone.description && (
                    <div
                      style={{
                        fontSize: descFontSize,
                        fontWeight: 400,
                        color: descColor,
                        lineHeight: 1.4,
                      }}
                    >
                      {milestone.description}
                    </div>
                  )}
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
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export default TimelineView;
