import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadOutfit();

export const StatisticHighlight: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow camera breathing
  const cameraScale = 1 + Math.sin(frame / 80) * 0.015;

  // Base spring for entrance animations
  const entranceSpring = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 90,
    },
  });

  // Spring specifically tuned for the fast count-up
  const counterSpring = spring({
    frame: frame - 10, // Slight delay for the count-up
    fps,
    config: {
      damping: 14,
      stiffness: 75,
    },
  });

  // Target statistic values
  const targetNumber = 87;
  const currentNumber = Math.min(
    targetNumber,
    Math.round(
      interpolate(counterSpring, [0, 1], [0, targetNumber], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  );

  // SVG Circle Progress Math
  const radius = 280;
  const circumference = 2 * Math.PI * radius;
  const targetProgress = 0.87;
  const currentProgress = interpolate(
    counterSpring,
    [0, 1],
    [0, targetProgress],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const strokeDashoffset = circumference * (1 - currentProgress);

  // Staggered entrance animations for UI elements
  const cardScale = interpolate(entranceSpring, [0, 1], [0.85, 1]);
  const cardOpacity = interpolate(entranceSpring, [0, 1], [0, 1]);

  const textEntrance = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const textY = interpolate(textEntrance, [0, 1], [40, 0]);
  const textOpacity = interpolate(textEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060913",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Ambient Orbs */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)",
          top: "-20%",
          left: "-20%",
          transform: `translate(${Math.sin(frame / 100) * 50}px, ${Math.cos(frame / 100) * 50}px)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 70%)",
          bottom: "-20%",
          right: "-20%",
          transform: `translate(${Math.cos(frame / 120) * 60}px, ${Math.sin(frame / 120) * 60}px)`,
          filter: "blur(80px)",
        }}
      />

      {/* Subtle Grid Texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.8,
        }}
      />

      {/* Main Cinematic Container */}
      <div
        style={{
          transform: `scale(${cameraScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Glassmorphic Card */}
        <div
          style={{
            width: 900,
            height: 1300,
            borderRadius: 64,
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 100px 150px -50px rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 60px",
            boxSizing: "border-box",
            opacity: cardOpacity,
            transform: `scale(${cardScale})`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle inner glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 64,
              border: "1px solid rgba(255, 255, 255, 0.05)",
              pointerEvents: "none",
            }}
          />

          {/* Circular Progress Ring Container */}
          <div
            style={{
              position: "relative",
              width: 640,
              height: 640,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 80,
            }}
          >
            {/* Background Track */}
            <svg
              width="640"
              height="640"
              style={{
                position: "absolute",
                transform: "rotate(-90deg)",
              }}
            >
              <circle
                cx="320"
                cy="320"
                r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="24"
              />
              {/* Animated Active Ring */}
              <circle
                cx="320"
                cy="320"
                r={radius}
                fill="transparent"
                stroke="url(#ringGradient)"
                strokeWidth="24"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  filter: "drop-shadow(0px 0px 20px rgba(16, 185, 129, 0.3))",
                }}
              />
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Massive Statistic Number */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <span
                style={{
                  fontSize: 210,
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-6px",
                  fontVariantNumeric: "tabular-nums",
                  background: "linear-gradient(180deg, #ffffff 30%, #a5b4fc 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {currentNumber}
              </span>
              <span
                style={{
                  fontSize: 100,
                  fontWeight: 700,
                  color: "#10b981",
                  marginLeft: 4,
                  alignSelf: "flex-start",
                  marginTop: 40,
                }}
              >
                %
              </span>
            </div>
          </div>

          {/* Supporting Context Metadata */}
          <div
            style={{
              textAlign: "center",
              transform: `translateY(${textY}px)`,
              opacity: textOpacity,
              maxWidth: 700,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#6366f1",
                letterSpacing: "6px",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              Efficiency Boost
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
                letterSpacing: "-1px",
                marginBottom: 20,
              }}
            >
              Faster Render Times
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 400,
                color: "#94a3b8",
                lineHeight: 1.5,
              }}
            >
              Achieved using Remotion's optimized multi-threaded asset pipeline.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Setup Reference:
import { Composition } from "remotion";
import { StatisticHighlight } from "./StatisticHighlight";

export const Root: React.FC = () => {
  return (
    <Composition
      id="StatisticHighlight"
      component={StatisticHighlight}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/