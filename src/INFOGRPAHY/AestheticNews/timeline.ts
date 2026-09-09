// Pacing + camera-safety engine for AestheticNews.
// The composition duration and the rendered camera both read from buildTimeline(),
// so they can never disagree.

export type ZoomSetting = boolean | "auto";
export type HighlightTarget = "headline" | "description";

export interface NewsHighlightInput {
  target?: HighlightTarget;
  at?: number;
  until?: number;
  fromWord?: number;
  toWord?: number;
  color?: string;
  zoom?: ZoomSetting;
  speed?: number;
  // legacy field names (frames instead of seconds)
  startFrame?: number;
  endFrame?: number;
  highlightColor?: string;
  cameraMode?: "auto" | "wide";
  speedMultiplier?: number;
  forceZoom?: boolean;
}

export interface NewsConfigInput {
  fps?: number;
  durationInSeconds?: number;
  durationInFrames?: number;
  kicker?: string;
  logoUrl?: string;
  headline?: string;
  description?: string;
  author?: string;
  dateStr?: string;
  bgImageUrl?: string;
  accentColor?: string;
  highlights?: NewsHighlightInput[];
  script?: { instructions?: NewsHighlightInput[] };
}

export interface ResolvedHighlight {
  target: HighlightTarget;
  fromWord: number;
  toWord: number;
  color?: string;
  startFrame: number;
  endFrame: number;
  wordDurations: number[];
  zoomRequest: ZoomSetting;
  group: number;
}

export interface CameraGroup {
  target: HighlightTarget;
  fromWord: number;
  toWord: number;
  startFrame: number;
  endFrame: number;
  zoom: boolean;
  members: number[];
}

export interface NewsTimeline {
  fps: number;
  headlineWords: string[];
  descriptionWords: string[];
  highlights: ResolvedHighlight[];
  groups: CameraGroup[];
  durationInFrames: number;
}

export const DEFAULT_FPS = 24;

const SECONDS_PER_CHAR = 2.5 / 24; // ~0.104s per character at speed 1
const MIN_WORD_SECONDS = 0.1;
const ENTRANCE_LOCK_SECONDS = 1.0; // text finishes springing in around here
const GROUP_GAP_SECONDS = 0.35;

// Zoom readability floors, in seconds spent per highlighted word.
// Below SOFT, "auto" stops zooming. Below HARD, even zoom:true is refused —
// panning a 3x crop faster than this is unreadable no matter who asked for it.
const ZOOM_SOFT_MIN_SECONDS_PER_WORD = 0.4;
const ZOOM_HARD_MIN_SECONDS_PER_WORD = 0.22;

export const ZOOM_IN_SECONDS = 0.6;
export const EXIT_HOLD_SECONDS = 0.65;
export const EXIT_ZOOM_OUT_SECONDS = 1.0;
export const EXIT_TAIL_SECONDS = 0.6;
export const FADE_IN_SECONDS = 0.85;
export const FADE_OUT_SECONDS = 0.8;
export const LINE_SWOOP_SECONDS = 0.14;

const NO_HIGHLIGHT_SECONDS = 5;

const clampNum = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const clampInt = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
};

export const splitWords = (text: string | undefined): string[] => {
  if (!text) return [];
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
};

// Spread an explicit time window across words, weighted by word length.
const distribute = (words: string[], total: number, minFrames: number): number[] => {
  const weights = words.map((w) => Math.max(1, w.length));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const budget = Math.max(total, words.length * minFrames);
  const out = weights.map((w) =>
    Math.max(minFrames, Math.round((w / weightSum) * budget)),
  );

  let diff = budget - out.reduce((a, b) => a + b, 0);
  if (diff > 0) {
    out[out.length - 1] += diff;
  } else if (diff < 0) {
    for (let i = out.length - 1; i >= 0 && diff < 0; i--) {
      const room = out[i] - minFrames;
      const take = Math.min(room, -diff);
      out[i] -= take;
      diff += take;
    }
  }
  return out;
};

export const buildTimeline = (configInput?: NewsConfigInput): NewsTimeline => {
  const config = configInput || {};
  const fps = Math.round(clampNum(config.fps, DEFAULT_FPS, 1, 120));
  const headlineWords = splitWords(config.headline);
  const descriptionWords = splitWords(config.description);

  const rawList =
    (config.highlights && config.highlights.length
      ? config.highlights
      : config.script?.instructions) || [];

  const minWordFrames = Math.max(1, Math.round(MIN_WORD_SECONDS * fps));
  const entranceLock = Math.round(ENTRANCE_LOCK_SECONDS * fps);

  const highlights: ResolvedHighlight[] = [];
  let cursor = 0;

  for (const item of rawList) {
    if (!item) continue;
    const target: HighlightTarget =
      item.target === "headline" ? "headline" : "description";
    const words = target === "headline" ? headlineWords : descriptionWords;
    if (words.length === 0) continue;

    const maxIdx = words.length - 1;
    const fromWord = clampInt(item.fromWord ?? 0, 0, maxIdx);
    const toWord = clampInt(item.toWord ?? fromWord, fromWord, maxIdx);
    const slice = words.slice(fromWord, toWord + 1);

    const requestedStart =
      item.at !== undefined
        ? Math.round(clampNum(item.at, 0, 0, 3600) * fps)
        : item.startFrame !== undefined
          ? Math.round(clampNum(item.startFrame, 0, 0, 216000))
          : cursor;

    // Never fire during the entrance animation, never overlap the previous highlight.
    const start = Math.max(
      requestedStart,
      highlights.length === 0 ? entranceLock : cursor,
    );

    const speed = clampNum(
      item.speed ?? item.speedMultiplier,
      1,
      0.15,
      4,
    );

    const explicitEnd =
      item.until !== undefined
        ? Math.round(clampNum(item.until, 0, 0, 3600) * fps)
        : item.endFrame !== undefined
          ? Math.round(clampNum(item.endFrame, 0, 0, 216000))
          : undefined;

    const wordDurations =
      explicitEnd !== undefined && explicitEnd > start
        ? distribute(slice, explicitEnd - start, minWordFrames)
        : slice.map((w) =>
            Math.max(
              minWordFrames,
              Math.round(w.length * SECONDS_PER_CHAR * fps * speed),
            ),
          );

    const end = start + wordDurations.reduce((a, b) => a + b, 0);
    cursor = end;

    const zoomRequest: ZoomSetting =
      item.zoom !== undefined
        ? item.zoom
        : item.forceZoom === true
          ? true
          : item.cameraMode === "wide"
            ? false
            : "auto";

    highlights.push({
      target,
      fromWord,
      toWord,
      color: item.color ?? item.highlightColor,
      startFrame: start,
      endFrame: end,
      wordDurations,
      zoomRequest,
      group: 0,
    });
  }

  // Adjacent highlights on the same text become one camera move, so a single
  // red word inside a yellow sentence doesn't make the camera snap out and back.
  const groupGap = Math.round(GROUP_GAP_SECONDS * fps);
  const groups: CameraGroup[] = [];

  highlights.forEach((h, idx) => {
    const prev = groups[groups.length - 1];
    const contiguous =
      prev &&
      prev.target === h.target &&
      h.fromWord <= prev.toWord + 1 &&
      h.startFrame - prev.endFrame <= groupGap;

    if (contiguous) {
      prev.toWord = Math.max(prev.toWord, h.toWord);
      prev.endFrame = h.endFrame;
      prev.members.push(idx);
      if (h.zoomRequest === false) prev.zoom = false;
    } else {
      groups.push({
        target: h.target,
        fromWord: h.fromWord,
        toWord: h.toWord,
        startFrame: h.startFrame,
        endFrame: h.endFrame,
        zoom: h.zoomRequest !== false,
        members: [idx],
        // zoom is re-decided below once the whole group's pace is known
      });
    }
    h.group = groups.length - 1;
  });

  for (const g of groups) {
    const first = highlights[g.members[0]];
    const request: ZoomSetting = g.zoom === false ? false : first.zoomRequest;
    const wordCount = Math.max(1, g.toWord - g.fromWord + 1);
    const secondsPerWord = (g.endFrame - g.startFrame) / wordCount / fps;

    if (request === false) {
      g.zoom = false;
    } else if (request === true) {
      g.zoom = secondsPerWord >= ZOOM_HARD_MIN_SECONDS_PER_WORD;
    } else {
      g.zoom = secondsPerWord >= ZOOM_SOFT_MIN_SECONDS_PER_WORD;
    }
  }

  const lastGroup = groups[groups.length - 1];
  const lastEnd = highlights.length
    ? highlights[highlights.length - 1].endFrame
    : 0;

  const exitFrames = lastGroup
    ? Math.round(
        (lastGroup.zoom
          ? EXIT_HOLD_SECONDS + EXIT_ZOOM_OUT_SECONDS + EXIT_TAIL_SECONDS
          : EXIT_TAIL_SECONDS) * fps,
      )
    : 0;

  const minimumFrames = highlights.length
    ? lastEnd + exitFrames
    : Math.round(NO_HIGHLIGHT_SECONDS * fps);

  const requestedFrames =
    config.durationInFrames !== undefined
      ? Math.round(clampNum(config.durationInFrames, 0, 0, 216000))
      : config.durationInSeconds !== undefined
        ? Math.round(clampNum(config.durationInSeconds, 0, 0, 3600) * fps)
        : undefined;

  // An explicit duration is honoured, but never at the cost of cutting the
  // animation off mid-move.
  const durationInFrames = Math.max(
    Math.round(fps),
    requestedFrames ? Math.max(requestedFrames, minimumFrames) : minimumFrames,
  );

  return {
    fps,
    headlineWords,
    descriptionWords,
    highlights,
    groups,
    durationInFrames,
  };
};

// Word index the marker has reached inside a camera group, as a float.
export const getGroupPen = (
  group: CameraGroup,
  highlights: ResolvedHighlight[],
  frame: number,
): number => {
  let reached = 0;
  for (const idx of group.members) {
    const h = highlights[idx];
    const len = h.toWord - h.fromWord + 1;
    if (frame >= h.endFrame) {
      reached += len;
      continue;
    }
    if (frame <= h.startFrame) return reached;
    let rel = frame - h.startFrame;
    for (let i = 0; i < len; i++) {
      const d = h.wordDurations[i];
      if (rel < d) return reached + i + rel / d;
      rel -= d;
    }
    return reached + len;
  }
  return reached;
};

// Frame at which the marker reaches a given word offset inside a group.
export const getGroupFrameAtWord = (
  group: CameraGroup,
  highlights: ResolvedHighlight[],
  wordOffset: number,
): number => {
  let seen = 0;
  for (const idx of group.members) {
    const h = highlights[idx];
    const len = h.toWord - h.fromWord + 1;
    if (wordOffset <= seen) return h.startFrame;
    if (wordOffset >= seen + len) {
      seen += len;
      continue;
    }
    let frame = h.startFrame;
    for (let i = 0; i < wordOffset - seen; i++) frame += h.wordDurations[i];
    return frame;
  }
  return group.endFrame;
};
