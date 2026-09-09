import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Rect } from "./layout";
import { lineHeightFor, bulletGap, galleryGrid } from "./layout";
import type {
  BulletsElement,
  GalleryElement,
  ImageElement,
  KickerElement,
  QuoteElement,
  ResolvedTheme,
  StatRowElement,
  TextElement,
  VideoElement,
} from "./types";

import { loadOutfit, loadInter } from "../utils/localFonts";

// Outfit only ships 400/700 locally, so asking for 800/900 silently falls back
// to the browser's faux-bold and titles never actually render heavy. Load what
// exists and use 700 as the display weight.
const { fontFamily: outfitFamily } = loadOutfit("normal", {
  weights: ["400", "700"],
});
const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

interface ElProps<T> {
  el: T;
  rect: Rect;
  fontSize: number;
  theme: ResolvedTheme;
  progress: number;
}

const ease = (p: number) =>
  interpolate(p, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

export const resolveSrc = (src?: string) =>
  !src
    ? undefined
    : src.startsWith("http") || src.startsWith("data:")
      ? src
      : staticFile(src);

/**
 * Drives a value that cycles through a set while its partner stays static.
 * Given the local frame (0 at the element's entrance), how many items there
 * are, and how long each holds, it returns which item is showing, how far it
 * is through its own reveal (0..1, restarts on every swap), and how far it is
 * through its cross-fade OUT (0..1 in the last beat before the next item).
 *
 * With a single item it degenerates to a normal one-shot entrance, so the same
 * view code handles both the static and the swapping case.
 */
const useSwap = (count: number, swapEverySec: number, revealSec = 0.55) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hold = Math.max(1, Math.round(swapEverySec * fps));
  const revealFrames = Math.round(revealSec * fps);
  const fadeFrames = Math.round(0.32 * fps);

  if (count <= 1) {
    return { index: 0, reveal: frame / Math.max(1, revealFrames), fadeOut: 0 };
  }

  // Hold on the last item instead of looping back, so the scene ends on a
  // settled frame rather than mid-swap.
  const raw = Math.floor(frame / hold);
  const index = Math.min(count - 1, raw);
  const local = frame - index * hold;
  const reveal = local / Math.max(1, revealFrames);
  const fadeOut =
    index < count - 1 && local > hold - fadeFrames
      ? (local - (hold - fadeFrames)) / Math.max(1, fadeFrames)
      : 0;
  return { index, reveal, fadeOut };
};

// How many words are mid-flight at once. Higher reads as a wave, lower as a
// typewriter; four is about where it stops looking mechanical.
const REVEAL_WINDOW = 4;

interface Token {
  word: string;
  accent: boolean;
}

/** Splits the copy into words, remembering which ones the LLM emphasised. */
const tokenise = (value: string, emphasis: string[]): Token[] => {
  const phrases = emphasis.filter(Boolean);
  const parts = phrases.length
    ? value.split(
        new RegExp(
          `(${phrases.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
          "gi",
        ),
      )
    : [value];

  const tokens: Token[] = [];
  for (const part of parts) {
    if (!part) continue;
    const accent = phrases.some((e) => e.toLowerCase() === part.toLowerCase());
    for (const word of part.split(/\s+/)) {
      if (word) tokens.push({ word, accent });
    }
  }
  return tokens;
};

/**
 * The shot. A photo or a video fills the entire frame, crops as a camera would
 * crop, and never stops moving — a slow push runs the whole length of the scene.
 * A picture that holds perfectly still reads as a web page; the drift is most of
 * what makes the same asset read as footage.
 */
export const FullBleedMedia: React.FC<{
  el: { src: string };
  isVideo: boolean;
  /** 0 to 1 over the entrance. */
  progress: number;
  /** 0 to 1 across the whole scene, for the push. */
  drift: number;
  /** Where the copy starts, so the subject is never sat on top of. */
  subjectBottom: number;
}> = ({ el, isVideo, progress, drift, subjectBottom }) => {
  const src = resolveSrc(el.src);
  const p = ease(progress);
  // A little more travel on the push so the shot breathes over the scene.
  const scale = 1.05 + drift * 0.12;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* The bleed. A cropped, heavily blurred copy of the same frame fills the
          screen edge to edge — it kills the white surround without cropping
          anything the viewer is meant to see. It drifts the opposite way to the
          subject so the two planes read as depth, not one flat layer. */}
      <AbsoluteFill
        style={{
          transform: `scale(${1.28 + drift * 0.05}) translateY(${drift * -14}px)`,
          filter: "blur(58px) saturate(1.28) brightness(0.82)",
          opacity: p,
          willChange: "transform",
        }}
      >
        {src &&
          (isVideo ? (
            <OffthreadVideo
              src={src}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Img
              src={src}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ))}
      </AbsoluteFill>
      {/* An even wash to pull the blurred plate down and keep contrast on the
          copy — deeper than before so white type never fights a bright photo. */}
      <AbsoluteFill style={{ backgroundColor: "rgba(6,11,22,0.52)" }} />

      {/* The subject, filling the frame edge to edge. A hook photo is the shot,
          so it covers the whole area down to the caption — cropping a strip off
          a landscape frame is what every real reel does, and it kills the hard
          letterbox edges that made the same asset read as boxed. The subject is
          anchored high so a face or a horizon lands in the top two-thirds, well
          clear of the caption. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: Math.max(320, subjectBottom),
          transform: `scale(${scale}) translateY(${drift * 10}px)`,
          transformOrigin: "center 40%",
          opacity: p,
          filter: p < 0.99 ? `blur(${(1 - p) * 16}px)` : undefined,
          willChange: "transform",
          overflow: "hidden",
        }}
      >
        {src &&
          (isVideo ? (
            <OffthreadVideo
              src={src}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Img
              src={src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 38%",
              }}
            />
          ))}
      </div>

      {/* A soft top gradient so the platform status bar / Reels header always
          has something to sit on, without darkening the subject's face. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(3,8,18,0.55) 0%, rgba(3,8,18,0.16) 12%, transparent 26%)",
          pointerEvents: "none",
        }}
      />

      {/* Scrim. Weighted to the foot of the frame so the copy has something to
          sit on, and kept off the top third so the picture still reads. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, transparent 30%, rgba(3,8,18,0.14) 48%, rgba(3,8,18,0.55) 66%, rgba(3,8,18,0.9) 84%, rgba(3,8,18,0.98) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/** One line of copy with the word-by-word reveal. `p` is its own 0..1 reveal
    and `fade` (0..1) is a soft opacity/rise-out for when it is being swapped. */
const TextLine: React.FC<{
  value: string;
  emphasis: string[];
  tone: "title" | "body" | "caption";
  align: "left" | "center" | "right";
  fontSize: number;
  lineHeight: number;
  width: number;
  theme: ResolvedTheme;
  p: number;
  fade?: number;
  absolute?: boolean;
}> = ({ value, emphasis, tone, align, fontSize, lineHeight, width, theme, p, fade = 0, absolute }) => {
  const tokens = tokenise(value, emphasis);
  const isTitle = tone === "title";
  const onDark = theme.mode === "dark";
  const titleShadow = onDark ? "0 2px 24px rgba(0,0,0,0.45)" : "none";

  return (
    <div
      style={{
        ...(absolute ? { position: "absolute", top: 0, left: 0 } : {}),
        width,
        fontSize,
        lineHeight,
        fontFamily: isTitle ? outfitFamily : interFamily,
        fontWeight: isTitle ? 700 : tone === "caption" ? 500 : 600,
        letterSpacing: isTitle ? "-2px" : tone === "caption" ? "0px" : "-0.5px",
        textAlign: align,
        color: tone === "caption" ? theme.muted : theme.text,
        textShadow: isTitle ? titleShadow : undefined,
        textWrap: "balance" as never,
        // While swapping, the outgoing line lifts and fades so the change reads
        // as a deliberate cut, not a flicker.
        opacity: 1 - fade,
        transform: fade ? `translateY(${-fade * 18}px)` : undefined,
        willChange: "opacity, transform",
      }}
    >
      {tokens.map((t, i) => {
        // Each word arrives just after the one before it, so the line reads
        // itself out rather than appearing all at once.
        const wp = interpolate(
          p * (tokens.length + REVEAL_WINDOW) - i,
          [0, REVEAL_WINDOW],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              opacity: wp,
              transform: `translateY(${(1 - wp) * 0.4}em)`,
              willChange: "transform, opacity",
              ...(t.accent
                ? {
                    // A single solid accent reads cleaner than a gradient at
                    // this size and never muddies on a busy photo. Weight, not
                    // hue, does the emphasising; colour just confirms it.
                    color: onDark ? "#7DD3FC" : theme.accent,
                    WebkitTextFillColor: onDark ? "#7DD3FC" : theme.accent,
                    fontWeight: 700,
                  }
                : {}),
            }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
};

export const TextElementView: React.FC<ElProps<TextElement>> = ({
  el,
  rect,
  fontSize,
  theme,
  progress,
}) => {
  const tone = el.tone || "body";
  const align = el.align || "left";
  const lh = lineHeightFor(el);
  const emphasis = el.emphasis || [];

  // The full set of lines. `value` is the first / only one.
  const lines = [el.value || "", ...(el.values || [])].filter(
    (v, i) => i === 0 || Boolean(String(v).trim()),
  );
  const cycles = (el.values || []).filter((v) => Boolean(String(v).trim()));
  const swapping = cycles.length > 0;

  const shared = { emphasis, tone, align, fontSize, lineHeight: lh, width: rect.width, theme };
  const all = [lines[0], ...cycles];

  // Always call the hook (rules of hooks); a single line degenerates to a
  // normal one-shot entrance.
  const { index, reveal, fadeOut } = useSwap(swapping ? all.length : 1, el.swapEvery ?? 1.8);

  // Static case: keep the original one-shot behaviour exactly.
  if (!swapping) {
    return <TextLine {...shared} value={lines[0]} p={ease(progress)} />;
  }

  // Swapping case: the image stays put, the text cycles line by line. Each line
  // re-runs its own word reveal and hands off with a soft cross-fade.
  return (
    <div style={{ position: "relative", width: rect.width }}>
      <TextLine {...shared} value={all[index]} p={reveal} fade={fadeOut} absolute />
    </div>
  );
};

/** One picture, contained (or cover for a circle), with its own reveal `p`
    and an optional swap `fade` (0..1) that scales + fades it out. */
const ImgLayer: React.FC<{
  src?: string;
  circle: boolean;
  p: number;
  fade?: number;
  stacked?: boolean;
}> = ({ src, circle, p, fade = 0, stacked }) => {
  if (!src) return null;
  const eased = ease(p);
  // A slow settle out of a slight over-scale. The picture never crops on entry.
  const zoom = (1 + 0.04 * (1 - eased)) * (1 - fade * 0.06);
  const blur = eased < 0.985 ? (1 - eased) * 12 : 0;
  return (
    <Img
      src={src}
      style={{
        ...(stacked ? { position: "absolute", inset: 0 } : {}),
        width: "100%",
        height: "100%",
        // Contain everywhere except the circle, which has to be filled: it may
        // letterbox, but it can never distort or crop the subject. The whole
        // picture is always visible — no zoom-crop.
        objectFit: circle ? "cover" : "contain",
        objectPosition: "center",
        transform: `scale(${zoom})`,
        opacity: eased * (1 - fade),
        // drop-shadow follows the actual contained/cut-out edges, so a
        // transparent PNG casts a shadow off the subject, not off an
        // invisible box around it.
        filter: circle
          ? undefined
          : `drop-shadow(0 30px 42px rgba(15,23,42,0.28))${blur ? ` blur(${blur}px)` : ""}`,
        willChange: "transform, opacity",
      }}
    />
  );
};

export const ImageElementView: React.FC<ElProps<ImageElement>> = ({
  el,
  rect,
  theme,
  progress,
}) => {
  const circle = el.shape === "circle";
  const captionH = el.caption ? 58 : 0;
  const size = Math.max(160, rect.height - captionH);

  // The full set of images. `src` is the first / only one.
  const cycles = (el.srcs || []).filter(Boolean);
  const swapping = cycles.length > 0;
  const all = [el.src, ...cycles].filter(Boolean);

  // Always call the hook (rules of hooks); with a single image it degenerates
  // to a normal one-shot entrance driven by the frame.
  const swap = useSwap(swapping ? all.length : 1, el.swapEvery ?? 1.6);

  const p = swapping ? swap.reveal : ease(progress);
  const rise = (1 - ease(p)) * 26;

  // Which image(s) to draw: in the swapping case the outgoing one cross-fades
  // under the incoming one; otherwise it is just the single asset.
  const index = swapping ? swap.index : 0;
  const curSrc = resolveSrc(all[index]);
  const prevSrc = swapping && swap.index > 0 ? resolveSrc(all[index - 1]) : undefined;
  const enteringFade = swapping ? Math.max(0, 1 - ease(swap.reveal / 0.6)) : 0;

  return (
    <div style={{ width: rect.width }}>
      <div
        style={{
          position: "relative",
          width: circle ? size : "100%",
          height: size,
          // Centre the contained image inside its slot so a portrait or square
          // asset sits in the middle of the reserved box — the card-view look,
          // whatever shape you drop in.
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // No card, no padding, no panel behind the asset. It sits directly on
          // the stage.
          borderRadius: circle ? "50%" : 22,
          overflow: circle ? "hidden" : "visible",
          transform: `translateY(${rise}px)`,
          willChange: "transform",
          boxShadow: circle
            ? `0 30px 64px -26px rgba(15,23,42,0.5), 0 0 0 6px ${
                theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"
              }`
            : undefined,
        }}
      >
        {/* Outgoing image, fading + lifting under the incoming one on a swap. */}
        {prevSrc && enteringFade > 0.01 && (
          <ImgLayer src={prevSrc} circle={circle} p={1} fade={1 - enteringFade} stacked />
        )}
        {/* Current image. On a swap it reveals with its own clarity wipe. */}
        <ImgLayer
          src={curSrc}
          circle={circle}
          p={p}
          stacked={Boolean(prevSrc && enteringFade > 0.01)}
        />
      </div>
      {el.caption && (
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 600,
            fontFamily: interFamily,
            color: theme.muted,
            letterSpacing: "-0.2px",
            opacity: ease(p),
          }}
        >
          {el.caption}
        </div>
      )}
    </div>
  );
};

export const VideoElementView: React.FC<ElProps<VideoElement>> = ({
  el,
  rect,
  theme,
  progress,
}) => {
  const src = resolveSrc(el.src);
  const captionH = el.caption ? 58 : 0;
  const p = ease(progress);
  const rise = (1 - p) * 24;

  return (
    <div style={{ width: rect.width }}>
      <div
        style={{
          width: "100%",
          height: Math.max(160, rect.height - captionH),
          borderRadius: 24,
          overflow: "hidden",
          transform: `translateY(${rise}px)`,
          willChange: "transform",
          boxShadow:
            theme.mode === "dark"
              ? "0 24px 48px -12px rgba(0,0,0,0.5)"
              : "0 24px 50px -12px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.06)",
        }}
      >
        {src && (
          <OffthreadVideo
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
      {el.caption && (
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 600,
            fontFamily: interFamily,
            color: theme.muted,
            letterSpacing: "-0.2px",
            opacity: p,
          }}
        >
          {el.caption}
        </div>
      )}
    </div>
  );
};

/* ── Editorial devices ────────────────────────────────────────────────────────
   These are the pieces that make a frame read as a page out of a documentary
   rather than a slide: a label above the statement, a list that builds, a
   pulled quote, a contact sheet, a strip of figures, a hairline rule.
   ────────────────────────────────────────────────────────────────────────── */

/** Small uppercase label with a short accent rule. The cheapest editorial mark
    there is, and the one that does the most work. */
export const KickerElementView: React.FC<ElProps<KickerElement>> = ({
  el,
  rect,
  fontSize,
  theme,
  progress,
}) => {
  const p = ease(progress);
  const showRule = el.rule !== false;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: rect.width,
        opacity: p,
      }}
    >
      {showRule && (
        <div
          style={{
            width: Math.round(52 * p),
            height: 4,
            borderRadius: 2,
            background: theme.accent,
            flex: "0 0 auto",
          }}
        />
      )}
      <span
        style={{
          fontFamily: interFamily,
          fontSize,
          fontWeight: 700,
          // Wide tracking is what separates a label from body copy.
          letterSpacing: "0.19em",
          textTransform: "uppercase",
          color: theme.accent,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {el.value}
      </span>
    </div>
  );
};

const MARKERS = {
  dash: "—",
  dot: "•",
  check: "✓",
} as const;

/** A list that builds one line at a time. */
export const BulletsElementView: React.FC<ElProps<BulletsElement>> = ({
  el,
  rect,
  fontSize,
  theme,
  progress,
}) => {
  const items = (el.items || []).filter((i) => String(i ?? "").trim());
  const kind = el.marker || "dash";
  const gap = bulletGap(fontSize);
  const markerWidth = Math.round(fontSize * 1.5);

  return (
    <div
      style={{
        width: rect.width,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {items.map((item, i) => {
        // Each line arrives after the one above it.
        const ip = interpolate(
          progress * (items.length + 1.6) - i,
          [0, 1.5],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const e = ease(ip);
        const hot = el.highlight === i;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              opacity: e,
              transform: `translateX(${(1 - e) * -18}px)`,
              willChange: "transform, opacity",
            }}
          >
            <span
              style={{
                width: markerWidth,
                flex: "0 0 auto",
                fontFamily: interFamily,
                fontSize: kind === "number" ? Math.round(fontSize * 0.78) : fontSize,
                fontWeight: 700,
                lineHeight: lineHeightFor(el),
                // The marker always carries the accent — it is the rhythm of
                // the list, and colouring the text instead would shout.
                color: hot ? theme.accent : theme.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {kind === "number" ? `${i + 1}.` : MARKERS[kind]}
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: interFamily,
                fontSize,
                fontWeight: hot ? 700 : 500,
                lineHeight: lineHeightFor(el),
                letterSpacing: "-0.3px",
                color: hot ? theme.text : theme.mode === "dark" ? "#CBD5E1" : "#334155",
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** A pulled quote, hanging off an oversized mark. */
export const QuoteElementView: React.FC<ElProps<QuoteElement>> = ({
  el,
  rect,
  fontSize,
  theme,
  progress,
}) => {
  const p = ease(progress);
  const tokens = (el.value || "").split(/\s+/).filter(Boolean);

  return (
    <div style={{ width: rect.width, display: "flex", gap: 14 }}>
      {/* The mark sits outside the column so the copy keeps a straight left
          edge — the detail that separates a real pull quote from italic text. */}
      <span
        style={{
          fontFamily: outfitFamily,
          fontSize: Math.round(fontSize * 1.5),
          fontWeight: 700,
          lineHeight: 0.9,
          color: theme.accent,
          opacity: p,
          flex: "0 0 auto",
        }}
      >
        “
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: outfitFamily,
            fontSize,
            fontWeight: 700,
            lineHeight: lineHeightFor(el),
            letterSpacing: "-1px",
            color: theme.text,
          }}
        >
          {tokens.map((w, i) => {
            const wp = interpolate(
              p * (tokens.length + REVEAL_WINDOW) - i,
              [0, REVEAL_WINDOW],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.26em",
                  opacity: wp,
                  transform: `translateY(${(1 - wp) * 0.36}em)`,
                  willChange: "transform, opacity",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        {el.author && (
          <div
            style={{
              marginTop: Math.round(fontSize * 0.34),
              fontFamily: interFamily,
              fontSize: Math.round(fontSize * 0.46),
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: theme.muted,
              opacity: interpolate(p, [0.6, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {`— ${el.author}`}
          </div>
        )}
      </div>
    </div>
  );
};

/** A contact sheet. Every tile is the same shape, so the grid reads as
    deliberate; tiles fill their cell by default and are never stretched. */
export const GalleryElementView: React.FC<ElProps<GalleryElement>> = ({
  el,
  rect,
  theme,
  progress,
}) => {
  const srcs = (el.srcs || []).filter(Boolean).slice(0, 6);
  const grid = galleryGrid(srcs.length, rect.width);
  const captions = el.captions || [];
  const fit = el.fit === "contain" ? "contain" : "cover";

  return (
    <div
      style={{
        width: rect.width,
        display: "grid",
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gap: grid.gap,
      }}
    >
      {srcs.map((raw, i) => {
        const src = resolveSrc(raw);
        // Tiles land one after another, reading order.
        const ip = interpolate(progress * (srcs.length + 1.4) - i, [0, 1.4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const e = ease(ip);
        const hot = el.highlight === i;

        return (
          <div key={i} style={{ opacity: e }}>
            <div
              style={{
                width: "100%",
                height: grid.tileHeight,
                borderRadius: 16,
                overflow: "hidden",
                transform: `scale(${0.94 + e * 0.06})`,
                // The accented tile gets a ring rather than a border on all of
                // them — one thing stands out, the rest stay quiet.
                boxShadow: hot
                  ? `0 0 0 4px ${theme.accent}, 0 20px 40px -15px rgba(15,23,42,0.2)`
                  : theme.mode === "dark"
                    ? "0 18px 34px -20px rgba(15,23,42,0.4)"
                    : "0 14px 30px -15px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06)",
                willChange: "transform, opacity",
              }}
            >
              {src && (
                <Img
                  src={src}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    objectPosition: "center",
                  }}
                />
              )}
            </div>
            {captions[i] && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: interFamily,
                  fontSize: 22,
                  fontWeight: 600,
                  color: theme.muted,
                  letterSpacing: "-0.2px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {captions[i]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Two to four figures across one row — the "by the numbers" strip. */
export const StatRowElementView: React.FC<ElProps<StatRowElement>> = ({
  el,
  rect,
  fontSize,
  theme,
  progress,
}) => {
  const stats = (el.stats || []).slice(0, 4);
  // More figures means each gets less width, so the type steps down to match.
  const valueSize = Math.round(
    fontSize * (stats.length <= 2 ? 1 : stats.length === 3 ? 0.82 : 0.68),
  );

  return (
    <div
      style={{
        width: rect.width,
        display: "flex",
        alignItems: "flex-start",
        gap: 26,
      }}
    >
      {stats.map((s, i) => {
        const ip = interpolate(progress * (stats.length + 1.3) - i, [0, 1.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const e = ease(ip);
        const hot = el.highlight === i;

        return (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              opacity: e,
              transform: `translateY(${(1 - e) * 16}px)`,
              willChange: "transform, opacity",
            }}
          >
            <div
              style={{
                fontFamily: outfitFamily,
                fontSize: valueSize,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: "-1.6px",
                color: hot ? theme.accent : theme.text,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {`${s.prefix ?? ""}${s.value ?? ""}${s.suffix ?? ""}`}
            </div>
            {s.label && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: interFamily,
                  fontSize: Math.round(valueSize * 0.3),
                  fontWeight: 600,
                  lineHeight: 1.3,
                  letterSpacing: "0.02em",
                  color: theme.muted,
                }}
              >
                {s.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** A hairline rule that draws itself in. Pure rhythm. */
export const DividerElementView: React.FC<ElProps<{ type: "divider" }>> = ({
  rect,
  theme,
  progress,
}) => {
  const p = ease(progress);
  return (
    <div
      style={{
        width: rect.width,
        height: 34,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: `${p * 100}%`,
          height: 2,
          background:
            theme.mode === "dark"
              ? "rgba(226,232,240,0.20)"
              : "rgba(15,23,42,0.14)",
          borderRadius: 1,
        }}
      />
    </div>
  );
};
