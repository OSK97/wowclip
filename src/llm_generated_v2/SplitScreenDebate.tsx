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

export const SplitScreenDebate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- ANIMATIONS & SPRINGS ---
  
  // Camera Breathing Effect
  const breathingScale = 1 + Math.sin(frame / 45) * 0.008;

  // Entrance Springs
  const baseSpringConfig = { damping: 16, stiffness: 90 };
  
  // Top & Bottom Split Entrance
  const splitEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  // Header Dropdown Entrance
  const headerEntrance = spring({
    frame: frame - 15,
    fps,
    config: baseSpringConfig,
  });

  // Content Entrances (Staggered)
  const topContentEntrance = spring({
    frame: frame - 25,
    fps,
    config: baseSpringConfig,
  });

  const bottomContentEntrance = spring({
    frame: frame - 35,
    fps,
    config: baseSpringConfig,
  });

  // VS Badge Pop Entrance
  const vsEntrance = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  // --- DYNAMIC DEBATE FLOW (The Tension Shift) ---
  // The split line dynamically shifts to highlight who is "speaking" or dominating the argument.
  // Frame 0-90: Balanced split (50%)
  // Frame 90-150: Pro-AI dominates (Split moves down to 58%)
  // Frame 150-210: Pro-Human fights back (Split moves up to 42%)
  // Frame 210+: Returns to balance (50%)
  const splitPercent = interpolate(
    frame,
    [0, 85, 105, 145, 165, 205, 225],
    [50, 50, 58, 58, 42, 42, 50],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Dynamic opacity / focus state based on who is dominating
  const topFocus = interpolate(splitPercent, [42, 50, 58], [0.4, 0.9, 1]);
  const bottomFocus = interpolate(splitPercent, [42, 50, 58], [1, 0.9, 0.4]);

  // Interpolated positions for entrance slides
  const topY = interpolate(splitEntrance, [0, 1], [-100, 0]);
  const bottomY = interpolate(splitEntrance, [0, 1], [100, 0]);
  const headerY = interpolate(headerEntrance, [0, 1], [-250, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0c",
        fontFamily,
        overflow: "hidden",
        color: "#ffffff",
      }}
    >
      {/* Cinematic Breathing Wrapper */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${breathingScale})`,
          position: "relative",
        }}
      >
        {/* --- TOP HALF: PRO-AI (EMERALD) --- */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: `${splitPercent}%`,
            background: "linear-gradient(180deg, #022c22 0%, #064e3b 100%)",
            transform: `translateY(${topY}%)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 80px",
            boxSizing: "border-box",
            borderBottom: "3px solid rgba(52, 211, 153, 0.3)",
            opacity: topFocus,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* Subtle Background Grid for Tech Aesthetic */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(rgba(52, 211, 153, 0.15) 1.5px, transparent 1.5px)",
              backgroundSize: "40px 40px",
              opacity: 0.7,
            }}
          />

          {/* Top Content Container */}
          <div
            style={{
              transform: `scale(${interpolate(topContentEntrance, [0, 1], [0.9, 1])}) translateY(${interpolate(topContentEntrance, [0, 1], [50, 0])}px)`,
              opacity: topContentEntrance,
              textAlign: "center",
              zIndex: 1,
              maxWidth: 900,
            }}
          >
            {/* Tag */}
            <div
              style={{
                display: "inline-block",
                backgroundColor: "rgba(16, 185, 129, 0.2)",
                border: "2px solid #10b981",
                padding: "12px 32px",
                borderRadius: "100px",
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "4px",
                color: "#34d399",
                textTransform: "uppercase",
                marginBottom: "40px",
                boxShadow: "0 0 30px rgba(16, 185, 129, 0.3)",
              }}
            >
              Pro-AI / Efficiency
            </div>

            {/* Main Argument Title */}
            <h2
              style={{
                fontSize: "85px",
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0 0 30px 0",
                letterSpacing: "-2px",
                background: "linear-gradient(to right, #ffffff, #a7f3d0)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Infinite Scale & Instant Iteration
            </h2>

            {/* Supporting Description */}
            <p
              style={{
                fontSize: "38px",
                lineHeight: 1.5,
                color: "#a7f3d0",
                opacity: 0.85,
                margin: 0,
                fontWeight: 400,
              }}
            >
              AI breaks creative bottlenecks, generating thousands of highly optimized variations in seconds.
            </p>
          </div>
        </div>

        {/* --- BOTTOM HALF: PRO-HUMAN (CRIMSON) --- */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: `${100 - splitPercent}%`,
            background: "linear-gradient(180deg, #1c0005 0%, #4c0519 100%)",
            transform: `translateY(${bottomY}%)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 80px",
            boxSizing: "border-box",
            borderTop: "3px solid rgba(251, 113, 133, 0.3)",
            opacity: bottomFocus,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* Subtle Background Radial Dots for Organic/Human Aesthetic */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(rgba(251, 113, 133, 0.12) 2px, transparent 2px)",
              backgroundSize: "50px 50px",
              opacity: 0.6,
            }}
          />

          {/* Bottom Content Container */}
          <div
            style={{
              transform: `scale(${interpolate(bottomContentEntrance, [0, 1], [0.9, 1])}) translateY(${interpolate(bottomContentEntrance, [0, 1], [-50, 0])}px)`,
              opacity: bottomContentEntrance,
              textAlign: "center",
              zIndex: 1,
              maxWidth: 900,
            }}
          >
            {/* Tag */}
            <div
              style={{
                display: "inline-block",
                backgroundColor: "rgba(244, 63, 94, 0.2)",
                border: "2px solid #f43f5e",
                padding: "12px 32px",
                borderRadius: "100px",
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "4px",
                color: "#fda4af",
                textTransform: "uppercase",
                marginBottom: "40px",
                boxShadow: "0 0 30px rgba(244, 63, 94, 0.3)",
              }}
            >
              Pro-Human / Soul
            </div>

            {/* Main Argument Title */}
            <h2
              style={{
                fontSize: "85px",
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0 0 30px 0",
                letterSpacing: "-2px",
                background: "linear-gradient(to right, #ffffff, #fecdd3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              The Empathy & Experience Gap
            </h2>

            {/* Supporting Description */}
            <p
              style={{
                fontSize: "38px",
                lineHeight: 1.5,
                color: "#fecdd3",
                opacity: 0.85,
                margin: 0,
                fontWeight: 400,
              }}
            >
              True art requires lived human experience, vulnerability, and authentic emotional resonance.
            </p>
          </div>
        </div>

        {/* --- FLOATING TOP HEADER (THE TOPIC) --- */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "50%",
            transform: `translateX(-50%) translateY(${headerY}px)`,
            opacity: headerEntrance,
            zIndex: 10,
            width: "90%",
            maxWidth: "920px",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(10, 10, 12, 0.75)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "32px",
              padding: "30px 40px",
              textAlign: "center",
              boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "6px",
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                marginBottom: "12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Clash of Perspectives
            </div>
            <h1
              style={{
                fontSize: "48px",
                fontWeight: 900,
                margin: 0,
                letterSpacing: "-1px",
                color: "#ffffff",
              }}
            >
              Will AI Replace Creative Writers?
            </h1>
          </div>
        </div>

        {/* --- CENTER VS BADGE --- */}
        <div
          style={{
            position: "absolute",
            top: `${splitPercent}%`,
            left: "50%",
            transform: `translate(-50%, -50%) scale(${vsEntrance})`,
            zIndex: 20,
          }}
        >
          {/* Outer Glowing Ring */}
          <div
            style={{
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              backgroundColor: "#0a0a0c",
              border: "4px solid rgba(255, 255, 255, 0.15)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: `
                0 0 50px rgba(0, 0, 0, 0.8),
                0 0 30px rgba(52, 211, 153, 0.2),
                0 0 30px rgba(251, 113, 133, 0.2)
              `,
              position: "relative",
            }}
          >
            {/* Inner Glass Circle */}
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              <span
                style={{
                  fontSize: "56px",
                  fontWeight: 900,
                  fontStyle: "italic",
                  letterSpacing: "-2px",
                  background: "linear-gradient(45deg, #34d399 0%, #fecdd3 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                VS
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
  Composition Setup (Root.tsx Snippet):
  
  import { Composition } from "remotion";
  import { SplitScreenDebate } from "./SplitScreenDebate";

  export const Root: React.FC = () => {
    return (
      <Composition
        id="SplitScreenDebate"
        component={SplitScreenDebate}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
      />
    );
  };
*/