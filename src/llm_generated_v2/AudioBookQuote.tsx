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

// Premium Color Palette
const COLORS = {
  bgGradientStart: "#0a0a0c",
  bgGradientEnd: "#121218",
  accent: "#e2b07e", // Warm gold/bronze
  accentLight: "#f5ebd8",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  glassBg: "rgba(20, 20, 25, 0.7)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  vinylGroove: "rgba(255, 255, 255, 0.03)",
};

export const AudioBookQuote: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Cinematic Breathing Effect
  const breathingScale = 1 + Math.sin(frame / 80) * 0.012;

  // 2. Continuous Record Rotation
  const recordRotation = (frame * 0.65) % 360;

  // 3. Spring Entrances
  const recordEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const cardEntrance = spring({
    frame: frame - 15,
    fps,
    config: { damping: 18, stiffness: 75 },
  });

  const tonearmEntrance = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 50 },
  });

  // 4. Audio Progress Simulation (e.g., 34% to 37% over the video)
  const progressPercent = interpolate(frame, [0, 300], [34.2, 37.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 5. Quote Text Staggered Entrances
  const quoteLines = [
    "“I must not fear.",
    "Fear is the mind-killer.",
    "Fear is the little-death",
    "that brings total obliteration.”",
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgGradientStart,
        backgroundImage: `radial-gradient(circle at 50% 30%, #1e1b24 0%, ${COLORS.bgGradientEnd} 70%)`,
        fontFamily,
        color: COLORS.textPrimary,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "120px 60px",
        overflow: "hidden",
      }}
    >
      {/* Subtle Ambient Background Orbs */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(226, 176, 126, 0.05) 0%, rgba(0,0,0,0) 70%)",
          top: "15%",
          left: "10%",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Cinematic Container with Breathing */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          transform: `scale(${breathingScale})`,
        }}
      >
        {/* Header Section */}
        <div
          style={{
            textAlign: "center",
            opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateLeft: "clamp" }),
            transform: `translateY(${interpolate(frame, [10, 40], [20, 0], { extrapolateLeft: "clamp" })}px)`,
          }}
        >
          <span
            style={{
              fontSize: 24,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: COLORS.accent,
              fontWeight: 600,
            }}
          >
            Audiobook Excerpt
          </span>
          <h2
            style={{
              fontSize: 42,
              fontWeight: 300,
              margin: "12px 0 0 0",
              color: COLORS.textSecondary,
              letterSpacing: -0.5,
            }}
          >
            Chapter IV: The Litany Against Fear
          </h2>
        </div>

        {/* Center Section: Rotating Record & Tonearm */}
        <div
          style={{
            position: "relative",
            width: 600,
            height: 600,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "40px 0",
          }}
        >
          {/* Vinyl Record */}
          <div
            style={{
              width: 520,
              height: 520,
              borderRadius: "50%",
              backgroundColor: "#0d0d0d",
              boxShadow: "0 50px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(255,255,255,0.05)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${recordEntrance}) rotate(${recordRotation}deg)`,
              position: "relative",
              border: "4px solid #1a1a1a",
            }}
          >
            {/* Concentric Grooves */}
            <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />
            <div style={{ position: "absolute", width: 440, height: 440, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />
            <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />
            <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />
            <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />
            <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", border: `1px solid ${COLORS.vinylGroove}` }} />

            {/* Record Label (Center Art) */}
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: `linear-gradient(135deg, #2c1e21 0%, #121013 100%)`,
                border: "6px solid #0d0d0d",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.6)",
              }}
            >
              {/* Minimalist Graphic on Label */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: `2px solid ${COLORS.accent}`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: COLORS.accent,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: COLORS.accent,
                  marginTop: 12,
                }}
              >
                DUNE
              </span>
              {/* Center Spindle Hole */}
              <div
                style={{
                  position: "absolute",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: COLORS.bgGradientStart,
                  border: "2px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>
          </div>

          {/* Tonearm (Sleek Metallic Needle) */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 200,
              height: 300,
              pointerEvents: "none",
              transformOrigin: "150px 40px",
              transform: `rotate(${interpolate(tonearmEntrance, [0, 1], [-35, 3])}deg)`,
              opacity: tonearmEntrance,
            }}
          >
            {/* Base/Pivot */}
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 30,
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#222",
                border: "4px solid #444",
                boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
              }}
            />
            {/* Arm Shaft */}
            <div
              style={{
                position: "absolute",
                top: 38,
                right: 48,
                width: 8,
                height: 220,
                backgroundColor: "#888",
                backgroundImage: "linear-gradient(to right, #888, #e1e1e1, #555)",
                borderRadius: 4,
                transform: "rotate(-12deg)",
                transformOrigin: "top center",
              }}
            />
            {/* Cartridge/Headshell */}
            <div
              style={{
                position: "absolute",
                bottom: 30,
                left: 62,
                width: 24,
                height: 45,
                backgroundColor: "#1a1a1a",
                borderRadius: 2,
                transform: "rotate(-25deg)",
                boxShadow: "0 5px 10px rgba(0,0,0,0.3)",
                borderLeft: `3px solid ${COLORS.accent}`,
              }}
            />
          </div>
        </div>

        {/* Bottom Section: Glassmorphic Quote Card */}
        <div
          style={{
            width: "100%",
            backgroundColor: COLORS.glassBg,
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            borderRadius: 40,
            padding: "60px 50px",
            border: `1px solid ${COLORS.glassBorder}`,
            boxShadow: "0 30px 60px rgba(0, 0, 0, 0.4)",
            transform: `translateY(${interpolate(cardEntrance, [0, 1], [100, 0])}px)`,
            opacity: cardEntrance,
          }}
        >
          {/* Quote Text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: 45,
            }}
          >
            {quoteLines.map((line, index) => {
              const lineEntrance = spring({
                frame: frame - 45 - index * 12,
                fps,
                config: { damping: 15, stiffness: 90 },
              });

              return (
                <div
                  key={index}
                  style={{
                    overflow: "hidden",
                    height: 72,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 52,
                      fontWeight: 300,
                      lineHeight: "72px",
                      color: index === 1 || index === 2 ? COLORS.accentLight : COLORS.textPrimary,
                      opacity: lineEntrance,
                      transform: `translateY(${interpolate(lineEntrance, [0, 1], [50, 0])}px)`,
                    }}
                  >
                    {line}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              width: "100%",
              marginBottom: 35,
            }}
          />

          {/* Metadata & Progress Bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                  }}
                >
                  Frank Herbert
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: 28,
                    color: COLORS.textSecondary,
                    fontWeight: 400,
                  }}
                >
                  Narrated by Simon Vance
                </p>
              </div>

              {/* Tabular Time Indicator */}
              <div
                style={{
                  fontFamily,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 28,
                  color: COLORS.accent,
                  fontWeight: 500,
                }}
              >
                02:14:{(30 + Math.floor(frame / 30)).toString().padStart(2, "0")}
              </div>
            </div>

            {/* Progress Track */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 8,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${progressPercent}%`,
                  backgroundColor: COLORS.accent,
                  borderRadius: 4,
                  boxShadow: `0 0 12px ${COLORS.accent}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
  Composition Setup:
  
  import { Composition } from "remotion";
  import { AudioBookQuote } from "./AudioBookQuote";

  export const Root: React.FC = () => {
    return (
      <Composition
        id="AudioBookQuote"
        component={AudioBookQuote}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
    );
  };
*/