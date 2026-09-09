import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadInter as loadSans } from "../../utils/localFonts";
import { NewsHighlighter } from "./NewsHighlighter";
import {
  EXIT_HOLD_SECONDS,
  EXIT_ZOOM_OUT_SECONDS,
  FADE_IN_SECONDS,
  FADE_OUT_SECONDS,
  LINE_SWOOP_SECONDS,
  ZOOM_IN_SECONDS,
  buildTimeline,
  getGroupFrameAtWord,
  getGroupPen,
} from "./timeline";
import type { NewsConfigInput } from "./timeline";
import defaultConfig from "./aesthetic-news.config.json";

const { fontFamily: sansFont } = loadSans("normal", {
  weights: ["400", "500", "700", "900"],
});

export type { NewsConfigInput };

export const getAestheticNewsDuration = (config?: NewsConfigInput) =>
  buildTimeline(config ?? (defaultConfig as NewsConfigInput)).durationInFrames;

const CANVAS = { width: 1080, height: 1920 };
const WIDE = { x: CANVAS.width / 2, y: CANVAS.height / 2, scale: 1 };
const READABLE_PX = 84; // apparent text size the zoom aims for
const DEFAULT_ACCENT = "#C084FC";

interface Line {
  yCenter: number;
  startX: number;
  endX: number;
  wordCount: number;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const ease = (frame: number, from: number, to: number) =>
  to <= from
    ? 1
    : interpolate(frame, [from, to], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });

const lerpCam = (a: Camera, b: Camera, t: number): Camera => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  scale: lerp(a.scale, b.scale, t),
});

const zoomScaleFor = (fontSize: number) =>
  Math.min(3, Math.max(1.4, READABLE_PX / fontSize));

const toLine = (points: { x: number; right: number; y: number }[]): Line => ({
  yCenter: points[0].y,
  startX: points[0].x,
  endX: points[points.length - 1].right,
  wordCount: points.length,
});

const headlineFontSize = (chars: number) =>
  chars > 110 ? 44 : chars > 85 ? 50 : chars > 62 ? 58 : 66;

const descriptionFontSize = (chars: number) =>
  chars > 420 ? 21 : chars > 340 ? 23 : chars > 260 ? 25 : 28;

const resolveAsset = (url?: string) =>
  !url ? undefined : url.startsWith("http") || url.startsWith("data:") ? url : staticFile(url);

export const AestheticNewsLayout: React.FC<{ config?: NewsConfigInput }> = ({
  config = defaultConfig as NewsConfigInput,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Keyed on content, not object identity — Remotion hands fresh props objects
  // every render, and re-measuring on each one would loop.
  const configKey = JSON.stringify(config);
  const timeline = useMemo(() => buildTimeline(config), [configKey]);
  const { headlineWords, descriptionWords, highlights, groups } = timeline;

  const accent = config.accentColor || DEFAULT_ACCENT;
  const headlineSize = headlineFontSize((config.headline || "").length);
  const descSize = descriptionFontSize((config.description || "").length);

  const bgImage = resolveAsset(config.bgImageUrl);
  const logo = resolveAsset(config.logoUrl);

  // Headline and description slide up as they enter. Measuring mid-slide would
  // aim the camera a few dozen pixels low, so the offset is subtracted back out.
  const entranceShift = (target: "headline" | "description", atFrame: number) => {
    const isHeadline = target === "headline";
    const settled = spring({
      frame: Math.max(0, atFrame - (isHeadline ? 5 : 15)),
      fps,
      config: { damping: isHeadline ? 16 : 17, stiffness: 80 },
    });
    return (1 - settled) * (isHeadline ? 30 : 25);
  };

  // ── Measure where each camera group's words landed ────────────────────────
  const [measurements, setMeasurements] = useState<(Line[] | null)[]>([]);
  const [handle] = useState(() => delayRender("AestheticNews layout measure"));
  const released = useRef(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const release = () => {
      if (!released.current) {
        released.current = true;
        continueRender(handle);
      }
    };

    const measure = async () => {
      const measuredAt = frameRef.current;
      try {
        // Word positions are only meaningful once the real font is applied.
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        const container = document.getElementById("article-container");
        if (!container) return;

        const cRect = container.getBoundingClientRect();
        // Normalises both Remotion's preview scale and the camera's own zoom,
        // since the container sits inside the camera transform.
        const ratio = cRect.width ? CANVAS.width / cRect.width : 1;

        const next = groups.map((group) => {
          const shift = entranceShift(group.target, measuredAt);
          const points: { x: number; right: number; y: number }[] = [];
          for (let i = group.fromWord; i <= group.toWord; i++) {
            const el = document.getElementById(`${group.target}-word-${i}`);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            points.push({
              x: (r.left - cRect.left) * ratio,
              right: (r.right - cRect.left) * ratio,
              y: (r.top + r.height / 2 - cRect.top) * ratio - shift,
            });
          }
          if (!points.length) return null;

          const lines: Line[] = [];
          let current = [points[0]];
          for (let i = 1; i < points.length; i++) {
            if (Math.abs(points[i].y - current[0].y) > 20) {
              lines.push(toLine(current));
              current = [points[i]];
            } else {
              current.push(points[i]);
            }
          }
          lines.push(toLine(current));
          return lines;
        });

        setMeasurements(next);
      } finally {
        release();
      }
    };

    measure();
    return release;
  }, [configKey, handle]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const cams = groups.map((group, i) => {
    const lines = measurements[i] || null;
    const zoom = group.zoom && !!lines;
    const fontSize = group.target === "headline" ? headlineSize : descSize;
    return { group, lines, zoom, scale: zoom ? zoomScaleFor(fontSize) : 1 };
  });

  type Cam = (typeof cams)[number];

  const startFocus = (c: Cam): Camera => ({
    x: c.lines![0].startX,
    y: c.lines![0].yCenter,
    scale: c.scale,
  });

  const endFocus = (c: Cam): Camera => {
    const line = c.lines![c.lines!.length - 1];
    return { x: line.endX, y: line.yCenter, scale: c.scale };
  };

  const zoomInFrames = Math.round(ZOOM_IN_SECONDS * fps);
  const holdFrames = Math.round(EXIT_HOLD_SECONDS * fps);
  const zoomOutFrames = Math.round(EXIT_ZOOM_OUT_SECONDS * fps);
  const swoopFrames = Math.max(2, Math.round(LINE_SWOOP_SECONDS * fps));

  const insideGroup = (c: Cam): Camera => {
    if (!c.zoom || !c.lines) return WIDE;
    const lines = c.lines;
    const pen = getGroupPen(c.group, highlights, frame);

    let index = 0;
    let wordsBefore = 0;
    for (let l = 0; l < lines.length; l++) {
      if (pen <= wordsBefore + lines[l].wordCount || l === lines.length - 1) {
        index = l;
        break;
      }
      wordsBefore += lines[l].wordCount;
    }

    const line = lines[index];
    const progress = Math.min(
      1,
      Math.max(0, (pen - wordsBefore) / Math.max(1, line.wordCount)),
    );

    let x = lerp(line.startX, line.endX, progress);
    let y = line.yCenter;

    if (index > 0) {
      const previous = lines[index - 1];
      const lineStart = getGroupFrameAtWord(c.group, highlights, wordsBefore);
      if (frame < lineStart + swoopFrames) {
        const t = ease(frame, lineStart, lineStart + swoopFrames);
        x = lerp(previous.endX, x, t);
        y = lerp(previous.yCenter, y, t);
      }
    }

    return { x, y, scale: c.scale };
  };

  const between = (previous: Cam | null, next: Cam): Camera => {
    const from = previous && previous.zoom ? endFocus(previous) : WIDE;
    const to = next.zoom ? startFocus(next) : WIDE;
    if (from.scale === 1 && to.scale === 1) return WIDE;

    const gapStart = previous ? previous.group.endFrame : 0;
    const gapEnd = next.group.startFrame;
    const gap = Math.max(1, gapEnd - gapStart);

    // Close together and both zoomed: glide across instead of pulling out.
    if (from.scale > 1 && to.scale > 1 && gap <= zoomInFrames * 2) {
      return lerpCam(from, to, ease(frame, gapStart, gapEnd));
    }

    const holdEnd = gapStart + Math.min(holdFrames, Math.floor(gap * 0.25));
    const outEnd = holdEnd + Math.min(zoomOutFrames, Math.floor(gap * 0.35));
    const inStart = gapEnd - Math.min(zoomInFrames, Math.floor(gap * 0.5));

    if (from.scale > 1) {
      if (frame < holdEnd) return from;
      if (frame < outEnd) return lerpCam(from, WIDE, ease(frame, holdEnd, outEnd));
    }
    if (to.scale > 1 && frame >= inStart) {
      return lerpCam(WIDE, to, ease(frame, inStart, gapEnd));
    }
    return WIDE;
  };

  let camera: Camera = WIDE;
  if (cams.length) {
    const last = cams[cams.length - 1];
    if (frame > last.group.endFrame) {
      if (last.zoom) {
        const focus = endFocus(last);
        const holdEnd = last.group.endFrame + holdFrames;
        camera =
          frame <= holdEnd
            ? focus
            : lerpCam(focus, WIDE, ease(frame, holdEnd, holdEnd + zoomOutFrames));
      }
    } else {
      for (let i = 0; i < cams.length; i++) {
        if (frame > cams[i].group.endFrame) continue;
        camera =
          frame >= cams[i].group.startFrame
            ? insideGroup(cams[i])
            : between(i > 0 ? cams[i - 1] : null, cams[i]);
        break;
      }
    }
  }

  // ── Entrances ─────────────────────────────────────────────────────────────
  const enter = (delayFrames: number, damping = 17) =>
    spring({
      frame: Math.max(0, frame - delayFrames),
      fps,
      config: { damping, stiffness: 80 },
    });

  const headlineIn = enter(5, 16);
  const ruleIn = enter(11);
  const descIn = enter(15);
  const metaIn = enter(24, 18);

  const opacity =
    interpolate(frame, [0, Math.round(FADE_IN_SECONDS * fps)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(
      frame,
      [
        Math.max(1, durationInFrames - Math.round(FADE_OUT_SECONDS * fps)),
        Math.max(2, durationInFrames),
      ],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );


  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#070707",
        overflow: "hidden",
        fontFamily: sansFont,
      }}
    >
      {bgImage && (
        <Img
          src={bgImage}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.8,
            filter: "blur(10px) brightness(0.55) saturate(1.1)",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(circle at 15% 22%, ${accent}1F 0%, transparent 48%),
            radial-gradient(circle at 85% 78%, rgba(255,255,255,0.02) 0%, transparent 55%),
            radial-gradient(circle at 50% 38%, rgba(15,15,15,0.35) 0%, rgba(7,7,7,0.92) 85%),
            linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)
          `,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity,
          transformOrigin: "0 0",
          transform: `translate(${WIDE.x - camera.x * camera.scale}px, ${
            WIDE.y - camera.y * camera.scale
          }px) scale(${camera.scale})`,
          willChange: "transform",
        }}
      >
        <div
          id="article-container"
          style={{
            width: CANVAS.width,
            height: CANVAS.height,
            position: "relative",
            padding: "110px 78px 130px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {logo && (
            <div
              style={{
                height: 92,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img
                src={logo}
                style={{
                  height: 85,
                  objectFit: "contain",
                  filter: `drop-shadow(0 0 1px rgba(255,255,255,0.95)) drop-shadow(0 0 6px ${accent}D9) drop-shadow(0 0 18px ${accent}99) brightness(1.3)`,
                }}
              />
            </div>
          )}

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingBottom: 140,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: headlineSize,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.14,
                letterSpacing: "-1.5px",
                textAlign: "left",
                opacity: headlineIn,
                transform: `translateY(${entranceShift("headline", frame)}px)`,
              }}
            >
              <NewsHighlighter
                words={headlineWords}
                highlights={highlights}
                target="headline"
                frame={frame}
                fontSize={headlineSize}
                lineHeight={1.14}
                color="#FFFFFF"
                defaultMarker="yellow"
                fontWeight={900}
                letterSpacing="-1.5px"
              />
            </h1>

            {descriptionWords.length > 0 && (
              <div
                style={{
                  width: 96,
                  height: 4,
                  marginTop: 34,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${accent}, ${accent}00)`,
                  boxShadow: `0 0 14px ${accent}80`,
                  transform: `scaleX(${ruleIn})`,
                  transformOrigin: "left center",
                }}
              />
            )}

            {descriptionWords.length > 0 && (
              <div
                style={{
                  marginTop: 30,
                  textAlign: "left",
                  opacity: descIn,
                  transform: `translateY(${entranceShift("description", frame)}px)`,
                }}
              >
                <NewsHighlighter
                  words={descriptionWords}
                  highlights={highlights}
                  target="description"
                  frame={frame}
                  fontSize={descSize}
                  lineHeight={1.85}
                  color="#CBCBCB"
                  defaultMarker="yellow"
                />
              </div>
            )}

            {(config.author || config.dateStr) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginTop: 48,
                  opacity: metaIn,
                  transform: `translateY(${(1 - metaIn) * 20}px)`,
                }}
              >
                <div
                  style={{
                    width: 3,
                    alignSelf: "stretch",
                    minHeight: 44,
                    borderRadius: 999,
                    background: `linear-gradient(180deg, ${accent}, ${accent}33)`,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {config.author && (
                    <div
                      style={{
                        fontSize: 27,
                        fontWeight: 600,
                        color: "#E4E4E7",
                        letterSpacing: "0.4px",
                      }}
                    >
                      {config.author}
                    </div>
                  )}
                  {config.dateStr && (
                    <div style={{ fontSize: 23, fontWeight: 500, color: "#9C9CA3" }}>
                      {config.dateStr}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 8,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          maskImage:
            "radial-gradient(circle at 50% 50%, transparent 55%, black 92%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, transparent 55%, black 92%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9,
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.30) 70%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <svg
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
          opacity: 0.038,
          mixBlendMode: "overlay",
          width: "100%",
          height: "100%",
        }}
      >
        <filter id="aestheticNewsGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#aestheticNewsGrain)" />
      </svg>
    </AbsoluteFill>
  );
};

export default AestheticNewsLayout;
