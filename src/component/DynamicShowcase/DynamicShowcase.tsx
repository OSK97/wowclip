import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { loadInter, loadOutfit, loadPlayfair, loadMontserrat, loadDancingScript } from "../../utils/localFonts";

import { Background, BackgroundConfig } from "./Background";
import { ImageBlock, ImageConfig } from "./ImageBlock";
import { TextSection, Segment, TextSectionConfig } from "./TextSection";

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

const fontFamilyMap = {
  Inter: interFamily,
  Outfit: outfitFamily,
  Playfair: playfairFamily,
  PlayfairDisplay: playfairFamily,
  Montserrat: montserratFamily,
  DancingScript: dancingScriptFamily,
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface DynamicShowcaseConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  background?: BackgroundConfig;
  floating?: {
    enable?: boolean;
    floatAmplitudeY?: number;
    floatFrequencyY?: number;
    rotateAmplitude?: number;
    rotateFrequency?: number;
  };
  image?: ImageConfig;
  text?: TextSectionConfig;
  segments?: Segment[];
}

export interface DynamicShowcaseProps {
  config?: DynamicShowcaseConfig;
}

// ─── Component Wrapper ────────────────────────────────────────────────────────
export const DynamicShowcase: React.FC<DynamicShowcaseProps> = ({ config: propConfig }) => {
  const frame = useCurrentFrame();
  const { fps, height: compHeight, width: compWidth } = useVideoConfig();

  // Load JSON config with a try-catch fallback
  let fileConfig: DynamicShowcaseConfig;
  try {
    fileConfig = require("./dynamic-showcase.json") as DynamicShowcaseConfig;
  } catch {
    fileConfig = {};
  }

  // Merge JSON file configs and direct props
  const merged: DynamicShowcaseConfig = {
    background: { ...(fileConfig.background || {}), ...(propConfig?.background || {}) },
    floating: { ...(fileConfig.floating || {}), ...(propConfig?.floating || {}) },
    image: { ...(fileConfig.image || {}), ...(propConfig?.image || {}) },
    text: { ...(fileConfig.text || {}), ...(propConfig?.text || {}) },
    segments: propConfig?.segments || fileConfig.segments || [],
  };

  const bg = merged.background || {};
  const float = merged.floating || {};
  const img = merged.image || {};
  const txt = merged.text || {};
  const segments = merged.segments || [];

  // ── Premium Organic Floating / Swim Animation ──
  const isFloatingEnabled = float.enable ?? true;
  const floatY = isFloatingEnabled
    ? Math.sin(frame * (float.floatFrequencyY ?? 0.05)) * (float.floatAmplitudeY ?? 12)
    : 0;
  const rotateAngle = isFloatingEnabled
    ? Math.sin(frame * (float.rotateFrequency ?? 0.03)) * (float.rotateAmplitude ?? 1.5)
    : 0;

  return (
    <AbsoluteFill>
      {/* Background layer */}
      <Background bg={bg} frame={frame} />

      {/* Stacked floating content container */}
      <AbsoluteFill
        style={{
          transform: `translateY(${floatY}px) rotate(${rotateAngle}deg)`,
          transformOrigin: "center center",
        }}
      >
        {/* Animated image layer (rises center, then shrinks & attaches bottom after 2 seconds) */}
        <ImageBlock
          imgConfig={img}
          compWidth={compWidth}
          compHeight={compHeight}
          frame={frame}
          fps={fps}
          textLength={segments.reduce((acc, seg) => acc + (seg.type === "text" ? seg.value.length : String(seg.value).length), txt.value ? txt.value.length : 0)}
        />
      </AbsoluteFill>

      {/* Dynamic header text layer (reveals after 2 seconds staggering word by word) - NOW STATIC OUTSIDE FLOATING */}
      <TextSection
        segments={segments}
        fallbackText={txt.value ?? "Dynamic Showcase Headline"}
        textConfig={{
          fontFamily: txt.fontFamily ?? "Montserrat",
          fontSize: txt.fontSize ?? 72,
          color: txt.color ?? "#0f172a",
          textAlign: txt.textAlign ?? "center",
          marginTop: txt.marginTop ?? 120,
          marginSide: txt.marginSide ?? 80,
          entranceDelay: txt.entranceDelay ?? 15,
          staggerFrames: txt.staggerFrames ?? 4,
        }}
        fontFamilyMap={fontFamilyMap}
        frame={frame}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

export default DynamicShowcase;
