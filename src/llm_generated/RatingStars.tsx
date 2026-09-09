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

// Premium Star SVG Component
const StarIcon = ({ fillPercent = 100 }: { fillPercent?: number }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        width: "100%",
        height: "100%",
        filter: "drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))",
      }}
    >
      <defs>
        <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z"
        fill="url(#starGradient)"
      />
    </svg>
  );
};

export const RatingStars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow camera breathing
  const cameraScale = 1 + Math.sin(frame / 60) * 0.012;

  // Card Entrance Spring
  const cardEntrance = spring({
    frame,
    fps,
    config: {
      damping: 18,
      stiffness: 90,
      mass: 1.2,
    },
  });

  const cardScale = interpolate(cardEntrance, [0, 1], [0.85, 1]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);
  const cardTranslateY = interpolate(cardEntrance, [0, 1], [100, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0B0F19",
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
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
          top: "10%",
          left: "-10%",
          filter: "blur(80px)",
          transform: `scale(${cameraScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "900px",
          height: "900px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(0,0,0,0) 70%)",
          bottom: "15%",
          right: "-20%",
          filter: "blur(100px)",
          transform: `scale(${cameraScale})`,
        }}
      />

      {/* Subtle Grid Pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.7,
        }}
      />

      {/* Main Container with Cinematic Breath */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${cameraScale})`,
        }}
      >
        {/* Glassmorphic Review Card */}
        <div
          style={{
            width: "880px",
            padding: "80px 60px",
            borderRadius: "48px",
            background: "rgba(17, 24, 39, 0.7)",
            backdropFilter: "blur(30px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 50px 100px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transform: `translateY(${cardTranslateY}px) scale(${cardScale})`,
            opacity: cardOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* User Profile Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "40px",
            }}
          >
            {/* Avatar with Ring Glow */}
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366F1, #3B82F6)",
                padding: "4px",
                boxShadow: "0 20px 40px rgba(99, 102, 241, 0.3)",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  backgroundColor: "#1F2937",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "54px",
                  fontWeight: "bold",
                  color: "#FFFFFF",
                }}
              >
                JD
              </div>
            </div>

            <div
              style={{
                fontSize: "42px",
                fontWeight: 600,
                color: "#FFFFFF",
                letterSpacing: "-0.5px",
                marginBottom: "8px",
              }}
            >
              Julianne Devaney
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 500,
                color: "#9CA3AF",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Verified Purchaser
            </div>
          </div>

          {/* 5-Star Rating Row */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              alignItems: "center",
              height: "100px",
              marginBottom: "50px",
            }}
          >
            {[0, 1, 2, 3, 4].map((index) => {
              // Staggered spring entrance for each star
              const starDelay = 15 + index * 8;
              const starSpring = spring({
                frame: frame - starDelay,
                fps,
                config: {
                  damping: 12,
                  stiffness: 150,
                },
              });

              const starScale = interpolate(starSpring, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const starRotate = interpolate(starSpring, [0, 1], [-30, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={index}
                  style={{
                    width: "84px",
                    height: "84px",
                    transform: `scale(${starScale}) rotate(${starRotate}deg)`,
                  }}
                >
                  <StarIcon />
                </div>
              );
            })}
          </div>

          {/* Review Text */}
          <div style={{ overflow: "hidden", width: "100%" }}>
            {(() => {
              const textEntrance = spring({
                frame: frame - 60,
                fps,
                config: {
                  damping: 15,
                  stiffness: 80,
                },
              });

              const textY = interpolate(textEntrance, [0, 1], [50, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const textOpacity = interpolate(textEntrance, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  style={{
                    transform: `translateY(${textY}px)`,
                    opacity: textOpacity,
                  }}
                >
                  <div
                    style={{
                      fontSize: "48px",
                      fontWeight: 500,
                      lineHeight: "1.4",
                      color: "#F3F4F6",
                      marginBottom: "24px",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    “Absolutely flawless execution. The attention to detail and premium build quality exceeded all my expectations.”
                  </div>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: 500,
                      color: "#10B981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "38px" }}>✓</span> Highly Recommended
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Snippet:
import { Composition } from "remotion";
import { RatingStars } from "./RatingStars";

export const Root = () => {
  return (
    <Composition
      id="RatingStars"
      component={RatingStars}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/