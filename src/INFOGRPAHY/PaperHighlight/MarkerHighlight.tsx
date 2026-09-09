import React from "react";
import { GlobalFocusConfig } from "./types";
import { random, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface MarkerHighlightProps {
  config: GlobalFocusConfig;
  seed: number;
}

export const MarkerHighlight: React.FC<MarkerHighlightProps> = ({ config, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate some deterministic roughness using the seed
  const r1 = random(`r1-${seed}`) * config.markerRoughness * 10;
  const r2 = random(`r2-${seed}`) * config.markerRoughness * 10;
  const r3 = random(`r3-${seed}`) * config.markerRoughness * 10;
  const r4 = random(`r4-${seed}`) * config.markerRoughness * 10;

  // A rough polygon that looks like a marker stroke
  const clipPath = `polygon(
    ${0 + r1}% ${10 + r2}%,
    ${4 + r2}% ${6 + r1}%,
    ${31 + r3}% ${9 + r4}%,
    ${58 + r1}% ${3 + r2}%,
    ${96 - r2}% ${8 + r3}%,
    ${100 - r1}% ${82 - r4}%,
    ${91 - r3}% ${94 - r1}%,
    ${55 - r2}% ${89 - r2}%,
    ${22 - r4}% ${97 - r3}%,
    ${0 + r2}% ${88 - r1}%
  )`;

  // Human-style drawing animation (draws from left to right)
  // We use interpolate to ensure it completes exactly at 1.5 seconds (fps * 1.5)
  const drawProgress = interpolate(
    frame,
    [0, fps * 1.5], // Animate from frame 0 to 1.5 seconds
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: -config.markerPaddingY,
        bottom: -config.markerPaddingY,
        left: -config.markerPaddingX,
        right: -config.markerPaddingX,
        zIndex: -1, // Keep behind the text
        // Animate revealing from left to right.
        // inset(top right bottom left)
        clipPath: `inset(0 ${100 - drawProgress * 100}% 0 0)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: config.markerColor,
          opacity: config.markerOpacity,
          clipPath: clipPath,
          mixBlendMode: "multiply", 
        }}
      />
    </div>
  );
};
