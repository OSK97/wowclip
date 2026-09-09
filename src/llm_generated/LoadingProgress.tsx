import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const LoadingProgress: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Cinematic Breathing & Camera Motion
  const breathingScale = 1 + Math.sin(frame / 45) * 0.012;
  const cameraRotation = Math.sin(frame / 90) * 0.5; // subtle 0.5 degree tilt

  // 2. Entrance Animations (Spring-loaded)
  const entranceSpring = spring({
    frame,
    fps,
    config: {
      damping: 18,
      stiffness: 90,
      mass: 1.2,
    },
  });

  const contentOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3. Progress Calculation (Organic, non-linear acceleration)
  // Starts slow, speeds up in the middle, settles elegantly at 100%
  const progress = interpolate(
    frame,
    [15, 115],
    [0, 100],
    {
      easing: Easing.bezier(0.65, 0, 0.15, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // SVG Circle Parameters
  const radius = 180;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Glow intensity based on progress
  const glowOpacity = interpolate(progress, [0, 100], [0.15, 0.45]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050508",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Cinematic Background Elements */}
      {/* Ambient Blurred Orbs */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.05) 50%, transparent 100%)",
          filter: "blur(80px)",
          transform: `translate(${-100 + Math.sin(frame / 60) * 30}px, ${-150 + Math.cos(frame / 60) * 30}px) scale(${breathingScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45, 212, 191, 0.1) 0%, rgba(99, 102, 241, 0.02) 60%, transparent 100%)",
          filter: "blur(100px)",
          transform: `translate(${150 + Math.cos(frame / 50) * 40}px, ${200 + Math.sin(frame / 50) * 40}px) scale(${breathingScale})`,
        }}
      />

      {/* Subtle Radial Grid Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "center center",
          opacity: 0.7,
        }}
      />

      {/* Main Interactive Container */}
      <div
        style={{
          transform: `scale(${entranceSpring * breathingScale}) rotate(${cameraRotation}deg)`,
          opacity: contentOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        {/* Glassmorphic Ring Card */}
        <div
          style={{
            position: "relative",
            width: "520px",
            height: "520px",
            borderRadius: "100px",
            background: "rgba(10, 10, 18, 0.4)",
            backdropFilter: "blur(30px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: "0 50px 100px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* SVG Progress Ring */}
          <svg
            width="440"
            height="440"
            viewBox="0 0 440 440"
            style={{
              transform: "rotate(-90deg)",
              filter: "drop-shadow(0px 0px 20px rgba(99, 102, 241, 0.2))",
            }}
          >
            <defs>
              {/* Premium Gradient for the Progress Ring */}
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
              {/* Glow Filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Track */}
            <circle
              cx="220"
              cy="220"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth={strokeWidth}
            />

            {/* Glowing Underlay (Dynamic Glow) */}
            <circle
              cx="220"
              cy="220"
              r={radius}
              fill="transparent"
              stroke="url(#progressGradient)"
              strokeWidth={strokeWidth + 4}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                opacity: glowOpacity,
                filter: "url(#glow)",
              }}
            />

            {/* Active Progress Stroke */}
            <circle
              cx="220"
              cy="220"
              r={radius}
              fill="transparent"
              stroke="url(#progressGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.1s ease-out",
              }}
            />
          </svg>

          {/* Center Text (Percentage) */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "96px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-2px",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                background: "linear-gradient(to bottom, #ffffff 60%, #a5b4fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {Math.round(progress)}
              <span
                style={{
                  fontSize: "40px",
                  fontWeight: 500,
                  color: "#6366f1",
                  marginLeft: "2px",
                  WebkitTextFillColor: "initial",
                }}
              >
                %
              </span>
            </span>
          </div>
        </div>

        {/* Minimalist Status Label */}
        <div
          style={{
            marginTop: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.4)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              paddingLeft: "8px", // Offset letter-spacing centering issue
            }}
          >
            {progress < 100 ? "Synchronizing" : "System Ready"}
          </span>
          
          {/* Tiny elegant loading dots */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              height: "6px",
              alignItems: "center",
            }}
          >
            {[0, 1, 2].map((i) => {
              const dotOpacity = interpolate(
                (frame / 10) % 3,
                [i - 0.5, i, i + 0.5],
                [0.2, 1, 0.2],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return (
                <div
                  key={i}
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: progress < 100 ? "#6366f1" : "#2dd4bf",
                    opacity: progress < 100 ? dotOpacity : 1,
                    transition: "background-color 0.5s ease",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Setup
import { Composition } from "remotion";
import { LoadingProgress } from "./LoadingProgress";

export const Root: React.FC = () => {
  return (
    <Composition
      id="LoadingProgress"
      component={LoadingProgress}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/