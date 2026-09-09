import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  delayRender,
  continueRender,
} from "remotion";

import { loadInter, loadOutfit, loadPlayfair, loadMontserrat, loadDancingScript } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────
const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: outfitFamily } = loadOutfit("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: playfairFamily } = loadPlayfair("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const { fontFamily: montserratFamily } = loadMontserrat("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: dancingScriptFamily } = loadDancingScript("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const fontMap: Record<string, string> = {
  Inter: interFamily,
  Outfit: outfitFamily,
  Playfair: playfairFamily,
  PlayfairDisplay: playfairFamily,
  Montserrat: montserratFamily,
  DancingScript: dancingScriptFamily,
};

// ─── Word-by-Word Text Animation Component ──────────────────────────────────
const WordSpan: React.FC<{
  word: string;
  startFrame: number;
  fontFamily: string;
  color: string;
  fps: number;
  frame: number;
}> = ({ word, startFrame, fontFamily, color, fps, frame }) => {
  const wordSpring = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 85, mass: 0.8 },
  });

  const wordY = interpolate(wordSpring, [0, 1], [25, 0]);
  const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1]);
  const wordBlur = interpolate(wordSpring, [0, 1], [10, 0]);

  return (
    <React.Fragment>
      <span
        style={{
          display: "inline-block",
          fontFamily,
          color,
          opacity: wordOpacity,
          transform: `translateY(${wordY}px)`,
          filter: `blur(${wordBlur}px)`,
        }}
      >
        {word}
      </span>
      {" "}
    </React.Fragment>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackgroundConfig {
  backgroundColor?: string;
  backgroundGradient?: string;
  showGrid?: boolean;
  gridColor?: string;
  gridSize?: number;
  gridOpacity?: number;
  showOrbs?: boolean;
  orb1Color?: string;
  orb2Color?: string;
  orb3Color?: string;
}

interface FloatingConfig {
  enable?: boolean;
  floatAmplitudeY?: number;
  floatFrequencyY?: number;
  rotateAmplitude?: number;
  rotateFrequency?: number;
}

interface ImageConfig {
  src?: string;
  heightPercent?: number;
  marginTop?: number;
  marginSide?: number;
  borderRadius?: number;
  objectFit?: "contain" | "cover" | "fill";
  showShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  entranceType?: "springUp" | "fadeIn" | "scaleIn" | "slideDown" | "none";
  entranceDelay?: number;
}

interface TextConfig {
  value?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  marginTop?: number;
  marginSide?: number;
  entranceType?: "fadeUp" | "fadeIn" | "scaleIn" | "slideUp" | "none";
  entranceDelay?: number;
  staggerFrames?: number;
}

export interface ShowcaseCardConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  background?: BackgroundConfig;
  floating?: FloatingConfig;
  image?: ImageConfig;
  text?: TextConfig;
}

export interface ShowcaseCardProps {
  config?: ShowcaseCardConfig;
}

// ─── Animated Background ─────────────────────────────────────────────────────

const AnimatedBackground: React.FC<{ bg: BackgroundConfig; frame: number }> = ({
  bg,
  frame,
}) => {
  const hasBgGradient = !!bg.backgroundGradient;
  const bgStyle: React.CSSProperties = {
    backgroundColor: bg.backgroundColor ?? "#f0f4ff",
    ...(hasBgGradient ? { backgroundImage: bg.backgroundGradient } : {}),
    overflow: "hidden",
  };

  const orb1X = Math.sin(frame / 70) * 100;
  const orb1Y = Math.cos(frame / 55) * 80;
  const orb2X = Math.cos(frame / 80) * -120;
  const orb2Y = Math.sin(frame / 60) * 100;
  const orb3X = Math.sin(frame / 50) * 60;
  const orb3Y = Math.cos(frame / 75) * -110;

  return (
    <AbsoluteFill style={bgStyle}>
      {/* Animated light orbs */}
      {(bg.showOrbs ?? true) && (
        <>
          <div
            style={{
              position: "absolute",
              width: 800,
              height: 800,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb1Color ?? "rgba(59, 130, 246, 0.08)"} 0%, transparent 60%)`,
              filter: "blur(50px)",
              top: "-5%",
              left: "-5%",
              transform: `translate(${orb1X}px, ${orb1Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 1000,
              height: 1000,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb2Color ?? "rgba(99, 102, 241, 0.06)"} 0%, transparent 60%)`,
              filter: "blur(70px)",
              bottom: "-15%",
              right: "-15%",
              transform: `translate(${orb2X}px, ${orb2Y}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${bg.orb3Color ?? "rgba(147, 197, 253, 0.1)"} 0%, transparent 60%)`,
              filter: "blur(45px)",
              top: "35%",
              left: "30%",
              transform: `translate(${orb3X}px, ${orb3Y}px)`,
            }}
          />
        </>
      )}

      {/* Dot grid overlay */}
      {(bg.showGrid ?? true) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(${bg.gridColor ?? "rgba(59, 130, 246, 0.04)"} 1px, transparent 1px)`,
            backgroundSize: `${bg.gridSize ?? 50}px ${bg.gridSize ?? 50}px`,
            opacity: bg.gridOpacity ?? 1,
            transform: `translateY(${(frame * 0.3) % (bg.gridSize ?? 50)}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ config: propConfig }) => {
  const frame = useCurrentFrame();
  const { fps, height: compHeight, width: compWidth } = useVideoConfig();

  // Load JSON config
  let fileConfig: ShowcaseCardConfig;
  try {
    fileConfig = require("./showcase-card.json") as ShowcaseCardConfig;
  } catch {
    fileConfig = {};
  }

  const merged: ShowcaseCardConfig = {
    background: { ...(fileConfig.background || {}), ...(propConfig?.background || {}) },
    floating: { ...(fileConfig.floating || {}), ...(propConfig?.floating || {}) },
    image: { ...(fileConfig.image || {}), ...(propConfig?.image || {}) },
    text: { ...(fileConfig.text || {}), ...(propConfig?.text || {}) },
  };

  const bg = merged.background || {};
  const float = merged.floating || {};
  const img = merged.image || {};
  const txt = merged.text || {};

  // ── Image source resolution ──
  const imgPath = img.src ?? "";
  const imgSrc =
    imgPath.startsWith("http://") ||
    imgPath.startsWith("https://") ||
    imgPath.startsWith("data:") ||
    imgPath.startsWith("/")
      ? imgPath
      : staticFile(imgPath);

  // ── Dynamic image dimensions ──
  const [imgDims, setImgDims] = React.useState<{ w: number; h: number } | null>(null);
  const [handle] = React.useState(() => delayRender("Loading ShowcaseCard image"));

  React.useEffect(() => {
    if (!imgPath) {
      setImgDims({ w: compWidth, h: compHeight });
      continueRender(handle);
      return;
    }
    const i = new window.Image();
    i.src = imgSrc;
    i.onload = () => {
      setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
      continueRender(handle);
    };
    i.onerror = () => {
      setImgDims({ w: compWidth, h: compHeight });
      continueRender(handle);
    };
  }, [imgSrc, handle, imgPath, compWidth, compHeight]);

  if (!imgDims) return null;

  // ── Layout calculations ──
  const safeMarginTop = img.marginTop ?? 80;
  const safeMarginSide = img.marginSide ?? 60;
  const imageHeightPercent = img.heightPercent ?? 0.75;

  const imageAreaHeight = compHeight * imageHeightPercent;
  const imageAreaWidth = compWidth - safeMarginSide * 2;
  const imageAreaTop = safeMarginTop;

  // Fit image inside allocated area preserving aspect ratio
  const imgRatio = imgDims.w / imgDims.h;
  const objectFit = img.objectFit ?? "contain";

  let renderWidth: number;
  let renderHeight: number;

  if (objectFit === "contain") {
    const areaRatio = imageAreaWidth / imageAreaHeight;
    if (imgRatio > areaRatio) {
      renderWidth = imageAreaWidth;
      renderHeight = imageAreaWidth / imgRatio;
    } else {
      renderHeight = imageAreaHeight;
      renderWidth = imageAreaHeight * imgRatio;
    }
  } else {
    renderWidth = imageAreaWidth;
    renderHeight = imageAreaHeight;
  }

  const imgLeft = (compWidth - renderWidth) / 2;
  const imgTop = imageAreaTop + (imageAreaHeight - renderHeight) / 2;

  // ── Text layout: Attached directly below the bottom of the rendered image ──
  const textMarginTop = txt.marginTop ?? 40;
  const textTop = imgTop + renderHeight + textMarginTop;
  const textLeft = imgLeft;
  const textWidth = renderWidth;

  // ── Image entrance animation ──
  const imgDelay = img.entranceDelay ?? 0;
  const imgEntrance = img.entranceType ?? "springUp";

  let imgOpacity = 1;
  let imgTranslateY = 0;
  let imgScale = 1;

  if (imgEntrance === "springUp") {
    const s = spring({
      frame: Math.max(0, frame - imgDelay),
      fps,
      config: { damping: 18, mass: 0.8, stiffness: 120 },
    });
    imgOpacity = s;
    imgTranslateY = interpolate(s, [0, 1], [80, 0]);
    imgScale = interpolate(s, [0, 1], [0.92, 1]);
  } else if (imgEntrance === "fadeIn") {
    imgOpacity = interpolate(frame, [imgDelay, imgDelay + 20], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else if (imgEntrance === "scaleIn") {
    const s = spring({
      frame: Math.max(0, frame - imgDelay),
      fps,
      config: { damping: 14, mass: 0.6, stiffness: 100 },
    });
    imgOpacity = s;
    imgScale = interpolate(s, [0, 1], [0.7, 1]);
  } else if (imgEntrance === "slideDown") {
    const p = interpolate(frame, [imgDelay, imgDelay + 25], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    imgOpacity = p;
    imgTranslateY = interpolate(p, [0, 1], [-60, 0]);
  }

  // ── Text entrance animation ──
  const txtDelay = txt.entranceDelay ?? 15;

  // ── Font resolution ──
  const fontFamily = fontMap[txt.fontFamily ?? "Inter"] || interFamily;

  // ── Premium Organic Floating / Swim Animation (same as PortraitAnimation) ──
  const isFloatingEnabled = float.enable ?? true;
  const floatY = isFloatingEnabled
    ? Math.sin(frame * (float.floatFrequencyY ?? 0.05)) * (float.floatAmplitudeY ?? 12)
    : 0;
  const rotateAngle = isFloatingEnabled
    ? Math.sin(frame * (float.rotateFrequency ?? 0.03)) * (float.rotateAmplitude ?? 1.5)
    : 0;

  return (
    <AbsoluteFill>
      {/* Animated Background */}
      <AnimatedBackground bg={bg} frame={frame} />

      {/* Main content container with floating and rotating motion */}
      <AbsoluteFill
        style={{
          transform: `translateY(${floatY}px) rotate(${rotateAngle}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* Image shadow (separate layer for blur performance) */}
        {(img.showShadow ?? true) && imgPath && (
          <div
            style={{
              position: "absolute",
              top: imgTop + 20,
              left: imgLeft + 20,
              width: renderWidth - 40,
              height: renderHeight - 40,
              borderRadius: img.borderRadius ?? 24,
              background: img.shadowColor ?? "rgba(30, 64, 175, 0.18)",
              filter: `blur(${img.shadowBlur ?? 60}px)`,
              opacity: imgOpacity,
              transform: `translateY(${imgTranslateY}px) scale(${imgScale})`,
              zIndex: 0,
            }}
          />
        )}

        {/* Image */}
        {imgPath && (
          <Img
            src={imgSrc}
            style={{
              position: "absolute",
              top: imgTop,
              left: imgLeft,
              width: renderWidth,
              height: renderHeight,
              borderRadius: img.borderRadius ?? 24,
              objectFit: objectFit,
              opacity: imgOpacity,
              transform: `translateY(${imgTranslateY}px) scale(${imgScale})`,
              zIndex: 1,
            }}
          />
        )}

        {/* Text */}
        {txt.value && (
          <div
            style={{
              position: "absolute",
              top: textTop,
              left: textLeft,
              width: textWidth,
              fontFamily,
              fontSize: txt.fontSize ?? 64,
              fontWeight: txt.fontWeight ?? 800,
              color: txt.color ?? "#0f172a",
              textAlign: txt.textAlign ?? "center",
              letterSpacing: txt.letterSpacing ?? -1,
              lineHeight: txt.lineHeight ?? 1.2,
              zIndex: 2,
            }}
          >
            {txt.value.split(" ").filter(Boolean).map((word, i) => (
              <WordSpan
                key={i}
                word={word}
                startFrame={txtDelay + i * (txt.staggerFrames ?? 5)}
                fontFamily={fontFamily}
                color={txt.color ?? "#0f172a"}
                fps={fps}
                frame={frame}
              />
            ))}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ShowcaseCard;
