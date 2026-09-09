import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const CountdownTimer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 5 seconds of countdown (30 fps * 5 = 150 frames) + 1 second of "GO" (30 frames) = 180 frames total
  const isGoState = frame >= 150;
  const currentSecond = Math.floor(frame / 30);
  const displayValue = isGoState ? "GO" : String(5 - currentSecond);
  const localFrame = isGoState ? frame - 150 : frame % 30;

  // Camera breathing effect
  const cameraScale = 1 + Math.sin(frame / 45) * 0.015;

  // Spring animations for the active number/text
  const numberScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 120 },
    from: isGoState ? 0.3 : 0.6,
    to: isGoState ? 1.2 : 1,
  });

  const numberOpacity = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 90 },
    from: 0,
    to: 1,
  });

  // Pulse wave expanding outwards every second
  const pulseScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 25, stiffness: 60 },
    from: 1,
    to: 2.2,
  });

  const pulseOpacity = interpolate(localFrame, [0, 20], [0.4, 0], {
    extrapolateRight: "clamp",
  });

  // Circular progress ring calculation
  // Radius = 280, Circumference = 2 * PI * 280 ≈ 1759.3
  const radius = 280;
  const circumference = 2 * Math.PI * radius;
  const progress = interpolate(frame, [0, 150], [0, 1], {
    extrapolateRight: "clamp",
  });
  const strokeDashoffset = circumference * progress;

  // Background ambient orbs animation
  const orb1X = Math.sin(frame / 60) * 50;
  const orb1Y = Math.cos(frame / 80) * 50;
  const orb2X = Math.cos(frame / 70) * 60;
  const orb2Y = Math.sin(frame / 90) * 60;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#030303",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Cinematic Camera Wrapper */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${cameraScale})`,
          position: "relative",
        }}
      >
        {/* Background Ambient Orbs */}
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
            filter: "blur(80px)",
            transform: `translate(${orb1X}px, ${orb1Y}px)`,
            top: "10%",
            left: "-10%",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)",
            filter: "blur(100px)",
            transform: `translate(${orb2X}px, ${orb2Y}px)`,
            bottom: "10%",
            right: "-10%",
          }}
        />

        {/* Subtle Grid Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
            backgroundSize: "48px 48px",
            opacity: 0.8,
          }}
        />

        {/* Top Header Label */}
        <div
          style={{
            position: "absolute",
            top: 280,
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "12px",
              color: "rgba(255, 255, 255, 0.4)",
              textTransform: "uppercase",
            }}
          >
            Session Begins
          </span>
        </div>

        {/* Central Timer Ring & Number Container */}
        <div
          style={{
            position: "relative",
            width: 700,
            height: 700,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Glassmorphic Inner Plate */}
          <div
            style={{
              position: "absolute",
              width: 520,
              height: 520,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.015)",
              backdropFilter: "blur(25px)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              boxShadow: `
                0 30px 100px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                inset 0 -1px 0 rgba(0, 0, 0, 0.5)
              `,
              zIndex: 2,
            }}
          />

          {/* Glowing Pulse Wave (Triggers every second) */}
          {!isGoState && (
            <div
              style={{
                position: "absolute",
                width: 520,
                height: 520,
                borderRadius: "50%",
                border: "2px solid rgba(245, 158, 11, 0.5)",
                transform: `scale(${pulseScale})`,
                opacity: pulseOpacity,
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
          )}

          {/* SVG Progress Ring */}
          <svg
            width="700"
            height="700"
            style={{
              position: "absolute",
              transform: "rotate(-90deg)",
              zIndex: 3,
            }}
          >
            {/* Background Track */}
            <circle
              cx="350"
              cy="350"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth="8"
            />
            {/* Active Progress */}
            <circle
              cx="350"
              cy="350"
              r={radius}
              fill="transparent"
              stroke={isGoState ? "url(#goGradient)" : "url(#timerGradient)"}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.1s linear",
              }}
            />
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <linearGradient id="goGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>

          {/* Massive Countdown Number */}
          <div
            style={{
              zIndex: 4,
              transform: `scale(${numberScale})`,
              opacity: numberOpacity,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: isGoState ? 180 : 320,
                fontWeight: 900,
                letterSpacing: isGoState ? "-4px" : "-10px",
                background: isGoState
                  ? "linear-gradient(135deg, #34D399 0%, #059669 100%)"
                  : "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 50%, #94A3B8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: isGoState
                  ? "drop-shadow(0 0 40px rgba(16, 185, 129, 0.4))"
                  : "drop-shadow(0 20px 30px rgba(0,0,0,0.3))",
                lineHeight: 1,
              }}
            >
              {displayValue}
            </span>
          </div>
        </div>

        {/* Bottom Subtitle Label */}
        <div
          style={{
            position: "absolute",
            bottom: 280,
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "6px",
              color: "rgba(255, 255, 255, 0.25)",
              textTransform: "uppercase",
            }}
          >
            {isGoState ? "Find your focus" : "Clear your mind"}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Composition Register Snippet:
// <Composition
//   id="CountdownTimer"
//   component={CountdownTimer}
//   durationInFrames={180}
//   fps={30}
//   width={1080}
//   height={1920}
// />