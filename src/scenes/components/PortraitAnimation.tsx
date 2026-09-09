import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { resolveAsset } from "./resolveAsset";
import { loadOutfit, loadInter } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: outfitFamily } = loadOutfit("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

export const PortraitAnimation: React.FC<{ config?: any }> = ({ config: propConfig }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Safely extract config or fallback to json
  let jsonConfig: any = {};
  try {
    jsonConfig = require("./portrait-animation.json");
  } catch {
    jsonConfig = {};
  }

  const c = propConfig || jsonConfig || {};
  const bg = c.background || {};
  const avatar = c.avatar || {};
  const floatCfg = c.floating || {};
  const textCfg = c.text || {};

  // Background Settings
  const backgroundColor = bg.backgroundColor || "#ffffff";
  const backgroundGradient =
    bg.backgroundGradient ||
    "radial-gradient(ellipse 130% 90% at 50% 45%, #ffffff 0%, #f1f5f9 55%, #e2e8f0 100%)";
  const showGrid = bg.showGrid ?? true;
  const gridLineColor = bg.gridLineColor || "rgba(30, 64, 175, 0.05)";
  const gridSize = bg.gridSize || 64;
  const showSpotlight = bg.showSpotlight ?? true;
  const spotlightColor = bg.spotlightColor || "rgba(37, 99, 235, 0.08)";

  // Avatar / Portrait Settings
  const imagePath = avatar.imagePath || "Building1.png";
  const circleSize = avatar.circleSize || 500;
  const circleBg =
    avatar.circleBg ||
    "radial-gradient(circle at 50% 30%, #1e3a8a 0%, #0f172a 58%, #020617 100%)";
  const glowColor = avatar.glowColor || "rgba(37, 99, 235, 0.35)";
  const glowColorOuter = avatar.glowColorOuter || "rgba(37, 99, 235, 0)";
  const borderColor = avatar.borderColor || "#2563eb";
  const borderWidth = avatar.borderWidth ?? 10;
  const showOrbitRing = avatar.showOrbitRing ?? true;
  const orbitRingColor = avatar.orbitRingColor || "rgba(37, 99, 235, 0.28)";

  // Floating Physics Settings
  const enableFloating = floatCfg.enabled ?? true;
  const floatAmplitudeY = floatCfg.floatAmplitudeY ?? 10;
  const floatFrequencyY = floatCfg.floatFrequencyY ?? 0.04;
  const rotateAmplitude = floatCfg.rotateAmplitude ?? 1.2;
  const rotateFrequency = floatCfg.rotateFrequency ?? 0.025;

  // Text Settings
  const titleText = textCfg.value || "Building Construction";
  const subtitleText = textCfg.subtitle || "";
  const animationMode = textCfg.animationMode || "word-level";
  const textColor = textCfg.color || "#1e3a8a";
  const subtitleColor = textCfg.subtitleColor || "#64748b";
  const fontFamily = textCfg.fontFamily === "Outfit" ? outfitFamily : interFamily;

  // Dynamic text sizing logic to gracefully handle any string length
  const textLength = titleText.length;
  let dynamicFontSize = 72;
  let dynamicLetterSpacing = 6;
  let dynamicMarginTop = -40;

  if (textLength > 25) {
    dynamicFontSize = 42;
    dynamicLetterSpacing = 3;
    dynamicMarginTop = -20;
  } else if (textLength > 14) {
    dynamicFontSize = 54;
    dynamicLetterSpacing = 5;
    dynamicMarginTop = -30;
  } else if (textLength < 8) {
    dynamicFontSize = 86;
    dynamicLetterSpacing = 8;
    dynamicMarginTop = -50;
  }

  // 1. Ken Burns Camera Movement: Smooth subtle image zoom
  const imageScale = interpolate(frame, [0, 300], [1.22, 1.34], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // 2. Organic Floating Animation (Spring Motion)
  const floatY = enableFloating ? Math.sin(frame * floatFrequencyY) * floatAmplitudeY : 0;
  const rotateAngle = enableFloating ? Math.sin(frame * rotateFrequency) * rotateAmplitude : 0;

  // 3. Floor Contact Drop Shadow scaling
  const shadowScale = enableFloating ? 1 + Math.sin(frame * floatFrequencyY) * 0.08 : 1;
  const shadowOpacity = enableFloating ? interpolate(Math.sin(frame * floatFrequencyY), [-1, 1], [0.18, 0.32]) : 0.25;

  // 4. Image Entrance Physics (Spring Pop-Up)
  const imageEntranceProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 55, mass: 0.8 },
  });
  const mappedImageTranslateY = interpolate(imageEntranceProgress, [0, 1], [380, 0]);
  const imageBlur = interpolate(imageEntranceProgress, [0, 1], [8, 0]);

  // 5. Specular Glass Shine Sweep across the circle frame
  const shineTranslateX = interpolate(frame, [20, 75], [-circleSize * 1.5, circleSize * 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  // 6. Ambient Glow Pulsing
  const glowPulse = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.94, 1.06]);

  // 7. Rotating Accent Orbit Ring Speed
  const orbitRotation = frame * 0.4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        background: backgroundGradient,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily,
      }}
    >
      {/* Studio Line-Mesh Grid with Radial Fade Mask */}
      {showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(${gridLineColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: "center center",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 95%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Floating Spotlight Gradient Overlay */}
      {showSpotlight && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at ${50 + Math.sin(frame * 0.02) * 8}% ${
              45 + Math.cos(frame * 0.02) * 8
            }%, transparent 25%, ${spotlightColor} 90%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Main floating wrapper */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${floatY}px) rotate(${rotateAngle}deg)`,
          transformOrigin: "center center",
          position: "relative",
        }}
      >
        {/* Floor Contact Drop Shadow */}
        <div
          style={{
            position: "absolute",
            bottom: -35,
            width: circleSize * 0.75,
            height: 35,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.4) 0%, transparent 70%)",
            transform: `scale(${shadowScale})`,
            opacity: shadowOpacity,
            filter: "blur(12px)",
            pointerEvents: "none",
          }}
        />

        {/* Outer Circle Container */}
        <div
          style={{
            position: "relative",
            width: circleSize,
            height: circleSize,
          }}
        >
          {/* Animated Glow Ring behind circle */}
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${glowColor} 0%, ${glowColorOuter} 70%)`,
              transform: `scale(${glowPulse})`,
              filter: "blur(25px)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          {/* After Effects Motion Graphic Orbit Ring */}
          {showOrbitRing && (
            <div
              style={{
                position: "absolute",
                inset: -22,
                borderRadius: "50%",
                border: `2px dashed ${orbitRingColor}`,
                transform: `rotate(${orbitRotation}deg)`,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Masked Wrapper: Layer 1 (Clipped Circle Background & Base Image) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: -100,
              right: -100,
              maskImage:
                "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)",
              WebkitMaskImage:
                "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)",
              zIndex: 1,
            }}
          >
            {/* Layer 1: Clipped Circle Container */}
            <div
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                background: circleBg,
                boxShadow: `
                  0 30px 60px -15px rgba(15, 23, 42, 0.35),
                  0 0 50px -10px ${glowColor},
                  inset 0 0 30px rgba(0, 0, 0, 0.55)
                `,
                overflow: "hidden",
                position: "absolute",
                top: 0,
                left: 100,
                boxSizing: "border-box",
              }}
            >
              {/* Glass Specular Reflection Beam */}
              <div
                style={{
                  position: "absolute",
                  top: -circleSize,
                  left: 0,
                  width: circleSize * 0.4,
                  height: circleSize * 3,
                  background:
                    "linear-gradient(to right, transparent 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%)",
                  transform: `translateX(${shineTranslateX}px) rotate(25deg)`,
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 0,
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Img
                  src={resolveAsset(imagePath)}
                  style={{
                    width: "85%",
                    height: "auto",
                    transform: `translateY(${mappedImageTranslateY}px) scale(${imageScale})`,
                    transformOrigin: "bottom center",
                    filter: imageBlur > 0.1 ? `blur(${imageBlur}px)` : undefined,
                  }}
                />
              </div>
            </div>

            {/* Solid Border Ring */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 100,
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                border: `${borderWidth}px solid ${borderColor}`,
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />

            {/* Overlay Glass Highlight Ring */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 100,
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                border: `${borderWidth}px solid rgba(255, 255, 255, 0.2)`,
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Layer 2 Wrapper: Pop-out Object 3D Unclipped Top */}
          <div
            style={{
              position: "absolute",
              // Tuned at circleSize 500 and kept proportional: the box has to
              // end exactly on the circle's baseline, or the popped-out head
              // detaches from the body inside the circle.
              top: -circleSize * 0.8,
              left: -200,
              width: circleSize + 400,
              height: circleSize * 1.8,
              clipPath: `inset(0px 0px ${circleSize * 0.75}px 0px)`,
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 200,
                width: circleSize,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Img
                src={resolveAsset(imagePath)}
                style={{
                  width: "85%",
                  height: "auto",
                  transform: `translateY(${mappedImageTranslateY}px) scale(${imageScale})`,
                  transformOrigin: "bottom center",
                  filter: imageBlur > 0.1 ? `blur(${imageBlur}px)` : undefined,
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Title Text with Spring Word Reveals */}
        <div
          style={{
            fontWeight: 900,
            fontSize: dynamicFontSize,
            textTransform: "uppercase",
            letterSpacing: `${dynamicLetterSpacing}px`,
            marginTop: dynamicMarginTop,
            zIndex: 6,
            filter: "drop-shadow(0 6px 16px rgba(15, 23, 42, 0.12))",
            textAlign: "center",
            maxWidth: "920px",
            lineHeight: 1.15,
            textWrap: "balance" as any,
            padding: "0 20px",
          }}
        >
          {titleText.split(" ").map((word: string, i: number) => {
            const wordStartFrame = animationMode === "fade" ? 10 : 10 + i * 5;
            const wordProgress = interpolate(frame - wordStartFrame, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1.15, 0.36, 1),
            });
            const wordOpacity = interpolate(frame - wordStartFrame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            });
            const wordTranslateY = interpolate(wordProgress, [0, 1], [26, 0]);
            const wordBlur = interpolate(wordOpacity, [0, 1], [4, 0]);

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: wordOpacity,
                  transform: `translateY(${wordTranslateY}px)`,
                  marginRight: i === titleText.split(" ").length - 1 ? 0 : "0.3em",
                  color: textColor,
                  paddingBottom: "8px",
                  marginBottom: "-8px",
                  filter: wordBlur > 0.1 ? `blur(${wordBlur}px)` : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Optional Subtitle / Bottom Text */}
        {subtitleText && (
          <div
            style={{
              marginTop: 12,
              fontSize: Math.round(dynamicFontSize * 0.38),
              fontWeight: 600,
              letterSpacing: "1.5px",
              color: subtitleColor,
              zIndex: 6,
              opacity: interpolate(frame, [25, 45], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {subtitleText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default PortraitAnimation;
