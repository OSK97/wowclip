import React from "react";
import { AbsoluteFill, staticFile, random, Video } from "remotion";
import { PaperConfig, TextureSeed } from "./types";

interface PaperTextureProps {
  config: PaperConfig;
  textures: TextureSeed;
  seed: number;
  isBackground: boolean;
  anchorX?: number;
  anchorY?: number;
}

export const PaperTexture: React.FC<PaperTextureProps> = ({ config, textures, seed, isBackground, anchorX = 0.5, anchorY = 0.5 }) => {
  // Use a static noise seed so the browser can cache the SVG turbulence filter, drastically improving render speeds
  const noiseSeed = 42;

  // Calculate percentage positions for the radial gradients so the blur/vignette perfectly centers on the word
  const focalX = anchorX * 100;
  const focalY = anchorY * 100;

  if (isBackground) {
    const bgVideo = staticFile("Documnetry_Info_assets/From Klickpin.com- Discover Aesthetic travel bucket list ideas for your next Pinterest save using ideas that balance beauty and everyday function-.mp4");
    
    return (
      <AbsoluteFill>
        {/* Fullscreen Video Background */}
        <AbsoluteFill>
          <Video
            src={bgVideo}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover", // Ensure it fills the screen perfectly
            }}
          />
        </AbsoluteFill>

        {/* Color Overlay to slightly tint the video to match the vibe (optional) */}
        <AbsoluteFill
          style={{
            backgroundColor: config.baseColor,
            opacity: 0.2, 
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

  // Foreground layers
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Procedural Grain Overlay */}
      <AbsoluteFill
        style={{
          opacity: config.globalGrainOpacity,
          mixBlendMode: "multiply",
        }}
      >
        <svg width="100%" height="100%">
          <filter id={`noise-${seed}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.7"
              numOctaves="1"
              stitchTiles="stitch"
              seed={noiseSeed}
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#noise-${seed})`} />
        </svg>
      </AbsoluteFill>

      {/* Intense Edge Blur (simulating shallow depth of field) */}
      <AbsoluteFill
        style={{
          // Tighter transparent center so the blur starts closer to the word, precisely centered on the word
          maskImage: `radial-gradient(circle at ${focalX}% ${focalY}%, transparent 15%, black 65%)`,
          WebkitMaskImage: `radial-gradient(circle at ${focalX}% ${focalY}%, transparent 15%, black 65%)`,
          backdropFilter: "blur(6px)", // Optimized blur
          WebkitBackdropFilter: "blur(6px)",
          pointerEvents: "none",
        }}
      />

      {/* Intense Vintage Vignette (focuses the eye firmly on the center) */}
      <AbsoluteFill
        style={{
          // Darker edges, warmer tones creeping further into the center
          background: `radial-gradient(circle at ${focalX}% ${focalY}%, transparent 20%, rgba(40, 20, 5, ${config.edgeDarkening * 2.5}) 55%, rgba(10, 5, 0, ${config.edgeDarkening * 6.0}) 100%)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />

      {/* Procedural Creases based on seed (the crumple is now controlled by globalCrumpleOpacity but textures trigger it) */}
      {textures.crease && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${random(`creaseA-${seed}`) * 360}deg, transparent 48%, rgba(0,0,0,${config.globalCrumpleOpacity}) 50%, rgba(255,255,255,${config.globalCrumpleOpacity}) 51%, transparent 53%)`,
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Procedural Stains based on seed */}
      {textures.stain && (
        <AbsoluteFill style={{ mixBlendMode: "multiply" }}>
          <div
            style={{
              position: "absolute",
              top: `${random(`stainY-${seed}`) * 80}%`,
              left: `${random(`stainX-${seed}`) * 80}%`,
              width: `${200 + random(`stainS-${seed}`) * 300}px`,
              height: `${200 + random(`stainS-${seed}`) * 300}px`,
              background: `radial-gradient(circle at center, rgba(139,69,19,${config.stainOpacity}) 0%, transparent 70%)`,
              borderRadius: "50%",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
