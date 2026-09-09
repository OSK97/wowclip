import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { loadInter } from "../utils/localFonts";
import config from "./cinematic-config.json";

loadInter();

// ─── Custom Easing ──────────────────────────────────────────────────
const smoothDecel = Easing.bezier(0.25, 1, 0.5, 1);
const gentleEaseOut = Easing.bezier(0.16, 1, 0.3, 1);

// ─── Timing Utilities ───────────────────────────────────────────────
export const getCinematicTimings = (fps: number) => {
  let introDuration = config.timing.introDuration || 1.0;
  let slideDuration = config.timing.slideDuration || 1.2;
  const showText = config.content.showText ?? true;
  let textHoldDuration = showText ? (config.timing.textHoldDuration || 1.0) : 0;
  const showBottomCard = config.timing.showBottomCard ?? true;
  let bottomCardDuration = showBottomCard ? (config.timing.bottomCardDuration || 1.5) : 0;

  const startBufferSeconds = config.timing.startBufferSeconds || 0;
  const endBufferSeconds = config.timing.endBufferSeconds || 0;

  // Enforce minimum readability bounds
  introDuration = Math.max(introDuration, 0.5);
  slideDuration = Math.max(slideDuration, 0.5);
  if (showText) textHoldDuration = Math.max(textHoldDuration, 1.5);
  if (showBottomCard) bottomCardDuration = Math.max(bottomCardDuration, 1.0);

  const startBufferFrame = startBufferSeconds * fps;
  const introEndFrame = startBufferFrame + introDuration * fps;
  const slideEndFrame = introEndFrame + slideDuration * fps;
  
  // Text starts appearing right at the end of the slide
  const textStartFrame = showText ? introEndFrame + (slideDuration * 0.8) * fps : slideEndFrame; 
  const textEndFrame = showText ? textStartFrame + 1.2 * fps : slideEndFrame; // fade-in duration
  const textHoldEndFrame = slideEndFrame + textHoldDuration * fps;
  
  // Bottom card starts sliding up after text hold
  const bottomCardStartFrame = textHoldEndFrame;
  const bottomCardEndFrame = bottomCardStartFrame + bottomCardDuration * fps;

  return {
    introEndFrame,
    slideEndFrame,
    textStartFrame,
    textEndFrame,
    textHoldEndFrame,
    showBottomCard,
    bottomCardStartFrame,
    bottomCardEndFrame,
    endBufferFrame: endBufferSeconds * fps,
  };
};

export const getCinematicDuration = () => {
  const fps = config.fps || 24;
  const timings = getCinematicTimings(fps);
  return Math.ceil(timings.bottomCardEndFrame + timings.endBufferFrame);
};

// ─── Sub-Components ─────────────────────────────────────────────────

const BackgroundLayer: React.FC<{ timings: ReturnType<typeof getCinematicTimings> }> = ({ timings }) => {
  const frame = useCurrentFrame();

  const bgScale = interpolate(
    frame,
    [timings.introEndFrame, timings.slideEndFrame],
    [1.0, 1.12],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(config.content.bgImage)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale})`,
          willChange: "transform",
        }}
      />
    </AbsoluteFill>
  );
};

const AppleLayer: React.FC<{ timings: ReturnType<typeof getCinematicTimings> }> = ({ timings }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const translateX = interpolate(
    frame,
    [timings.introEndFrame, timings.slideEndFrame],
    [0, -width * 0.54],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  const driftY = interpolate(
    frame,
    [timings.introEndFrame, timings.slideEndFrame],
    [0, -height * 0.02],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  const cameraSlideY = timings.showBottomCard
    ? interpolate(
        frame,
        [timings.bottomCardStartFrame, timings.bottomCardStartFrame + 1.2 * (timings.slideEndFrame - timings.introEndFrame)],
        [0, -height * 0.40],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: smoothDecel,
        },
      )
    : 0;

  const translateY = driftY + cameraSlideY;

  const appleScale = interpolate(
    frame,
    [timings.introEndFrame, timings.slideEndFrame],
    [1.0, 2.0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  const blurAmount = interpolate(
    frame,
    [timings.introEndFrame + 5, timings.slideEndFrame],
    [0, 10],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  const brightness = interpolate(
    frame,
    [timings.introEndFrame + 5, timings.slideEndFrame],
    [1.0, 1.08],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        paddingLeft: "8%",
      }}
    >
      <Img
        src={staticFile(config.content.mainImage)}
        style={{
          width: "45%",
          height: "auto",
          objectFit: "contain",
          transform: `translate(${translateX}px, ${translateY}px) scale(${appleScale})`,
          filter: `blur(${blurAmount}px) brightness(${brightness})`,
          willChange: "transform, filter",
        }}
      />
    </AbsoluteFill>
  );
};

const TextRevealLayer: React.FC<{ timings: ReturnType<typeof getCinematicTimings> }> = ({ timings }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const showText = config.content.showText ?? true;
  if (!showText) return null;

  const opacity = interpolate(
    frame,
    [timings.textStartFrame, timings.textEndFrame],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  );

  const translateY = interpolate(
    frame,
    [timings.textStartFrame, timings.textEndFrame],
    [40, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  );

  const letterSpacing = interpolate(
    frame,
    [timings.textStartFrame, timings.textEndFrame],
    [12, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  );

  const subStartFrame = timings.textStartFrame + 8;
  const subEndFrame = timings.textEndFrame + 8;

  const showSubtitle = config.content.showSubtitle ?? true;

  const subOpacity = showSubtitle ? interpolate(
    frame,
    [subStartFrame, subEndFrame],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  ) : 0;

  const subTranslateY = showSubtitle ? interpolate(
    frame,
    [subStartFrame, subEndFrame],
    [25, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  ) : 0;

  const lineWidth = interpolate(
    frame,
    [timings.textStartFrame + 4, timings.textEndFrame],
    [0, 60],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: gentleEaseOut,
    },
  );

  const cameraSlideY = timings.showBottomCard
    ? interpolate(
        frame,
        [timings.bottomCardStartFrame, timings.bottomCardStartFrame + 1.2 * (timings.slideEndFrame - timings.introEndFrame)],
        [0, -height * 0.40],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: smoothDecel,
        },
      )
    : 0;

  // Split title if it contains newlines
  const titles = config.content.title.split('\n');

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: "47%",
        paddingRight: "12%",
        transform: `translateY(${cameraSlideY}px)`,
        willChange: "transform",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          maxWidth: "400px",
          gap: 12,
        }}
      >
        <div
          style={{
            width: lineWidth,
            height: 3,
            backgroundColor: "#228B22",
            opacity: opacity * 0.7,
            borderRadius: 2,
            marginBottom: 8,
          }}
        />

        <div
          style={{
            fontFamily:
              "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 76,
            fontWeight: 700,
            color: "#228B22",
            lineHeight: 1.1,
            opacity,
            transform: `translateY(${translateY}px)`,
            letterSpacing: `${letterSpacing}px`,
            textShadow: "0 2px 30px rgba(0,0,0,0.3)",
            willChange: "transform, opacity",
          }}
        >
          {titles.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < titles.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {showSubtitle && (
          <div
            style={{
              fontFamily:
                "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: 24,
              fontWeight: 500,
              color: "rgba(34,139,34,0.85)",
              lineHeight: 1.5,
              opacity: subOpacity,
              transform: `translateY(${subTranslateY}px)`,
              letterSpacing: "1px",
              textShadow: "0 1px 15px rgba(0,0,0,0.4)",
              willChange: "transform, opacity",
            }}
          >
            {config.content.subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const VignetteOverlay: React.FC<{ timings: ReturnType<typeof getCinematicTimings> }> = ({ timings }) => {
  const frame = useCurrentFrame();

  const vignetteOpacity = interpolate(
    frame,
    [0, timings.introEndFrame, timings.slideEndFrame, timings.slideEndFrame + 24],
    [0.15, 0.15, 0.35, 0.3],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(
          ellipse 70% 70% at center,
          transparent 0%,
          rgba(0,0,0,${vignetteOpacity}) 100%
        )`,
        pointerEvents: "none",
      }}
    />
  );
};

const ImageCardLayer: React.FC<{ timings: ReturnType<typeof getCinematicTimings> }> = ({ timings }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  if (!timings.showBottomCard) return null;

  const slideDuration = timings.slideEndFrame - timings.introEndFrame;

  const slideUpY = interpolate(
    frame,
    [timings.bottomCardStartFrame, timings.bottomCardStartFrame + 1.2 * slideDuration],
    [height * 0.6, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  const opacity = interpolate(
    frame,
    [timings.bottomCardStartFrame, timings.bottomCardStartFrame + 0.8 * slideDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothDecel,
    },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "32%",
        transform: `translateY(${slideUpY}px)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          width: "84%",
          height: "600px",
          borderRadius: 30,
          overflow: "hidden",
          border: "6px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          backgroundColor: "#1a1a1a",
        }}
      >
        <Img
          src={staticFile(config.content.bottomImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const CinematicFocusShift: React.FC = () => {
  const { fps } = useVideoConfig();
  const timings = getCinematicTimings(fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      <BackgroundLayer timings={timings} />
      <AppleLayer timings={timings} />
      <VignetteOverlay timings={timings} />
      <TextRevealLayer timings={timings} />
      <ImageCardLayer timings={timings} />
    </AbsoluteFill>
  );
};

