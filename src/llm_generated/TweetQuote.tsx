import React from "react";
import {
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
} from "remotion";

// Premium local font loader mock/implementation as requested
// Fallback to system-ui stack if local helper isn't present, but keeping the import structure
const fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const TweetQuote: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Cinematic Breathing Effect (Slow, organic camera movement)
  const breathingScale = 1 + Math.sin(frame / 45) * 0.015;

  // 2. Spring Configurations
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const profileSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const textSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const statsSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // 3. Interpolations for smooth transitions
  const cardOffsetY = interpolate(cardSpring, [0, 1], [150, 0]);
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardBlur = interpolate(cardSpring, [0, 1], [40, 0]);

  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textOffsetY = interpolate(textSpring, [0, 1], [40, 0]);

  // Metric Count-up Interpolations
  const rawLikes = interpolate(statsSpring, [0, 1], [0, 142]);
  const likesCount = Math.floor(rawLikes);

  const rawRetweets = interpolate(statsSpring, [0, 1], [0, 28]);
  const retweetsCount = Math.floor(rawRetweets);

  const rawViews = interpolate(statsSpring, [0, 1], [0, 842]);
  const viewsCount = (rawViews / 10).toFixed(1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#05070f",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily,
      }}
    >
      {/* Cinematic Background Orbs */}
      <div
        style={{
          position: "absolute",
          width: "1200px",
          height: "1200px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
          top: "-200px",
          left: "-200px",
          transform: `scale(${1 + Math.sin(frame / 80) * 0.05})`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "1000px",
          height: "1000px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-100px",
          right: "-100px",
          transform: `scale(${1 + Math.cos(frame / 70) * 0.06})`,
          filter: "blur(100px)",
        }}
      />

      {/* Subtle Radial Grid Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.1) 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
          opacity: 0.4,
        }}
      />

      {/* Main Cinematic Container (Breathing) */}
      <div
        style={{
          transform: `scale(${breathingScale})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Glassmorphic Tweet Card */}
        <div
          style={{
            width: "900px",
            padding: "80px 70px",
            borderRadius: "48px",
            backgroundColor: "rgba(13, 17, 30, 0.45)",
            backdropFilter: `blur(${25 - cardBlur}px)`,
            WebkitBackdropFilter: `blur(${25 - cardBlur}px)`,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 50px 100px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            opacity: cardOpacity,
            transform: `translateY(${cardOffsetY}px)`,
            display: "flex",
            flexDirection: "column",
            gap: "50px",
            position: "relative",
          }}
        >
          {/* Top subtle ambient glow inside card */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
            }}
          />

          {/* Header: Profile Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: profileSpring,
              transform: `translateY(${interpolate(profileSpring, [0, 1], [20, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              {/* Profile Avatar with Gradient Border */}
              <div
                style={{
                  width: "110px",
                  height: "110px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #ec4899)",
                  padding: "4px",
                  boxShadow: "0 10px 30px rgba(99, 102, 241, 0.3)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: "#0d111e",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "42px",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  A
                </div>
              </div>

              {/* Name and Handle */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: "40px",
                      fontWeight: 700,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    Alex Valo
                  </span>
                  {/* Verified Badge */}
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      color: "#38bdf8",
                      transform: `scale(${profileSpring})`,
                    }}
                  >
                    <path
                      d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  style={{
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "32px",
                    fontWeight: 500,
                  }}
                >
                  @alexvalo
                </span>
              </div>
            </div>

            {/* Premium Minimalist Logo */}
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  fill="#ffffff"
                />
              </svg>
            </div>
          </div>

          {/* Body: High-Impact Quote */}
          <div
            style={{
              opacity: textOpacity,
              transform: `translateY(${textOffsetY}px)`,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <p
              style={{
                color: "#f8fafc",
                fontSize: "52px",
                lineHeight: "1.45",
                fontWeight: 600,
                letterSpacing: "-1px",
                margin: 0,
              }}
            >
              The best products don't solve complex problems. They make complex things feel{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #818cf8, #f472b6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 800,
                }}
              >
                incredibly simple
              </span>
              .
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              width: "100%",
              opacity: statsSpring,
            }}
          />

          {/* Footer: Live-updating Metrics */}
          <div
            style={{
              display: "flex",
              gap: "60px",
              opacity: statsSpring,
              transform: `translateY(${interpolate(statsSpring, [0, 1], [15, 0])}px)`,
            }}
          >
            {/* Metric: Views */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span style={{ fontSize: "32px", fontWeight: 600, color: "#ffffff" }}>
                {viewsCount}K
              </span>
              <span style={{ fontSize: "32px", fontWeight: 500, color: "rgba(255, 255, 255, 0.4)" }}>
                Views
              </span>
            </div>

            {/* Metric: Retweets */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m17 2 4 4-4 4"/>
                <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                <path d="m7 22-4-4 4-4"/>
                <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
              </svg>
              <span style={{ fontSize: "32px", fontWeight: 600, color: "#ffffff" }}>
                {retweetsCount}
              </span>
              <span style={{ fontSize: "32px", fontWeight: 500, color: "rgba(255, 255, 255, 0.4)" }}>
                Reposts
              </span>
            </div>

            {/* Metric: Likes */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill={likesCount > 0 ? "#f43f5e" : "none"}
                stroke={likesCount > 0 ? "#f43f5e" : "rgba(255, 255, 255, 0.4)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: `scale(${interpolate(statsSpring, [0, 0.8, 1], [1, 1.2, 1])})`,
                  transition: "transform 0.1s ease-out",
                }}
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span style={{ fontSize: "32px", fontWeight: 600, color: likesCount > 0 ? "#f43f5e" : "#ffffff" }}>
                {likesCount}
              </span>
              <span style={{ fontSize: "32px", fontWeight: 500, color: "rgba(255, 255, 255, 0.4)" }}>
                Likes
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
Composition Registration Snippet for Root.tsx:

import { Composition } from "remotion";
import { TweetQuote } from "./TweetQuote";

export const Root: React.FC = () => {
  return (
    <Composition
      id="TweetQuote"
      component={TweetQuote}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/