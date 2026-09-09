import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { loadInter as loadFont } from "../../utils/localFonts";

const { fontFamily } = loadFont();

// ════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ════════════════════════════════════════════════════════════════

export interface GrossVolumeProps {
  composition?: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
  };
  company?: {
    name: string;
    ticker?: string;
    currency?: string;
  };
  theme?: {
    backgroundColor?: string;
    cardBackgroundColor?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    accentColor?: string;
    badgeBackgroundColor?: string;
    badgeTextColor?: string;
  };
  data?: {
    startValue: number;
    endValue: number;
    startPercentage: number;
    endPercentage: number;
    points: number[][];
    xLabels: string[];
  };
  animation?: {
    entranceDurationFrames?: number;
    keyframes?: { frame: number; progress: number }[];
  };
}

// ════════════════════════════════════════════════════════════════
// BOKEH ORB DATA
// ════════════════════════════════════════════════════════════════
interface BokehOrb {
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  speed: number;
}

const BOKEH_ORBS: BokehOrb[] = [
  { x: 8, y: 12, size: 160, opacity: 0.25, driftX: 15, driftY: 10, speed: 0.7 },
  { x: 85, y: 78, size: 200, opacity: 0.2, driftX: 12, driftY: 18, speed: 0.5 },
  { x: 15, y: 85, size: 120, opacity: 0.15, driftX: 20, driftY: 8, speed: 0.9 },
  { x: 80, y: 15, size: 140, opacity: 0.18, driftX: 10, driftY: 14, speed: 0.6 },
  { x: 50, y: 5, size: 100, opacity: 0.12, driftX: 18, driftY: 12, speed: 0.8 },
  { x: 25, y: 50, size: 80, opacity: 0.08, driftX: 14, driftY: 16, speed: 1.1 },
  { x: 70, y: 55, size: 110, opacity: 0.1, driftX: 16, driftY: 10, speed: 0.65 },
];

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

const interpolateKeyframes = (frame: number, keyframes: { frame: number; progress: number }[], fallbackProgress: number) => {
  if (!keyframes || keyframes.length === 0) return fallbackProgress;
  if (frame <= keyframes[0].frame) return keyframes[0].progress;
  if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1].progress;
  
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].frame && frame < keyframes[i+1].frame) {
      return interpolate(
        frame,
        [keyframes[i].frame, keyframes[i+1].frame],
        [keyframes[i].progress, keyframes[i+1].progress],
        {
          easing: Easing.bezier(0.25, 1, 0.5, 1)
        }
      );
    }
  }
  return 1;
};

const formatDollar = (val: number, currency: string = ""): string => {
  if (val > 1000) {
    return currency + Math.round(val).toLocaleString("en-US");
  }
  return currency + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const buildChartPath = (
  points: number[][],
  progress: number,
  chartW: number,
  chartH: number,
): { linePath: string; fillPath: string; tipX: number; tipY: number } => {
  const visiblePoints = points.filter(([x]) => x <= progress);
  if (visiblePoints.length < 2) {
    return { linePath: "", fillPath: "", tipX: 0, tipY: chartH };
  }

  const lastIdx = points.findIndex(([x]) => x > progress);
  if (lastIdx > 0) {
    const prev = points[lastIdx - 1];
    const next = points[lastIdx];
    const t = (progress - prev[0]) / (next[0] - prev[0]);
    const interpY = prev[1] + t * (next[1] - prev[1]);
    visiblePoints.push([progress, interpY]);
  }

  let linePath = "";
  visiblePoints.forEach(([x, y], i) => {
    const px = x * chartW;
    const py = chartH - y * chartH;
    if (i === 0) {
      linePath += `M ${px},${py}`;
    } else {
      const prevPoint = visiblePoints[i - 1];
      const cpx = ((prevPoint[0] + x) / 2) * chartW;
      linePath += ` Q ${cpx},${chartH - prevPoint[1] * chartH} ${px},${py}`;
    }
  });

  const lastPoint = visiblePoints[visiblePoints.length - 1];
  const tipX = lastPoint[0] * chartW;
  const tipY = chartH - lastPoint[1] * chartH;

  const fillPath =
    linePath + ` L ${tipX},${chartH} L ${visiblePoints[0][0] * chartW},${chartH} Z`;

  return { linePath, fillPath, tipX, tipY };
};

export const GrossVolume: React.FC<GrossVolumeProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── DATA PREP ─────────────────────────────────────────
  const data = {
    startValue: 1046020,
    endValue: 1046658,
    startPercentage: 302.08,
    endPercentage: 350.08,
    points: [
      [0, 0.42], [0.04, 0.38], [0.08, 0.35], [0.10, 0.42],
      [0.25, 0.28], [0.5, 0.50], [0.75, 0.55], [1.0, 0.62]
    ],
    xLabels: ["Jan 25", "Jan 26"],
    ...props.data
  };

  const isProfit = data.endPercentage >= 0;
  
  // Dynamic Green/Red theme
  const ACCENT_COLOR = props.theme?.accentColor || (isProfit ? "#34C759" : "#E8364E");
  const BG_COLOR = props.theme?.backgroundColor || (isProfit ? "#051A0A" : "#1A0505");
  const BADGE_BG = props.theme?.badgeBackgroundColor || (isProfit ? "rgba(52, 199, 89, 0.08)" : "rgba(232, 54, 78, 0.08)");
  const BADGE_BORDER = isProfit ? "rgba(52, 199, 89, 0.25)" : "rgba(232, 54, 78, 0.25)";
  const TEXT_GREY = "#4A4A4A";
  const TEXT_BLACK = "#1A1A1A";
  const CARD_BG = "#FAFAFA";

  const company = {
    name: "Gross Volume",
    currency: "$",
    ...props.company
  };

  const animation = {
    entranceDurationFrames: 45,
    keyframes: [],
    ...props.animation
  };

  // Extract color for glow
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : (isProfit ? "52,199,89" : "232,54,78");
  };
  const bgAccentRgb = hexToRgb(ACCENT_COLOR);

  // ── PHASE TIMING (Old Fallback if no keyframes) ──────────────────
  const chartDrawStart = 0.5 * fps;
  const chartDrawEnd = 3.2 * fps;
  const fallbackProgress = interpolate(frame, [chartDrawStart, chartDrawEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });

  // ── DYNAMIC KEYFRAMED PROGRESS ───────────────────────────────
  const chartProgress = animation.keyframes && animation.keyframes.length > 0
    ? interpolateKeyframes(frame, animation.keyframes, fallbackProgress)
    : fallbackProgress;

  // ── CARD 3D ENTRANCE ─────────────────────────────────────────
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1.2 },
    durationInFrames: animation.entranceDurationFrames
  });

  const rotateX = interpolate(cardEntrance, [0, 1], [-15, 0]);
  const rotateY = interpolate(cardEntrance, [0, 1], [12, 0]);
  const rotateZ = interpolate(cardEntrance, [0, 1], [-8, 0]);
  const cardScale = interpolate(cardEntrance, [0, 1], [0.85, 1.0]);

  const floatPhase = frame / fps;
  const floatY = Math.sin(floatPhase * 0.8) * 6;
  const floatRotZ = Math.sin(floatPhase * 0.5 + 1) * 0.5;

  // ── TEXT CONTENT ANIMATIONS ──────────────────────────────────
  const labelOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const currentDollar = data.startValue + (data.endValue - data.startValue) * chartProgress;
  const currentPct = data.startPercentage + (data.endPercentage - data.startPercentage) * chartProgress;

  const badgeSpring = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);
  const badgeOpacity = interpolate(badgeSpring, [0, 0.3, 1], [0, 1, 1]);

  const dollarOpacity = interpolate(frame, [5, 25], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dollarWeight = interpolate(frame, [5, 25], [300, 800], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── CHART LINE DRAWING ───────────────────────────────────────
  const CHART_W = 808;
  const CHART_H = 260;
  const { linePath, fillPath, tipX, tipY } = buildChartPath(data.points, chartProgress, CHART_W, CHART_H);

  const tipGlowScale = 1 + Math.sin(frame * 0.15) * 0.3;
  const tipGlowOpacity = interpolate(chartProgress, [0.05, 0.15], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fillOpacity = interpolate(chartProgress, [0.3, 0.7, 1], [0, 0.15, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── GRID LINES & LABELS ───────────────────────────────────────
  const gridLineCount = 8;
  const gridLineProgress = interpolate(frame, [20, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const CARD_W = 920;
  const CARD_H = 580;
  const CARD_RADIUS = 36;
  const CARD_PAD = 56;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR, fontFamily, overflow: "hidden" }}>
      {/* ── DEEP RADIAL BACKGROUND GRADIENT ──────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, rgba(${bgAccentRgb}, 0.35) 0%, transparent 70%)`,
        }}
      />

      {/* ── STUDIO GRID BACKGROUND ─────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 960,
          height: 1700,
          opacity: interpolate(frame, [0, 20], [0, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 90%)",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 90%)",
          pointerEvents: "none" as const,
        }}
      >
        <svg width="100%" height="100%">
          {Array.from({ length: Math.round(960 / 90) + 1 }).map((_, i) => (
            <line key={`vg-${i}`} x1={i * 90} y1={0} x2={i * 90} y2={1700} stroke={`rgba(${bgAccentRgb}, 0.06)`} strokeWidth={1} />
          ))}
          {Array.from({ length: Math.round(1700 / 90) + 1 }).map((_, i) => (
            <line key={`hg-${i}`} x1={0} y1={i * 90} x2={960} y2={i * 90} stroke={`rgba(${bgAccentRgb}, 0.06)`} strokeWidth={1} />
          ))}
        </svg>
      </div>

      {/* ── BOKEH LIGHT ORBS ─────────────────────────────────── */}
      {BOKEH_ORBS.map((orb, i) => {
        const ox = orb.x + Math.sin(frame * 0.02 * orb.speed + i * 2) * orb.driftX * 0.1;
        const oy = orb.y + Math.cos(frame * 0.015 * orb.speed + i * 3) * orb.driftY * 0.1;
        const pulseOpacity = orb.opacity * (0.7 + 0.3 * Math.sin(frame * 0.03 * orb.speed + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${ox}%`,
              top: `${oy}%`,
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${bgAccentRgb}, ${pulseOpacity}) 0%, transparent 70%)`,
              filter: `blur(${orb.size * 0.4}px)`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none" as const,
            }}
          />
        );
      })}

      {/* ── THE CARD ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          width: CARD_W, height: CARD_H,
          marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2,
          transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ + floatRotZ}deg) scale(${cardScale}) translateY(${floatY}px)`,
          backgroundColor: CARD_BG,
          borderRadius: CARD_RADIUS,
          boxShadow: `0 40px 100px rgba(0, 0, 0, 0.5), 0 12px 30px rgba(0, 0, 0, 0.25), 0 0 80px rgba(${bgAccentRgb}, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)`,
          border: `1px solid rgba(255, 255, 255, 0.15)`,
          padding: CARD_PAD,
          overflow: "hidden",
        }}
      >
        {/* ── Header Row: Company Name + Badge ─────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: labelOpacity }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: TEXT_GREY, letterSpacing: "-0.01em" }}>
            {company.name}
          </span>

          <div
            style={{
              transform: `scale(${badgeScale})`, opacity: badgeOpacity,
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 8,
              backgroundColor: BADGE_BG,
              border: `1px solid ${BADGE_BORDER}`,
            }}
          >
            {/* Arrow SVG */}
            {isProfit ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7"/>
              </svg>
            )}
            <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT_COLOR, fontVariantNumeric: "tabular-nums" }}>
              {Math.abs(currentPct).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* ── Dollar Amount ──────────────────────────────────── */}
        <div style={{ marginTop: 12, fontSize: 82, fontWeight: dollarWeight, color: TEXT_BLACK, opacity: dollarOpacity, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
          {formatDollar(currentDollar, company.currency)}
        </div>

        {/* ── Chart Area ─────────────────────────────────────── */}
        <div style={{ position: "absolute", left: CARD_PAD, right: CARD_PAD, bottom: CARD_PAD + 40, height: CHART_H }}>
          <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity={0.0} />
              </linearGradient>
              <radialGradient id="tipGlow">
                <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.8} />
                <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity={0} />
              </radialGradient>
              <filter id="lineGlow">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={ACCENT_COLOR} floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Vertical grid lines */}
            {Array.from({ length: gridLineCount }).map((_, i) => {
              const gx = ((i + 1) / (gridLineCount + 1)) * CHART_W;
              return (
                <line key={i} x1={gx} y1={0} x2={gx} y2={CHART_H} stroke="rgba(0,0,0,0.06)" strokeWidth={1.5} strokeDasharray="6 6" opacity={gridLineProgress} />
              );
            })}

            {/* Baseline axis */}
            <line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="rgba(0,0,0,0.12)" strokeWidth={2} />

            {/* Area fill */}
            {fillPath && <path d={fillPath} fill="url(#chartFill)" opacity={fillOpacity} />}

            {/* Line with glow */}
            {linePath && <path d={linePath} fill="none" stroke={ACCENT_COLOR} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />}

            {/* Tip pulse ring */}
            {chartProgress > 0.05 && (
              <circle cx={tipX} cy={tipY} r={12} fill="none" stroke={ACCENT_COLOR} strokeWidth={2} opacity={tipGlowOpacity * 0.5} />
            )}
            {/* Tip dot */}
            {chartProgress > 0.05 && (
              <circle cx={tipX} cy={tipY} r={5} fill={ACCENT_COLOR} stroke="#FAFAFA" strokeWidth={2.5} />
            )}
          </svg>

          {/* Axis labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {data.xLabels.map((label, idx) => (
              <span key={idx} style={{
                fontSize: 18, color: "rgba(0,0,0,0.45)", fontWeight: 500,
                opacity: interpolate(frame, [30 + idx * 5, 50 + idx * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── SUBTLE VIGNETTE ──────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default GrossVolume;
