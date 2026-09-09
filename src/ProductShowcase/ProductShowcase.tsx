import React from "react";
import { AbsoluteFill, Img, Video, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { loadEBGaramond } from "../utils/localFonts";
import config from "./showcase-config.json";

const { fontFamily: ebGaramond } = loadEBGaramond("normal", {
  weights: ["400"],
});

interface PointConfig {
  title: string;
  description?: string;
  image?: string;
  video?: string;
  durationSeconds?: number;
}

const pointsTyped = config.points as PointConfig[];

// Calculate point coordinates and durations dynamically based on the JSON configuration
const totalPoints = pointsTyped.length;

// Dynamically scale layout sizes based on totalPoints (N) to prevent overlaps and keep proportions clean
const t = Math.max(0, Math.min(1, (totalPoints - 4) / 41));

const titleFontSize = Math.round(38 * (1 - t) + 12 * t);
const descFontSize = Math.round(24 * (1 - t) + 9 * t);
const mediaMaxSize = Math.round(280 * (1 - t) + 70 * t);
const containerWidth = Math.round(240 * (1 - t) + 80 * t);
const containerHalfWidth = containerWidth / 2;

const layoutScale = 1.0;
const mediaMargin = 12;
const CENTER_IMAGE_SIZE = 385;

// Zoom transition speeds hardcoded to ensure consistency and prevent distortion
const ZOOM_IN_DURATION_SECONDS = 1.5;
const ZOOM_OUT_DURATION_SECONDS = 0.67;
const DEFAULT_HOLD_DURATION_SECONDS = 1.33;

export const getProductShowcaseDuration = () => {
  const fps = config.fps || 24;
  const introDurationSeconds = config.introDurationSeconds ?? 2.0;
  const finalBufferSeconds = config.finalBufferSeconds ?? 3.0;
  const points = config.points as any[];
  
  let totalSeconds = introDurationSeconds;
  
  points.forEach(p => {
    const hold = p.durationSeconds ?? DEFAULT_HOLD_DURATION_SECONDS;
    totalSeconds += ZOOM_IN_DURATION_SECONDS + hold + ZOOM_OUT_DURATION_SECONDS;
  });
  
  totalSeconds += finalBufferSeconds;
  
  return Math.ceil(totalSeconds * fps);
};

export const ProductShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introDurationSeconds = config.introDurationSeconds ?? 2.0;
  
  const introDurationFrames = Math.round(introDurationSeconds * fps);
  const zoomInFrames = Math.round(ZOOM_IN_DURATION_SECONDS * fps);
  const zoomOutFrames = Math.round(ZOOM_OUT_DURATION_SECONDS * fps);

  // Calculate points dynamically with explicit branch timings
  const POINTS = React.useMemo(() => {
    let currentStartFrame = introDurationFrames;

    return pointsTyped.map((rawP: any, i) => {
      const p = { ...rawP };
      
      const holdSecs = Math.max(p.durationSeconds ?? DEFAULT_HOLD_DURATION_SECONDS, 0.5); // minimum 0.5s read time
      
      const startAngle = -Math.PI / 2;
      const angle = startAngle + i * (2 * Math.PI / totalPoints);
      
      const RxArrow = Math.round(360 * (1 - t) + 400 * t);
      const RyArrow = Math.round(660 * (1 - t) + 750 * t);
      
      const centerImageRadius = CENTER_IMAGE_SIZE / 2;
      const MIN_ARROW_DISTANCE_FROM_CENTER = centerImageRadius * 3;
      
      const targetArrowX = RxArrow * Math.cos(angle);
      const targetArrowY = RyArrow * Math.sin(angle);
      const targetArrowDist = Math.sqrt(targetArrowX * targetArrowX + targetArrowY * targetArrowY);
      
      let arrowEndX = 540 + targetArrowX;
      let arrowEndY = 960 + targetArrowY;
      if (targetArrowDist < MIN_ARROW_DISTANCE_FROM_CENTER && targetArrowDist > 0.001) {
        const factor = MIN_ARROW_DISTANCE_FROM_CENTER / targetArrowDist;
        arrowEndX = 540 + targetArrowX * factor;
        arrowEndY = 960 + targetArrowY * factor;
      }
      
      const W = containerHalfWidth;
      const displayTitle = config.showNumbers ? `${i + 1}. ${p.title || ""}` : (p.title || "");
      const titleLines = Math.max(1, Math.ceil((displayTitle.length * titleFontSize * 0.45) / containerWidth));
      const titleHeight = titleLines * titleFontSize * 1.25;
      
      let descHeight = 0;
      if (p.description) {
        const descLines = Math.max(1, Math.ceil((p.description.length * descFontSize * 0.45) / containerWidth));
        descHeight = descLines * descFontSize * 1.35 + 6 * layoutScale;
      }
      const textHeight = titleHeight + descHeight;
      const H = textHeight / 2;
      const gap = 20;
      
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const absCos = Math.abs(cosA);
      const absSin = Math.abs(sinA);
      
      const dBox = Math.min(
        absCos > 0.0001 ? W / absCos : Infinity,
        absSin > 0.0001 ? H / absSin : Infinity
      );
      
      const D = dBox + gap;
      const textX = arrowEndX + D * cosA;
      const textY = arrowEndY + D * sinA;
      
      const holdDuration = Math.round(holdSecs * fps);
      const startFrame = currentStartFrame;
      const endFrame = startFrame + zoomInFrames + holdDuration + zoomOutFrames;
      
      currentStartFrame = endFrame;
      
      return {
        ...p,
        angle,
        textX,
        textY,
        textHeight,
        H,
        x: arrowEndX,
        y: arrowEndY,
        arrowEndX,
        arrowEndY,
        startFrame,
        zoomInDuration: zoomInFrames,
        holdDuration,
        zoomOutDuration: zoomOutFrames,
        endFrame,
      };
    });
  }, [fps, introDurationFrames, zoomInFrames, zoomOutFrames]);

  // ─── Stage 1: Subject Image Entrance (during intro phase) ───
  const entryStartFrame = 5;
  const entrySpring = spring({
    frame: frame - entryStartFrame,
    fps,
    config: { damping: 18, stiffness: 95, mass: 1.1 },
  });
  const springProgress = frame < entryStartFrame ? 0 : (entrySpring > 0.995 ? 1 : entrySpring);

  // Center image initial slide and scale
  const initialY = interpolate(springProgress, [0, 1], [-1200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const initialScale = interpolate(springProgress, [0, 1], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const initialRotate = interpolate(springProgress, [0, 1], [-18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const initialOpacity = interpolate(springProgress, [0, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dynamically compute maxZoom based on density to keep text clear and isolate active items
  const maxZoom = interpolate(totalPoints, [4, 45], [2.4, 3.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ─── Compile bounding box to dynamically scale down (zoom out) the scene if elements are out of bounds ───
  const minX = Math.min(...POINTS.map(p => {
    let xMin = Math.min(p.arrowEndX, p.textX - containerHalfWidth);
    if (p.image || p.video) {
      xMin = Math.min(xMin, p.textX - mediaMaxSize / 2);
    }
    return xMin;
  }));
  const maxX = Math.max(...POINTS.map(p => {
    let xMax = Math.max(p.arrowEndX, p.textX + containerHalfWidth);
    if (p.image || p.video) {
      xMax = Math.max(xMax, p.textX + mediaMaxSize / 2);
    }
    return xMax;
  }));
  const minY = Math.min(...POINTS.map(p => {
    let yMin = Math.min(p.arrowEndY, p.textY - p.H);
    if (p.image || p.video) {
      if (p.textY < 960) {
        yMin = Math.min(yMin, p.textY - p.H - mediaMaxSize - mediaMargin);
      }
    }
    return yMin;
  }));
  const maxY = Math.max(...POINTS.map(p => {
    let yMax = Math.max(p.arrowEndY, p.textY + p.H);
    if (p.image || p.video) {
      if (p.textY >= 960) {
        yMax = Math.max(yMax, p.textY + p.H + mediaMargin + mediaMaxSize);
      }
    }
    return yMax;
  }));
  
  const marginX = 60;
  const marginY = 80;
  const scaleX = (1080 - 2 * marginX) / (maxX - minX);
  const scaleY = (1920 - 2 * marginY) / (maxY - minY);
  const baseScale = Math.min(1.0, scaleX, scaleY);

  // ─── Camera Panning & Zooming Engine ───
  let cameraScale = baseScale;
  let cameraTx = 0;
  let cameraTy = 0;

  if (frame >= introDurationFrames) {
    let activePointFound = false;
    for (let i = 0; i < POINTS.length; i++) {
      const p = POINTS[i];
      if (frame >= p.startFrame && frame < p.endFrame) {
        activePointFound = true;
        const elapsed = frame - p.startFrame;
        const zoomEase = Easing.bezier(0.8, 0, 0.4, 0.15); // slow start, fast dive
        
        // Zoom midpoint to keep both the arrowhead and the text container centered
        const targetX = (p.arrowEndX + p.textX) / 2;
        const targetY = (p.arrowEndY + p.textY) / 2;
        
        if (elapsed < p.zoomInDuration) {
          // Zooming in from baseScale to maxZoom
          const progress = interpolate(elapsed, [0, p.zoomInDuration], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: zoomEase,
          });
          cameraScale = interpolate(progress, [0, 1], [baseScale, maxZoom]);
          cameraTx = cameraScale * (540 - targetX) * progress;
          cameraTy = cameraScale * (960 - targetY) * progress;
        } else if (elapsed < p.zoomInDuration + p.holdDuration) {
          // Holding zoom
          cameraScale = maxZoom;
          cameraTx = cameraScale * (540 - targetX);
          cameraTy = cameraScale * (960 - targetY);
        } else {
          // Zooming out from maxZoom back to baseScale
          const progress = interpolate(elapsed, [p.zoomInDuration + p.holdDuration, p.zoomInDuration + p.holdDuration + p.zoomOutDuration], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.25, 1, 0.5, 1),
          });
          cameraScale = interpolate(progress, [0, 1], [baseScale, maxZoom]);
          cameraTx = cameraScale * (540 - targetX) * progress;
          cameraTy = cameraScale * (960 - targetY) * progress;
        }
        break;
      }
    }
    
    // Default fallback (camera at baseScale, centered) if we are in the final buffer
    if (!activePointFound) {
      cameraScale = baseScale;
      cameraTx = 0;
      cameraTy = 0;
    }
  }

  // Subject scale stays constant after landing
  const finalAppleScale = initialScale;

  // Floor Shadow opacity calculation (fades in on landing, fades out when camera zooms in)
  const baseShadowOpacity = interpolate(springProgress, [0.35, 1], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shadowZoomFade = interpolate(cameraScale, [baseScale, maxZoom], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shadowOpacity = baseShadowOpacity * shadowZoomFade;

  const shadowScale = interpolate(springProgress, [0.35, 1], [0.15, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle floating idle motion for the central image (starts after settling)
  const floatY = frame >= introDurationFrames ? Math.sin((frame - introDurationFrames) * 0.04) * 8 : 0;

  // ─── Compile Active & Past Point Data (allows cumulative display) ───
  const activePointData = POINTS.map((p) => {
    // Position the arrow end at the target point
    const arrowEndX = p.arrowEndX;
    const arrowEndY = p.arrowEndY;
    
    // Bezier control points for a smooth, hand-drawn organic curve
    const P0 = { x: 540, y: 960 };
    const P3 = { x: arrowEndX, y: arrowEndY };
    
    // P2 is along the radial angle so the arrow ends pointing directly at the text
    const P2 = {
      x: arrowEndX - 100 * Math.cos(p.angle) * layoutScale,
      y: arrowEndY - 100 * Math.sin(p.angle) * layoutScale,
    };
    
    const isLeft = arrowEndX < 540;
    // P1 adds a nice hand-drawn vertical and horizontal bend
    const P1 = {
      x: (P0.x + P3.x) / 2 + (isLeft ? -120 : 120) * layoutScale,
      y: (P0.y + P3.y) / 2 - 80 * layoutScale,
    };
    
    const arrowPath = `M 540,960 C ${P1.x},${P1.y} ${P2.x},${P2.y} ${arrowEndX},${arrowEndY}`;

    // Progressive drawing animation: drawProgress goes from 0 (at center) to 1 (at tip)
    let drawProgress = 0;
    const drawStartFrame = p.startFrame + Math.round(0.5 * fps);
    const drawEndFrame = p.startFrame + Math.round(1.83 * fps);
    if (frame >= drawStartFrame) {
      drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 1, 0.4, 1),
      });
    }

    // Dashed line progressive drawing (mask stroke offset)
    const lineDrawProgress = (1 - drawProgress) * 1000;

    // Text opacity & blur reveal transitions
    let textOpacity = 0;
    let textBlur = 12;
    const textStartFrame = p.startFrame + Math.round(1.17 * fps);
    const textEndFrame = p.startFrame + Math.round(2.17 * fps);
    if (frame >= textStartFrame) {
      textOpacity = interpolate(frame, [textStartFrame, textEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      textBlur = interpolate(frame, [textStartFrame, textEndFrame], [12, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }

    return {
      ...p,
      arrowPath,
      lineDrawProgress,
      textOpacity,
      textBlur,
    };
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle, #ffffff 0%, #ececec 100%)",
        overflow: "hidden",
      }}
    >
      {/* Dynamic Background Image Layer */}
      {config.backgroundImage && (
        <AbsoluteFill style={{ opacity: 0.12, pointerEvents: "none" }}>
          <Img
            src={staticFile(config.backgroundImage)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      )}

      {/* Cinematic Camera Viewport Container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transform: `translate(${cameraTx}px, ${cameraTy}px) scale(${cameraScale})`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* 3D Floor Shadow */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: (CENTER_IMAGE_SIZE * 0.65) * layoutScale,
              height: 25 * layoutScale,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 75%)",
              opacity: shadowOpacity,
              transform: `scale(${shadowScale}) translateY(${(CENTER_IMAGE_SIZE / 2) * layoutScale}px)`,
              filter: "blur(5px)",
            }}
          />
        </div>

        {/* SVG overlay for the active animated dashed connector line and arrowhead (zIndex: 1 - Below Apple) */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
          viewBox="0 0 1080 1920"
        >
          {activePointData.map((p, i) => {
            // Render only after its drawing start frame has been reached
            if (frame < p.startFrame + Math.round(0.5 * fps)) return null;
            const maskId = `dash-line-mask-${i}`;
            return (
              <React.Fragment key={i}>
                <defs>
                  <mask id={maskId}>
                    <path
                      d={p.arrowPath}
                      fill="none"
                      stroke="white"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray="1000"
                      strokeDashoffset={p.lineDrawProgress}
                    />
                  </mask>
                </defs>

                {/* Curved dashed line */}
                <path
                  d={p.arrowPath}
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.75)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10, 10"
                  mask={`url(#${maskId})`}
                />
              </React.Fragment>
            );
          })}
        </svg>

        {/* Central Subject Image Container (zIndex: 2 - Above SVG Arrow Overlay) */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            left: 540,
            top: 960,
            transform: `translate(-50%, -50%) translateY(${initialY + floatY}px) scale(${finalAppleScale}) rotate(${initialRotate}deg)`,
            transformOrigin: "center center",
            zIndex: 2,
            opacity: initialOpacity,
          }}
        >
          {config.centerImage && (
            <Img
              src={staticFile(config.centerImage)}
              style={{
                width: CENTER_IMAGE_SIZE,
                height: CENTER_IMAGE_SIZE,
                objectFit: "contain",
                filter: "drop-shadow(0px 20px 25px rgba(0, 0, 0, 0.12))",
              }}
            />
          )}
        </div>

        {/* Dynamic Detail cards containing Text & Optional Media (zIndex: 3 - Above everything) */}
        {activePointData.map((p, i) => {
          // Render only after its text reveal start frame has been reached
          if (frame < p.startFrame + Math.round(1.17 * fps)) return null;
          const displayTitle = config.showNumbers ? `${i + 1}. ${p.title || ""}` : (p.title || "");
          
          const isUpper = p.textY < 960;
          const mediaTop = isUpper 
            ? p.textY - p.H * layoutScale - mediaMaxSize * layoutScale - mediaMargin * layoutScale
            : p.textY + p.H * layoutScale + mediaMargin * layoutScale;
            
          return (
            <React.Fragment key={i}>
              {/* Separate Media Container (Image/Video) positioned dynamically above or below the text */}
              {(p.image || p.video) && (
                <div
                  style={{
                    position: "absolute",
                    left: p.textX - (mediaMaxSize / 2) * layoutScale,
                    top: mediaTop,
                    width: mediaMaxSize * layoutScale,
                    height: mediaMaxSize * layoutScale,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: p.textOpacity,
                    filter: `blur(${p.textBlur}px)`,
                    zIndex: 3,
                  }}
                >
                  {p.image && (
                    <Img
                      src={staticFile(p.image)}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        borderRadius: 12 * layoutScale,
                        filter: "drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.08))",
                      }}
                    />
                  )}
                  {p.video && (
                    <Video
                      src={staticFile(p.video)}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        borderRadius: 12 * layoutScale,
                        filter: "drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.08))",
                        objectFit: "contain",
                      }}
                      volume={0}
                    />
                  )}
                </div>
              )}

              {/* Text Container centered exactly at p.textX, p.textY */}
              <div
                style={{
                  position: "absolute",
                  left: p.textX - containerHalfWidth * layoutScale,
                  top: p.textY - p.H * layoutScale,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  opacity: p.textOpacity,
                  filter: `blur(${p.textBlur}px)`,
                  zIndex: 3,
                  width: containerWidth * layoutScale,
                  height: p.textHeight * layoutScale,
                }}
              >
                {/* Title Text */}
                <span
                  style={{
                    fontFamily: ebGaramond,
                    fontSize: titleFontSize,
                    fontStyle: "italic",
                    color: "rgba(0, 0, 0, 0.75)",
                    display: "block",
                    width: "100%",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    lineHeight: 1.25,
                  }}
                >
                  {displayTitle}
                </span>

                {/* Description Text */}
                {p.description && (
                  <span
                    style={{
                      fontFamily: "Inter",
                      fontSize: descFontSize,
                      fontWeight: 400,
                      color: "rgba(0, 0, 0, 0.45)",
                      marginTop: 6 * layoutScale,
                      maxWidth: 220 * layoutScale,
                      lineHeight: 1.35,
                    }}
                  >
                    {p.description}
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default ProductShowcase;
