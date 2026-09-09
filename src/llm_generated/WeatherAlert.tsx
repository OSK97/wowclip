import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const WeatherAlert: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow breathing scale for the entire scene
  const sceneScale = 1 + Math.sin(frame / 90) * 0.012;

  // Spring animations for entrance
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  // Staggered entrances for internal elements
  const headerEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const titleEntrance = spring({
    frame: frame - 18,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const dividerEntrance = spring({
    frame: frame - 24,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const bodyEntrance = spring({
    frame: frame - 30,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const actionEntrance = spring({
    frame: frame - 40,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  // Interpolations for card entrance
  const cardY = interpolate(cardEntrance, [0, 1], [400, 0]);
  const cardScale = interpolate(cardEntrance, [0, 1], [0.85, 1]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);

  // Interpolations for content elements
  const headerY = interpolate(headerEntrance, [0, 1], [40, 0]);
  const headerOpacity = interpolate(headerEntrance, [0, 1], [0, 1]);

  const titleY = interpolate(titleEntrance, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleEntrance, [0, 1], [0, 1]);

  const dividerWidth = interpolate(dividerEntrance, [0, 1], [0, 100]); // percentage

  const bodyY = interpolate(bodyEntrance, [0, 1], [40, 0]);
  const bodyOpacity = interpolate(bodyEntrance, [0, 1], [0, 1]);

  const actionScale = interpolate(actionEntrance, [0, 1], [0.9, 1]);
  const actionOpacity = interpolate(actionEntrance, [0, 1], [0, 1]);

  // Pulsing warning glow effect (red/amber)
  const glowPulse = interpolate(
    Math.sin(frame / 15),
    [-1, 1],
    [0.4, 0.85]
  );

  // Radar ring expansions
  const ring1Scale = interpolate((frame % 60) / 60, [0, 1], [1, 2.5]);
  const ring1Opacity = interpolate((frame % 60) / 60, [0, 0.8, 1], [0.6, 0.4, 0]);

  const ring2Scale = interpolate(((frame + 30) % 60) / 60, [0, 1], [1, 2.5]);
  const ring2Opacity = interpolate(((frame + 30) % 60) / 60, [0, 0.8, 1], [0.6, 0.4, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#07090e",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Cinematic Background Atmosphere */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `scale(${sceneScale})`,
          transition: "transform 0.1s ease-out",
        }}
      >
        {/* Deep storm cloud radial gradient */}
        <div
          style={{
            position: "absolute",
            width: "150%",
            height: "150%",
            top: "-25%",
            left: "-25%",
            background:
              "radial-gradient(circle at 50% 35%, rgba(180, 20, 20, 0.15) 0%, rgba(15, 23, 42, 0) 60%)",
            opacity: glowPulse,
          }}
        />
        {/* Subtle grid pattern for technical/radar feel */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Radar Pulse Visualizer behind the card */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          width: "400px",
          height: "400px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(239, 68, 68, 0.3)",
            transform: `scale(${ring1Scale})`,
            opacity: ring1Opacity,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(239, 68, 68, 0.3)",
            transform: `scale(${ring2Scale})`,
            opacity: ring2Opacity,
          }}
        />
      </div>

      {/* Severe Weather Alert Card */}
      <div
        style={{
          width: "900px",
          padding: "80px 60px",
          borderRadius: "48px",
          background: "rgba(18, 24, 38, 0.75)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: `
            0 30px 100px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            0 0 80px rgba(239, 68, 68, ${glowPulse * 0.15})
          `,
          transform: `translateY(${cardY}px) scale(${cardScale})`,
          opacity: cardOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {/* Header: Emergency Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            transform: `translateY(${headerY}px)`,
            opacity: headerOpacity,
            marginBottom: "40px",
          }}
        >
          {/* Warning Icon */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#ef4444",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.5)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#ef4444",
              letterSpacing: "6px",
              textTransform: "uppercase",
            }}
          >
            Emergency Alert
          </span>
        </div>

        {/* Title: Alert Type */}
        <h1
          style={{
            fontSize: "90px",
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            margin: "0 0 20px 0",
            lineHeight: "1.1",
            letterSpacing: "-2px",
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          Tornado Warning
        </h1>

        {/* Animated Divider */}
        <div
          style={{
            width: `${dividerWidth}%`,
            height: "2px",
            background:
              "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2) 20%, rgba(255, 255, 255, 0.2) 80%, transparent)",
            marginBottom: "40px",
          }}
        />

        {/* Body: Location & Time Details */}
        <div
          style={{
            transform: `translateY(${bodyY}px)`,
            opacity: bodyOpacity,
            textAlign: "center",
            marginBottom: "60px",
          }}
        >
          <p
            style={{
              fontSize: "42px",
              fontWeight: 600,
              color: "#e2e8f0",
              margin: "0 0 12px 0",
            }}
          >
            King County Area
          </p>
          <p
            style={{
              fontSize: "32px",
              fontWeight: 500,
              color: "#94a3b8",
              margin: 0,
            }}
          >
            Until 10:45 PM PDT • National Weather Service
          </p>
        </div>

        {/* Action Banner: Instruction */}
        <div
          style={{
            width: "100%",
            padding: "36px",
            borderRadius: "24px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            boxShadow: "inset 0 0 20px rgba(239, 68, 68, 0.05)",
            transform: `scale(${actionScale})`,
            opacity: actionOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "38px",
              fontWeight: 800,
              color: "#fca5a5",
              letterSpacing: "1px",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Take Shelter Immediately
          </span>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "#f87171",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            Move to a basement or an interior room.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
Composition Registration Snippet (for Root.tsx):

import { Composition } from "remotion";
import { WeatherAlert } from "./WeatherAlert";

export const Root: React.FC = () => {
  return (
    <Composition
      id="WeatherAlert"
      component={WeatherAlert}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/