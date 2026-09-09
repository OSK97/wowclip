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
  bgGradient: "radial-gradient(circle at 50% 50%, #121520 0%, #07080d 100%)",
  glassBg: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassHighlight: "rgba(255, 255, 255, 0.15)",
  accentGold: "linear-gradient(135deg, #ffdbb5 0%, #ffb03a 50%, #e38300 100%)",
  accentRed: "#ff4a5a",
  textMuted: "#8e9bb0",
  textLight: "#f3f6fa",
};

export const CalendarDate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Cinematic Breathing Effect (Slow camera drift)
  const cameraScale = 1 + Math.sin(frame / 80) * 0.02;
  const cameraRotateX = 8 + Math.sin(frame / 100) * 2;
  const cameraRotateY = -8 + Math.cos(frame / 100) * 2;

  // 2. Spring configuration for the flip animation
  const flipSpring = spring({
    frame: frame - 35, // Starts at frame 35
    fps,
    config: {
      damping: 14,
      stiffness: 75,
      mass: 1.5,
    },
  });

  // 3. Reveal spring for the new date's content pop
  const revealSpring = spring({
    frame: frame - 55,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  // Interpolations for the flipping page
  // Rotates from 0 (hanging flat) to -130 degrees (flipped up and backward)
  const flipRotation = interpolate(flipSpring, [0, 1], [0, -140]);
  const flipOpacity = interpolate(flipSpring, [0, 0.6, 0.8], [1, 1, 0]);
  const flipZIndex = interpolate(flipSpring, [0, 0.5, 1], [3, 1, 0]);

  // Interpolations for the revealed page (shadow and scale)
  const revealScale = interpolate(revealSpring, [0, 1], [0.96, 1]);
  const revealBlur = interpolate(revealSpring, [0, 1], [8, 0]);
  const glowIntensity = interpolate(flipSpring, [0, 0.7, 1], [0.2, 0.8, 0.4]);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgGradient,
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        perspective: 2000,
      }}
    >
      {/* Background Ambient Glows */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 176, 58, 0.08) 0%, rgba(0,0,0,0) 70%)",
          top: "20%",
          left: "10%",
          filter: "blur(80px)",
          transform: `scale(${cameraScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 74, 90, 0.05) 0%, rgba(0,0,0,0) 70%)",
          bottom: "15%",
          right: "10%",
          filter: "blur(60px)",
          transform: `scale(${cameraScale})`,
        }}
      />

      {/* Subtle Radial Grid Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.1) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.4,
        }}
      />

      {/* 3D Cinematic Camera Container */}
      <div
        style={{
          transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Calendar Binder / Rings */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            width: 500,
            position: "absolute",
            top: -40,
            zIndex: 10,
            transform: "translateZ(40px)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 80,
                borderRadius: 12,
                background: "linear-gradient(180deg, #3a3f50 0%, #1e212b 50%, #0f1117 100%)",
                boxShadow: "0 10px 20px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            />
          ))}
        </div>

        {/* Dynamic Backlight Glow */}
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 850,
            background: `radial-gradient(circle, rgba(255, 176, 58, ${glowIntensity * 0.25}) 0%, rgba(0,0,0,0) 70%)`,
            zIndex: -1,
            transform: "translateZ(-50px)",
            pointerEvents: "none",
          }}
        />

        {/* Main Calendar Card Wrapper */}
        <div
          style={{
            width: 720,
            height: 880,
            position: "relative",
            transformStyle: "preserve-3d",
          }}
        >
          {/* ================= PAGE 2: UNDERNEATH (THE IMPORTANT DATE) ================= */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(13, 16, 27, 0.85)",
              backdropFilter: "blur(30px)",
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 48,
              boxShadow: "0 50px 100px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transform: `scale(${revealScale}) translateZ(0px)`,
              filter: `blur(${revealBlur}px)`,
              zIndex: 1,
            }}
          >
            {/* Red Accent Header Bar */}
            <div
              style={{
                height: 180,
                background: "linear-gradient(90deg, #ff4a5a 0%, #ff6b6b 100%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  letterSpacing: 12,
                  color: "#ffffff",
                  textShadow: "0 4px 10px rgba(0,0,0,0.15)",
                }}
              >
                OCTOBER
              </span>
            </div>

            {/* Date Body */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                paddingBottom: 40,
              }}
            >
              <span
                style={{
                  fontSize: 320,
                  fontWeight: 900,
                  background: COLORS.accentGold,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 0.9,
                  letterSpacing: -10,
                  filter: "drop-shadow(0 15px 30px rgba(227, 131, 0, 0.2))",
                }}
              >
                24
              </span>

              {/* Event Badge */}
              <div
                style={{
                  marginTop: 20,
                  padding: "16px 40px",
                  borderRadius: 100,
                  background: "rgba(255, 176, 58, 0.1)",
                  border: "1px solid rgba(255, 176, 58, 0.3)",
                  boxShadow: "0 10px 30px rgba(255, 176, 58, 0.05)",
                  transform: `scale(${interpolate(revealSpring, [0.5, 1], [0.8, 1], { extrapolateLeft: "clamp" })})`,
                  opacity: interpolate(revealSpring, [0.4, 0.8], [0, 1], { extrapolateLeft: "clamp" }),
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#ffb03a",
                    letterSpacing: 6,
                    textTransform: "uppercase",
                  }}
                >
                  Launch Day
                </span>
              </div>
            </div>
          </div>

          {/* ================= PAGE 1: FLIPPING (THE OLD DATE) ================= */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(18, 22, 35, 0.95)",
              backdropFilter: "blur(30px)",
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 48,
              boxShadow: "0 50px 100px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transformOrigin: "top center",
              transform: `rotateX(${flipRotation}deg) translateZ(10px)`,
              opacity: flipOpacity,
              zIndex: flipZIndex,
              pointerEvents: "none",
            }}
          >
            {/* Red Accent Header Bar (Old Page) */}
            <div
              style={{
                height: 180,
                background: "linear-gradient(90deg, #e03e4d 0%, #f05a5a 100%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  letterSpacing: 12,
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                OCTOBER
              </span>
            </div>

            {/* Date Body (Old Page) */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                paddingBottom: 40,
              }}
            >
              <span
                style={{
                  fontSize: 320,
                  fontWeight: 900,
                  color: COLORS.textLight,
                  lineHeight: 0.9,
                  letterSpacing: -10,
                  opacity: 0.9,
                }}
              >
                23
              </span>

              {/* Event Badge (Old Page - Empty/Standard) */}
              <div
                style={{
                  marginTop: 20,
                  padding: "16px 40px",
                  borderRadius: 100,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.textMuted,
                    letterSpacing: 6,
                    textTransform: "uppercase",
                  }}
                >
                  Yesterday
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
  Composition Setup:
  ------------------
  import { Composition } from "remotion";
  import { CalendarDate } from "./CalendarDate";

  export const Root = () => {
    return (
      <Composition
        id="CalendarDate"
        component={CalendarDate}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
    );
  };
*/
