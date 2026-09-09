import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Easing,
  Sequence,
} from "remotion";
import { SmartTextView } from "../component/SmartTextView/SmartTextView";
import { StateOverlayMap } from "../maps/SingleMap/StateOverlayMap";
import { CoreLineGraph } from "../graphs/LineGraph/CoreLineGraph";
import { CorePieChart } from "../graphs/PieChart/CorePieChart";
import { CoreBarGraph } from "../graphs/BarGraph/CoreBarGraph";
import { SocialMediaCard } from "../SocialMediaEmbed/SocialMediaCard";
import socialEmbedConfig from "../SocialMediaEmbed/social-embed.json";
import { ProductReveal } from "../component/ProductReveal/ProductReveal";

// ============================================
// REUSABLE PORTRAIT COMPONENT
// ============================================
const ModiPortrait: React.FC<{ text: string; scale: number; blur?: number }> = ({ text, scale, blur = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageScale = interpolate(frame, [0, 300], [1.22, 1.32], { extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  const circleScale = spring({ frame, fps, config: { damping: 15, mass: 0.6, stiffness: 90 } });
  const textOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textTranslateY = interpolate(frame, [20, 45], [25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.5)) });
  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.95, 1.05]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${scale})`, transformOrigin: "top center", filter: `blur(${Math.max(0, blur)}px)`, width: 1080, willChange: "transform, filter" }}>
      <div style={{ position: "relative", width: 600, height: 600, transform: `scale(${circleScale})` }}>
        <div style={{ position: "absolute", inset: -15, borderRadius: "50%", background: "radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(30, 58, 138, 0) 70%)", transform: `scale(${glowPulse})`, filter: "blur(20px)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: -100, right: -100, maskImage: "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)", WebkitMaskImage: "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)", zIndex: 1 }}>
          <div style={{ width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, #1e3a8a 0%, #0f172a 100%)", boxShadow: "0 30px 60px -15px rgba(15, 23, 42, 0.35), 0 0 50px -10px rgba(56, 189, 248, 0.45), inset 0 0 25px rgba(0, 0, 0, 0.6)", overflow: "hidden", position: "absolute", top: 0, left: 100, boxSizing: "border-box" }}>
            <Img src={staticFile("modi.png")} style={{ position: "absolute", bottom: 10, left: 0, width: "100%", height: "auto", transform: `scale(${imageScale})`, transformOrigin: "bottom center" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 100, width: 600, height: 600, borderRadius: "50%", border: "10px solid #1e40af", boxSizing: "border-box" }} />
          <div style={{ position: "absolute", top: 0, left: 100, width: 600, height: 600, borderRadius: "50%", border: "10px solid rgba(255, 255, 255, 0.15)", boxSizing: "border-box" }} />
        </div>
        <div style={{ position: "absolute", top: -400, left: -200, width: 1000, height: 1000, clipPath: "inset(0px 0px 450px 0px)", zIndex: 4 }}>
          <Img src={staticFile("modi.png")} style={{ position: "absolute", bottom: 10, left: 200, width: 600, height: "auto", transform: `scale(${imageScale})`, transformOrigin: "bottom center" }} />
        </div>
      </div>
      <div style={{ opacity: textOpacity, transform: `translateY(${textTranslateY}px)`, backgroundImage: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #0369a1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900, fontSize: 76, textTransform: "uppercase", letterSpacing: "8px", marginTop: -45, zIndex: 6, filter: "drop-shadow(0 4px 12px rgba(14, 165, 233, 0.15))" }}>
        {text}
      </div>
    </div>
  );
};


// ============================================
// MAIN ANIMATION COMPONENT
// ============================================
export const AppleAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;
  const smoothDecel = Easing.bezier(0.25, 1, 0.5, 1);

  // -- Phases 2 to 4 --
  const panStartFrame = 450;
  const panEndFrame = 530; 
  const cameraPanProgress = interpolate(frame, [panStartFrame, panEndFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });

  const panStartFrame2 = 700;
  const panEndFrame2 = 780;
  const cameraPanProgress2 = interpolate(frame, [panStartFrame2, panEndFrame2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });

  const p4Start = 1100;
  const camPanRight = interpolate(frame, [p4Start, p4Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  
  const canvasX = 6000;
  const bossX = canvasX;
  const bossY = cy - 400; 
  const subLeftX = bossX - 800;
  const subLeftY = bossY + 1000;
  const subRightX = bossX + 800;
  const subRightY = bossY + 1000;
  
  const drawLeftStart = 1200;
  const focusBackStart = 1300;
  const drawRightStart = 1380;
  const zoomOutStart = 1500;

  const p4Pan1 = interpolate(frame, [drawLeftStart, drawLeftStart + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const p4PanBack = interpolate(frame, [focusBackStart, focusBackStart + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const p4Pan2 = interpolate(frame, [drawRightStart, drawRightStart + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const p4Zoom = interpolate(frame, [zoomOutStart, zoomOutStart + 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });

  // -- Phase 5 --
  const p5Start = 1600;
  const camPanRight2 = interpolate(frame, [p5Start, p5Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const canvasX_5 = 11000;
  const tCamX_P5 = cx - canvasX_5;

  // -- Phase 6 (New) --
  const p6Start = 2260; // Camera pans to Canvas 6
  const camPanRight3 = interpolate(frame, [p6Start, p6Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const canvasX_6 = 16000;
  const tCamX_P6 = cx - canvasX_6;

  // -- Phase 7 (New Canvas for Modi) --
  const p7Start = 2820;
  const camPanRight4 = interpolate(frame, [p7Start, p7Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const canvasX_7 = 21000;
  const tCamX_P7 = cx - canvasX_7;

  // -- Phase 8 (Social Media Embed) --
  const p8Start = 3400;
  const camPanRight5 = interpolate(frame, [p8Start, p8Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const canvasX_8 = 26000;
  const tCamX_P8 = cx - canvasX_8;

  // -- Phase 9 (Product Reveal / Modi Card) --
  const p9Start = 4000;
  const camPanRight6 = interpolate(frame, [p9Start, p9Start + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const canvasX_9 = 31000;
  const tCamX_P9 = cx - canvasX_9;

  // Camera Composition
  const baseCamX = interpolate(camPanRight6, [0, 1], [
    interpolate(camPanRight5, [0, 1], [
      interpolate(camPanRight4, [0, 1], [
        interpolate(camPanRight3, [0, 1], [
          interpolate(camPanRight2, [0, 1], [
            interpolate(camPanRight, [0, 1], [
              interpolate(cameraPanProgress2, [0, 1], [
                interpolate(cameraPanProgress, [0, 1], [
                  0,
                  cx - (cx + 240 + 750 + 350)
                ]),
                cx - (cx + 240 + 750 + 450 + 500)
              ]), 
              cx - bossX
            ]),
            tCamX_P5
          ]),
          tCamX_P6
        ]),
        tCamX_P7
      ]),
      tCamX_P8
    ]),
    tCamX_P9
  ]);

  const baseCamY = interpolate(camPanRight2, [0, 1], [
    interpolate(camPanRight, [0, 1], [
      interpolate(cameraPanProgress2, [0, 1], [0, cy - (620 + 100 + 700 + 500)]), 
      cy - (bossY + 240)
    ]),
    0 
  ]);

  const p4OffsetsFade = interpolate(camPanRight2, [0, 1], [1, 0], { extrapolateRight: "clamp" });
  
  const offsetXL = interpolate(p4Pan1, [0, 1], [0, (cx - subLeftX) - (cx - bossX)]) - interpolate(p4PanBack, [0, 1], [0, (cx - subLeftX) - (cx - bossX)]);
  const offsetYL = interpolate(p4Pan1, [0, 1], [0, (cy - (subLeftY + 240)) - (cy - (bossY + 240))]) - interpolate(p4PanBack, [0, 1], [0, (cy - (subLeftY + 240)) - (cy - (bossY + 240))]);
  const offsetXR = interpolate(p4Pan2, [0, 1], [0, (cx - subRightX) - (cx - bossX)]);
  const offsetYR = interpolate(p4Pan2, [0, 1], [0, (cy - (subRightY + 240)) - (cy - (bossY + 240))]);
  const zoomOffsetX = interpolate(p4Zoom, [0, 1], [0, (cx - bossX) - (cx - subRightX)]);
  const zoomOffsetY = interpolate(p4Zoom, [0, 1], [0, (cy - (bossY + 1100)) - (cy - (subRightY + 240))]);

  const cameraX = baseCamX + (offsetXL + offsetXR + zoomOffsetX) * p4OffsetsFade;
  const cameraY = baseCamY + (offsetYL + offsetYR + zoomOffsetY) * p4OffsetsFade;

  // Zoom out to 0.85 in Phase 9 for full visibility of the hierarchical tree
  const cameraScale = interpolate(camPanRight6, [0, 1], [
    interpolate(camPanRight5, [0, 1], [
      interpolate(camPanRight4, [0, 1], [
        interpolate(camPanRight3, [0, 1], [
          interpolate(camPanRight2, [0, 1], [
            interpolate(p4Zoom, [0, 1], [1, 0.45], { extrapolateRight: "clamp" }),
            1
          ], { extrapolateRight: "clamp" }),
          1
        ], { extrapolateRight: "clamp" }),
        1
      ], { extrapolateRight: "clamp" }),
      1
    ], { extrapolateRight: "clamp" }),
    0.85
  ], { extrapolateRight: "clamp" });


  // ============================================
  // PREVIOUS PHASES MATH (1-4)
  // ============================================
  const componentScale = 0.8;
  const portraitTop = interpolate(frame, [180, 240], [708, 380], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const circleCenterY = portraitTop + (300 * componentScale);

  const startY1 = circleCenterY;
  const endY1 = 1460;
  const pathD1 = `M ${cx} ${startY1} C ${cx - 60} ${startY1 + 250}, ${cx + 60} ${endY1 - 250}, ${cx} ${endY1}`;
  const pathLength1 = endY1 - startY1 + 200;
  const drawProgress1 = interpolate(frame, [180, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const strokeDashoffset1 = interpolate(drawProgress1, [0, 1], [pathLength1, 0]);

  const startX2 = cx + 240; const startY2 = 620; const endX2 = startX2 + 750; const endY2 = 800; 
  const pathD2 = `M ${startX2} ${startY2} C ${startX2 + 300} ${startY2}, ${endX2 - 300} ${endY2}, ${endX2} ${endY2}`;
  const pathLength2 = endX2 - startX2 + Math.abs(endY2 - startY2) + 100;
  const drawProgress2 = interpolate(frame, [panStartFrame, panEndFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const strokeDashoffset2 = interpolate(drawProgress2, [0, 1], [pathLength2, 0]);

  const startX3 = endX2 + 450; const startY3 = endY2 + 100; const endX3 = startX3 + 500; const endY3 = startY3 + 700; 
  const pathD3 = `M ${startX3} ${startY3} C ${startX3} ${startY3 + 300}, ${endX3} ${endY3 - 300}, ${endX3} ${endY3}`;
  const pathLength3 = Math.abs(endX3 - startX3) + Math.abs(endY3 - startY3) + 200;
  const drawProgress3 = interpolate(frame, [panStartFrame2, panEndFrame2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const strokeDashoffset3 = interpolate(drawProgress3, [0, 1], [pathLength3, 0]);

  const bCenterY = bossY + 240;
  const pathDL = `M ${bossX - 180} ${bCenterY + 120} C ${bossX - 400} ${bCenterY + 400}, ${subLeftX + 100} ${subLeftY - 200}, ${subLeftX} ${subLeftY + 200}`;
  const pathLengthL = 1600; 
  const drawProgL = interpolate(frame, [drawLeftStart, drawLeftStart + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const strokeOffL = interpolate(drawProgL, [0, 1], [pathLengthL, 0]);

  const pathDR = `M ${bossX + 180} ${bCenterY + 120} C ${bossX + 400} ${bCenterY + 400}, ${subRightX - 100} ${subRightY - 200}, ${subRightX} ${subRightY + 200}`;
  const pathLengthR = 1600;
  const drawProgR = interpolate(frame, [drawRightStart, drawRightStart + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const strokeOffR = interpolate(drawProgR, [0, 1], [pathLengthR, 0]);

  const maxBlur = 12;
  const bossBlur = interpolate(p4Pan1, [0, 1], [0, maxBlur]) - interpolate(p4PanBack, [0, 1], [0, maxBlur]) + interpolate(p4Pan2, [0, 1], [0, maxBlur]) - interpolate(p4Zoom, [0, 1], [0, maxBlur]);
  const subLeftBlur = interpolate(p4Pan1, [0, 1], [maxBlur, 0]) + interpolate(p4PanBack, [0, 1], [0, maxBlur]) - interpolate(p4Zoom, [0, 1], [0, maxBlur]);
  const subRightBlur = interpolate(p4Pan2, [0, 1], [maxBlur, 0]) - interpolate(p4Zoom, [0, 1], [0, maxBlur]);


  // ============================================
  // PHASE 5: GRAPH MATH
  // ============================================
  const p5GraphHoldEnd = 1780;
  const p5GraphSlideUp = interpolate(frame, [p5GraphHoldEnd, p5GraphHoldEnd + 40], [0, -400], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const p5ClearOut = interpolate(frame, [1900, 1960], [0, -2500], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  
  const graphY = cy - 300 + p5GraphSlideUp + p5ClearOut;
  const textY = graphY + 600 + 100;

  // ============================================
  // PHASE 6: PIE, CANVAS 6, BAR MATH
  // ============================================
  // 1. Tank image from P5 slides up
  const p6TankSlideUp = interpolate(frame, [2040, 2100], [0, -800], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const tankY = interpolate(frame, [1960, 2040], [height + 800, cy], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel }) + p6TankSlideUp;

  // STRICT BOUNDING BOXES FOR CANVAS 5
  const tankBottom = tankY + 300; // Tank image is roughly 600px tall
  const pieContainerTop = tankBottom + 50; // 50px safe gap
  const pieTextContainerTop = pieContainerTop + 900 + 50; // Pie is 900px tall

  // -- Canvas 6 Math --
  const c6TextContainerTop = 100; // Text 1: Top=100, Height=400, Bottom=500
  const c6TankRevealY = interpolate(frame, [2380, 2460], [height + 800, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel }); 
  const c6TankTop = c6TankRevealY - 300;
  const c6TankBottom = c6TankRevealY + 300;
  const c6BarContainerTop = c6TankBottom + 50; // 50px safe gap

  // Dashed line connects Text (bottom = 500) to Image (top = c6TankTop)
  const c6PathD = `M ${canvasX_6} 500 C ${canvasX_6 - 100} 550, ${canvasX_6 + 100} ${c6TankTop - 50}, ${canvasX_6} ${c6TankTop}`;
  const c6PathLength = 400;
  const c6PathDraw = interpolate(frame, [2460, 2500], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel });
  const c6PathOffset = interpolate(c6PathDraw, [0, 1], [c6PathLength, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(circle at 50% 50%, #ffffff 20%, #e2e8f0 70%, #cbd5e1 100%)",
        overflow: "hidden",
        fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      }}
    >
      {/* GLOBAL GRID BACKGROUND */}
      <div
        style={{
          position: "absolute",
          inset: -6000,
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.02) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          backgroundPosition: "center center",
          pointerEvents: "none",
          transform: `translate(${cameraX * 0.2}px, ${cameraY * 0.2}px) scale(${cameraScale})`, 
        }}
      />
      
      {/* CAMERA WRAPPER */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px)`,
          transformOrigin: "center center"
        }}
      >
        {/* ======================= PHASE 2-4 ELEMENTS ======================= */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1, maskImage: `linear-gradient(to bottom, black 0px, black ${endY1 - 40}px, transparent ${endY1}px)`, WebkitMaskImage: `linear-gradient(to bottom, black 0px, black ${endY1 - 40}px, transparent ${endY1}px)`, overflow: "visible" }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: 5000, height: 5000, overflow: "visible" }}>
            <defs>
              <mask id="drawMask1">
                <path d={pathD1} fill="none" stroke="white" strokeWidth="10" strokeDasharray={pathLength1} strokeDashoffset={strokeDashoffset1} strokeLinecap="round" />
              </mask>
            </defs>
            <path d={pathD1} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#drawMask1)" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, width: 5000, height: 5000, zIndex: 1, maskImage: `linear-gradient(to right, black 0px, black ${endX2 - 40}px, transparent ${endX2}px)`, WebkitMaskImage: `linear-gradient(to right, black 0px, black ${endX2 - 40}px, transparent ${endX2}px)`, overflow: "visible" }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <mask id="drawMask2">
                <path d={pathD2} fill="none" stroke="white" strokeWidth="10" strokeDasharray={pathLength2} strokeDashoffset={strokeDashoffset2} strokeLinecap="round" />
              </mask>
            </defs>
            <path d={pathD2} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#drawMask2)" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, width: 5000, height: 5000, zIndex: 1, maskImage: `linear-gradient(to bottom, black 0px, black ${endY3 - 40}px, transparent ${endY3}px)`, WebkitMaskImage: `linear-gradient(to bottom, black 0px, black ${endY3 - 40}px, transparent ${endY3}px)`, overflow: "visible" }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <mask id="drawMask3">
                <path d={pathD3} fill="none" stroke="white" strokeWidth="10" strokeDasharray={pathLength3} strokeDashoffset={strokeDashoffset3} strokeLinecap="round" />
              </mask>
            </defs>
            <path d={pathD3} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#drawMask3)" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ position: "absolute", left: 0, top: 0, width: 10000, height: 10000, zIndex: 1, overflow: "visible" }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <mask id="drawMaskL">
                <path d={pathDL} fill="none" stroke="white" strokeWidth="10" strokeDasharray={pathLengthL} strokeDashoffset={strokeOffL} strokeLinecap="round" />
              </mask>
              <mask id="drawMaskR">
                <path d={pathDR} fill="none" stroke="white" strokeWidth="10" strokeDasharray={pathLengthR} strokeDashoffset={strokeOffR} strokeLinecap="round" />
              </mask>
            </defs>
            <path d={pathDL} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#drawMaskL)" strokeLinecap="round" />
            <path d={pathDR} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#drawMaskR)" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ position: "absolute", top: portraitTop, left: cx - 540, zIndex: 2 }}>
          <Sequence from={0} layout="none">
             <ModiPortrait scale={componentScale} text="Black Paper" />
          </Sequence>
        </div>

        <AbsoluteFill style={{ top: 1350, left: 0, width: width, height: 400, zIndex: 3 }}>
          <Sequence from={240}>
            <SmartTextView isOverlay={true} />
          </Sequence>
        </AbsoluteFill>

        <AbsoluteFill style={{ top: endY2 - 200, left: endX2 - 100, width: 900, height: 400, zIndex: 3 }}>
          <Sequence from={panEndFrame}>
            <SmartTextView isOverlay={true} />
          </Sequence>
        </AbsoluteFill>

        <AbsoluteFill style={{ top: endY3 - 100, left: endX3 - 450, width: 900, height: 900, zIndex: 3 }}>
          <Sequence from={panEndFrame2}>
             <StateOverlayMap />
          </Sequence>
        </AbsoluteFill>

        <AbsoluteFill style={{ top: endY3 + 700, left: endX3 - 450, width: 900, height: 400, zIndex: 3 }}>
          <Sequence from={panEndFrame2 + 100}>
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 120, textAlign: "center" }}
              segments={[ { type: "text", value: "GUJARAT", style: "bold", color: "primary" } ] as any}
            />
          </Sequence>
        </AbsoluteFill>

        <div style={{ position: "absolute", top: bossY, left: bossX - 540, zIndex: 5 }}>
          <Sequence from={p4Start + 60} layout="none">
            <ModiPortrait scale={0.8} text="National Leader" blur={bossBlur} />
          </Sequence>
        </div>

        <div style={{ position: "absolute", top: subLeftY, left: subLeftX - 540, zIndex: 5 }}>
          <Sequence from={drawLeftStart + 40} layout="none">
            <ModiPortrait scale={0.7} text="Regional Head A" blur={subLeftBlur} />
          </Sequence>
        </div>

        <div style={{ position: "absolute", top: subRightY, left: subRightX - 540, zIndex: 5 }}>
          <Sequence from={drawRightStart + 40} layout="none">
            <ModiPortrait scale={0.7} text="Regional Head B" blur={subRightBlur} />
          </Sequence>
        </div>

        <AbsoluteFill style={{ top: subLeftY + 750, left: bossX - 450, width: 900, height: 400, zIndex: 3 }}>
          <Sequence from={zoomOutStart + 50}>
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 100, numberFontSize: 160 }}
              segments={[
                { type: "text", value: "NATIONAL ELECTION RESULTS", style: "bold", color: "slate", lineBreak: true },
                { type: "text", value: "SEATS WON", style: "normal", color: "slate", lineBreak: true },
                { type: "number", value: 300, prefix: "+", suffix: "", color: "emerald", animation: "countUp" }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>


        {/* ======================= PHASE 5 ELEMENTS ======================= */}
        <AbsoluteFill style={{ top: graphY, left: canvasX_5 - 450, width: 900, height: 600, zIndex: 5 }}>
          <Sequence from={p5Start + 60} layout="none">
             <CoreLineGraph />
          </Sequence>
        </AbsoluteFill>
        
        <AbsoluteFill style={{ top: textY, left: canvasX_5 - 450, width: 900, height: 400, zIndex: 5 }}>
          <Sequence from={p5GraphHoldEnd + 20} layout="none">
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 64, numberFontSize: 120, textAlign: "center" }}
              segments={[
                { type: "text", value: "STEADY ECONOMIC GROWTH", style: "bold", color: "slate", lineBreak: true },
                { type: "number", value: 45, prefix: "+", suffix: "%", color: "emerald", animation: "countUp" }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>


        {/* ======================= PHASE 6 ELEMENTS ======================= */}
        {/* 1. Tank Image */}
        <AbsoluteFill style={{ top: tankY, left: canvasX_5, width: 1080, height: 1920, transform: "translate(-50%, -50%)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6 }}>
          <Sequence from={1900} layout="none">
            <div style={{ width: "84%", borderRadius: 40, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.3)" }}>
              <Img src={staticFile("motion-graphic/tank.jpg")} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
          </Sequence>
        </AbsoluteFill>

        {/* 2. Core Pie Chart */}
        <AbsoluteFill style={{ top: pieContainerTop, left: canvasX_5 - 450, width: 900, height: 900, zIndex: 5 }}>
          <Sequence from={2100} layout="none">
             <CorePieChart />
          </Sequence>
        </AbsoluteFill>

        {/* 3. SmartTextView Below Pie */}
        <AbsoluteFill style={{ top: pieTextContainerTop, left: canvasX_5 - 450, width: 900, height: 400, zIndex: 5 }}>
          <Sequence from={2160} layout="none">
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 64, numberFontSize: 120, textAlign: "center" }}
              segments={[
                { type: "text", value: "RESOURCE ALLOCATION", style: "bold", color: "slate", lineBreak: true },
                { type: "number", value: 100, prefix: "", suffix: "%", color: "emerald", animation: "countUp" }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>

        {/* 4. Canvas 6 - Top Text */}
        <AbsoluteFill style={{ top: c6TextContainerTop, left: canvasX_6 - 450, width: 900, height: 400, zIndex: 5 }}>
          <Sequence from={2320} layout="none">
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 80, textAlign: "center" }}
              segments={[
                { type: "text", value: "INFRASTRUCTURE DEVELOPMENT", style: "bold", color: "slate", lineBreak: true }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>

        {/* 5. Canvas 6 - Dashed Line */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 20000, height: 10000, zIndex: 4, overflow: "visible" }}>
          <Sequence from={2460}>
            <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <mask id="c6Mask">
                  <path d={c6PathD} fill="none" stroke="white" strokeWidth="10" strokeDasharray={c6PathLength} strokeDashoffset={c6PathOffset} strokeLinecap="round" />
                </mask>
              </defs>
              <path d={c6PathD} fill="none" stroke="#475569" strokeWidth="4" strokeDasharray="14 14" mask="url(#c6Mask)" strokeLinecap="round" />
            </svg>
          </Sequence>
        </div>

        {/* 6. Canvas 6 - Second Image */}
        <AbsoluteFill style={{ top: c6TankRevealY, left: canvasX_6, width: 1080, height: 1920, transform: "translate(-50%, -50%)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6 }}>
          <Sequence from={2380} layout="none">
            <div style={{ width: "84%", borderRadius: 40, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.3)" }}>
              <Img src={staticFile("motion-graphic/tank.jpg")} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
          </Sequence>
        </AbsoluteFill>

        {/* 7. Canvas 6 - Bar Graph */}
        <AbsoluteFill style={{ top: c6BarContainerTop, left: canvasX_6 - 450, width: 900, height: 600, zIndex: 5 }}>
          <Sequence from={2520} layout="none">
             <CoreBarGraph />
          </Sequence>
        </AbsoluteFill>

        {/* ======================= PHASE 7 ELEMENTS (NEW) ======================= */}
        {/* Centered Modi Portrait with scale / fade-in animation */}
        <AbsoluteFill style={{ 
          top: cy - 250, 
          left: canvasX_7, 
          width: 1080, 
          height: 1920, 
          transform: "translate(-50%, -50%)", 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          zIndex: 6 
        }}>
          <Sequence from={2860} layout="none">
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: 400,
              height: 400,
              transform: `scale(${interpolate(frame, [2860, 2895], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothDecel })})`,
              opacity: interpolate(frame, [2860, 2885], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}>
              <Img src={staticFile("modi.png")} style={{
                width: "100%",
                height: "auto",
                objectFit: "contain"
              }} />
            </div>
          </Sequence>
        </AbsoluteFill>

        {/* SmartTextView Below Centered Modi */}
        <AbsoluteFill style={{ top: cy + 180, left: canvasX_7 - 450, width: 900, height: 400, zIndex: 5 }}>
          <Sequence from={2870} layout="none">
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 56, textAlign: "center" }}
              segments={[
                { type: "text", value: "VISIONARY LEADERSHIP", style: "bold", color: "blue", emphasis: "underline" },
                { type: "text", value: "SHAPING THE FUTURE", style: "bold", color: "primary", lineBreak: true },
                { type: "text", value: "OF A NEW INDIA", style: "italic-serif", color: "amber" }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>

        {/* ======================= PHASE 8 ELEMENTS (NEW) ======================= */}
        {/* Clean Social Media Card Overlay */}
        <AbsoluteFill style={{ top: 100, left: canvasX_8 - 400, width: 800, height: 750, zIndex: 5, overflow: "hidden", borderRadius: 16 }}>
          <Sequence from={3440} layout="none">
            <SocialMediaCard config={{
              ...(socialEmbedConfig as any),
              theme: {
                ...(socialEmbedConfig.theme || {}),
                darkMode: true
              }
            }} style={{ transform: "scale(0.9)", transformOrigin: "top center" }} />
          </Sequence>
        </AbsoluteFill>

        {/* SmartTextView Below Social Media Embed */}
        <AbsoluteFill style={{ top: 1000, left: canvasX_8 - 450, width: 900, height: 400, zIndex: 5 }}>
          <Sequence from={3450} layout="none">
            <SmartTextView 
              isOverlay={true} 
              theme={{ textFontSize: 56, textAlign: "center" }}
              segments={[
                { type: "text", value: "OVERWHELMING RESPONSE", style: "bold", color: "blue", emphasis: "underline" },
                { type: "text", value: "ACROSS SOCIAL MEDIA", style: "bold", color: "primary", lineBreak: true },
                { type: "text", value: "A NATION UNITED", style: "italic-serif", color: "amber" }
              ] as any}
            />
          </Sequence>
        </AbsoluteFill>

        {/* ======================= PHASE 9 ELEMENTS (NEW) ======================= */}
        {/* Transparent ProductReveal overlay rendering the Modi hierarchical card */}
        <AbsoluteFill style={{ top: 0, left: canvasX_9 - 540, width: 1080, height: 1920, zIndex: 5, transform: "translateY(-300px) scale(0.75)", transformOrigin: "center center" }}>
          <Sequence from={4060} layout="none">
            <ProductReveal config={{
              theme: {
                initialBg: "transparent",
                initialBgShade: "transparent",
                finalBg: "transparent",
                finalBgGradient: "transparent",
                cardBg: "rgba(255, 255, 255, 0.8)", // Semi-transparent white card to blend with light grid
                showGrid: false,
                showOrbs: false,
                shrinkStartFrame: 0, // Starts the image shrink immediately upon sequence start
                shrinkDurationFrames: 60,
                floatAmplitude: 0 // Static card
              },
              image: {
                src: "modi.png",
                objectFit: "contain"
              },
              footer: [
                {
                  type: "title",
                  value: "A GLOBAL LEADER",
                  fontSize: 48,
                  color: "#1e3a8a",
                  align: "center"
                },
                {
                  type: "description",
                  value: "Driving unprecedented growth and solidifying India's position on the world stage.",
                  fontSize: 28,
                  color: "#334155",
                  align: "center"
                }
              ]
            }} />
          </Sequence>
        </AbsoluteFill>

        {/* Hierarchical Dashed Lines and Portraits */}
        <AbsoluteFill style={{ top: 0, left: canvasX_9 - 540, width: 1080, height: 1920, zIndex: 1 }}>
          <Sequence from={4120} layout="none">
            <svg width="1080" height="1920" style={{ position: "absolute", top: 0, left: 0 }}>
              {/* Center Line */}
              <line x1={540} y1={1050} x2={540} y2={1500} 
                stroke="#1e3a8a" strokeWidth={5} strokeDasharray="15 15" strokeLinecap="round"
                strokeDashoffset={interpolate(frame, [4120, 4150], [450, 0], { extrapolateRight: "clamp" })} 
                opacity={interpolate(frame, [4120, 4130], [0, 1])}
              />
              {/* Left Line */}
              <line x1={540} y1={1050} x2={180} y2={1500} 
                stroke="#1e3a8a" strokeWidth={5} strokeDasharray="15 15" strokeLinecap="round"
                strokeDashoffset={interpolate(frame, [4120, 4150], [600, 0], { extrapolateRight: "clamp" })} 
                opacity={interpolate(frame, [4120, 4130], [0, 1])}
              />
              {/* Right Line */}
              <line x1={540} y1={1050} x2={900} y2={1500} 
                stroke="#1e3a8a" strokeWidth={5} strokeDasharray="15 15" strokeLinecap="round"
                strokeDashoffset={interpolate(frame, [4120, 4150], [600, 0], { extrapolateRight: "clamp" })} 
                opacity={interpolate(frame, [4120, 4130], [0, 1])}
              />
            </svg>
            {/* Modi Portraits at the end of lines */}
            <div style={{ position: "absolute", top: 1500 - 125, left: 540 - 125, width: 250, height: 250, borderRadius: "50%", overflow: "hidden", border: "6px solid #1e3a8a", transform: `scale(${spring({ fps: 60, frame: Math.max(0, frame - 4140), config: { damping: 12 } })})` }}>
              <Img src={staticFile("modi.png")} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
            </div>
            <div style={{ position: "absolute", top: 1500 - 125, left: 180 - 125, width: 250, height: 250, borderRadius: "50%", overflow: "hidden", border: "6px solid #1e3a8a", transform: `scale(${spring({ fps: 60, frame: Math.max(0, frame - 4145), config: { damping: 12 } })})` }}>
              <Img src={staticFile("modi.png")} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
            </div>
            <div style={{ position: "absolute", top: 1500 - 125, left: 900 - 125, width: 250, height: 250, borderRadius: "50%", overflow: "hidden", border: "6px solid #1e3a8a", transform: `scale(${spring({ fps: 60, frame: Math.max(0, frame - 4150), config: { damping: 12 } })})` }}>
              <Img src={staticFile("modi.png")} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
            </div>
          </Sequence>
        </AbsoluteFill>

      </div>
    </AbsoluteFill>
  );
};
