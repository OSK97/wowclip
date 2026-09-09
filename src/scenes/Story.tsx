import React, { useMemo } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SceneView } from "./SceneView";
import { buildStoryTimeline } from "./timeline";
import { resolveTheme } from "./types";
import type { StoryConfig } from "./types";
import defaultStory from "./story.config.json";

export { getStoryDuration } from "./timeline";
export { DEFAULT_FPS as STORY_FPS } from "./timeline";
export type { StoryConfig };

export const Story: React.FC<{ config?: StoryConfig }> = ({
  config = defaultStory as StoryConfig,
}) => {
  const configKey = JSON.stringify(config);
  const timeline = useMemo(() => buildStoryTimeline(config), [configKey]);
  const theme = resolveTheme(config?.theme);
  const dark = theme.mode === "dark";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        backgroundImage: dark
          ? "radial-gradient(ellipse 95% 62% at 46% 34%, #16223A 0%, #0B1120 58%, #070C16 100%)"
          : "none",
        overflow: "hidden",
      }}
    >
      {/* The board the scenes are drawn on. Ultra-faint on pure white to maintain an architectural minimal stage */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 82% 60% at 46% 38%, black 15%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 82% 60% at 46% 38%, black 15%, transparent 90%)",
          pointerEvents: "none",
        }}
      />

      {/* Filmic grain texture: active in dark mode; disabled on pure white stage to keep it crisp and pristine */}
      {dark && (
        <AbsoluteFill
          style={{
            opacity: 0.055,
            mixBlendMode: "overlay",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <svg width="100%" height="100%">
            <filter id="story-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves={3}
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#story-grain)" />
          </svg>
        </AbsoluteFill>
      )}

      {/* Vignette: applied only in dark mode so the white stage corners stay 100% pure white */}
      {dark && (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 80% 64% at 50% 44%, transparent 46%, rgba(15,23,42,0.13) 100%)",
            pointerEvents: "none",
            zIndex: 6,
          }}
        />
      )}

      {timeline.scenes.map((resolved, i) => (
        <Sequence
          key={resolved.scene.id ?? i}
          from={resolved.startFrame}
          durationInFrames={resolved.durationInFrames}
          layout="none"
        >
          <SceneView resolved={resolved} theme={theme} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export default Story;
