import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  delayRender,
  continueRender,
  useVideoConfig,
  staticFile,
  Img,
} from 'remotion';
import { CommanderHighlighter } from './CommanderHighlighter';
import { getNormalizedWordDurations, getPenPosition } from '../AestheticNews/AestheticHighlighter';
import commanderTableConfig from './commander-table.config.json';

const ZOOM_FRAMES_PER_CHAR = 2.5;

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

export const getCommanderTableDuration = () => {
  const script = (commanderTableConfig as any).script || { instructions: [] };
  const blocks = (commanderTableConfig as any).documentBlocks || [
    { type: "heading", content: "COMMAND DIRECTIVE" },
    { type: "normal", content: "No directive content available in configuration." }
  ];

  if (!script || !script.instructions || script.instructions.length === 0)
    return 240;

  const wordsArr: string[] = [];
  blocks.forEach((block: any) => {
    if (block.type !== "separator" && block.type !== "spacer") {
      const w = block.content.split(/\s+/).filter((w: string) => w.length > 0);
      wordsArr.push(...w);
    }
  });

  let lastEnd = 24; // 1 second safe intro duration
  for (let i = 0; i < script.instructions.length; i++) {
    const inst = script.instructions[i];
    const maxIdx = Math.max(0, wordsArr.length - 1);
    const safeFrom = Math.max(0, Math.min(inst.fromWord, maxIdx));
    let safeTo = Math.max(0, Math.min(inst.toWord, maxIdx));
    safeTo = Math.max(safeFrom, safeTo);

    let start = inst.startFrame;
    start = Math.max(start, lastEnd);

    const slice = wordsArr.slice(safeFrom, safeTo + 1);
    const durs = slice.map((word: string) => Math.max(1, Math.round(word.length * ZOOM_FRAMES_PER_CHAR)));
    const duration = durs.reduce((a: number, b: number) => a + b, 0);

    lastEnd = start + duration;
  }

  const ZOOM_OUT_END = lastEnd + 16;
  const WIDE_HOLD_END = ZOOM_OUT_END + 48;
  const DIVE_END = WIDE_HOLD_END + 44;
  const fadeOutEnd = DIVE_END + 16;

  const requestedDuration = (commanderTableConfig as any).durationInFrames || 0;
  return Math.max(fadeOutEnd, requestedDuration);
};

export const CommanderTable: React.FC<any> = ({
  blocks = (commanderTableConfig as any).documentBlocks || [
    { type: "heading", content: "COMMAND DIRECTIVE" },
    { type: "normal", content: "No directive content available in configuration." }
  ],
  script = (commanderTableConfig as any).script || { instructions: [] },
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const resScale = width / 1080;
  const bodyFontSize = 14.5 * resScale;
  const verticalOffset = 15 * resScale;

  // ─── Timeline Parsing ──────────────────────────────────────────────────
  const safeScript = React.useMemo(() => {
    let lastEnd = 24; // 1 second at 24fps
    const rawInstructions = script?.instructions && Array.isArray(script.instructions) ? script.instructions : [];
    
    // Count total words in all text blocks
    let totalWords = 0;
    blocks.forEach((block: any) => {
      if (block.type !== "separator" && block.type !== "spacer") {
        const w = block.content.split(/\s+/).filter((w: string) => w.length > 0);
        totalWords += w.length;
      }
    });

    const wordsArr: string[] = [];
    blocks.forEach((block: any) => {
      if (block.type !== "separator" && block.type !== "spacer") {
        const w = block.content.split(/\s+/).filter((w: string) => w.length > 0);
        wordsArr.push(...w);
      }
    });

    const safeInstructions = rawInstructions.map((inst: any, idx: number) => {
      const maxIdx = Math.max(0, wordsArr.length - 1);
      
      const safeFrom = Math.max(0, Math.min(inst.fromWord, maxIdx));
      let safeTo = Math.max(0, Math.min(inst.toWord, maxIdx));
      safeTo = Math.max(safeFrom, safeTo);
      
      let start = inst.startFrame;
      start = Math.max(start, lastEnd);
      
      const slice = wordsArr.slice(safeFrom, safeTo + 1);
      const durs = slice.map((word: string) => Math.max(1, Math.round(word.length * ZOOM_FRAMES_PER_CHAR)));
      const totalDur = durs.reduce((a: number, b: number) => a + b, 0);
      
      let end = start + totalDur;
      lastEnd = end;
      return { ...inst, startFrame: start, endFrame: end, fromWord: safeFrom, toWord: safeTo, wordDurations: durs };
    });

    return { instructions: safeInstructions };
  }, [script, blocks]);

  // ─── Fade in / out ─────────────────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lastInstEnd =
    safeScript.instructions.length > 0
      ? safeScript.instructions[safeScript.instructions.length - 1].endFrame
      : 96;

  const ZOOM_OUT_END = lastInstEnd + 16;
  const WIDE_HOLD_END = ZOOM_OUT_END + 48; // Hold for 2 seconds
  const DIVE_END = WIDE_HOLD_END + 44;

  const fadeOutStart = DIVE_END;
  const fadeOutEnd = fadeOutStart + 16;
  const globalOpacity = interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const diveProgress = frame >= WIDE_HOLD_END
    ? interpolate(frame, [WIDE_HOLD_END, DIVE_END], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.8, 0, 0.5, 0.1),
      })
    : 0;

  const tableBlur = interpolate(diveProgress, [0, 0.7], [0, 25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tableOpacity = interpolate(diveProgress, [0.5, 0.95], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const paperOpacity = interpolate(
    frame,
    [WIDE_HOLD_END - 20, WIDE_HOLD_END],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ─── DOM measurement ─────────────
  const [measurements, setMeasurements] = useState<InstructionMeasurement[]>([]);
  const [handle] = useState(() => delayRender());

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

  // ─── DYNAMIC CAMERA MATH ─────────────────
  const TARGET_SCALE = 4.0;
  let targetX = width / 2;
  let targetY = height / 2;
  let scale = 1;

  if (
    measurements.length === safeScript.instructions.length &&
    safeScript.instructions.length > 0
  ) {
    let handled = false;

    // Phase: End fade out
    const lastInst = safeScript.instructions[safeScript.instructions.length - 1];
    const lastMeas = measurements[measurements.length - 1];
    const lastLine = lastMeas.lines[lastMeas.lines.length - 1];

    if (frame > lastInst.endFrame) {
      const startX = lastLine.endX;
      const startY = lastLine.y + verticalOffset;

      if (frame <= lastInst.endFrame + 6) {
        // Hold on last position
        targetX = startX;
        targetY = startY;
        scale = TARGET_SCALE;
        handled = true;
      } else if (frame <= ZOOM_OUT_END) {
        // Zoom out to wide
        const prog = interpolate(
          frame,
          [lastInst.endFrame + 6, ZOOM_OUT_END],
          [0, 1],
          { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) },
        );
        targetX = interpolate(prog, [0, 1], [startX, width / 2]);
        targetY = interpolate(prog, [0, 1], [startY, height / 2]);
        scale = interpolate(prog, [0, 1], [TARGET_SCALE, 1]);
        handled = true;
      } else if (frame <= WIDE_HOLD_END) {
        // Phase 5: Hold wide
        targetX = width / 2;
        targetY = height / 2;
        scale = 1;
        handled = true;
      } else {
        // Phase 6: Portal dive
        const paperCenterX = 0.50325 * width;
        const paperCenterY = 0.52265 * height;

        targetX = interpolate(diveProgress, [0, 1], [width / 2, paperCenterX], { easing: Easing.inOut(Easing.cubic) });
        targetY = interpolate(diveProgress, [0, 1], [height / 2, paperCenterY], { easing: Easing.inOut(Easing.cubic) });
        scale = interpolate(diveProgress, [0, 1], [1, 35], { extrapolateRight: 'clamp' });
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

          scale = TARGET_SCALE;

          const totalWords = inst.toWord - inst.fromWord + 1;
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
              const totalWords = inst.toWord - inst.fromWord + 1;
              const durs = getNormalizedWordDurations(
                inst.wordDurations,
                totalWords,
              );
              for (let w = 0; w < wordsBeforeLine; w++) {
                lineStartFrame += durs[w];
              }
            } else {
              const duration = inst.endFrame - inst.startFrame;
              const totalWords = inst.toWord - inst.fromWord + 1;
              lineStartFrame += (wordsBeforeLine / totalWords) * duration;
            }

            // Fast 3-frame swoop
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
          if (i === 0) {
            // First instruction zoom in
            const zoomInStart = Math.max(0, inst.startFrame - 24);
              if (frame >= zoomInStart) {
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
                scale = 1.0;
              }
            handled = true;
            break;
          } else {
            // Transition parameters
            const prevInst = safeScript.instructions[i - 1];
            const prevMeas = measurements[i - 1];
            const prevLastLine = prevMeas.lines[prevMeas.lines.length - 1];
            const nextFirstLine = meas.lines[0];
            const gap = inst.startFrame - prevInst.endFrame;

            // Start state (from previous instruction)
            const prevScale = TARGET_SCALE;
            let prevX = prevLastLine.endX;
            let prevY = prevLastLine.y + verticalOffset;

            // End state (for next instruction)
            const nextScale = TARGET_SCALE;
            let nextX = nextFirstLine.startX;
            let nextY = nextFirstLine.y + verticalOffset;

            if (prevScale === 1.0 && nextScale === 1.0) {
              targetX = width / 2;
              targetY = height / 2;
              scale = 1.0;
            } else if (prevScale === TARGET_SCALE && nextScale === TARGET_SCALE && gap < 48) {
              const slideProg = interpolate(frame, [prevInst.endFrame, inst.startFrame], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
              targetX = interpolate(slideProg, [0, 1], [prevX, nextX]);
              targetY = interpolate(slideProg, [0, 1], [prevY, nextY]);
              scale = TARGET_SCALE;
            } else if (prevScale === TARGET_SCALE && nextScale === 1.0) {
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
                targetX = width / 2;
                targetY = height / 2;
                scale = 1.0;
              }
            } else if (prevScale === 1.0 && nextScale === TARGET_SCALE) {
              const zoomInDuration = Math.min(18, Math.floor(gap * 0.4));
              const zoomInStart = inst.startFrame - zoomInDuration;

              if (frame < zoomInStart) {
                targetX = width / 2;
                targetY = height / 2;
                scale = 1.0;
              } else {
                const prog = interpolate(frame, [zoomInStart, inst.startFrame], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
                targetX = interpolate(prog, [0, 1], [width / 2, nextX]);
                targetY = interpolate(prog, [0, 1], [height / 2, nextY]);
                scale = interpolate(prog, [0, 1], [1, TARGET_SCALE]);
              }
            } else {
              const holdDuration = Math.min(12, Math.floor(gap * 0.25));
              const zoomOutDuration = Math.min(18, Math.floor(gap * 0.35));
              const zoomInDuration = Math.min(18, Math.floor(gap * 0.35));

              const holdEnd = prevInst.endFrame + holdDuration;
              const zoomOutEnd = holdEnd + zoomOutDuration;
              const zoomInStart = inst.startFrame - zoomInDuration;

              if (frame < holdEnd) {
                targetX = prevX;
                targetY = prevY;
                scale = TARGET_SCALE;
              } else if (frame < zoomOutEnd) {
                const prog = interpolate(frame, [holdEnd, zoomOutEnd], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
                targetX = interpolate(prog, [0, 1], [prevX, width / 2]);
                targetY = interpolate(prog, [0, 1], [prevY, height / 2]);
                scale = interpolate(prog, [0, 1], [TARGET_SCALE, 1]);
              } else if (frame < zoomInStart) {
                targetX = width / 2;
                targetY = height / 2;
                scale = 1.0;
              } else {
                const prog = interpolate(frame, [zoomInStart, inst.startFrame], [0, 1], { extrapolate: "clamp", easing: Easing.inOut(Easing.cubic) });
                targetX = interpolate(prog, [0, 1], [width / 2, nextX]);
                targetY = interpolate(prog, [0, 1], [height / 2, nextY]);
                scale = interpolate(prog, [0, 1], [1, TARGET_SCALE]);
              }
            }
            handled = true;
            break;
          }
        }
      }
    }
  }

  // ─── Exact Paper Bounding Coordinates ─────────────────────────────────────
  const clipPathTable = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 30.185% 36.354%, 28.333% 68.281%, 72.315% 68.281%, 70.093% 36.354%, 30.185% 36.354%)';
  const clipPathPaper = 'polygon(30.185% 36.354%, 70.093% 36.354%, 72.315% 68.281%, 28.333% 68.281%)';

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent', overflow: 'hidden' }}>
      {/* ── Layer 1: Table scene with clip-path paper cutout ── */}
      <AbsoluteFill
        style={{
          zIndex: 1,
          opacity: globalOpacity * fadeIn * tableOpacity,
          filter: tableBlur > 0 ? `blur(${tableBlur}px)` : undefined,
        }}
      >
        {/* Camera transform wrapper */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transformOrigin: '0 0',
            transform: `translate(${width / 2 - targetX * scale}px, ${height / 2 - targetY * scale}px) scale(${scale})`,
            willChange: 'transform',
          }}
        >
          <div
            id="article-container"
            style={{
              width,
              height,
              position: 'relative',
            }}
          >
            {/* White paper background */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                clipPath: clipPathPaper,
                opacity: paperOpacity,
              }}
            />

            {/* Background Table Image with paper cutout hole */}
            <Img
              src={staticFile("/Documnetry_Info_assets/commander_table_bg.png")}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                clipPath: clipPathTable,
              }}
            />

            {/* Document Text Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '38.0%',
                left: '31.5%',
                width: '37.0%',
                height: '28.5%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                boxSizing: 'border-box',
                color: '#1c1c1c',
                opacity: paperOpacity,
              }}
            >
              <CommanderHighlighter
                blocks={blocks}
                script={safeScript}
                frame={frame}
                fontSize={bodyFontSize}
                lineHeight={1.4}
                color="#1a1a1a"
                accentColor="rgba(253, 224, 71, 0.65)"
                idPrefix="highlight-word-"
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
