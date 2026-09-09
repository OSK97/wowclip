import React, { useMemo, useState, useEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  delayRender,
  continueRender,
} from "remotion";
import { loadEBGaramond as loadSerif } from "../../utils/localFonts";

// Import config
import documentConfig from "./document.config.json";
import rawDefaultConfig from "./defaultConfig.json";
import { GovernmentHighlighter } from "./GovernmentHighlighter";
import { getNormalizedWordDurations, getPenPosition } from "../AestheticNews/AestheticHighlighter";

const defaultConfig = rawDefaultConfig as any;
const userConfig = documentConfig as any;
const config = {
  ...defaultConfig,
  ...userConfig,
  styling: {
    ...(defaultConfig.styling || {}),
    ...(userConfig.styling || {}),
  },
  stamp: {
    ...(defaultConfig.stamp || {}),
    ...(userConfig.stamp || {}),
  }
};

// Load Google Fonts serif at module scope
const serifFontDetails = loadSerif("normal", { weights: ["400", "700"], subsets: ["latin"] });

interface HighlightInstruction {
  fromWord: number;
  toWord: number;
  startFrame?: number;
  endFrame?: number;
  cameraMode?: "auto" | "wide";
  wordDurations?: number | string | number[];
  speedMultiplier?: number;
  forceZoom?: boolean;
  highlightColor?: string;
}

interface InstructionLineData {
  y: number;
  startX: number;
  endX: number;
  wordCount: number;
  firstWordIndex: number;
  lastWordIndex: number;
}

interface InstructionMeasurement {
  instIndex: number;
  lines: InstructionLineData[];
}

import { TOP_DUMMY_BLOCKS, BOTTOM_DUMMY_BLOCKS, getTopDummyWordCount } from "./constants";

const topDummyWordCount = getTopDummyWordCount();


export const GovernmentDocument: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const serif = serifFontDetails.fontFamily;

  const [measurements, setMeasurements] = useState<InstructionMeasurement[]>([]);
  const [handle] = useState(() => delayRender());

  // Merge the script instructions to perfectly align with the global word indices
  const safeScript = useMemo(() => {
    if (!config.script?.instructions) return { instructions: [] };
    const instructions = (config.script.instructions as HighlightInstruction[]).map((inst) => ({
      ...inst,
      fromWord: inst.fromWord + topDummyWordCount,
      toWord: inst.toWord + topDummyWordCount,
      startFrame: inst.startFrame ?? 0,
      endFrame: inst.endFrame ?? 0,
      speedMultiplier: inst.speedMultiplier ?? 1.0,
      cameraMode: inst.cameraMode || "auto",
    }));
    
    // Automatically calculate start and end frames with speed multiplier and gap handling
    let currentFrame = 24; // 1 second front buffer
    let prevToWord = 0;

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      const wordCount = Math.max(1, inst.toWord - inst.fromWord + 1);
      const computedDuration = Math.max(12, Math.round((wordCount * 12) / (inst.speedMultiplier || 1)));

      if (inst.startFrame === 0 && inst.endFrame === 0) {
        if (i > 0) {
          const wordGap = inst.fromWord - prevToWord;
          if (wordGap > 20) {
            // Large gap -> zoom out and back in
            currentFrame += 60;
          } else {
            // Small gap -> fast slide pan
            currentFrame += 15;
          }
        } else {
          currentFrame = Math.max(currentFrame, 24);
        }
        inst.startFrame = currentFrame;
        inst.endFrame = inst.startFrame + computedDuration;
        currentFrame = inst.endFrame;
        prevToWord = inst.toWord;
      } else if (inst.startFrame > 0 && (inst.endFrame === 0 || inst.endFrame <= inst.startFrame)) {
        // Explicit startFrame provided by LLM (e.g. 96 for 4 seconds in), compute endFrame from speedMultiplier
        inst.endFrame = inst.startFrame + computedDuration;
        currentFrame = inst.endFrame;
        prevToWord = inst.toWord;
      } else {
        currentFrame = inst.endFrame;
        prevToWord = inst.toWord;
      }
    }
    
    return { instructions };
  }, [config.script]);

  const allBlocks = useMemo(() => {
    return [...TOP_DUMMY_BLOCKS, ...(config.documentBlocks || []), ...BOTTOM_DUMMY_BLOCKS];
  }, [config.documentBlocks]);

  useEffect(() => {
    const container = document.getElementById("article-container");
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const scaleRatio = width / cRect.width;

    const newMeasurements: InstructionMeasurement[] = [];

    for (let idx = 0; idx < safeScript.instructions.length; idx++) {
      const inst = safeScript.instructions[idx];
      const words = [];

      for (let i = inst.fromWord; i <= inst.toWord; i++) {
        const el = document.getElementById(`highlight-word-${i}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          words.push({
            index: i,
            x: (rect.left - cRect.left) * scaleRatio,
            y: (rect.top - cRect.top) * scaleRatio,
            right: (rect.right - cRect.left) * scaleRatio,
          });
        }
      }

      if (words.length > 0) {
        const groupedLines: (typeof words)[] = [];
        let currentLine = [words[0]];

        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          if (Math.abs(w.y - currentLine[0].y) > 20) {
            groupedLines.push(currentLine);
            currentLine = [w];
          } else {
            currentLine.push(w);
          }
        }
        groupedLines.push(currentLine);

        const instLines: InstructionLineData[] = groupedLines.map((line) => {
          const firstWord = line[0];
          const lastWord = line[line.length - 1];
          return {
            y: firstWord.y,
            startX: firstWord.x,
            endX: lastWord.right,
            wordCount: line.length,
            firstWordIndex: firstWord.index,
            lastWordIndex: lastWord.index,
          };
        });

        newMeasurements.push({ instIndex: idx, lines: instLines });
      }
    }

    setMeasurements(newMeasurements);
    continueRender(handle);
  }, [safeScript, handle, width]);

  // ─── DYNAMIC CAMERA MATH ────────────────────────────────────────────────────────
  const TARGET_SCALE = config.zoomScale || 2.5;
  let targetX = width / 2;
  let targetY = height / 2;
  let scale = 1;
  const verticalOffset = 30; // Push camera down slightly so text is centered

  if (
    measurements.length === safeScript.instructions.length &&
    safeScript.instructions.length > 0
  ) {
    let handled = false;

    // Phase: End zoom out & Buffer Shield
    const lastInst = safeScript.instructions[safeScript.instructions.length - 1];
    const lastMeas = measurements[measurements.length - 1];
    const lastLine = lastMeas.lines[lastMeas.lines.length - 1];

    const totalLastWords = lastInst.toWord - lastInst.fromWord + 1;
    const lastWasWide = lastInst.cameraMode === "wide" || (totalLastWords <= 3 && !lastInst.forceZoom && (lastInst.endFrame - lastInst.startFrame) < 20);
    const startX = lastWasWide ? width / 2 : lastLine.endX;
    const startY = lastWasWide ? height / 2 : lastLine.y + verticalOffset;
    const startScale = lastWasWide ? 1.0 : TARGET_SCALE;

    const requestedDuration = config.durationInFrames || 360;
    const minRequiredDuration = lastInst.endFrame + 60; // 12-frame hold + 24-frame zoom out + 24-frame end hold
    const effectiveDuration = Math.max(requestedDuration, minRequiredDuration);
    const zoomOutStart = lastInst.endFrame + 12;
    const zoomOutEnd = Math.max(zoomOutStart + 24, effectiveDuration - 24);

    if (frame > lastInst.endFrame) {
      if (frame <= zoomOutStart) {
        // Hold on last position briefly
        targetX = startX;
        targetY = startY;
        scale = startScale;
        handled = true;
      } else if (frame <= zoomOutEnd) {
        // Zoom out to wide
        const prog = interpolate(
          frame,
          [zoomOutStart, zoomOutEnd],
          [0, 1],
          { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) },
        );
        targetX = interpolate(prog, [0, 1], [startX, width / 2]);
        targetY = interpolate(prog, [0, 1], [startY, height / 2]);
        scale = interpolate(prog, [0, 1], [startScale, 1]);
        handled = true;
      } else {
        // Hold wide
        targetX = width / 2;
        targetY = height / 2;
        scale = 1;
        handled = true;
      }
    }

    if (!handled) {
      for (let i = 0; i < safeScript.instructions.length; i++) {
        const inst = safeScript.instructions[i];
        const meas = measurements[i];

        if (!meas || !meas.lines || meas.lines.length === 0) continue;

        // Is frame inside this instruction?
        if (frame >= inst.startFrame && frame <= inst.endFrame) {
          const totalWords = inst.toWord - inst.fromWord + 1;
          const isWideMode = inst.cameraMode === "wide" || (totalWords <= 3 && !inst.forceZoom && (inst.endFrame - inst.startFrame) < 20);

          if (isWideMode) {
            targetX = width / 2;
            targetY = height / 2;
            scale = 1.0;
            handled = true;
            break;
          }

          scale = TARGET_SCALE;

          const currentWordOffset = getPenPosition(inst, frame);

          let activeLineIdx = Math.max(0, meas.lines.length - 1);
          let wordsSoFar = 0;
          for (let l = 0; l < meas.lines.length; l++) {
            wordsSoFar += meas.lines[l].wordCount;
            if (currentWordOffset <= wordsSoFar) {
              activeLineIdx = l;
              break;
            }
          }

          const activeLine = meas.lines[activeLineIdx];

          let wordsBeforeLine = 0;
          for (let l = 0; l < activeLineIdx; l++)
            wordsBeforeLine += meas.lines[l].wordCount;

          const lineProg = interpolate(
            currentWordOffset,
            [wordsBeforeLine, wordsBeforeLine + activeLine.wordCount],
            [0, 1],
            { extrapolate: "clamp" },
          );

          let camX = interpolate(
            lineProg,
            [0, 1],
            [activeLine.startX, activeLine.endX],
          );
          let camY = activeLine.y + verticalOffset;

          if (activeLineIdx > 0) {
            const prevLine = meas.lines[activeLineIdx - 1];

            // Calculate exact frame when this line starts highlighting
            let lineStartFrame = inst.startFrame;
            if (
              inst.wordDurations !== undefined &&
              inst.wordDurations !== null
            ) {
              const durs = getNormalizedWordDurations(
                inst.wordDurations,
                totalWords,
              );
              for (let w = 0; w < wordsBeforeLine; w++) {
                lineStartFrame += durs[w];
              }
            } else {
              const duration = inst.endFrame - inst.startFrame;
              lineStartFrame += (wordsBeforeLine / totalWords) * duration;
            }

            // Fast 3-frame swoop down to the next line
            const swoopDuration = 3;
            if (frame < lineStartFrame + swoopDuration) {
              const swoopProgress = interpolate(
                frame,
                [lineStartFrame, lineStartFrame + swoopDuration],
                [0, 1],
                { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) },
              );

              camX = interpolate(swoopProgress, [0, 1], [prevLine.endX, camX]);
              camY = interpolate(
                swoopProgress,
                [0, 1],
                [prevLine.y + verticalOffset, camY],
              );
            }
          }

          targetX = camX;
          targetY = camY;
          handled = true;
          break;
        }

        if (frame < inst.startFrame) {
          const totalWords = inst.toWord - inst.fromWord + 1;
          const isWideMode = inst.cameraMode === "wide" || (totalWords <= 3 && !inst.forceZoom && (inst.endFrame - inst.startFrame) < 20);

          if (i === 0) {
            // First instruction zoom in
            const zoomInStart = Math.max(0, inst.startFrame - 24);
            if (frame >= zoomInStart && !isWideMode) {
              const prog = interpolate(
                frame,
                [zoomInStart, inst.startFrame],
                [0, 1],
                { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) },
              );
              targetX = interpolate(prog, [0, 1], [width / 2, meas.lines[0].startX]);
              targetY = interpolate(prog, [0, 1], [height / 2, meas.lines[0].y + verticalOffset]);
              scale = interpolate(prog, [0, 1], [1, TARGET_SCALE]);
            } else {
              targetX = width / 2;
              targetY = height / 2;
              scale = 1.0;
            }
            handled = true;
            break;
          } else {
            // Transition parameters between instructions
            const prevInst = safeScript.instructions[i - 1];
            const prevMeas = measurements[i - 1];
            const prevLastLine = prevMeas.lines[prevMeas.lines.length - 1];
            const nextFirstLine = meas.lines[0];
            const gap = inst.startFrame - prevInst.endFrame;

            const prevX = prevLastLine.endX;
            const prevY = prevLastLine.y + verticalOffset;

            const nextX = nextFirstLine.startX;
            const nextY = nextFirstLine.y + verticalOffset;

            if (gap < 48) {
              // Quick slide if gap is small
              const slideProg = interpolate(frame, [prevInst.endFrame, inst.startFrame], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
              targetX = interpolate(slideProg, [0, 1], [prevX, nextX]);
              targetY = interpolate(slideProg, [0, 1], [prevY, nextY]);
              scale = TARGET_SCALE;
            } else {
              // Zoom out and zoom back in
              const holdDuration = Math.min(12, Math.floor(gap * 0.25));
              const zoomOutDuration = Math.min(18, Math.floor(gap * 0.4));
              const holdEnd = prevInst.endFrame + holdDuration;
              const zoomOutEnd = holdEnd + zoomOutDuration;

              if (frame < holdEnd) {
                targetX = prevX;
                targetY = prevY;
                scale = TARGET_SCALE;
              } else if (frame < zoomOutEnd) {
                const prog = interpolate(frame, [holdEnd, zoomOutEnd], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
                targetX = interpolate(prog, [0, 1], [prevX, width / 2]);
                targetY = interpolate(prog, [0, 1], [prevY, height / 2]);
                scale = interpolate(prog, [0, 1], [TARGET_SCALE, 1]);
              } else {
                const zoomInStart = inst.startFrame - zoomOutDuration;
                if (frame >= zoomInStart) {
                  const prog = interpolate(frame, [zoomInStart, inst.startFrame], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
                  targetX = interpolate(prog, [0, 1], [width / 2, nextX]);
                  targetY = interpolate(prog, [0, 1], [height / 2, nextY]);
                  scale = interpolate(prog, [0, 1], [1, TARGET_SCALE]);
                } else {
                  targetX = width / 2;
                  targetY = height / 2;
                  scale = 1.0;
                }
              }
            }
            handled = true;
            break;
          }
        }
      }
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.styling.backgroundColor || "#faf7f0",
        overflow: "hidden",
      }}
    >
      {/* ── Camera transform wrapper ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transformOrigin: "0 0",
          transform: `translate(${width / 2 - targetX * scale}px, ${height / 2 - targetY * scale}px) scale(${scale})`,
          willChange: "transform",
        }}
      >
        {/* Massive Infinite Canvas Background to prevent edge exposure */}
        <div
          style={{
            position: "absolute",
            width: "5080px",
            height: "5920px",
            left: "-2000px",
            top: "-2000px",
            backgroundColor: config.styling.backgroundColor || "#faf7f0",
            backgroundImage: `
              radial-gradient(circle at 50% 50%, transparent 20%, rgba(45, 30, 10, 0.03) 75%, rgba(20, 10, 0, 0.08) 100%)
            `,
          }}
        >
          {/* Paper Grain Overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.045,
              mixBlendMode: "multiply",
              zIndex: 10,
            }}
          >
            <svg width="100%" height="100%">
              <filter id="paper-noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#paper-noise)" />
            </svg>
          </div>
        </div>

        {/* The Document Page container */}
        <div
          id="article-container"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "1080px",
            height: "1920px",
            padding: "95px 80px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            fontFamily: serif,
          }}
        >
          {/* Header Metadata */}
          <div style={{ width: '100%', marginBottom: '40px', fontSize: '24px', fontWeight: 'bold' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div>{config.headerDepartment}</div>
              <div>{config.headerLocation}</div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '40px', fontSize: '28px', textDecoration: 'underline' }}>
              {config.classification}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <div>TO: {config.memoTo}</div>
              <div>FROM: {config.memoFrom}</div>
              <div>DATE: {config.date}</div>
              <div>SUBJECT: {config.memoSubject}</div>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: "920px",
              zIndex: 2,
            }}
          >
            <GovernmentHighlighter 
              blocks={allBlocks}
              script={safeScript}
              frame={frame}
              fontSize={36}
              lineHeight={1.65}
              color={config.styling.textColor}
              accentColor={config.styling.highlightColor}
            />
          </div>

          {/* Signature Block */}
          <div style={{ marginTop: '80px', alignSelf: 'flex-end', paddingRight: '40px', textAlign: 'center' }}>
            <div style={{ fontFamily: '"Great Vibes", cursive', fontSize: '64px', color: '#1a1e24', transform: 'rotate(-5deg)', marginBottom: '-20px' }}>
              {config.signatureName}
            </div>
            <div style={{ borderTop: '1px solid #1a1e24', width: '300px', paddingTop: '10px', fontSize: '20px' }}>
              {config.signatureTitle}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
