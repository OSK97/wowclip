import React from "react";
import type { HighlightTarget, ResolvedHighlight } from "./timeline";

interface Props {
  words: string[];
  highlights: ResolvedHighlight[];
  target: HighlightTarget;
  frame: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  defaultMarker: string;
  fontWeight?: number;
  letterSpacing?: number | string;
}

// How far the marker has travelled through one highlight, in words.
export const getPenPosition = (h: ResolvedHighlight, frame: number): number => {
  const len = h.toWord - h.fromWord + 1;
  if (frame <= h.startFrame) return 0;
  if (frame >= h.endFrame) return len;
  let rel = frame - h.startFrame;
  for (let i = 0; i < len; i++) {
    const d = h.wordDurations[i];
    if (rel < d) return i + rel / d;
    rel -= d;
  }
  return len;
};

const MARKER_PALETTE: Record<string, string> = {
  yellow: "#FFEB3B",
  default: "#FFEB3B",
  neutral: "#FFEB3B",
  highlight: "#FFEB3B",
  red: "#FF3B30",
  danger: "#FF3B30",
  death: "#FF3B30",
  fatal: "#FF3B30",
  loss: "#FF3B30",
  decline: "#FF3B30",
  crash: "#FF3B30",
  crisis: "#FF3B30",
  war: "#FF3B30",
  fall: "#FF3B30",
  green: "#00E676",
  profit: "#00E676",
  growth: "#00E676",
  success: "#00E676",
  surge: "#00E676",
  gain: "#00E676",
  rise: "#00E676",
  blue: "#38BDF8",
  info: "#38BDF8",
  tech: "#38BDF8",
  orange: "#FB923C",
  warning: "#FB923C",
  caution: "#FB923C",
  alert: "#FB923C",
  purple: "#C084FC",
  violet: "#C084FC",
  premium: "#C084FC",
  legal: "#C084FC",
};

// Marker colour plus the text colour that stays legible on top of it.
export const resolveMarkerColor = (
  input: string | undefined,
  fallback: string,
): { bgColor: string; textColor: string } => {
  const raw = (input && input.trim() ? input : fallback).trim();
  const hex = MARKER_PALETTE[raw.toLowerCase()] || raw;
  const opaque = hex.startsWith("rgba") ? hex.replace(/[\d.]+\)$/, "1)") : hex;

  let r = 255;
  let g = 235;
  let b = 59;

  if (opaque.startsWith("#")) {
    const clean = opaque.slice(1);
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length >= 6) {
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
    }
  } else if (opaque.startsWith("rgb")) {
    const match = opaque.match(/\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/[\s,]+/).map(Number);
      if (parts.length >= 3) [r, g, b] = parts;
    }
  }

  if (![r, g, b].every((v) => isFinite(v))) {
    return { bgColor: MARKER_PALETTE.yellow, textColor: "#111111" };
  }

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return { bgColor: opaque, textColor: luminance < 145 ? "#FFFFFF" : "#111111" };
};

const TEXT_SHADOW =
  "0.8px 0 1.5px rgba(255,0,0,0.28), -0.8px 0 1.5px rgba(0,255,255,0.28), 0 0 10px rgba(255,255,255,0.10)";

export const NewsHighlighter: React.FC<Props> = ({
  words,
  highlights,
  target,
  frame,
  fontSize,
  lineHeight,
  color,
  defaultMarker,
  fontWeight = 400,
  letterSpacing = 0.2,
}) => {
  const mine = highlights.filter((h) => h.target === target);

  return (
    <span
      style={{
        fontSize,
        lineHeight,
        color,
        fontWeight,
        letterSpacing,
        display: "inline-block",
        textShadow: TEXT_SHADOW,
        verticalAlign: "baseline",
      }}
    >
      {words.map((word, i) => {
        // Latest started instruction wins, so recolouring a word later works.
        const active = mine
          .filter((h) => i >= h.fromWord && i <= h.toWord)
          .reduce<ResolvedHighlight | null>(
            (best, h) =>
              !best || (h.startFrame <= frame && h.startFrame >= best.startFrame)
                ? h
                : best,
            null,
          );

        const id = `${target}-word-${i}`;
        const trailingSpace = i < words.length - 1 ? " " : "";

        if (!active) {
          return (
            <span key={i} id={id} style={{ display: "inline" }}>
              {word}
              {trailingSpace}
            </span>
          );
        }

        const wordFill = Math.max(
          0,
          Math.min(
            100,
            (getPenPosition(active, frame) - (i - active.fromWord)) * 100,
          ),
        );

        const isFirst = i === active.fromWord;
        const isLast = i === active.toWord;
        const pad = `3px ${isLast ? "6px" : "0px"} 3px ${isFirst ? "6px" : "0px"}`;

        let radius = "0px";
        if (isFirst && isLast) {
          radius = "255px 15px 225px 15px/15px 225px 15px 255px";
        } else if (isFirst) {
          radius = "255px 0px 0px 15px/15px 0px 0px 255px";
        } else if (isLast) {
          radius = "0px 15px 225px 0px/0px 225px 15px 0px";
        }

        const { bgColor, textColor } = resolveMarkerColor(
          active.color,
          defaultMarker,
        );

        const shadows = [
          "inset 0 2px 3px -1px rgba(255,255,255,0.8)",
          "inset 0 -2px 3px -1px rgba(0,0,0,0.25)",
        ];
        if (isFirst) shadows.push("inset 3px 0 3px -2px rgba(0,0,0,0.15)");
        if (isLast) shadows.push("inset -3px 0 3px -2px rgba(0,0,0,0.15)");

        return (
          <React.Fragment key={i}>
            <span
              style={{
                position: "relative",
                display: "inline-block",
                verticalAlign: "baseline",
                marginLeft: isFirst ? "-6px" : "0px",
                marginRight: isLast ? "-2px" : "-1px",
              }}
            >
              <span
                id={id}
                style={{
                  display: "inline-block",
                  verticalAlign: "baseline",
                  padding: pad,
                  color,
                  textShadow: TEXT_SHADOW,
                  fontWeight,
                  whiteSpace: "pre",
                }}
              >
                {word}
                {isLast ? "" : " "}
              </span>

              {wordFill > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width:
                      wordFill === 100 && !isLast
                        ? "calc(100% + 1.5px)"
                        : `${wordFill}%`,
                    overflow: "hidden",
                    backgroundColor: bgColor,
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.12) 100%)",
                    borderRadius: radius,
                    display: "inline-block",
                    verticalAlign: "baseline",
                    padding: pad,
                    color: textColor,
                    textShadow:
                      textColor === "#FFFFFF"
                        ? "0 1px 2px rgba(0,0,0,0.45)"
                        : "none",
                    fontWeight,
                    whiteSpace: "pre",
                    boxSizing: "border-box",
                    // No per-word drop-shadow: it lands on the neighbouring
                    // word and shows up as a seam once the camera zooms in.
                    boxShadow: shadows.join(", "),
                  }}
                >
                  {word}
                  {isLast ? "" : " "}
                </span>
              )}
            </span>
            {isLast ? trailingSpace : null}
          </React.Fragment>
        );
      })}
    </span>
  );
};
