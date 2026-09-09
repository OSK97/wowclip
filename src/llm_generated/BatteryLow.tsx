import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Extrapolate,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const BatteryLow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic camera breathing effect
  const cameraScale = 1 + Math.sin(frame / 45) * 0.015;

  // Spring animations for entry
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const contentEntrance = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Pulse effect for the critical red glow (heartbeat rhythm)
  const pulse = Math.sin(frame / 10) * 0.4 + 0.6; 
  const criticalGlowOpacity = interpolate(
    Math.sin(frame / 15),
    [-1, 1],
    [0.1, 0.35]
  );

  // Subtle battery level blink (1% indicator)
  const batteryBlink = frame % 30 < 15 ? 1 : 0.3;

  // Slide up interpolation
  const translateY = interpolate(
    cardEntrance,
    [0, 1],
    [150, 0],
    { extrapolateRight: Extrapolate.clamp }
  );

  // Scale interpolation for the card
  const cardScale = interpolate(
    cardEntrance,
    [0, 1],
    [0.9, 1],
    { extrapolateRight: Extrapolate.clamp }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050506",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Cinematic Background Glow */}
      <div
        style={{
          position: "absolute",
          width: "1000px",
          height: "1000px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(80px)",
          transform: `scale(${cameraScale})`,
          opacity: pulse,
          pointerEvents: "none",
        }}
      />

      {/* Subtle Grid Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.015) 1.5px, transparent 1.5px)",
          backgroundSize: "60px 60px",
          opacity: 0.8,
        }}
      />

      {/* Main Container with Camera Breathing */}
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
        {/* Glassmorphic Warning Card */}
        <div
          style={{
            width: "820px",
            height: "1100px",
            borderRadius: "60px",
            backgroundColor: "rgba(15, 15, 18, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            boxShadow: `0 80px 100px rgba(0, 0, 0, 0.8), inset 0 0 80px rgba(239, 68, 68, ${criticalGlowOpacity * 0.15})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "100px 60px",
            boxSizing: "border-box",
            opacity: cardEntrance,
            transform: `translateY(${translateY}px) scale(${cardScale})`,
          }}
        >
          {/* Top Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              opacity: contentEntrance,
              transform: `translateY(${interpolate(contentEntrance, [0, 1], [30, 0])}px)`,
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                boxShadow: "0 0 20px #ef4444",
                opacity: batteryBlink,
              }}
            />
            <span
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              Critical Status
            </span>
          </div>

          {/* Center Visual: Cinematic Battery Icon */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "40px 0",
              opacity: contentEntrance,
              transform: `scale(${interpolate(contentEntrance, [0, 1], [0.85, 1])})`,
            }}
          >
            {/* Battery Shell */}
            <div
              style={{
                width: "420px",
                height: "210px",
                border: "12px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "48px",
                padding: "12px",
                boxSizing: "border-box",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
              }}
            >
              {/* 1% Battery Level Indicator */}
              <div
                style={{
                  width: "12px",
                  height: "100%",
                  backgroundColor: "#ef4444",
                  borderRadius: "20px",
                  opacity: batteryBlink,
                  boxShadow: "0 0 40px rgba(239, 68, 68, 0.8)",
                  transition: "opacity 0.1s ease-in-out",
                }}
              />

              {/* Battery Tip */}
              <div
                style={{
                  position: "absolute",
                  right: "-32px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "20px",
                  height: "70px",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  borderRadius: "0 16px 16px 0",
                }}
              />
            </div>

            {/* Massive 1% Typography */}
            <div
              style={{
                fontSize: "180px",
                fontWeight: 800,
                color: "#ffffff",
                marginTop: "60px",
                lineHeight: 1,
                letterSpacing: "-4px",
                display: "flex",
                alignItems: "baseline",
              }}
            >
              1
              <span
                style={{
                  fontSize: "90px",
                  color: "#ef4444",
                  marginLeft: "10px",
                  fontWeight: 700,
                }}
              >
                %
              </span>
            </div>
          </div>

          {/* Bottom Warning Message */}
          <div
            style={{
              textAlign: "center",
              width: "100%",
              opacity: contentEntrance,
              transform: `translateY(${interpolate(contentEntrance, [0, 1], [40, 0])}px)`,
            }}
          >
            <h1
              style={{
                color: "#ffffff",
                fontSize: "64px",
                fontWeight: 700,
                margin: "0 0 20px 0",
                letterSpacing: "-1px",
              }}
            >
              Battery Ultra Low
            </h1>
            <p
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: "36px",
                fontWeight: 400,
                lineHeight: 1.5,
                margin: 0,
                padding: "0 40px",
              }}
            >
              Connect to a power source immediately to prevent shutdown.
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Setup
import { Composition } from "remotion";
import { BatteryLow } from "./BatteryLow";

export const Root: React.FC = () => {
  return (
    <Composition
      id="BatteryLow"
      component={BatteryLow}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/