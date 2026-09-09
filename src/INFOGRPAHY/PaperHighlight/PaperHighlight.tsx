import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, Loop, staticFile } from "remotion";
import { NewspaperPage } from "./NewspaperPage";
import { FocusLine } from "./FocusLine";
import { PaperTexture } from "./PaperTexture";
import { resolveConfig } from "./resolveConfig";
import { PaperHighlightConfig } from "./types";
import "./fonts.css";

export const PaperHighlight: React.FC<{ config: Record<string, unknown> }> = ({ config: rawConfig }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Resolve configuration (replaces tokens, provides defaults)
  const config: PaperHighlightConfig = useMemo(() => resolveConfig(rawConfig), [rawConfig]);

  const { audioLoopFrames } = config.composition;
  
  // Base zoom plus continuous push
  const globalPush = config.motion.globalPush;
  const totalFrames = config.composition.durationSeconds * fps;

  // User rule: exactly 10 newspaper pages (frames) shown per second of video.
  const pagesPerSecond = 10;
  let activePageIndex = Math.floor((frame / fps) * pagesPerSecond);
  
  // Modulo by numPages so that if the video is super long (e.g. 5 seconds = 50 pages), 
  // it safely loops through the 20 available pages over and over.
  const numPages = config.pages.length;
  activePageIndex = activePageIndex % numPages;

  const activePage = config.pages[activePageIndex];
  
  // Heavily increased base zoom (1.6x) and heavily increased zoom intensity (globalPush * 3.5)
  const scale = 1.6 + (frame / totalFrames) * (globalPush * 3.5);

  // Compute dynamic typography at the root so the FocusLine and NewspaperPage share the EXACT same fonts and sizes.
  // This makes the FocusLine look like a real part of the page.
  const fontFamilies = [
    "Tinos, serif",
    "'Times New Roman', serif",
    "Georgia, serif",
    "'Palatino Linotype', Book Antiqua, Palatino, serif",
    "Baskerville, Garamond, serif",
  ];
  const dynamicFontFamily = fontFamilies[(activePage?.seed || 0 * 11) % fontFamilies.length];
  
  // We use a larger base font size because the user wants it to look like a sentence on the page, 
  // but still be readable.
  const sizeVariation = ((activePage?.seed || 0) * 23) % 15; 
  const dynamicBodyFontSize = config.typography.bodyFontSize + sizeVariation; 

  const headlineVariation = ((activePage?.seed || 0) * 31) % 20;
  const dynamicHeadlineFontSize = config.typography.headlineFontSize + headlineVariation;

  const dynamicTypography = {
    ...config.typography,
    fontFamily: dynamicFontFamily,
    bodyFontSize: dynamicBodyFontSize,
    headlineFontSize: dynamicHeadlineFontSize,
  };

  const bgAudio = staticFile("Documnetry_Info_assets/65d0-e650-41b2-9134-a4dfed2bbd27.mp3");

  return (
    <AbsoluteFill
      className="composition"
      style={{
        backgroundColor: "#000", // Edge backdrop
        overflow: "hidden",
      }}
    >
      {/* Background Audio Track - 2x Speed, Looped before the silence */}
      {audioLoopFrames ? (
        <Loop durationInFrames={audioLoopFrames}>
          <Audio src={bgAudio} playbackRate={2} />
        </Loop>
      ) : (
        <Audio src={bgAudio} playbackRate={2} />
      )}

      <AbsoluteFill
        style={{
          transformOrigin: "center center",
          transform: `scale(${scale})`,
        }}
      >
        {activePage && (
          <>
            {/* 1. Base Paper Texture Background */}
            <PaperTexture 
              config={config.paper} 
              textures={activePage.textures} 
              seed={activePage.seed} 
              isBackground={true} 
              anchorX={config.focus.anchorX}
              anchorY={config.focus.anchorY}
            />

            {/* 2. Moving Newspaper Content */}
            <NewspaperPage
              key={activePage.id}
              page={activePage}
              typography={dynamicTypography}
              focus={config.focus}
              compositionWidth={width}
              compositionHeight={height}
            />

            {/* 3. Stable Focus Band (now strictly matching the page typography) */}
            <FocusLine
              config={activePage.focusLine}
              typography={dynamicTypography}
              focus={config.focus}
              pageTransform={activePage.transform}
              compositionWidth={width}
              compositionHeight={height}
              seed={activePage.seed} 
            />

            {/* 4. Global Paper Grain Overlay (to blend the focus band with the paper) */}
            <PaperTexture 
              config={config.paper} 
              textures={activePage.textures} 
              seed={activePage.seed} 
              isBackground={false} 
              anchorX={config.focus.anchorX}
              anchorY={config.focus.anchorY}
            />
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
