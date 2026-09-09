import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";

// Premium Font Loading (as per system prompt)
import { loadInter, loadOutfit } from "../utils/localFonts";
const { fontFamily } = loadInter();

export const BreakingNews: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow breathing scale for the entire viewport
  const baseScale = 1 + Math.sin(frame / 60) * 0.008;

  // Spring animations for elements
  const springConfig = { damping: 15, stiffness: 80 };
  
  // Entrance springs
  const cardEntrance = spring({
    frame,
    fps,
    config: springConfig,
    delay: 5,
  });

  const badgeEntrance = spring({
    frame,
    fps,
    config: springConfig,
    delay: 15,
  });

  const titleEntrance = spring({
    frame,
    fps,
    config: springConfig,
    delay: 25,
  });

  const tickerEntrance = spring({
    frame,
    fps,
    config: springConfig,
    delay: 35,
  });

  // Background ambient light movement
  const ambientX = Math.sin(frame / 100) * 100;
  const ambientY = Math.cos(frame / 120) * 150;

  // Infinite Ticker translation logic
  const tickerSpeed = 3.5; // pixels per frame
  const tickerOffset = -(frame * tickerSpeed);

  const tickerItems = [
    "FUSION REACTOR ACHIEVES NET ENERGY GAIN OF 150%",
    "GLOBAL MARKETS RESPOND WITH HISTORIC SURGE",
    "COMMERCIAL ROLLOUT PROJECTED FOR EARLY 2028",
    "CLEAN ENERGY TRANSITION ACCELERATES DECADES AHEAD OF SCHEDULE",
  ];
  
  // Duplicate items to ensure seamless loop
  const repeatedTickerText = [...tickerItems, ...tickerItems, ...tickerItems].join("   •   ");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060608",
        fontFamily,
        color: "#ffffff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 60px",
        transform: `scale(${baseScale})`,
      }}
    >
      {/* Cinematic Ambient Background Orbs */}
      <div
        style={{
          position: "absolute",
          top: `calc(30% + ${ambientY}px)`,
          left: `calc(50% + ${ambientX}px)`,
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />

      {/* Top Decorative Grid Pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />

      {/* Top Header Area */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          zIndex: 10,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "6px", color: "rgba(255,255,255,0.4)" }}>
          GLOBAL NEWS NETWORK
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#ef4444",
              borderRadius: "50%",
              display: "inline-block",
              boxShadow: "0 0 12px #ef4444",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "2px", color: "#ef4444" }}>LIVE</span>
        </div>
      </div>

      {/* Main Content Card (Glassmorphic) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          zIndex: 10,
          transform: `translateY(${interpolate(cardEntrance, [0, 1], [100, 0])}px)`,
          opacity: cardEntrance,
        }}
      >
        {/* Red Alert Badge */}
        <div
          style={{
            transform: `scale(${badgeEntrance})`,
            opacity: badgeEntrance,
            backgroundColor: "#dc2626",
            padding: "16px 36px",
            borderRadius: "12px",
            fontSize: "32px",
            fontWeight: 900,
            letterSpacing: "8px",
            boxShadow: "0 20px 40px rgba(220, 38, 38, 0.3)",
            marginBottom: "48px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          BREAKING
        </div>

        {/* Headline Container */}
        <div
          style={{
            transform: `translateY(${interpolate(titleEntrance, [0, 1], [40, 0])}px)`,
            opacity: titleEntrance,
          }}
        >
          <h1
            style={{
              fontSize: "96px",
              fontWeight: 900,
              lineHeight: "1.15",
              letterSpacing: "-2px",
              margin: 0,
              background: "linear-gradient(to bottom right, #ffffff 60%, rgba(255,255,255,0.6))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SCIENTISTS ACHIEVE
            <br />
            <span style={{ color: "#f59e0b", WebkitTextFillColor: "initial" }}>HISTORIC FUSION</span>
            <br />
            BREAKTHROUGH
          </h1>

          <p
            style={{
              fontSize: "42px",
              lineHeight: "1.5",
              color: "rgba(255, 255, 255, 0.7)",
              marginTop: "40px",
              maxWidth: "850px",
              fontWeight: 400,
            }}
          >
            The Department of Energy officially announces net energy gain, marking a monumental milestone for clean power.
          </p>
        </div>
      </div>

      {/* Bottom Ticker Alert System */}
      <div
        style={{
          width: "100%",
          transform: `translateY(${interpolate(tickerEntrance, [0, 1], [150, 0])}px)`,
          opacity: tickerEntrance,
          zIndex: 10,
        }}
      >
        {/* Glassmorphic Ticker Container */}
        <div
          style={{
            width: "100%",
            height: "120px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            borderRadius: "24px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 40px 60px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Static Left Label */}
          <div
            style={{
              height: "100%",
              backgroundColor: "#111115",
              borderRight: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              alignItems: "center",
              padding: "0 40px",
              zIndex: 20,
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "4px",
              color: "#f59e0b",
            }}
          >
            UPDATE
          </div>

          {/* Scrolling Text Wrapper */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              position: "relative",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                whiteSpace: "nowrap",
                transform: `translateX(${tickerOffset}px)`,
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "1px",
                color: "rgba(255, 255, 255, 0.95)",
              }}
            >
              {repeatedTickerText}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Snippet:
import { Composition } from "remotion";
import { BreakingNews } from "./BreakingNews";

export const Root: React.FC = () => {
  return (
    <Composition
      id="BreakingNews"
      component={BreakingNews}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/