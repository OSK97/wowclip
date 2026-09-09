import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const CorePieChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cx = 450;
  const cy = 450;
  const radius = 250;

  const sectors = [
    { id: "s1", name: "Industry", percentage: 40, color: "#0284c7" },
    { id: "s2", name: "Agriculture", percentage: 35, color: "#0ea5e9" },
    { id: "s3", name: "Services", percentage: 25, color: "#38bdf8" },
  ];

  let currentAngle = -90;
  const calculatedSectors = sectors.map((sector, i) => {
    const angleSpan = (sector.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    const middleAngle = currentAngle + angleSpan / 2;
    currentAngle = endAngle;

    const startDraw = 10 + i * 8;
    return {
      ...sector,
      startAngle,
      endAngle,
      middleAngle,
      drawRange: [startDraw, startDraw + 22] as [number, number],
      labelRange: [startDraw + 14, startDraw + 24] as [number, number],
      lineRange: [startDraw + 20, startDraw + 32] as [number, number],
      textRange: [startDraw + 26, startDraw + 36] as [number, number],
    };
  });

  const getCoord = (angleDeg: number, r: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  };

  const getWedgePath = (startAngle: number, endAngle: number, rValue: number) => {
    const start = getCoord(startAngle, rValue);
    const end = getCoord(endAngle, rValue);
    const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${rValue} ${rValue} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  const dividersOpacity = interpolate(frame, [40, 60], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: 900, height: 900 }}>
        <svg width={900} height={900} style={{ position: "absolute", overflow: "visible" }}>
          <defs>
            <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="15" stdDeviation="20" floodColor="#000000" floodOpacity="0.15" />
            </filter>
          </defs>

          <g filter="url(#pieShadow)">
            {calculatedSectors.map((sector) => {
              const drawVal = interpolate(frame, sector.drawRange, [0, 1], { ...clamp, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) });
              const currentEndAngle = sector.startAngle + drawVal * (sector.percentage / 100) * 360;
              if (drawVal <= 0.001) return null;
              return <path key={sector.id} d={getWedgePath(sector.startAngle, currentEndAngle, radius)} fill={sector.color} stroke="rgba(255,255,255,0.1)" strokeWidth="2" />;
            })}

            {dividersOpacity > 0.001 && calculatedSectors.slice(0, -1).map((s) => {
              const { x, y } = getCoord(s.endAngle, radius);
              return <line key={s.endAngle} x1={cx} y1={cy} x2={x} y2={y} stroke="#FFFFFF" strokeWidth="4" opacity={dividersOpacity} />;
            })}
          </g>

          {calculatedSectors.map((sector) => {
            const lineProgress = interpolate(frame, sector.lineRange, [0, 1], clamp);
            if (lineProgress <= 0.001) return null;
            const { x: xStart, y: yStart } = getCoord(sector.middleAngle, radius + 10);
            const { x: xMid, y: yMid } = getCoord(sector.middleAngle, radius + 70);
            const isRight = Math.cos((sector.middleAngle * Math.PI) / 180) >= 0;
            const xEnd = isRight ? xMid + 50 : xMid - 50;
            return <path key={`line-${sector.id}`} d={`M ${xStart} ${yStart} L ${xMid} ${yMid} L ${xEnd} ${yMid}`} fill="none" stroke="#64748b" strokeWidth="4" strokeDasharray={150} strokeDashoffset={150 - lineProgress * 150} />;
          })}
        </svg>

        {calculatedSectors.map((sector) => {
          const labelOpacity = interpolate(frame, sector.labelRange, [0, 1], clamp);
          const labelScale = spring({ frame: frame - sector.labelRange[0], fps, config: { damping: 10, stiffness: 120 } });
          if (labelOpacity <= 0.001) return null;
          const { x, y } = getCoord(sector.middleAngle, radius * 0.6);
          return (
            <div key={`inner-${sector.id}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${labelScale})`, opacity: labelOpacity, fontSize: 40, fontWeight: 900, color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
              {sector.percentage}%
            </div>
          );
        })}

        {calculatedSectors.map((sector) => {
          const textOpacity = interpolate(frame, sector.textRange, [0, 1], clamp);
          if (textOpacity <= 0.001) return null;
          const { x: xMid, y: yMid } = getCoord(sector.middleAngle, radius + 70);
          const isRight = Math.cos((sector.middleAngle * Math.PI) / 180) >= 0;
          const xEnd = isRight ? xMid + 50 : xMid - 50;
          return (
            <div key={`text-${sector.id}`} style={{ position: "absolute", left: xEnd, top: yMid, transform: `translate(${isRight ? "15px" : "-100%"}, -50%)`, opacity: textOpacity, fontSize: 32, fontWeight: 800, color: "#334155" }}>
              {sector.name}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
