import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { loadPoppins } from "../../utils/localFonts";

const { fontFamily } = loadPoppins("normal", {
  weights: ["400", "600", "800", "900"],
});

// Dynamically scale text down if it's too long
const getFontSize = (text: string, baseSize: number) => {
  const maxAllowedSize = Math.floor(1280 / Math.max(text.length, 1));
  return Math.min(baseSize, maxAllowedSize);
};

export interface BlurredVideoConfig {
  composition?: {
    durationSeconds?: number;
    durationInFrames?: number;
  };
  theme?: {
    backgroundImage?: string;
    cutoutImage?: string;
    vignetteOpacity?: number;
    showSunFlare?: boolean;
    sunFlareColor?: string;
    textGradient?: string;
    textColor?: string;
  };
  timing?: {
    cutoutEnterFrame?: number;
    textEnterFrame?: number;
  };
  text?: {
    line1?: string;
    line2?: string;
    line3?: string;
  };
}

export const BlurredBackgroundVideo: React.FC<{
  config?: BlurredVideoConfig;
}> = ({ config: propConfig }) => {
  let jsonConfig: any = {};
  try {
    jsonConfig = require("./blurred-video.json");
  } catch {
    jsonConfig = {};
  }

  const c = propConfig || jsonConfig || {};
  const theme = c.theme || {};
  const timing = c.timing || {};
  const text = c.text || {};

  const line1 = text.line1 || "NARENDRA";
  const line2 = text.line2 || "";
  const line3 = text.line3 || "MODI";

  const bgImage = theme.backgroundImage || "BlurredBackgroundVideo/ca46ecaa35b2c7e197e8af9bd5c124f4.jpg";
  const cutoutImage = theme.cutoutImage || "Documnetry_Info_assets/building1.png";

  const vignetteOpacity = theme.vignetteOpacity ?? 0.35;
  const showSunFlare = theme.showSunFlare ?? true;
  const sunFlareColor = theme.sunFlareColor || "rgba(255, 200, 80, 0.14)";
  const textGradient =
    theme.textGradient ||
    "linear-gradient(180deg, #FFD700 0%, #FFA500 40%, #FF8C00 70%, #FFD700 100%)";
  const line1TextColor = theme.textColor || "#ffffff";

  const cutoutEnterFrame = timing.cutoutEnterFrame ?? 24;
  const textEnterFrame = timing.textEnterFrame ?? 144;
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();

  // ════════════════════════════════════════════════════════════════
  // HUMAN OPERATOR SIMULATION (Handheld Camera Shake)
  // Subtle, organic documentary camera movement
  // ════════════════════════════════════════════════════════════════
  const shakeX = Math.sin(frame * 0.04) * 3 + Math.cos(frame * 0.095) * 1.5;
  const shakeY = Math.cos(frame * 0.035) * 2 + Math.sin(frame * 0.08) * 1.0;

  // ════════════════════════════════════════════════════════════════
  // ENTRANCE TRANSITIONS
  // ════════════════════════════════════════════════════════════════

  // Background: smooth slide-down entrance
  const bgEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });
  const bgEntranceY = interpolate(bgEntrance, [0, 1], [-height, 0]);

  // Cutout: staggered smooth slide-up entrance
  const cutoutEntrance = spring({
    frame: frame - cutoutEnterFrame,
    fps,
    config: { damping: 200 },
  });
  const cutoutEntranceY = interpolate(cutoutEntrance, [0, 1], [400, 0]);
  const cutoutOpacity = interpolate(cutoutEntrance, [0, 1], [0, 1]);

  // Text: staggered smooth fade-in entrance with spring blur
  const textEntranceProgress = interpolate(
    frame - textEnterFrame,
    [0, 18],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.22, 1.15, 0.36, 1),
    }
  );

  const textOpacity = interpolate(frame - textEnterFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textTranslateY = interpolate(textEntranceProgress, [0, 1], [30, 0]);
  const textBlur = interpolate(textOpacity, [0, 1], [6, 0]);

  // Cutout Slide-Down Animation (Happens simultaneously with text entering)
  const cutoutMoveDownSpring = spring({
    frame: frame - textEnterFrame,
    fps,
    config: { damping: 100 },
  });
  const cutoutExitOffset = interpolate(cutoutMoveDownSpring, [0, 1], [0, 240]);

  // ════════════════════════════════════════════════════════════════
  // CONTINUOUS CINEMATIC DRIFTS (Documentary Ken Burns)
  // ════════════════════════════════════════════════════════════════

  const bgZoom = interpolate(frame, [0, durationInFrames], [1.04, 1.12], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });
  const bgDriftX = interpolate(frame, [0, durationInFrames], [-8, 8], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });
  const bgDriftY = interpolate(frame, [0, durationInFrames], [4, -4], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  const cutoutScale = interpolate(frame, [0, durationInFrames], [1.0, 1.03], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });
  const cutoutDriftX = interpolate(frame, [0, durationInFrames], [3, -3], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });
  const cutoutFloat = Math.sin((frame / durationInFrames) * Math.PI * 1.5) * 6;
  const cutoutRotateY = interpolate(frame, [0, durationInFrames], [-0.5, 0.5], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // Glowing Text Pulse
  const glowPulse = Math.sin((frame / fps) * Math.PI * 1.2) * 0.3 + 0.7;
  const glowSpread = interpolate(glowPulse, [0.4, 1.0], [15, 30]);
  const glowOpacity = interpolate(glowPulse, [0.4, 1.0], [0.5, 0.9]);

  const finalCutoutTranslateY = cutoutEntranceY + cutoutExitOffset;

  return (
    <AbsoluteFill
      style={{ backgroundColor: "transparent", overflow: "hidden" }}
    >
      {/* ─── BLURRED BACKGROUND ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${bgEntranceY}px)`,
        }}
      >
        <Img
          src={bgImage.startsWith("http") ? bgImage : staticFile(bgImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(8px)",
            pointerEvents: "none",
            transform: `scale(${bgZoom}) translate(${bgDriftX + shakeX}px, ${bgDriftY + shakeY}px)`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* ─── CINEMATIC VIGNETTE OVERLAY ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle, rgba(0,0,0,0) 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* ─── CINEMATIC SUN LIGHT LEAK FLARE ─── */}
      {showSunFlare && (
        <div
          style={{
            position: "absolute",
            top: -250,
            right: -250,
            width: 900,
            height: 900,
            background: `radial-gradient(circle, ${sunFlareColor} 0%, rgba(255, 140, 40, 0.04) 50%, rgba(0,0,0,0) 80%)`,
            pointerEvents: "none",
            mixBlendMode: "screen",
            transform: `translate(${shakeX * 1.5}px, ${shakeY * 1.5}px)`,
            zIndex: 4,
          }}
        />
      )}

      {/* ─── KINETIC NAME TYPOGRAPHY ─── */}
      <div
        style={{
          position: "absolute",
          top: line3 ? 160 : 180,
          left: 0,
          right: 0,
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: textOpacity,
          transform: `translateY(${textTranslateY}px)`,
          filter: textBlur > 0.1 ? `blur(${textBlur}px)` : undefined,
        }}
      >
        {/* Line 1 */}
        <div
          style={{
            fontFamily,
            fontSize: getFontSize(line1, line3 ? 150 : 200),
            fontWeight: 800,
            color: line1TextColor,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            textShadow: "0 6px 20px rgba(0,0,0,0.65)",
            lineHeight: 0.9,
            textAlign: "center",
          }}
        >
          {line1}
        </div>

        {/* Optional Line 2 */}
        {line3 && (
          <div
            style={{
              fontFamily,
              fontSize: getFontSize(line2, 112),
              fontWeight: 800,
              color: line1TextColor,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              textShadow: "0 6px 20px rgba(0,0,0,0.65)",
              lineHeight: 1.0,
              marginTop: 15,
              textAlign: "center",
            }}
          >
            {line2}
          </div>
        )}

        {/* Glowing Bottom Accent Line */}
        <div style={{ position: "relative", marginTop: 10 }}>
          {/* Glow layer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontFamily,
              fontSize: getFontSize(line3 || line2, line3 ? 280 : 300),
              fontWeight: 900,
              color: "transparent",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              WebkitTextStroke: "0px transparent",
              textShadow: `0 0 ${glowSpread}px rgba(255, 200, 0, ${glowOpacity}), 0 0 ${glowSpread * 2}px rgba(255, 170, 0, ${glowOpacity * 0.5}), 0 0 ${glowSpread * 3}px rgba(255, 140, 0, ${glowOpacity * 0.2})`,
              pointerEvents: "none" as const,
            }}
          >
            {line3 || line2}
          </div>

          {/* Main gradient text layer */}
          <div
            style={{
              position: "relative",
              fontFamily,
              fontSize: getFontSize(line3 || line2, line3 ? 280 : 300),
              fontWeight: 900,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1,
              background: textGradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.6)) drop-shadow(0 0 ${12 + glowSpread * 0.3}px rgba(255, 200, 0, ${glowOpacity * 0.4}))`,
            }}
          >
            {line3 || line2}
          </div>
        </div>
      </div>

      {/* ─── CUTOUT OBJECT ─── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "85%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          zIndex: 10,
          perspective: 1200,
          opacity: cutoutOpacity,
          transform: `translateY(${finalCutoutTranslateY}px)`,
        }}
      >
        <Img
          src={cutoutImage.startsWith("http") ? cutoutImage : staticFile(cutoutImage)}
          style={{
            height: "100%",
            maxHeight: "1350px",
            width: "calc(100% - 60px)",
            objectFit: "contain",
            objectPosition: "bottom center",
            pointerEvents: "none",
            transform: `scale(${cutoutScale}) translateX(${cutoutDriftX + shakeX * 0.6}px) translateY(${cutoutFloat + shakeY * 0.6}px) rotateY(${cutoutRotateY}deg)`,
            transformOrigin: "center bottom",
            filter: "drop-shadow(0 15px 40px rgba(0, 0, 0, 0.45))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default BlurredBackgroundVideo;

export const getBlurredVideoDuration = () => {
  let config: any;
  try {
    config = require("./blurred-video.json");
  } catch {
    config = {};
  }

  const comp = config?.composition;
  const fps = comp?.fps ?? 24;
  if (comp?.durationSeconds) return Math.round(comp.durationSeconds * fps);
  if (comp?.durationInFrames) return comp.durationInFrames;

  const textEnterFrame = config?.timing?.textEnterFrame ?? 144;
  return textEnterFrame + 120;
};
