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

export const PriceTag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow camera breathing
  const cameraScale = 1 + Math.sin(frame / 80) * 0.015;

  // Spring animations
  const cardEntrance = spring({
    frame: frame - 12,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const priceDropTrigger = spring({
    frame: frame - 35,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const strikeThroughWidth = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const badgeEntrance = spring({
    frame: frame - 50,
    fps,
    config: { damping: 10, stiffness: 120 },
  });

  // Interpolations for smooth transitions
  const cardScale = interpolate(cardEntrance, [0, 1], [0.85, 1]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);
  const cardBlur = interpolate(cardEntrance, [0, 1], [20, 0]);

  const oldPriceOpacity = interpolate(priceDropTrigger, [0, 1], [1, 0.4]);
  const oldPriceScale = interpolate(priceDropTrigger, [0, 1], [1, 0.85]);
  const oldPriceY = interpolate(priceDropTrigger, [0, 1], [0, -20]);

  const newPriceScale = interpolate(priceDropTrigger, [0, 1], [0.7, 1.2]);
  const newPriceOpacity = interpolate(priceDropTrigger, [0, 1], [0, 1]);
  const newPriceY = interpolate(priceDropTrigger, [0, 1], [40, 0]);

  const badgeScale = interpolate(badgeEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#090a0f",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Cinematic Orbs & Grid */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.03) 2px, transparent 2px)`,
          backgroundSize: "40px 40px",
          opacity: 0.7,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)",
          top: "15%",
          left: "10%",
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
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
          bottom: "10%",
          right: "-10%",
          filter: "blur(100px)",
          transform: `scale(${cameraScale})`,
        }}
      />

      {/* Main Container with Camera Breathing Effect */}
      <div
        style={{
          transform: `scale(${cameraScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          zIndex: 10,
        }}
      >
        {/* Premium Glassmorphic Card */}
        <div
          style={{
            width: "820px",
            padding: "80px 60px",
            borderRadius: "60px",
            background: "rgba(17, 20, 28, 0.6)",
            backdropFilter: `blur(${cardBlur}px) saturate(180%)`,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 50px 100px rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: cardOpacity,
            transform: `scale(${cardScale})`,
            textAlign: "center",
          }}
        >
          {/* Subtle Tag Icon / Accent */}
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "30px",
              background: "linear-gradient(135deg, #ef4444, #f43f5e)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "40px",
              boxShadow: "0 20px 40px rgba(239, 68, 68, 0.3)",
              transform: `scale(${interpolate(cardEntrance, [0, 1], [0.5, 1])})`,
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
            </svg>
          </div>

          {/* Product Label */}
          <span
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#94a3b8",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            Studio Display Pro
          </span>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: "84px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              margin: "0 0 60px 0",
              lineHeight: 1.1,
            }}
          >
            Price Drop Detected
          </h1>

          {/* Price Comparison Area */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "320px",
              position: "relative",
              width: "100%",
            }}
          >
            {/* Original Price */}
            <div
              style={{
                position: "absolute",
                top: interpolate(priceDropTrigger, [0, 1], [110, 20]),
                opacity: oldPriceOpacity,
                transform: `scale(${oldPriceScale})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "80px",
                  fontWeight: 700,
                  color: "#64748b",
                  position: "relative",
                }}
              >
                $1,999
                {/* Strike-through line */}
                <span
                  style={{
                    position: "absolute",
                    left: "-5%",
                    top: "50%",
                    width: `${strikeThroughWidth * 110}%`,
                    height: "8px",
                    backgroundColor: "#ef4444",
                    borderRadius: "4px",
                    transform: "rotate(-8deg)",
                    boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
                  }}
                />
              </span>
            </div>

            {/* New Price */}
            <div
              style={{
                position: "absolute",
                bottom: interpolate(priceDropTrigger, [0, 1], [-20, 40]),
                opacity: newPriceOpacity,
                transform: `scale(${newPriceScale}) translateY(${newPriceY}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "140px",
                  fontWeight: 900,
                  color: "#10b981",
                  letterSpacing: "-0.04em",
                  textShadow: "0 0 60px rgba(16, 185, 129, 0.3)",
                }}
              >
                $1,499
              </span>
            </div>
          </div>

          {/* Discount Badge */}
          <div
            style={{
              transform: `scale(${badgeScale})`,
              opacity: badgeEntrance,
              marginTop: "20px",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                padding: "20px 48px",
                borderRadius: "100px",
                boxShadow: "0 20px 40px rgba(16, 185, 129, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "38px",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}
              >
                SAVE 25% INSTANTLY
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Composition configuration for Root.tsx
import { Composition } from "remotion";
import { PriceTag } from "./PriceTag";

export const Root = () => {
  return (
    <Composition
      id="PriceTag"
      component={PriceTag}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/