import React from "react";
import { AbsoluteFill } from "remotion";

export interface BackgroundConfig {
  backgroundColor?: string;
  backgroundGradient?: string;
  showGrid?: boolean;
  gridColor?: string;
  gridSize?: number;
  gridOpacity?: number;
  showOrbs?: boolean;
  orb1Color?: string;
  orb2Color?: string;
  orb3Color?: string;
}

export const Background: React.FC<{ bg: BackgroundConfig; frame: number }> = ({
  bg,
  frame,
}) => {
  const hasBgGradient = !!bg.backgroundGradient;
  const bgStyle: React.CSSProperties = {
    backgroundColor: bg.backgroundColor ?? "#ffffff",
    ...(hasBgGradient ? { backgroundImage: bg.backgroundGradient } : {}),
    overflow: "hidden",
  };

  const orb1X = Math.sin(frame / 70) * 100;
  const orb1Y = Math.cos(frame / 55) * 80;
  const orb2X = Math.cos(frame / 80) * -120;
  const orb2Y = Math.sin(frame / 60) * 100;
  const orb3X = Math.sin(frame / 50) * 60;
  const orb3Y = Math.cos(frame / 75) * -110;

  return (
    <AbsoluteFill style={bgStyle}>
      {/* Animated light orbs */}
      {(bg.showOrbs ?? true) && (
        <>
          <div
            style={{
              position: "absolute",
              width: 800,
              height: 800,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb1Color ?? "rgba(59, 130, 246, 0.06)"} 0%, transparent 60%)`,
              filter: "blur(60px)",
              top: "-5%",
              left: "-5%",
              transform: `translate(${orb1X}px, ${orb1Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 1000,
              height: 1000,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb2Color ?? "rgba(99, 102, 241, 0.05)"} 0%, transparent 60%)`,
              filter: "blur(80px)",
              bottom: "-15%",
              right: "-15%",
              transform: `translate(${orb2X}px, ${orb2Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb3Color ?? "rgba(147, 197, 253, 0.08)"} 0%, transparent 60%)`,
              filter: "blur(50px)",
              top: "35%",
              left: "30%",
              transform: `translate(${orb3X}px, ${orb3Y}px)`,
            }}
          />
        </>
      )}

      {/* Dot grid overlay */}
      {(bg.showGrid ?? true) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(${bg.gridColor ?? "rgba(59, 130, 246, 0.03)"} 1px, transparent 1px)`,
            backgroundSize: `${bg.gridSize ?? 50}px ${bg.gridSize ?? 50}px`,
            opacity: bg.gridOpacity ?? 1,
            transform: `translateY(${(frame * 0.3) % (bg.gridSize ?? 50)}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
