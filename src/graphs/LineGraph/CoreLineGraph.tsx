import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const CoreLineGraph: React.FC = () => {
  const frame = useCurrentFrame();
  
  const GRID_W = 900;
  const GRID_H = 600;
  const MARGIN_X = 40;
  const MARGIN_Y = 40;
  const GRAPH_W = GRID_W - 2 * MARGIN_X;
  const GRAPH_H = GRID_H - 2 * MARGIN_Y;

  // Dummy upward trend data
  const data = [15, 25, 20, 45, 60, 50, 85, 100];
  const maxValue = 100;
  const yLabels = ["0", "25", "50", "75", "100"];

  const normalise = (values: number[]) => values.map((v) => (v / maxValue) * 100);
  const normPoints = normalise(data);

  const valToX = (index: number, total: number) => MARGIN_X + (index / (total - 1)) * GRAPH_W;
  const valToY = (val: number) => GRID_H - MARGIN_Y - (val / 100) * GRAPH_H;

  const getCurvePath = (points: number[]) => {
    let path = `M ${valToX(0, points.length)} ${valToY(points[0])}`;
    const segW = GRAPH_W / (points.length - 1);
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = valToX(i, points.length);
      const y0 = valToY(points[i]);
      const x1 = valToX(i + 1, points.length);
      const y1 = valToY(points[i + 1]);
      path += ` C ${x0 + segW / 2} ${y0}, ${x0 + segW / 2} ${y1}, ${x1} ${y1}`;
    }
    return path;
  };

  const getAreaPath = (points: number[]) => {
    const curve = getCurvePath(points);
    const lastX = valToX(points.length - 1, points.length);
    const firstX = valToX(0, points.length);
    const baseY = GRID_H - MARGIN_Y;
    return `${curve} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  };

  // Draw timing
  const drawProgress = interpolate(frame, [20, 80], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.22, 0.61, 0.36, 1),
  });

  const areaOpacity = interpolate(drawProgress, [0.5, 1], [0, 1], clamp);
  const labelsOpacity = interpolate(frame, [40, 80], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: GRID_W, height: GRID_H, position: "relative" }}>
        
        {/* Grid Lines */}
        <div style={{ position: "absolute", inset: 0, opacity: labelsOpacity * 0.4 }}>
          <svg width="100%" height="100%">
            {yLabels.map((_, i) => {
              const yPos = MARGIN_Y + i * (GRAPH_H / (yLabels.length - 1));
              return (
                <line
                  key={`h-${i}`}
                  x1={MARGIN_X}
                  y1={yPos}
                  x2={GRID_W - MARGIN_X}
                  y2={yPos}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                />
              );
            })}
          </svg>
        </div>

        {/* Y Axis Labels */}
        <div style={{ position: "absolute", inset: 0, opacity: labelsOpacity, pointerEvents: "none" }}>
          {yLabels.map((lbl) => (
            <div
              key={lbl}
              style={{
                position: "absolute",
                right: GRID_W - MARGIN_X + 20,
                top: valToY(parseInt(lbl)),
                transform: "translateY(-50%)",
                fontSize: 24,
                fontWeight: "bold",
                color: "#64748b",
                fontFamily: "sans-serif",
              }}
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Graph Paths */}
        <svg width={GRID_W} height={GRID_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <clipPath id="revealClip">
              <rect x={0} y={-50} width={drawProgress * GRID_W + 50} height={GRID_H + 100} />
            </clipPath>
          </defs>
          
          <path
            d={getAreaPath(normPoints)}
            fill="url(#areaGrad)"
            clipPath="url(#revealClip)"
            opacity={areaOpacity}
          />
          
          <path
            d={getCurvePath(normPoints)}
            fill="none"
            stroke="url(#strokeGrad)"
            strokeWidth={8}
            strokeLinecap="round"
            clipPath="url(#revealClip)"
          />
        </svg>

        {/* Final Value Dot */}
        {drawProgress > 0.95 && (
          <div
            style={{
              position: "absolute",
              left: valToX(normPoints.length - 1, normPoints.length),
              top: valToY(normPoints[normPoints.length - 1]),
              transform: "translate(-50%, -50%)",
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: "#06b6d4",
              border: "4px solid white",
              boxShadow: "0 4px 12px rgba(6, 182, 212, 0.5)",
              animation: "fadeIn 0.3s ease-out forwards",
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};
