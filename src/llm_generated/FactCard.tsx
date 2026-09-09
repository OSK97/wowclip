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

export const FactCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic camera breathing effect
  const cameraScale = 1 + Math.sin(frame / 45) * 0.015;

  // Spring configurations for premium feel
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const headerSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const bodySpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 15, stiffness: 90 },
  });

  const visualSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Animations & Interpolations
  const cardOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
  const cardTranslateY = interpolate(cardSpring, [0, 1], [150, 0]);
  const cardScale = interpolate(cardSpring, [0, 1], [0.9, 1]);

  const headerOpacity = interpolate(frame - 15, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
  const headerTranslateY = interpolate(headerSpring, [0, 1], [50, 0]);

  const bodyOpacity = interpolate(frame - 25, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
  const bodyTranslateY = interpolate(bodySpring, [0, 1], [40, 0]);

  const visualScale = interpolate(visualSpring, [0, 1], [0.5, 1]);
  const visualOpacity = interpolate(frame - 35, [0, 25], [0, 1], { extrapolateLeft: "clamp" });

  // Slow drift for background orbs
  const orb1X = Math.sin(frame / 100) * 50;
  const orb1Y = Math.cos(frame / 80) * 50;
  const orb2X = Math.cos(frame / 90) * -60;
  const orb2Y = Math.sin(frame / 110) * -40;

  // Pulse effect for the central star visual
  const starPulse = 1 + Math.sin(frame / 15) * 0.04;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#05050a",
        fontFamily,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background Cinematic Orbs */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(80px)",
          transform: `translate(${orb1X}px, ${orb1Y}px)`,
          top: "10%",
          left: "-10%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, rgba(0,0,0,0) 70%)",
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
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.8,
        }}
      />

      {/* Main Cinematic Container with Breathing Effect */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${cameraScale})`,
        }}
      >
        {/* Glassmorphic Fact Card */}
        <div
          style={{
            width: 880,
            height: 1400,
            borderRadius: 64,
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 80px 120px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            padding: "90px 70px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            boxSizing: "border-box",
            opacity: cardOpacity,
            transform: `translateY(${cardTranslateY}px) scale(${cardScale})`,
          }}
        >
          {/* Header Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              opacity: headerOpacity,
              transform: `translateY(${headerTranslateY}px)`,
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#6366f1",
                textTransform: "uppercase",
                letterSpacing: 8,
                background: "linear-gradient(90deg, #818cf8, #e0e7ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Cosmos Edition
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: -2,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              Did you know?
            </div>
          </div>

          {/* Central Visual Element (Glowing Abstract Star) */}
          <div
            style={{
              width: 380,
              height: 380,
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: visualOpacity,
              transform: `scale(${visualScale * starPulse})`,
            }}
          >
            {/* Outer Glow */}
            <div
              style={{
                position: "absolute",
                width: 280,
                height: 280,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(236, 72, 153, 0) 70%)",
                filter: "blur(40px)",
              }}
            />
            {/* Core Sphere */}
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1 0%, #d946ef 100%)",
                boxShadow: "0 0 80px rgba(99, 102, 241, 0.6), inset -15px -15px 40px rgba(0,0,0,0.4), inset 15px 15px 40px rgba(255,255,255,0.4)",
              }}
            />
            {/* Orbiting Ring */}
            <div
              style={{
                position: "absolute",
                width: 340,
                height: 100,
                border: "4px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "50%",
                transform: "rotate(-15deg)",
                boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
              }}
            />
          </div>

          {/* Fact Body Text */}
          <div
            style={{
              opacity: bodyOpacity,
              transform: `translateY(${bodyTranslateY}px)`,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 46,
                fontWeight: 500,
                color: "#e2e8f0",
                lineHeight: 1.5,
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              A single teaspoon of a{" "}
              <span style={{ color: "#a5b4fc", fontWeight: 700 }}>neutron star</span>{" "}
              would weigh approximately{" "}
              <span style={{ color: "#f472b6", fontWeight: 700 }}>6 billion tons</span>{" "}
              on Earth.
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Snippet:
import { Composition } from "remotion";
import { FactCard } from "./FactCard";

export const Root = () => {
  return (
    <Composition
      id="FactCard"
      component={FactCard}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/