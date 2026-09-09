import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadOutfit();

// Premium Color Palette
const COLORS = {
  bgDark: "#0B0F19",
  proGlow: "rgba(16, 185, 129, 0.15)", // Emerald
  proBorder: "rgba(16, 185, 129, 0.3)",
  proText: "#34D399",
  conGlow: "rgba(244, 63, 94, 0.15)", // Rose
  conBorder: "rgba(244, 63, 94, 0.3)",
  conText: "#FB7185",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  glassBg: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
};

const PROS_DATA = [
  { id: 1, text: "Next-Gen M3 Max Architecture" },
  { id: 2, text: "Stunning 120Hz Liquid Retina XDR" },
  { id: 3, text: "Unrivaled 22-Hour Battery Life" },
];

const CONS_DATA = [
  { id: 1, text: "Premium $3,499 Entry Price" },
  { id: 2, text: "Zero Post-Purchase Upgrades" },
  { id: 3, text: "Noticeable Thermal Throttling" },
];

export const ProsConsList: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Cinematic Breathing Effect
  const breatheScale = 1 + Math.sin(frame / 45) * 0.008;

  // Spring configurations for premium feel
  const baseSpringConfig = {
    damping: 16,
    stiffness: 80,
    mass: 0.8,
  };

  // Split screen entrance (slide from top and bottom)
  const splitProgress = spring({
    frame,
    fps,
    config: baseSpringConfig,
    delay: 5,
  });

  const topY = interpolate(splitProgress, [0, 1], [-height / 2, 0]);
  const bottomY = interpolate(splitProgress, [0, 1], [height / 2, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Background Decorative Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)`,
          backgroundSize: "40px 40px",
          opacity: 0.7,
        }}
      />

      {/* Cinematic Breathing Wrapper */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${breatheScale})`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* TOP HALF: PROS */}
        <div
          style={{
            flex: 1,
            position: "relative",
            transform: `translateY(${topY}px)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 80px",
            background: `linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, transparent 100%)`,
            borderBottom: `1px solid ${COLORS.glassBorder}`,
          }}
        >
          {/* Ambient Glow */}
          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: "30%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: COLORS.proGlow,
              filter: "blur(120px)",
              pointerEvents: "none",
            }}
          />

          {/* Section Header */}
          <div style={{ marginBottom: "50px" }}>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 800,
                letterSpacing: "0.25em",
                color: COLORS.proText,
                textTransform: "uppercase",
                display: "block",
                marginBottom: "12px",
              }}
            >
              The Advantages
            </span>
            <h2
              style={{
                fontSize: "80px",
                fontWeight: 900,
                color: COLORS.textPrimary,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              PROS
            </h2>
          </div>

          {/* Pros List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {PROS_DATA.map((item, index) => {
              const itemSpring = spring({
                frame: frame - (20 + index * 12),
                fps,
                config: baseSpringConfig,
              });

              const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
              const slideX = interpolate(itemSpring, [0, 1], [-50, 0]);

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "28px",
                    padding: "32px 40px",
                    borderRadius: "24px",
                    backgroundColor: COLORS.glassBg,
                    border: `1px solid ${COLORS.glassBorder}`,
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                    transform: `translateX(${slideX}px)`,
                    opacity,
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      border: `2px solid ${COLORS.proBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={COLORS.proText}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: "38px",
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM HALF: CONS */}
        <div
          style={{
            flex: 1,
            position: "relative",
            transform: `translateY(${bottomY}px)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 80px",
            background: `linear-gradient(180deg, transparent 0%, rgba(244, 63, 94, 0.03) 100%)`,
          }}
        >
          {/* Ambient Glow */}
          <div
            style={{
              position: "absolute",
              bottom: "-10%",
              right: "30%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: COLORS.conGlow,
              filter: "blur(120px)",
              pointerEvents: "none",
            }}
          />

          {/* Section Header */}
          <div style={{ marginBottom: "50px" }}>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 800,
                letterSpacing: "0.25em",
                color: COLORS.conText,
                textTransform: "uppercase",
                display: "block",
                marginBottom: "12px",
              }}
            >
              The Limitations
            </span>
            <h2
              style={{
                fontSize: "80px",
                fontWeight: 900,
                color: COLORS.textPrimary,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              CONS
            </h2>
          </div>

          {/* Cons List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {CONS_DATA.map((item, index) => {
              const itemSpring = spring({
                frame: frame - (35 + index * 12),
                fps,
                config: baseSpringConfig,
              });

              const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
              const slideX = interpolate(itemSpring, [0, 1], [50, 0]);

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "28px",
                    padding: "32px 40px",
                    borderRadius: "24px",
                    backgroundColor: COLORS.glassBg,
                    border: `1px solid ${COLORS.glassBorder}`,
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                    transform: `translateX(${slideX}px)`,
                    opacity,
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(244, 63, 94, 0.1)",
                      border: `2px solid ${COLORS.conBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={COLORS.conText}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: "38px",
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Composition Registration Snippet (Root.tsx)
import { Composition } from "remotion";
import { ProsConsList } from "./ProsConsList";

export const Root: React.FC = () => {
  return (
    <Composition
      id="ProsConsList"
      component={ProsConsList}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/