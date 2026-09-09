import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  spring,
  useVideoConfig,
  staticFile,
  Img,
} from "remotion";
import { loadInter as loadSans } from "../../utils/localFonts";
import {
  AestheticHighlighter as Highlighter,
} from "../../INFOGRPAHY/AestheticNews/AestheticHighlighter";

const { fontFamily: sansFont } = loadSans("normal", {
  weights: ["400", "500", "700", "900"],
});

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface PersonNewsConfig {
  logoUrl?: string;
  publisher?: string;
  topic?: string;
  dateStr?: string;
  headline: string;
  description: string;
  upfrontImage?: string;
  backgroundImage?: string;
  durationInFrames?: number;
  durationInSeconds?: number;
  timing?: {
    newsAppearFrame?: number;
    photoShrinkDuration?: number;
    initialPhotoHeight?: number;
    targetPhotoHeight?: number;
  };
  script?: {
    instructions: Array<{
      target: string;
      startFrame: number;
      endFrame: number;
      fromWord: number;
      toWord: number;
      cameraMode?: string;
    }>;
  };
}

// ══════════════════════════════════════════════════════════════
// TIMING GUARDRAILS — Prevents LLM from generating impossible timings
// ══════════════════════════════════════════════════════════════

// Minimum time (in seconds) the person's photo must show before news section appears
const MIN_PHOTO_DISPLAY_SEC = 1.5;
// Minimum time (in seconds) the news section must remain visible
const MIN_NEWS_VISIBLE_SEC = 2.0;
// Minimum overall duration (in seconds) for the entire animation
const MIN_DURATION_SEC = 4.0;

// ══════════════════════════════════════════════════════════════
// DURATION CALCULATOR (exported for Root.tsx)
// ══════════════════════════════════════════════════════════════

export const getPersonNewsDuration = (config?: PersonNewsConfig, defaultFps = 30): number => {
  if (!config) return 300; // 10s fallback
  const fps = defaultFps;

  // Prefer explicit durationInSeconds, then durationInFrames, then auto-calculate
  if (config.durationInSeconds && config.durationInSeconds > 0) {
    const enforced = Math.max(config.durationInSeconds, MIN_DURATION_SEC);
    return Math.ceil(enforced * fps);
  }
  if (config.durationInFrames && config.durationInFrames > 0) {
    const enforced = Math.max(config.durationInFrames, Math.ceil(MIN_DURATION_SEC * fps));
    return enforced;
  }

  // Auto-calculate from script instructions
  const script = config.script || { instructions: [] };
  if (script.instructions.length > 0) {
    const lastEnd = script.instructions[script.instructions.length - 1].endFrame;
    return Math.max(lastEnd + Math.ceil(2 * fps), Math.ceil(MIN_DURATION_SEC * fps));
  }

  return 300; // default 10s at 30fps
};

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export const ElonRocketNews: React.FC<{ config?: PersonNewsConfig }> = ({ config: rawConfig }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Merge defaults — makes every field safe to access
  const config: Required<Pick<PersonNewsConfig, 'headline' | 'description'>> & PersonNewsConfig = {
    headline: "Breaking News Headline",
    description: "Description text goes here.",
    publisher: "",
    topic: "",
    dateStr: "",
    logoUrl: "",
    upfrontImage: "",
    backgroundImage: "",
    durationInFrames: 300,
    timing: {
      newsAppearFrame: 60,
      photoShrinkDuration: 20,
      initialPhotoHeight: 65,
      targetPhotoHeight: 45,
    },
    script: { instructions: [] },
    ...rawConfig,
  };

  const headline = config.headline;
  const description = config.description;
  const dateStr = config.dateStr || "";
  const topic = config.topic || "";
  const script = config.script || { instructions: [] };

  // ── Enforce minimum timing guardrails ──────────────────────────
  const minPhotoFrames = Math.ceil(MIN_PHOTO_DISPLAY_SEC * fps);
  const minNewsFrames = Math.ceil(MIN_NEWS_VISIBLE_SEC * fps);

  const timing = config.timing || {};
  const newsAppearFrame = Math.max(timing.newsAppearFrame || 60, minPhotoFrames);
  const shrinkDur = Math.max(timing.photoShrinkDuration || 20, 10);
  const initialPhotoHeight = timing.initialPhotoHeight || 65;
  const targetPhotoHeight = timing.targetPhotoHeight || 45;

  // ── Fade in / out ──────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  const lastInstEnd = script.instructions.length > 0
    ? script.instructions[script.instructions.length - 1].endFrame
    : 240;
    
  // Ensure news is visible for minimum time after it appears
  const minFadeOutStart = newsAppearFrame + minNewsFrames;
  const totalFrames = config.durationInFrames || 300;
  const fadeOutStart = Math.max(lastInstEnd + 60, minFadeOutStart, totalFrames - 30);
  const fadeOutEnd = fadeOutStart + 24;
  const fadeOut = interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = fadeIn * fadeOut;

  // ── News text entrance ─────────────────────────────────────────
  const textEntranceProg = spring({
    frame: Math.max(0, frame - newsAppearFrame),
    fps,
    config: { damping: 16, stiffness: 80 }
  });

  const newsOpacity = interpolate(textEntranceProg, [0, 1], [0, 1]);
  const newsYShift = interpolate(textEntranceProg, [0, 1], [40, 0]);

  // ── Photo scale animation ─────────────────────────────────────
  const initialScale = initialPhotoHeight / targetPhotoHeight;
  const photoScale = interpolate(
    frame,
    [newsAppearFrame, newsAppearFrame + shrinkDur],
    [initialScale, 1.0], 
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    }
  );

  // ── Dynamic publisher name sizing ──────────────────────────────
  const publisherName = config.publisher || "";
  const publisherFontSize = publisherName.length > 20
    ? Math.max(22, Math.round(38 * (20 / publisherName.length)))
    : publisherName.length > 14
      ? 30
      : 38;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f15", overflow: "hidden", fontFamily: sansFont }}>
      {/* Background Image */}
      {config.backgroundImage && (
        <Img
          src={config.backgroundImage.startsWith("http") ? config.backgroundImage : staticFile(config.backgroundImage)}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.6,
            filter: "blur(8px) brightness(0.8)",
            transform: `scale(${interpolate(frame, [0, 600], [1, 1.1])})`
          }}
        />
      )}

      {/* Atmospheric Overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 35%, rgba(15, 15, 15, 0.2) 0%, rgba(10, 10, 15, 0.8) 100%)" }} />

      {/* Upfront Image (Person Photo) */}
      {config.upfrontImage && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${targetPhotoHeight}%`,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          overflow: "hidden",
          opacity: opacity,
          transform: `scale(${photoScale})`,
          transformOrigin: "bottom center",
          willChange: "transform",
        }}>
          <Img
            src={config.upfrontImage.startsWith("http") ? config.upfrontImage : staticFile(config.upfrontImage)}
            style={{ height: "100%", width: "100%", objectFit: "contain", objectPosition: "bottom center" }}
          />
          {/* Bottom fade blend */}
          <div style={{
             position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
             background: 'linear-gradient(0deg, #0f0f15 0%, rgba(15,15,21,0.7) 15%, transparent 40%)'
          }} />
        </div>
      )}

      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity }}>
        <div id="article-container" style={{ width: 1080, height: 1920, position: "relative", padding: "120px 75px 80px 75px", display: "flex", flexDirection: "column", justifyContent: "flex-start", boxSizing: "border-box" }}>
          
          {/* Publisher + Topic bar */}
          <div style={{ width: "100%", height: "80px", marginBottom: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: newsOpacity, transform: `translateY(${newsYShift}px)` }}>
            {config.logoUrl ? (
              <Img src={config.logoUrl} style={{ height: "60px", objectFit: "contain" }} />
            ) : publisherName ? (
              <div style={{
                fontSize: `${publisherFontSize}px`,
                fontWeight: 900,
                color: "#FFFFFF",
                letterSpacing: "-1.5px",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                {publisherName}
                <span style={{ color: "#FFEB3B", fontSize: "48px", lineHeight: "10px" }}>.</span>
              </div>
            ) : <div/>}
            <div style={{ fontSize: "26px", color: "#BDBDBD", fontWeight: 600, letterSpacing: "2.5px" }}>{topic}</div>
          </div>

          {/* Headline + Description */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-start", opacity: newsOpacity, transform: `translateY(${newsYShift}px)` }}>
            <h1 style={{ fontSize: "66px", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.15, margin: 0, marginBottom: "36px", letterSpacing: "-1.5px", textAlign: "left" }}>
              <Highlighter body={headline} script={script} frame={frame} fontSize={66} lineHeight={1.15} color="#FFFFFF" accentColor="rgba(255, 235, 59, 0.85)" idPrefix="headline-word-" targetName="headline" fontWeight={900} letterSpacing="-1.5px" />
            </h1>

            <div style={{ maxWidth: 930, textAlign: "left" }}>
              <Highlighter body={description} script={script} frame={frame} fontSize={32} lineHeight={1.8} color="#CCCCCC" accentColor="rgba(255, 235, 59, 0.85)" idPrefix="description-word-" targetName="description" />
            </div>

            {dateStr && (
              <div style={{ marginTop: "36px", fontSize: "21px", fontWeight: 400, color: "#8E8E8E" }}>
                {dateStr}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Corner Blur Overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", maskImage: "radial-gradient(circle at 50% 50%, transparent 55%, black 95%)", WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent 55%, black 95%)" }} />
      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9, background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%)" }} />
      {/* Film Grain */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10, opacity: 0.035, mixBlendMode: "overlay", width: "100%", height: "100%" }}>
        <filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
    </AbsoluteFill>
  );
};
