// Timing engine. Feeds both calculateMetadata and the renderer, so the
// composition length can never disagree with what is on screen.

import { MAX_ELEMENTS_PER_SCENE } from "./layout";
import type { Scene, SceneElement, StoryConfig } from "./types";

export const DEFAULT_FPS = 30;

export const ENTER_SECONDS = 0.6; // one element's entrance
export const STAGGER_SECONDS = 0.34; // gap between the two entrances
export const EXIT_SECONDS = 0.45; // the scene lifting away as the next arrives
const HOLD_SECONDS = 1.3; // reading time after the last element lands
const MAX_SCENE_SECONDS = 25;

export interface ResolvedElement {
  element: SceneElement;
  id: string;
  index: number;
  enterFrame: number;
}

export interface ResolvedScene {
  scene: Scene;
  elements: ResolvedElement[];
  startFrame: number;
  durationInFrames: number;
}

export interface StoryTimeline {
  fps: number;
  scenes: ResolvedScene[];
  durationInFrames: number;
}

// Types something on screen can actually be drawn for. Anything else — an
// unimplemented type, or a hallucinated one — is dropped before layout so it
// cannot reserve a slot and then render as a hole in the frame.
const SUPPORTED = new Set<string>([
  "text",
  "smartText",
  "number",
  "barGraph",
  "lineGraph",
  "pieChart",
  "table",
  "image",
  "video",
  "portrait",
  "socialEmbed",
  // Editorial devices
  "kicker",
  "bullets",
  "quote",
  "gallery",
  "statRow",
  "divider",
]);

const hasContent = (el: SceneElement): boolean => {
  const any = el as unknown as Record<string, unknown>;
  switch (el.type) {
    case "text":
      return Boolean(String(any.value ?? "").trim());
    case "kicker":
    case "quote":
      return Boolean(String(any.value ?? "").trim());
    case "divider":
      return true;
    case "bullets":
      return (
        Array.isArray(any.items) &&
        (any.items as unknown[]).some((i) => Boolean(String(i ?? "").trim()))
      );
    case "gallery":
      return (
        Array.isArray(any.srcs) && (any.srcs as unknown[]).some((s) => Boolean(s))
      );
    case "statRow":
      return Array.isArray(any.stats) && (any.stats as unknown[]).length > 0;
    case "smartText":
      return Array.isArray(any.segments) && any.segments.length > 0;
    case "barGraph":
      return Array.isArray(any.bars) && any.bars.length > 0;
    case "lineGraph":
      return Array.isArray(any.points) && (any.points as unknown[]).length > 1;
    case "pieChart":
      return Array.isArray(any.sectors) && any.sectors.length > 0;
    case "table":
      return (
        Array.isArray(any.columns) &&
        any.columns.length > 0 &&
        Array.isArray(any.rows) &&
        any.rows.length > 0
      );
    case "image":
    case "video":
    case "portrait":
      return Boolean(any.src);
    default:
      return true;
  }
};

const isRenderable = (el: SceneElement | undefined): boolean =>
  Boolean(el) && SUPPORTED.has(el!.type) && hasContent(el!);

const clampNum = (v: unknown, fallback: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

export const buildStoryTimeline = (config?: StoryConfig): StoryTimeline => {
  const fps = Math.round(clampNum(config?.fps, DEFAULT_FPS, 1, 120));
  const rawScenes = Array.isArray(config?.scenes) ? config!.scenes : [];

  const enterFrames = Math.round(ENTER_SECONDS * fps);
  const staggerFrames = Math.round(STAGGER_SECONDS * fps);
  const exitFrames = Math.round(EXIT_SECONDS * fps);
  const holdFrames = Math.round(HOLD_SECONDS * fps);

  let cursor = 0;
  const scenes: ResolvedScene[] = [];

  rawScenes.forEach((scene, sceneIndex) => {
    const kept = (Array.isArray(scene?.elements) ? scene.elements : [])
      .filter(isRenderable)
      .slice(0, MAX_ELEMENTS_PER_SCENE);

    // With six elements a fixed stagger would take three seconds just to get
    // everything on screen. Tighten the step as the count grows so a busy frame
    // still assembles briskly, and keep a small label ahead of its statement.
    const step =
      kept.length <= 2
        ? staggerFrames
        : Math.max(
            Math.round(staggerFrames * 0.45),
            Math.round((staggerFrames * 2.4) / kept.length),
          );

    const elements = kept.map((element, index) => {
      const auto = index * step;
      const requested =
        element?.at !== undefined
          ? Math.round(clampNum(element.at, 0, 0, MAX_SCENE_SECONDS) * fps)
          : auto;
      return {
        element,
        id: element?.id || `${sceneIndex}-${index}`,
        index,
        // Never before its own slot in the stagger: elements land top-down.
        enterFrame: Math.max(requested, auto),
      };
    });

    const lastLanded = elements.length
      ? Math.max(...elements.map((e) => e.enterFrame)) + enterFrames
      : enterFrames;

    // The scene lifts away inside its own time, so the next one starts clean.
    const isLast = sceneIndex === rawScenes.length - 1;
    const minimum = lastLanded + holdFrames + (isLast ? 0 : exitFrames);
    const requested =
      scene?.durationInSeconds !== undefined
        ? Math.round(clampNum(scene.durationInSeconds, 0, 0, MAX_SCENE_SECONDS) * fps)
        : 0;

    const durationInFrames = Math.max(requested, minimum);

    scenes.push({
      scene,
      elements,
      startFrame: cursor,
      durationInFrames,
    });

    cursor += durationInFrames;
  });

  return {
    fps,
    scenes,
    durationInFrames: Math.max(fps, cursor),
  };
};

export const getStoryDuration = (config?: StoryConfig) =>
  buildStoryTimeline(config).durationInFrames;
