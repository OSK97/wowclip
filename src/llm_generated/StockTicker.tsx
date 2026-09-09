import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Premium local font loader simulation as per instructions
// In a real project, this imports from your local utils
const fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const StockTicker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Cinematic Breathing Effect (Camera)
  const breathingScale = 1 + Math.sin(frame / 45) * 0.012;

  // 2. Spring Animations for Entrances
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const contentEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const pillEntrance = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 110 },
  });

  const chartEntrance = spring({
    frame: frame - 30,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  // 3. Interpolations for Numbers & Visuals
  // Price counter animation (from $824.15 to $892.50)
  const animatedPrice = interpolate(
    contentEntrance,
    0,
    1,
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const currentPrice = (824.15 + animatedPrice * (892.50 - 824.15)).toFixed(2);

  // Percentage counter animation (from +0.00% to +8.29%)
  const animatedPercent = interpolate(
    pillEntrance,
    0,
    1,
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const currentPercent = (animatedPercent * 8.29).toFixed(2);

  // SVG Chart Path Dash Offset (drawing effect)
  const chartStrokeDashoffset = interpolate(
    chartEntrance,
    0,
    1,
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0b0d",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Grid Pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(#1e293b 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.4,
        }}
      />

      {/* Cinematic Glowing Orbs */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(0,0,0,0) 70%)",
          top: "20%",
          left: "10%",
          filter: "blur(60px)",
          transform: `scale(${breathingScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(0,0,0,0) 70%)",
          bottom: "15%",
          right: "5%",
          filter: "blur(80px)",
          transform: `scale(${2 - breathingScale})`,
        }}
      />

      {/* Main Container with Breathing Camera Effect */}
      <div
        style={{
          transform: `scale(${breathingScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Glassmorphic Card */}
        <div
          style={{
            width: "900px",
            height: "1150px",
            backgroundColor: "rgba(20, 22, 27, 0.75)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            borderRadius: "60px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 80px 120px rgba(0, 0, 0, 0.5)",
            padding: "80px 70px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            opacity: cardEntrance,
            transform: `translateY(${(1 - cardEntrance) * 80}px) scale(${0.95 + cardEntrance * 0.05})`,
            boxSizing: "border-box",
          }}
        >
          {/* Top Row: Brand & Ticker Info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: contentEntrance,
              transform: `translateY(${(1 - contentEntrance) * 30}px)`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "110px",
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                NVDA
              </div>
              <div
                style={{
                  fontSize: "38px",
                  color: "#94a3b8",
                  fontWeight: 500,
                  marginTop: "12px",
                  letterSpacing: "-0.5px",
                }}
              >
                NVIDIA Corporation
              </div>
            </div>

            {/* Stylized Neon Chip/Logo */}
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "32px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 20px 40px rgba(16, 185, 129, 0.3)",
              }}
            >
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          {/* Middle Row: Price & Dynamic Percentage Pill */}
          <div
            style={{
              margin: "60px 0",
              opacity: contentEntrance,
              transform: `translateY(${(1 - contentEntrance) * 40}px)`,
            }}
          >
            <div
              style={{
                fontSize: "150px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-5px",
                lineHeight: 0.9,
              }}
            >
              ${currentPrice}
            </div>

            {/* Up Arrow & Percentage Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                padding: "18px 36px",
                borderRadius: "100px",
                marginTop: "40px",
                opacity: pillEntrance,
                transform: `scale(${0.8 + pillEntrance * 0.2}) translateY(${(1 - pillEntrance) * 20}px)`,
              }}
            >
              {/* Massive Up Arrow */}
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  marginRight: "16px",
                  transform: `translateY(${Math.sin(frame / 10) * 2}px)`, // Subtle arrow bounce
                }}
              >
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
              <span
                style={{
                  color: "#10b981",
                  fontSize: "46px",
                  fontWeight: 700,
                  letterSpacing: "-1px",
                }}
              >
                +{currentPercent}%
              </span>
            </div>
          </div>

          {/* Bottom Row: Minimalist Sparkline Chart */}
          <div
            style={{
              width: "100%",
              height: "320px",
              position: "relative",
              opacity: chartEntrance,
              transform: `translateY(${(1 - chartEntrance) * 50}px)`,
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 760 300"
              fill="none"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Gradient for the chart stroke */}
                <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                {/* Gradient for the area fill */}
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area Fill under the path */}
              <path
                d={`M 0 280 
                    C 100 270, 150 180, 220 190 
                    C 290 200, 340 120, 420 140 
                    C 500 160, 580 40, 660 60 
                    C 700 70, 730 20, 760 10
                    L 760 300 L 0 300 Z`}
                fill="url(#areaGradient)"
                opacity={chartStrokeDashoffset} // Fades in with the path drawing
              />

              {/* Glowing Trendline */}
              <path
                d={`M 0 280 
                    C 100 270, 150 180, 220 190 
                    C 290 200, 340 120, 420 140 
                    C 500 160, 580 40, 660 60 
                    C 700 70, 730 20, 760 10`}
                stroke="url(#chartGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="2000"
                strokeDashoffset={2000 - chartStrokeDashoffset * 2000}
              />

              {/* Pulsing End Point Indicator */}
              {chartStrokeDashoffset > 0.95 && (
                <circle
                  cx="760"
                  cy="10"
                  r={8 + Math.sin(frame / 5) * 3}
                  fill="#34d399"
                  style={{
                    filter: "drop-shadow(0 0 12px #10b981)",
                  }}
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Root.tsx Composition Setup:
import { Composition } from "remotion";
import { StockTicker } from "./StockTicker";

export const Root: React.FC = () => {
  return (
    <Composition
      id="StockTicker"
      component={StockTicker}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/