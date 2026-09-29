import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

export interface PolicyBazaarCrashProps {
  config?: any;
}

export const PolicyBazaarCrash: React.FC<PolicyBazaarCrashProps> = ({
  config: propConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load config
  let jsonConfig: any = {};
  try {
    jsonConfig = require("./policy-bazaar-crash.json");
  } catch {
    jsonConfig = {};
  }
  const config = propConfig || jsonConfig || {};

  const stock = config.stock || {
    symbol: "POLICYBZR",
    exchange: "NSE",
    companyName: "POLICYBAZAAR",
    legalName: "PB Fintech Ltd.",
    peakPrice: 1745.0,
    crashPrice: 1416.5,
    changePercentage: -18.84,
    lossPerShare: -328.5,
    marketCapLoss: "₹7,850 CRORE",
    affectedInvestors: "4,20,000+",
    avgLossPerRetailer: "₹38,500",
  };

  const assets = config.assets || {
    logo: "policybazaar/logo.jpg",
    investor: "policybazaar/investor_loss.jpg",
  };

  const fontTitle = "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const fontBody = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const fontMono = "'JetBrains Mono', monospace";

  // -------------------------------------------------------------
  // Floating Physics & 3D Shadow Dynamics
  // -------------------------------------------------------------
  const floatY = Math.sin(frame * 0.05) * 12;
  const floatRotate = Math.sin(frame * 0.035) * 1.5;
  const shadowScale = 1 - Math.sin(frame * 0.05) * 0.08;
  const shadowOpacity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.18, 0.28]
  );

  // -------------------------------------------------------------
  // Dynamic Value Interpolations
  // -------------------------------------------------------------
  // Price crash countdown (Scene 2: frames 95 - 165)
  const priceCrashProgress = interpolate(frame, [95, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const currentPrice =
    stock.peakPrice + (stock.crashPrice - stock.peakPrice) * priceCrashProgress;
  const currentPercent = stock.changePercentage * priceCrashProgress;
  const currentDropAmount = stock.lossPerShare * priceCrashProgress;

  // Wealth Loss Countup (Scene 3: frames 205 - 265)
  const lossCountProgress = interpolate(frame, [205, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const currentLossCrores = Math.round(7850 * lossCountProgress);

  // -------------------------------------------------------------
  // Scene Opacity / Visibility Choreography (360 frames total ~ 12s)
  // Scene 1: 0 - 95 (The Stock & Plunge Announcement)
  // Scene 2: 90 - 205 (The Visual Price Collapse & Crash Curve)
  // Scene 3: 200 - 310 (The Retail Investors & Wealth Destruction)
  // Scene 4: 305 - 360 (Clean Final Takeaway Outro)
  // -------------------------------------------------------------
  const s1Opacity = interpolate(frame, [0, 15, 82, 94], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s1TranslateY = interpolate(frame, [82, 94], [0, -35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const s2Opacity = interpolate(frame, [90, 100, 195, 205], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s2TranslateY = interpolate(frame, [90, 102], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.1)),
  });

  const s3Opacity = interpolate(frame, [200, 210, 300, 310], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s3TranslateY = interpolate(frame, [200, 212], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.1)),
  });

  const s4Opacity = interpolate(frame, [305, 316, 355, 360], [0, 1, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F1F4F8",
        fontFamily: fontBody,
        color: "#0F172A",
        overflow: "hidden",
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. 3D STUDIO ROOM BACKGROUND: Off-white to subtle grey gradient
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 130% 90% at 50% 32%, #FFFFFF 0%, #F5F7FA 45%, #E9ECEF 78%, #DCE1E7 100%)",
        }}
      />

      {/* Studio Overhead Spotlight */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. 3D TILTED FLOOR GRID (Creating Authentic 3D Room Floor)
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: -40,
          left: "-25%",
          width: "150%",
          height: 680,
          transformOrigin: "50% 100%",
          transform: "perspective(650px) rotateX(68deg)",
          backgroundImage: `
            linear-gradient(rgba(15, 23, 42, 0.08) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1.5px, transparent 1.5px)
          `,
          backgroundSize: "64px 64px",
          backgroundPosition: "center bottom",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 15%, rgba(0,0,0,0.6) 50%, transparent 95%)",
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 15%, rgba(0,0,0,0.6) 50%, transparent 95%)",
          pointerEvents: "none",
        }}
      />

      {/* Soft Horizon Shadow Line where wall meets 3D floor */}
      <div
        style={{
          position: "absolute",
          bottom: 420,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(15, 23, 42, 0.04) 70%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          PERSISTENT TOP MINIMALIST PILL (Category Marker)
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 80,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 24px",
            borderRadius: 9999,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#DC2626",
              boxShadow: "0 0 10px #DC2626",
            }}
          />
          <span
            style={{
              fontFamily: fontTitle,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 2,
              color: "#475569",
              textTransform: "uppercase",
            }}
          >
            MARKET ALERT • {stock.symbol}
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SCENE 1: THE ANNOUNCEMENT & -18.8% PLUNGE (Frames 0 – 95)
      ───────────────────────────────────────────────────────────── */}
      {frame < 95 && (
        <AbsoluteFill
          style={{
            opacity: s1Opacity,
            transform: `translateY(${s1TranslateY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            padding: "0 50px",
          }}
        >
          {/* Floating 3D Badge with Floor Shadow */}
          {(() => {
            const badgeSpring = spring({
              frame,
              fps,
              config: { damping: 13, stiffness: 120, mass: 0.9 },
            });

            return (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: 44,
                }}
              >
                {/* Floor Contact Shadow on 3D room floor */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -180,
                    width: 220,
                    height: 38,
                    borderRadius: "50%",
                    backgroundColor: "rgba(15, 23, 42, 1)",
                    opacity: shadowOpacity * badgeSpring,
                    transform: `scale(${shadowScale})`,
                    filter: "blur(20px)",
                  }}
                />

                {/* Floating Circular 3D Badge */}
                <div
                  style={{
                    transform: `scale(${badgeSpring}) translateY(${floatY}px) rotate(${floatRotate}deg)`,
                    width: 230,
                    height: 230,
                    borderRadius: 54,
                    padding: 8,
                    backgroundColor: "#FFFFFF",
                    boxShadow:
                      "0 24px 50px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.05)",
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Img
                    src={staticFile(assets.logo)}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 46,
                      objectFit: "cover",
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Clean Bold Kinetic Text */}
          <div style={{ textAlign: "center" }}>
            {(() => {
              const text1Spring = spring({
                frame: frame - 12,
                fps,
                config: { damping: 14, stiffness: 150 },
              });
              return (
                <div
                  style={{
                    transform: `scale(${Math.max(0, text1Spring)})`,
                    fontFamily: fontTitle,
                    fontSize: 78,
                    fontWeight: 900,
                    letterSpacing: -1.5,
                    color: "#0F172A",
                    lineHeight: 1.05,
                  }}
                >
                  POLICYBAZAAR
                </div>
              );
            })()}

            {(() => {
              const text2Spring = spring({
                frame: frame - 22,
                fps,
                config: { damping: 14, stiffness: 150 },
              });
              return (
                <div
                  style={{
                    transform: `scale(${Math.max(0, text2Spring)})`,
                    fontFamily: fontTitle,
                    fontSize: 70,
                    fontWeight: 900,
                    letterSpacing: -1,
                    color: "#DC2626",
                    marginTop: 8,
                  }}
                >
                  CRASHES -18.8%
                </div>
              );
            })()}
          </div>

          {/* Minimalist Stat Tag */}
          {(() => {
            const pillSpring = spring({
              frame: frame - 32,
              fps,
              config: { damping: 14, stiffness: 140 },
            });
            return (
              <div
                style={{
                  transform: `scale(${Math.max(0, pillSpring)})`,
                  marginTop: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 16,
                  backgroundColor: "#FFFFFF",
                  padding: "16px 36px",
                  borderRadius: 24,
                  boxShadow:
                    "0 16px 35px rgba(220, 38, 38, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)",
                  border: "1.5px solid rgba(220, 38, 38, 0.2)",
                }}
              >
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 38,
                    fontWeight: 900,
                    color: "#DC2626",
                  }}
                >
                  -₹328.50
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#64748B",
                  }}
                >
                  Per Share in 1 Day
                </span>
              </div>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENE 2: THE MINIMALIST 3D CRASH CURVE (Frames 90 – 205)
      ───────────────────────────────────────────────────────────── */}
      {frame >= 90 && frame < 205 && (
        <AbsoluteFill
          style={{
            opacity: s2Opacity,
            transform: `translateY(${s2TranslateY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            padding: "0 50px",
          }}
        >
          {/* Minimalist Floating Stage for Price & Chart */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 920,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Real-time Large Price Counter */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#64748B",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontFamily: fontTitle,
                  marginBottom: 8,
                }}
              >
                PB FINTECH • INTRADAY PRICE
              </div>

              {/* Huge Clean Drop Price */}
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 94,
                  fontWeight: 900,
                  letterSpacing: -3,
                  color: frame > 105 ? "#DC2626" : "#0F172A",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <span>₹{currentPrice.toFixed(2)}</span>
              </div>

              {/* Percentage Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 18,
                  backgroundColor: "rgba(220, 38, 38, 0.1)",
                  padding: "10px 24px",
                  borderRadius: 16,
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                }}
              >
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#DC2626",
                  }}
                >
                  ▼ {currentPercent.toFixed(2)}%
                </span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#DC2626",
                  }}
                >
                  ({currentDropAmount.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Floating Clean SVG Crash Chart (Without ugly UI borders!) */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 380,
                backgroundColor: "#FFFFFF",
                borderRadius: 36,
                padding: "36px 40px 24px",
                boxShadow:
                  "0 25px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)",
                border: "1px solid rgba(15, 23, 42, 0.06)",
              }}
            >
              {/* Floor contact shadow for the chart card */}
              <div
                style={{
                  position: "absolute",
                  bottom: -60,
                  left: "10%",
                  width: "80%",
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: "rgba(15, 23, 42, 0.08)",
                  filter: "blur(18px)",
                }}
              />

              {/* Subtle Horizontal Levels */}
              <div
                style={{
                  position: "absolute",
                  inset: "36px 40px 48px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  pointerEvents: "none",
                }}
              >
                {[
                  { price: "₹1,745", label: "Morning Peak" },
                  { price: "₹1,600", label: "Breakdown" },
                  { price: "₹1,416", label: "Day Low" },
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px dashed rgba(15, 23, 42, 0.1)",
                      paddingBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fontMono,
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#94A3B8",
                      }}
                    >
                      {row.price}
                    </span>
                    <span
                      style={{
                        fontFamily: fontTitle,
                        fontSize: 15,
                        fontWeight: 700,
                        color: i === 2 ? "#DC2626" : "#94A3B8",
                      }}
                    >
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* The SVG Line Curve */}
              {(() => {
                const svgW = 840;
                const svgH = 300;

                // Smooth plunging curve from (20, 30) down to (820, 270)
                const linePath =
                  "M 20,35 C 100,32 180,38 260,45 C 320,55 360,140 430,225 C 490,265 560,270 820,272";
                const areaPath = `${linePath} L 820,${svgH} L 20,${svgH} Z`;

                const pathLength = 1000;
                const drawProgress = interpolate(frame, [95, 160], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                });
                const strokeDashoffset = pathLength * (1 - drawProgress);

                const tipX = 20 + (820 - 20) * drawProgress;
                const tipY =
                  drawProgress < 0.28
                    ? 35 + drawProgress * 35
                    : drawProgress < 0.65
                    ? 45 + ((drawProgress - 0.28) / 0.37) * 220
                    : 270;

                return (
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="cleanRedGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#DC2626"
                          stopOpacity={0.22 * drawProgress}
                        />
                        <stop
                          offset="100%"
                          stopColor="#DC2626"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    {/* Gradient Fill under curve */}
                    <path d={areaPath} fill="url(#cleanRedGrad)" />

                    {/* The Bold Red Plunge Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={pathLength}
                      strokeDashoffset={strokeDashoffset}
                    />

                    {/* Animated Beacon at tip */}
                    {drawProgress > 0.05 && (
                      <g transform={`translate(${tipX}, ${tipY})`}>
                        <circle
                          r={14}
                          fill="#DC2626"
                          opacity={0.3}
                          style={{
                            transform: `scale(${
                              1 + Math.sin(frame * 0.3) * 0.4
                            })`,
                          }}
                        />
                        <circle
                          r={7}
                          fill="#FFFFFF"
                          stroke="#DC2626"
                          strokeWidth={4}
                        />
                      </g>
                    )}
                  </svg>
                );
              })()}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENE 3: THE RETAIL INVESTOR LOSS (Frames 200 – 310)
      ───────────────────────────────────────────────────────────── */}
      {frame >= 200 && frame < 312 && (
        <AbsoluteFill
          style={{
            opacity: s3Opacity,
            transform: `translateY(${s3TranslateY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
            padding: "0 50px",
          }}
        >
          {/* Distressed Investor Floating Avatar with Floor Shadow */}
          {(() => {
            const avatarSpring = spring({
              frame: frame - 202,
              fps,
              config: { damping: 14, stiffness: 120 },
            });

            return (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: 36,
                }}
              >
                {/* 3D Room Floor Contact Shadow */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -220,
                    width: 260,
                    height: 42,
                    borderRadius: "50%",
                    backgroundColor: "rgba(15, 23, 42, 1)",
                    opacity: shadowOpacity * avatarSpring,
                    transform: `scale(${shadowScale})`,
                    filter: "blur(24px)",
                  }}
                />

                {/* Circular Masked Investor Avatar */}
                <div
                  style={{
                    transform: `scale(${avatarSpring}) translateY(${floatY}px) rotate(${floatRotate}deg)`,
                    width: 320,
                    height: 320,
                    borderRadius: "50%",
                    padding: 8,
                    backgroundColor: "#FFFFFF",
                    boxShadow:
                      "0 25px 60px rgba(15, 23, 42, 0.15), 0 4px 16px rgba(15, 23, 42, 0.06)",
                    border: "2px solid rgba(220, 38, 38, 0.25)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                    }}
                  >
                    <Img
                      src={staticFile(assets.investor)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center 35%",
                      }}
                    />
                  </div>

                  {/* Red Loss Tag Overlap */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "#DC2626",
                      color: "#FFFFFF",
                      padding: "6px 20px",
                      borderRadius: 9999,
                      fontFamily: fontTitle,
                      fontWeight: 900,
                      fontSize: 18,
                      letterSpacing: 1.5,
                      boxShadow: "0 6px 18px rgba(220, 38, 38, 0.35)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    INVESTORS TRAPPED
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Huge Loss Numbers (No Clutter, Pure High-Impact Motion Design) */}
          <div style={{ textAlign: "center", width: "100%" }}>
            {(() => {
              const numSpring = spring({
                frame: frame - 215,
                fps,
                config: { damping: 14, stiffness: 140 },
              });
              return (
                <div style={{ transform: `scale(${Math.max(0, numSpring)})` }}>
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 82,
                      fontWeight: 900,
                      letterSpacing: -2,
                      color: "#DC2626",
                      lineHeight: 1,
                    }}
                  >
                    ₹{currentLossCrores.toLocaleString()} CR
                  </div>
                  <div
                    style={{
                      fontFamily: fontTitle,
                      fontSize: 34,
                      fontWeight: 900,
                      letterSpacing: -0.5,
                      color: "#0F172A",
                      marginTop: 10,
                    }}
                  >
                    WEALTH WIPED OUT
                  </div>
                </div>
              );
            })()}

            {/* Sub-loss stats */}
            {(() => {
              const subSpring = spring({
                frame: frame - 230,
                fps,
                config: { damping: 14, stiffness: 140 },
              });
              return (
                <div
                  style={{
                    transform: `scale(${Math.max(0, subSpring)})`,
                    marginTop: 28,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 20,
                    backgroundColor: "#FFFFFF",
                    padding: "16px 36px",
                    borderRadius: 22,
                    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: fontTitle,
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#0F172A",
                    }}
                  >
                    4,20,000+ RETAIL BUYERS
                  </span>
                  <span style={{ color: "#CBD5E1" }}>•</span>
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#DC2626",
                    }}
                  >
                    AVG HIT: ₹38,500
                  </span>
                </div>
              );
            })()}
          </div>
        </AbsoluteFill>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENE 4: MINIMALIST FINAL SUMMARY (Frames 305 – 360)
      ───────────────────────────────────────────────────────────── */}
      {frame >= 305 && (
        <AbsoluteFill
          style={{
            opacity: s4Opacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
            padding: "0 50px",
          }}
        >
          {(() => {
            const outroSpring = spring({
              frame: frame - 308,
              fps,
              config: { damping: 14, stiffness: 130 },
            });
            return (
              <div
                style={{
                  transform: `scale(${Math.max(0, outroSpring)})`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  backgroundColor: "#FFFFFF",
                  padding: "54px 48px",
                  borderRadius: 40,
                  boxShadow:
                    "0 30px 70px rgba(15, 23, 42, 0.1), 0 6px 20px rgba(15, 23, 42, 0.04)",
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  maxWidth: 860,
                }}
              >
                {/* PolicyBazaar Small Badge */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 28,
                    overflow: "hidden",
                    marginBottom: 26,
                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.1)",
                  }}
                >
                  <Img
                    src={staticFile(assets.logo)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>

                <div
                  style={{
                    fontFamily: fontTitle,
                    fontSize: 48,
                    fontWeight: 900,
                    color: "#0F172A",
                    letterSpacing: -1,
                    lineHeight: 1.15,
                  }}
                >
                  THE LESSON
                </div>

                <div
                  style={{
                    fontSize: 26,
                    color: "#64748B",
                    lineHeight: 1.4,
                    marginTop: 14,
                    maxWidth: 720,
                  }}
                >
                  Never chase vertical rallies without a strict{" "}
                  <span style={{ color: "#DC2626", fontWeight: 800 }}>
                    Stop-Loss
                  </span>
                  . Capital protection comes first.
                </div>

                {/* Final Pill */}
                <div
                  style={{
                    marginTop: 30,
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    border: "1.5px solid rgba(220, 38, 38, 0.3)",
                    padding: "14px 32px",
                    borderRadius: 9999,
                    fontFamily: fontTitle,
                    fontWeight: 900,
                    fontSize: 22,
                    color: "#DC2626",
                    letterSpacing: 1,
                  }}
                >
                  SHARE WITH FELLOW TRADERS ➔
                </div>
              </div>
            );
          })()}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
