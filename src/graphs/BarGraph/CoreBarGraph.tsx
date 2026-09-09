import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const CoreBarGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bars = [
    { label: "Q1", value: 400, gradientFrom: "#3b82f6", gradientTo: "#06b6d4" },
    { label: "Q2", value: 650, gradientFrom: "#0ea5e9", gradientTo: "#0284c7" },
    { label: "Q3", value: 800, gradientFrom: "#10b981", gradientTo: "#059669" },
    { label: "Q4", value: 1200, gradientFrom: "#f59e0b", gradientTo: "#d97706" },
  ];

  const totalValue = bars.reduce((s, b) => s + b.value, 0);
  const maxValue = Math.max(...bars.map((b) => b.value));
  
  const chartW = 900;
  const chartH = 600;
  const barSpacing = chartW / bars.length;
  const BAR_W = 100;
  const BAR_R = 24;

  const gridO = interpolate(frame, [5, 25], [0, 0.6], clamp);
  const labelsO = interpolate(frame, [15, 35], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: chartW, height: chartH }}>
        {/* Subtle horizontal guides */}
        <svg width={chartW} height={chartH} style={{ position: "absolute", inset: 0, opacity: gridO }}>
          {[0.25, 0.5, 0.75].map((pct) => (
            <line key={pct} x1={0} y1={chartH * (1 - pct)} x2={chartW} y2={chartH * (1 - pct)} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="8 8" />
          ))}
          <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#94a3b8" strokeWidth={3} />
        </svg>

        {/* SVG bars */}
        <svg width={chartW} height={chartH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            {bars.map((bar, i) => (
              <React.Fragment key={`d-${i}`}>
                <linearGradient id={`bg-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={bar.gradientFrom} />
                  <stop offset="100%" stopColor={bar.gradientTo} />
                </linearGradient>
                <filter id={`bs-${i}`} x="-20%" y="-10%" width="140%" height="130%">
                  <feDropShadow dx="0" dy="12" stdDeviation="15" floodColor={bar.gradientTo} floodOpacity="0.25" />
                </filter>
              </React.Fragment>
            ))}
          </defs>

          {bars.map((bar, i) => {
            const cx = barSpacing * (i + 0.5);
            const x = cx - BAR_W / 2;
            const startFrame = 10 + i * 7;
            const barSpr = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 100, mass: 0.8 } });
            const targetH = (bar.value / maxValue) * chartH;
            const h = barSpr * targetH;
            const y = chartH - h;

            return h > 1 ? (
              <rect key={i} x={x} y={y} width={BAR_W} height={h} rx={BAR_R} fill={`url(#bg-${i})`} filter={`url(#bs-${i})`} />
            ) : null;
          })}
        </svg>

        {/* Value labels */}
        {bars.map((bar, i) => {
          const cx = barSpacing * (i + 0.5);
          const targetH = (bar.value / maxValue) * chartH;
          const barTop = chartH - targetH;
          const startFrame = 10 + i * 7;
          const pop = spring({ frame: frame - (startFrame + 14), fps, config: { damping: 12, stiffness: 120, mass: 0.7 } });
          const o = interpolate(pop, [0, 1], [0, 1], clamp);
          const sc = interpolate(pop, [0, 1], [0.4, 1], clamp);

          return frame > startFrame + 14 ? (
            <div
              key={`v-${i}`}
              style={{
                position: "absolute",
                left: cx,
                top: barTop - 45,
                transform: `translate(-50%, -50%) scale(${sc})`,
                opacity: o,
                fontSize: 26,
                fontWeight: 900,
                color: "#0f172a",
                background: "rgba(255, 255, 255, 0.95)",
                border: "2px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: "8px 20px",
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
                whiteSpace: "nowrap",
              }}
            >
              {bar.value}k
            </div>
          ) : null;
        })}

        {/* Category labels */}
        {bars.map((bar, i) => {
          const cx = barSpacing * (i + 0.5);
          return (
            <div
              key={`l-${i}`}
              style={{
                position: "absolute",
                left: cx,
                top: chartH + 30,
                transform: "translateX(-50%)",
                opacity: labelsO,
                fontSize: 28,
                fontWeight: 800,
                color: "#64748b",
                textAlign: "center",
              }}
            >
              {bar.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
