import React from "react";
import { Img, staticFile, spring, interpolate, delayRender, continueRender } from "remotion";

export interface ImageConfig {
  src?: string;
  heightPercent?: number; // default 0.75 for hero area
  marginTop?: number;
  marginSide?: number;
  marginBottom?: number;
  borderRadius?: number;
  showShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  entranceDelay?: number;
}

export interface ImageBlockProps {
  imgConfig: ImageConfig;
  compWidth: number;
  compHeight: number;
  frame: number;
  fps: number;
  textLength?: number;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({
  imgConfig,
  compWidth,
  compHeight,
  frame,
  fps,
  textLength,
}) => {
  const imgPath = imgConfig.src ?? "";
  const imgSrc =
    imgPath.startsWith("http://") ||
    imgPath.startsWith("https://") ||
    imgPath.startsWith("data:") ||
    imgPath.startsWith("/")
      ? imgPath
      : staticFile(imgPath);

  // ── Dynamic Image Dimensions Hooks ──
  const [imgDims, setImgDims] = React.useState<{ w: number; h: number } | null>(null);
  const [handle] = React.useState(() => delayRender("Loading DynamicShowcase image"));

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

  // ── layout parameters ──
  const marginSide = imgConfig.marginSide ?? 60;
  const marginBottom = imgConfig.marginBottom ?? 80;
  const marginTop = imgConfig.marginTop ?? 80;
  const imgRatio = imgDims.w / imgDims.h;

  // ── Layout 1: Hero State (Large, Bottom-Attached) ──
  const heroMaxWidth = compWidth - marginSide * 2;
  const heroMaxHeight = compHeight - marginBottom - marginTop;
  
  let heroWidth = heroMaxWidth;
  let heroHeight = heroMaxWidth / imgRatio;
  
  // Don't let it overflow the top
  if (heroHeight > heroMaxHeight) {
    heroHeight = heroMaxHeight;
    heroWidth = heroHeight * imgRatio;
  }
  
  const heroLeft = (compWidth - heroWidth) / 2;
  const heroTop = compHeight - heroHeight - marginBottom;

  // ── Layout 2: Final State (Bottom-attached, making room for text) ──
  // Estimate text space needed
  const chars = textLength && textLength > 0 ? textLength : 40;
  // A rough estimation: 72px font size, ~15 chars per line. 
  const lines = Math.ceil(chars / 15);
  const textSpace = marginTop + (lines * 110) + 40; // marginTop + text height + padding
  
  const finalMaxHeight = compHeight - marginBottom - textSpace;
  
  let finalWidth = heroMaxWidth;
  let finalHeight = heroMaxWidth / imgRatio;
  
  // "only decsrease the size of the image if text is more like for adjustsment"
  if (finalHeight > finalMaxHeight) {
    finalHeight = Math.max(finalMaxHeight, compHeight * 0.3); // minimum height
    finalWidth = finalHeight * imgRatio;
  }
  
  const finalLeft = (compWidth - finalWidth) / 2;
  const finalTop = compHeight - finalHeight - marginBottom;

  // ── Transition Springs ──
  // Transition triggers at 2 seconds (frame 120 at 60fps, or 2 * fps)
  const startFrameTransition = 2 * fps;
  const transitionSpring = spring({
    frame: Math.max(0, frame - startFrameTransition),
    fps,
    config: { damping: 16, stiffness: 75, mass: 0.85 },
  });

  // Interpolate position and size dynamically (guarantees perfect aspect ratio mapping)
  const renderWidth = interpolate(transitionSpring, [0, 1], [heroWidth, finalWidth]);
  const renderHeight = interpolate(transitionSpring, [0, 1], [heroHeight, finalHeight]);
  const baseLeft = interpolate(transitionSpring, [0, 1], [heroLeft, finalLeft]);
  const baseTop = interpolate(transitionSpring, [0, 1], [heroTop, finalTop]);

  // ── Phase 1: Entrance Spring (sliding up from bottom at starting frame) ──
  const imgDelay = imgConfig.entranceDelay ?? 0;
  const entranceSpring = spring({
    frame: Math.max(0, frame - imgDelay),
    fps,
    config: { damping: 18, stiffness: 95, mass: 0.8 },
  });

  const entranceY = interpolate(entranceSpring, [0, 1], [compHeight, 0]);
  const entranceScale = interpolate(entranceSpring, [0, 1], [0.8, 1]);

  const imgLeft = baseLeft;
  const imgTop = baseTop + entranceY;
  const imgScale = entranceScale;

  // Render container styles
  const borderRadius = imgConfig.borderRadius ?? 24;
  const shadowBlur = imgConfig.shadowBlur ?? 60;
  const shadowColor = imgConfig.shadowColor ?? "rgba(15, 23, 42, 0.15)";
  const showShadow = imgConfig.showShadow ?? true;

  return (
    <>
      {/* Image Shadow Layer */}
      {showShadow && imgPath && (
        <div
          style={{
            position: "absolute",
            top: imgTop + 15,
            left: imgLeft + 15,
            width: renderWidth - 30,
            height: renderHeight - 30,
            borderRadius: borderRadius,
            background: shadowColor,
            filter: `blur(${shadowBlur}px)`,
            transform: `scale(${imgScale})`,
            transformOrigin: "center center",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Main Image Layer */}
      {imgPath && (
        <Img
          src={imgSrc}
          style={{
            position: "absolute",
            top: imgTop,
            left: imgLeft,
            width: renderWidth,
            height: renderHeight,
            borderRadius: borderRadius,
            objectFit: "cover", // Covers the bounding box seamlessly
            transform: `scale(${imgScale})`,
            transformOrigin: "center center",
            zIndex: 2,
          }}
        />
      )}
    </>
  );
};
