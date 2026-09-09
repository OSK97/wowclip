import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CANVAS, SAFE, layoutCinemaText, layoutScene } from "./layout";

// Fallback subject foot when a photo scene has no caption: stop just inside the
// platform chrome so the picture never runs under the caption / action column.
const SAFE_BOTTOM_APPROX = SAFE.bottom - 60;
import type { PlacedElement, Rect } from "./layout";
import {
  BulletsElementView,
  DividerElementView,
  FullBleedMedia,
  GalleryElementView,
  ImageElementView,
  KickerElementView,
  QuoteElementView,
  StatRowElementView,
  TextElementView,
  VideoElementView,
} from "./elements";
import { renderTemplateElement } from "./adapters";
import { ENTER_SECONDS, EXIT_SECONDS } from "./timeline";
import type { ResolvedScene } from "./timeline";
import type { ResolvedTheme } from "./types";

// Elements that reveal their own contents over time. Their container is held
// still so the two animations do not compound.
const SELF_ANIMATING = new Set<string>([
  "text",
  "kicker",
  "bullets",
  "quote",
  "statRow",
  "divider",
  "gallery",
]);

// Elements drawn in house, anchored to the top-left of their slot. Everything
// else is a template that centres itself, so a connector has to reach further
// in to actually touch what the viewer sees.
const TOP_ANCHORED = new Set<string>([
  "text",
  "image",
  "video",
  "kicker",
  "bullets",
  "quote",
  "statRow",
  "divider",
  "gallery",
]);

const easeOut = (frame: number, from: number, to: number) =>
  to <= from
    ? 1
    : interpolate(frame, [from, to], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });

const renderElement = (
  placed: PlacedElement,
  theme: ResolvedTheme,
  progress: number,
  fps: number,
) => {
  const { element, rect, fontSize } = placed;
  const props = { rect, fontSize, theme, progress };

  // Types with no template of their own are drawn in house.
  switch (element.type) {
    case "text":
      return <TextElementView el={element} {...props} />;
    case "image":
      return <ImageElementView el={element} {...props} />;
    case "video":
      return <VideoElementView el={element} {...props} />;
    // Editorial devices.
    case "kicker":
      return <KickerElementView el={element} {...props} />;
    case "bullets":
      return <BulletsElementView el={element} {...props} />;
    case "quote":
      return <QuoteElementView el={element} {...props} />;
    case "gallery":
      return <GalleryElementView el={element} {...props} />;
    case "statRow":
      return <StatRowElementView el={element} {...props} />;
    case "divider":
      return <DividerElementView el={element} {...props} />;
    default:
      break;
  }

  // Everything else is the real template, sized to its slot. They position
  // themselves with AbsoluteFill, so they need a relative box of exact size.
  const node = renderTemplateElement(element, { rect, theme, fps });
  if (!node) return null;
  return (
    <div style={{ position: "relative", width: rect.width, height: rect.height }}>
      {node}
    </div>
  );
};

// A real dashed line that draws itself on. The dash pattern stays fixed while a
// mask sweeps along the path to reveal it — animating the dash array directly
// just grows one long dash, which is what made this look like a stub before.
const Connector: React.FC<{
  id: string;
  from: Rect;
  to: Rect;
  /** Template-rendered elements centre their content inside the slot, so the
      line has to run further in to actually reach what the viewer sees. */
  toIsCentred: boolean;
  theme: ResolvedTheme;
  progress: number;
  shift: number;
}> = ({ id, from, to, toIsCentred, theme, progress, shift }) => {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height + 26;
  const x2 = to.x + to.width / 2;
  const y2 = toIsCentred ? to.y + Math.min(140, to.height * 0.24) : to.y - 26;
  if (y2 <= y1 + 8 || progress <= 0) return null;

  const mid = (y1 + y2) / 2;
  const bow = Math.min(64, (y2 - y1) * 0.14);
  const path = `M${x1},${y1} C${x1 - bow},${mid - (y2 - y1) * 0.18} ${x2 + bow},${mid + (y2 - y1) * 0.18} ${x2},${y2}`;
  const span = Math.hypot(x2 - x1, y2 - y1) + 200;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        transform: `translateY(${shift}px)`,
      }}
      width={CANVAS.width}
      height={CANVAS.height}
    >
      <defs>
        {/* userSpaceOnUse is required: a straight vertical connector has a
            zero-width bounding box, and the default objectBoundingBox units
            would collapse the mask region and hide the line entirely. */}
        <mask
          id={`connector-${id}`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={CANVAS.width}
          height={CANVAS.height}
        >
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth={26}
            strokeDasharray={span}
            strokeDashoffset={span * (1 - progress)}
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={theme.connector}
        strokeWidth={5}
        strokeDasharray="14 14"
        strokeLinecap="round"
        mask={`url(#connector-${id})`}
      />
    </svg>
  );
};

// White type over a photograph, and a brighter accent so it survives the scrim.
const invert = (theme: ResolvedTheme): ResolvedTheme => ({
  ...theme,
  mode: "dark",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.74)",
  accent: "#38BDF8",
});

export const SceneView: React.FC<{
  resolved: ResolvedScene;
  theme: ResolvedTheme;
}> = ({ resolved, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = Math.round(ENTER_SECONDS * fps);
  const exitFrames = Math.round(EXIT_SECONDS * fps);
  const exitStart = Math.max(0, resolved.durationInFrames - exitFrames);

  // Scenes do not cut, they rack out of focus. The outgoing frame softens and
  // opens up slightly while the incoming one resolves — the join reads as an
  // edit rather than as one page replacing another.
  const sceneOut = interpolate(frame, [exitStart, resolved.durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const sceneIn = easeOut(frame, 0, Math.round(enterFrames * 0.8));
  const focus = sceneOut * 18 + (1 - sceneIn) * 7;

  const transition: React.CSSProperties = {
    transform: `scale(${1 + sceneOut * 0.06 + (1 - sceneIn) * 0.015})`,
    filter: focus > 0.4 ? `blur(${focus}px)` : undefined,
    opacity: 1 - sceneOut,
    willChange: "transform, filter, opacity",
  };

  // Full-bleed "shot" treatment is opt-in: photo or video fills the whole
  // frame only when the JSON asks for it (layout: "cinema" or shape: "full").
  // Otherwise it sits card-view on the white stage as the visual half of a pair.
  const lead = resolved.elements[0]?.element;
  const isMedia = lead?.type === "image" || lead?.type === "video";
  const isCinema =
    isMedia &&
    (resolved.scene.layout === "cinema" ||
      (lead as { shape?: string }).shape === "full");

  if (isCinema) {
    const media = lead as { src: string };
    const copy = resolved.elements[1];
    const shotTheme = invert(theme);
    // The push runs the whole scene, so the frame is never truly still.
    const drift = interpolate(frame, [0, resolved.durationInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // The copy sits at the foot of the safe band; the subject fills the frame
    // down to just above it, so a full-bleed photo actually reads full-bleed
    // instead of collapsing to a strip at the top.
    const copySlot =
      copy?.element.type === "text" ? layoutCinemaText(copy.element) : null;
    const subjectBottom = copySlot
      ? copySlot.rect.y - 40
      : CANVAS.height - SAFE_BOTTOM_APPROX;

    return (
      <AbsoluteFill style={transition}>
        <FullBleedMedia
          el={media}
          isVideo={lead?.type === "video"}
          progress={easeOut(frame, 0, enterFrames * 2)}
          drift={drift}
          subjectBottom={subjectBottom}
        />
        {copy?.element.type === "text" &&
          frame >= copy.enterFrame &&
          copySlot &&
          (() => {
            const slot = copySlot;
            return (
              <div
                style={{
                  position: "absolute",
                  left: slot.rect.x,
                  top: slot.rect.y - 26,
                  width: slot.rect.width,
                }}
              >
                {/* A short accent rule that draws in before the words — the
                    single mark that turns floating text into a lower third. */}
                <div
                  style={{
                    height: 5,
                    width:
                      64 *
                      easeOut(
                        frame,
                        copy.enterFrame,
                        copy.enterFrame + Math.round(enterFrames * 0.9),
                      ),
                    borderRadius: 3,
                    marginBottom: 20,
                    background: shotTheme.accent,
                    boxShadow: `0 0 22px ${shotTheme.accent}`,
                  }}
                />
                <Sequence from={copy.enterFrame} layout="none">
                  <TextElementView
                    el={copy.element}
                    rect={slot.rect}
                    fontSize={slot.fontSize}
                    theme={shotTheme}
                    progress={easeOut(
                      frame,
                      copy.enterFrame,
                      copy.enterFrame + Math.round(enterFrames * 2.8),
                    )}
                  />
                </Sequence>
              </div>
            );
          })()}
      </AbsoluteFill>
    );
  }

  // Widen the gap where a connector will be drawn between the pair.
  const connectedAfter = new Set<number>();
  for (const c of resolved.scene.connections || []) {
    const fromIndex = resolved.elements.findIndex((e) => e.id === c.from);
    const toIndex = resolved.elements.findIndex((e) => e.id === c.to);
    if (fromIndex >= 0 && toIndex === fromIndex + 1) connectedAfter.add(fromIndex);
  }

  const placed = layoutScene(
    resolved.elements.map((e) => e.element),
    connectedAfter,
    resolved.scene.layout,
  );
  const rectById = new Map<string, Rect>();
  placed.forEach((p, i) => {
    const id = resolved.elements[i]?.id;
    if (id) rectById.set(id, p.rect);
  });

  const enterAt = (index: number) => resolved.elements[index]?.enterFrame ?? 0;

  // The scene as a whole racks out of focus; on top of that the elements lift,
  // the lower one a beat after the upper, so the frame empties rather than
  // blinking out.
  const exitOf = (index: number) => {
    const start = exitStart + index * Math.round(exitFrames * 0.22);
    return interpolate(frame, [start, start + exitFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    });
  };

  return (
    <AbsoluteFill style={transition}>
      {(resolved.scene.connections || []).map((c, i) => {
        const from = rectById.get(c.from);
        const to = rectById.get(c.to);
        if (!from || !to) return null;
        const fromIndex = resolved.elements.findIndex((e) => e.id === c.from);
        const toIndex = resolved.elements.findIndex((e) => e.id === c.to);
        const start = Math.max(enterAt(fromIndex), enterAt(toIndex)) + enterFrames;
        const gone = exitOf(0);
        if (gone >= 1) return null;
        return (
          <Connector
            key={i}
            id={`${resolved.scene.id ?? "s"}-${i}`}
            from={from}
            to={to}
            toIsCentred={
              !TOP_ANCHORED.has(resolved.elements[toIndex]?.element.type ?? "")
            }
            theme={theme}
            progress={easeOut(frame, start, start + Math.round(fps * 0.6)) * (1 - gone)}
            shift={-gone * 150}
          />
        );
      })}

      {placed.map((p, i) => {
        const meta = resolved.elements[i];
        const at = enterAt(i);
        if (frame < at) return null;

        // A spring lands with weight instead of easing to a stop, which is what
        // makes an element read as placed rather than faded in.
        const land = spring({
          frame: frame - at,
          fps,
          config: { damping: 21, mass: 0.8, stiffness: 108 },
          durationInFrames: Math.round(enterFrames * 1.7),
        });
        // These types animate their own contents — words, list items, tiles,
        // figures — so their container must stay still or the two motions
        // fight each other and the result reads as jelly.
        const isText = SELF_ANIMATING.has(p.element.type);
        const opacity = easeOut(frame, at, at + Math.round(enterFrames * 0.7));
        // Content keeps animating after the container has landed. Text needs a
        // longer window because its words arrive one after another.
        const reveal = easeOut(frame, at, at + Math.round(enterFrames * (isText ? 2.8 : 2.2)));

        const out = exitOf(i);
        const rise = isText ? 0 : (1 - land) * 30;
        const scale = isText ? 1 : 0.965 + land * 0.035;

        return (
          <div
            key={meta?.id ?? i}
            style={{
              position: "absolute",
              left: p.rect.x,
              top: p.rect.y,
              width: p.rect.width,
              // Only a partial fade here — the scene container is already
              // taking the frame down, and doubling it snaps things out.
              opacity: opacity * (1 - out * 0.55),
              transform: `translateY(${rise - out * 130}px) scale(${scale})`,
              transformOrigin: "left top",
              filter: !isText && land < 0.995 ? `blur(${(1 - land) * 8}px)` : undefined,
              willChange: "transform, opacity",
            }}
          >
            <Sequence from={at} layout="none">
              {renderElement(p, theme, reveal, fps)}
            </Sequence>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
