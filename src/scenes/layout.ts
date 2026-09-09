// Geometry engine. The LLM never sets a size or a position — everything on
// screen is placed here, so a bad JSON can crowd a frame but can never break it.
//
// The contract: the LLM says WHAT is on screen and in WHAT ORDER. This file
// decides where each thing goes, how big it is, and guarantees the result fits
// inside the safe band without overflowing, stretching or overlapping.
//
// It handles one element or six, a single chart or a grid of images, and it
// arrives at a composition rather than a list of boxes.

import type { ElementType, SceneElement, SceneLayout } from "./types";

export const CANVAS = { width: 1080, height: 1920 };

// Platform chrome on a 1080x1920 frame, taken from the harsher of the two
// targets so a frame that reads here reads on both:
//
//   Instagram Reels   bottom ~360-420  handle, caption, audio ticker, nav bar
//                     right  ~170      like / comment / share / more / disc
//                     top    ~150      status bar + "Reels" header
//   YouTube Shorts    bottom ~330      title, channel row, progress bar
//                     right  ~170      the same action column
//                     top    ~120      search / more
//
// The right inset is what pushes every frame left, and the deep bottom inset is
// what pushes it up — together they give the top-left weighted composition that
// short-form graphics need. Nothing but the background may cross these.
export const SAFE = {
  top: 170,
  bottom: 460,
  left: 56,
  right: 156,
};

export const CONTENT_WIDTH = CANVAS.width - SAFE.left - SAFE.right;
export const BAND_HEIGHT = CANVAS.height - SAFE.top - SAFE.bottom;

// Six is the point past which a 1080-wide portrait frame stops being readable
// at arm's length. Extra elements are dropped rather than crammed.
export const MAX_ELEMENTS_PER_SCENE = 6;

// Vertical rhythm between rows, and horizontal gutter between items sharing a
// row. Both are deliberately generous — crowding is what makes a frame look
// like a dashboard instead of a page.
const ROW_GAP = 46;
const COL_GAP = 30;

// A connected pair needs real space between them or the dashed line has nowhere
// to draw.
const CONNECTOR_GAP = 170;

// Nothing is ever typeset smaller than this, whatever the LLM sends.
const MIN_FONT = 34;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedElement {
  element: SceneElement;
  rect: Rect;
  /** Font size the text-like elements were finally fitted at. */
  fontSize: number;
}

interface Spec {
  /** Grows to fill leftover space (visuals) vs. sized by its content (text). */
  kind: "visual" | "text";
  minHeight: number;
  maxHeight: number;
  /** width / height. When set, height is derived and never stretched. */
  aspect?: number;
  /** Relative appetite for leftover space when several visuals compete. */
  weight?: number;
}

const SPECS: Record<ElementType, Spec> = {
  // ── Text-like: height follows the copy ──────────────────────────────────
  kicker: { kind: "text", minHeight: 44, maxHeight: 92 },
  text: { kind: "text", minHeight: 60, maxHeight: 620 },
  smartText: { kind: "text", minHeight: 200, maxHeight: 660 },
  quote: { kind: "text", minHeight: 160, maxHeight: 700 },
  bullets: { kind: "text", minHeight: 120, maxHeight: 720 },
  statRow: { kind: "text", minHeight: 180, maxHeight: 300 },
  divider: { kind: "text", minHeight: 34, maxHeight: 34 },

  // ── Visuals: take the room left over ────────────────────────────────────
  barGraph: { kind: "visual", minHeight: 420, maxHeight: 900, aspect: 1.16, weight: 1.2 },
  lineGraph: { kind: "visual", minHeight: 400, maxHeight: 860, aspect: 1.24, weight: 1.2 },
  pieChart: { kind: "visual", minHeight: 360, maxHeight: 820, weight: 1.1 },
  table: { kind: "visual", minHeight: 320, maxHeight: 940, weight: 1 },
  // 3:2, the shape most photography actually is. A box that does not match the
  // picture letterboxes it, and although the letterbox is invisible on a white
  // stage it still pushes the caption away — so the default has to be close to
  // the common case. A tall picture simply sits narrower inside it.
  image: { kind: "visual", minHeight: 300, maxHeight: 880, aspect: 1.5, weight: 1 },
  video: { kind: "visual", minHeight: 300, maxHeight: 900, aspect: 16 / 9, weight: 1 },
  gallery: { kind: "visual", minHeight: 300, maxHeight: 900, weight: 1.1 },
  number: { kind: "visual", minHeight: 220, maxHeight: 440, aspect: 2.1, weight: 0.7 },
  portrait: { kind: "visual", minHeight: 400, maxHeight: 900, aspect: 1.05, weight: 1 },
  map: { kind: "visual", minHeight: 400, maxHeight: 880, aspect: 0.95, weight: 1.1 },
  socialEmbed: { kind: "visual", minHeight: 340, maxHeight: 860, weight: 1 },
};

const specOf = (el: SceneElement): Spec =>
  SPECS[el.type] ?? { kind: "text", minHeight: 60, maxHeight: 400 };

export const isVisual = (el: SceneElement) => specOf(el).kind === "visual";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── Text measurement ─────────────────────────────────────────────────────── */

const textOf = (el: SceneElement): string => {
  const any = el as unknown as Record<string, unknown>;
  switch (el.type) {
    case "text": {
      // When the line cycles through a set, size the slot to the LONGEST line so
      // the box and the font stay fixed while the copy swaps — the text never
      // jumps size mid-scene.
      const set = any.values as string[] | undefined;
      const base = String(any.value ?? "");
      if (Array.isArray(set) && set.length) {
        return set.reduce((a, b) => (String(b).length > a.length ? String(b) : a), base);
      }
      return base;
    }
    case "kicker":
      return String(any.value ?? "");
    case "quote":
      return `${any.value ?? ""} ${any.author ?? ""}`;
    case "bullets":
      return ((any.items as string[]) || []).join(" ");
    case "number":
      return `${any.value ?? ""} ${any.label ?? ""}`;
    case "smartText": {
      const segs = (any.segments as unknown[]) || [];
      return segs
        .map((s) => {
          const seg = s as { value?: string; text?: string };
          return seg?.value ?? seg?.text ?? "";
        })
        .join(" ");
    }
    default:
      return "";
  }
};

// Inter averages ~0.52em per character; good enough to predict wrap height.
const measureText = (text: string, fontSize: number, width: number, lineHeight: number) => {
  const perLine = Math.max(6, Math.floor(width / (fontSize * 0.52)));
  const explicit = text.split("\n");
  let lines = 0;
  for (const chunk of explicit) {
    lines += Math.max(1, Math.ceil(chunk.length / perLine));
  }
  return Math.ceil(lines * fontSize * lineHeight);
};

/**
 * Type size follows the amount of copy rather than a fixed scale: six words is
 * a statement and gets set large, forty words is an explanation and gets set
 * small. This is why a caption never needs hand tuning.
 */
const baseFont = (el: SceneElement): number => {
  if (el.type === "number") return 190;
  if (el.type === "smartText") return 80; // measurement only; the view sets its own
  if (el.type === "kicker") return 30;
  if (el.type === "divider") return 0;
  if (el.type === "statRow") return 76;

  const chars = textOf(el).trim().length;

  if (el.type === "quote") {
    return chars <= 60 ? 72 : chars <= 120 ? 62 : chars <= 200 ? 54 : 46;
  }
  if (el.type === "bullets") {
    const items = ((el as { items?: string[] }).items || []).length;
    const longest = ((el as { items?: string[] }).items || []).reduce(
      (n, s) => Math.max(n, String(s).length),
      0,
    );
    // More items, or longer items, means smaller type — the list has to fit as
    // a block or it stops reading as one thought.
    const byCount = items <= 3 ? 54 : items <= 4 ? 48 : items <= 5 ? 44 : 40;
    const byLength = longest <= 28 ? 54 : longest <= 44 ? 48 : longest <= 64 ? 42 : 38;
    return Math.min(byCount, byLength);
  }

  const base =
    chars <= 40 ? 74 : chars <= 80 ? 64 : chars <= 140 ? 55 : chars <= 230 ? 48 : 42;

  const tone = (el as { tone?: string }).tone || "body";
  if (tone === "title") return Math.min(96, Math.round(base * 1.2));
  if (tone === "caption") return Math.round(base * 0.8);
  return base;
};

export const lineHeightFor = (el: SceneElement) => {
  if (el.type === "number") return 1.05;
  if (el.type === "kicker") return 1.2;
  if (el.type === "quote") return 1.28;
  if (el.type === "bullets") return 1.3;
  if (el.type === "text" && (el as { tone?: string }).tone === "title") return 1.15;
  return 1.36;
};

/** Spacing between bullet items, derived from the type size. */
export const bulletGap = (fontSize: number) => Math.round(fontSize * 0.62);

/* ── Content-derived geometry for the odd types ───────────────────────────── */

/**
 * A pie's sector names sit outside the rim on leader lines, so the circle is
 * limited by the longest name and not by the slot. Both the layout engine and
 * the adapter derive the radius from here, so the box the engine reserves is
 * always the box the chart actually draws in.
 */
export const PIE_LABEL_REACH = 74; // leader offset + elbow + gap before the name
export const pieRadius = (width: number, labels: string[]) => {
  const longest = labels.reduce((n, s) => Math.max(n, (s || "").length), 0);
  return Math.round(
    Math.max(150, Math.min(340, width / 2 - (longest * 14 + PIE_LABEL_REACH))),
  );
};

/**
 * The table draws at a fixed internal width and then scales itself to fit what
 * it is given, so its real height is knowable up front. Reserving exactly that
 * is what stops a three-row table sitting in the middle of an empty slot.
 */
export const TABLE_METRICS = {
  width: 880,
  headerHeight: 76,
  rowHeight: 120,
  padding: 100, // matches the constant the template adds around the rows
  cellFontSize: 34,
  headerFontSize: 26,
};

export const tableNaturalHeight = (rows: number) =>
  TABLE_METRICS.headerHeight + rows * TABLE_METRICS.rowHeight + TABLE_METRICS.padding;

export const tableFitScale = (width: number) =>
  Math.min(1.5, width / TABLE_METRICS.width);

/**
 * How a gallery breaks its tiles into a grid. Kept here so the engine reserves
 * exactly the height the view will draw, and so both agree on the tile shape —
 * every tile is the same size, which is what stops a contact sheet looking
 * ragged.
 */
export const galleryGrid = (count: number, width: number) => {
  const n = Math.max(1, Math.min(6, count));
  const cols = n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 18;
  const tileWidth = (width - gap * (cols - 1)) / cols;
  // Square tiles for multi-image sheets, 3:2 for a single one. A uniform shape
  // is what makes a grid read as deliberate.
  const tileHeight = n === 1 ? tileWidth / 1.5 : tileWidth;
  return { cols, rows, gap, tileWidth, tileHeight, count: n };
};

/** Types whose drawn height follows their content rather than their slot. */
const aspectFor = (el: SceneElement, width: number): number | undefined => {
  if (el.type === "table") {
    const rows = Math.min(8, ((el as { rows?: unknown[] }).rows || []).length);
    return width / (tableNaturalHeight(rows) * tableFitScale(width));
  }
  if (el.type === "socialEmbed") {
    const s = el as { text?: string; image?: string };
    const lines = Math.max(1, Math.ceil((s.text || "").length / 44));
    return width / (450 + lines * 60 + (s.image ? 460 : 0));
  }
  if (el.type === "pieChart") {
    const sectors = ((el as { sectors?: { label: string }[] }).sectors || []).map(
      (s) => s?.label ?? "",
    );
    return width / (pieRadius(width, sectors) * 2 + 110);
  }
  if (el.type === "gallery") {
    const srcs = ((el as { srcs?: string[] }).srcs || []).length;
    const g = galleryGrid(srcs, width);
    const captions = ((el as { captions?: string[] }).captions || []).length ? 40 : 0;
    return width / (g.rows * g.tileHeight + g.gap * (g.rows - 1) + captions);
  }
  return specOf(el).aspect;
};

interface Sized {
  height: number;
  fontSize: number;
}

/**
 * Natural size of one element at a given width. `room` is how much vertical
 * space a visual is allowed to grow into; text ignores it and takes what its
 * copy needs. `fontScale` lets the fitting pass shrink type globally.
 */
const sizeOne = (
  el: SceneElement,
  width: number,
  room: number,
  fontScale = 1,
): Sized => {
  const spec = specOf(el);

  if (spec.kind === "text") {
    if (el.type === "divider") return { height: spec.minHeight, fontSize: 0 };

    let size = Math.max(
      el.type === "kicker" ? 22 : MIN_FONT,
      Math.round(baseFont(el) * fontScale),
    );
    const lh = lineHeightFor(el);

    const measure = (fs: number) => {
      if (el.type === "bullets") {
        const items = (el as { items?: string[] }).items || [];
        const gap = bulletGap(fs);
        // Each item wraps on its own, indented past its marker.
        const inner = width - Math.round(fs * 1.5);
        return (
          items.reduce((sum, it) => sum + measureText(String(it), fs, inner, lh), 0) +
          gap * Math.max(0, items.length - 1)
        );
      }
      if (el.type === "statRow") {
        const stats = (el as { stats?: unknown[] }).stats || [];
        // One row of figures; a label sits under each.
        return Math.round(fs * 1.1) + (stats.length ? Math.round(fs * 0.46) : 0);
      }
      if (el.type === "quote") {
        const q = el as { value?: string; author?: string };
        // The quote hangs past a mark, so it wraps in a slightly narrower column.
        const body = measureText(String(q.value ?? ""), fs, width - 46, lh);
        return body + (q.author ? Math.round(fs * 0.86) : 0);
      }
      return measureText(textOf(el), fs, width, lh);
    };

    let measured = measure(size);
    // Step this element's own type down until the copy fits the box it is
    // allowed, so long text shrinks instead of spilling out of its slot.
    const floor = el.type === "kicker" ? 22 : MIN_FONT;
    while (measured > spec.maxHeight && size > floor) {
      size = Math.max(floor, Math.round(size * 0.92));
      measured = measure(size);
    }
    return { height: clamp(measured, spec.minHeight, spec.maxHeight), fontSize: size };
  }

  const aspect = aspectFor(el, width);
  let height = clamp(room > 0 ? room : spec.maxHeight, spec.minHeight, spec.maxHeight);
  // Never stretch: a fixed-aspect element is capped by its own width.
  if (aspect) height = Math.min(height, width / aspect);
  return { height, fontSize: baseFont(el) };
};

/* ── Row building ─────────────────────────────────────────────────────────── */

interface Row {
  items: SceneElement[];
  /** Indices into the original element list, parallel to `items`. */
  indices: number[];
}

/**
 * Decides which elements share a row. This is the whole difference between a
 * frame that reads as a composition and one that reads as a stack of boxes.
 *
 * Auto rules, in order:
 *  - a kicker always sits on its own line, tight above whatever follows
 *  - two visuals in a row with nothing between them pair up side by side
 *  - three or more consecutive visuals become a grid row of up to three
 *  - everything else stacks
 */
const buildRows = (elements: SceneElement[], layout: SceneLayout): Row[] => {
  const rows: Row[] = [];
  const push = (items: SceneElement[], indices: number[]) => rows.push({ items, indices });

  if (layout === "stack") {
    elements.forEach((el, i) => push([el], [i]));
    return rows;
  }

  if (layout === "hero") {
    // The first element owns the frame; the rest share one row beneath it.
    if (elements.length) push([elements[0]], [0]);
    const rest = elements.slice(1);
    if (rest.length) {
      push(rest, rest.map((_, i) => i + 1));
    }
    return rows;
  }

  let i = 0;
  while (i < elements.length) {
    const el = elements[i];

    // A label never shares a line — it belongs to the thing under it.
    if (el.type === "kicker" || el.type === "divider") {
      push([el], [i]);
      i += 1;
      continue;
    }

    if (isVisual(el)) {
      // Gather the run of consecutive visuals.
      const run: number[] = [];
      let j = i;
      while (j < elements.length && isVisual(elements[j])) {
        run.push(j);
        j += 1;
      }

      // A single visual takes the full width.
      if (run.length === 1) {
        push([el], [i]);
        i = j;
        continue;
      }

      const wantSplit = layout === "split" || run.length === 2;
      const perRow = wantSplit ? 2 : Math.min(3, run.length);

      for (let k = 0; k < run.length; k += perRow) {
        const slice = run.slice(k, k + perRow);
        push(
          slice.map((idx) => elements[idx]),
          slice,
        );
      }
      i = j;
      continue;
    }

    // Text stacks on its own.
    push([el], [i]);
    i += 1;
  }

  return rows;
};

/** Auto-pick an arrangement from the mix of elements. */
const pickLayout = (elements: SceneElement[], hint?: SceneLayout): SceneLayout => {
  if (hint && hint !== "auto") return hint;
  const visuals = elements.filter(isVisual).length;
  if (visuals >= 3) return "grid";
  if (visuals === 2) return "split";
  return "stack";
};

/* ── The fitting pass ─────────────────────────────────────────────────────── */

/**
 * Places any number of elements as a top-weighted composition inside the safe
 * band. Text is measured first — it earns exactly the room its copy needs — and
 * the visuals share what is left, in proportion to how much each one wants.
 *
 * The result is guaranteed to fit: if the content cannot be made to fit by
 * shrinking type and pulling visuals to their minimums, everything is squeezed
 * proportionally as a last resort. Nothing ever crosses the safe band.
 */
export const layoutScene = (
  elements: SceneElement[],
  /** Indices after which a connector is drawn, so the gap is widened. */
  connectedAfter: ReadonlySet<number> = new Set(),
  layoutHint?: SceneLayout,
): PlacedElement[] => {
  const items = elements.slice(0, MAX_ELEMENTS_PER_SCENE).filter(Boolean);
  if (!items.length) return [];

  const layout = pickLayout(items, layoutHint);
  const rows = buildRows(items, layout);

  // Width available to each item, per row.
  const widthFor = (row: Row) =>
    (CONTENT_WIDTH - COL_GAP * (row.items.length - 1)) / row.items.length;

  // Gap after each row. A kicker hugs what follows it; a connector needs room.
  const gapAfterRow = (r: number): number => {
    const row = rows[r];
    if (r >= rows.length - 1) return 0;
    if (row.items.length === 1 && row.items[0].type === "kicker") return 14;
    if (row.items.length === 1 && row.items[0].type === "divider") return 10;
    // Widen where a connector will be drawn between this row and the next.
    const last = row.indices[row.indices.length - 1];
    if (connectedAfter.has(last)) return CONNECTOR_GAP;
    return ROW_GAP;
  };

  const gapsTotal = rows.reduce((sum, _, r) => sum + gapAfterRow(r), 0);
  const available = BAND_HEIGHT - gapsTotal;

  // Pass 1 — measure text at its natural size, then hand the remainder to the
  // visuals in proportion to their appetite.
  const solve = (fontScale: number) => {
    const rowHeights: number[] = [];
    const sizedByRow: Sized[][] = [];

    let textTotal = 0;
    let visualWeight = 0;
    rows.forEach((row) => {
      const w = widthFor(row);
      row.items.forEach((el) => {
        if (specOf(el).kind === "text") {
          textTotal += 0; // accounted per-row below
        } else {
          visualWeight += specOf(el).weight ?? 1;
        }
      });
      // A row's text height is the tallest text in it.
      const textHeights = row.items
        .filter((el) => specOf(el).kind === "text")
        .map((el) => sizeOne(el, w, 0, fontScale).height);
      if (textHeights.length && textHeights.length === row.items.length) {
        textTotal += Math.max(...textHeights);
      }
    });

    const visualRoom = Math.max(0, available - textTotal);

    rows.forEach((row) => {
      const w = widthFor(row);
      const sized = row.items.map((el) => {
        if (specOf(el).kind === "text") return sizeOne(el, w, 0, fontScale);
        const share = (specOf(el).weight ?? 1) / Math.max(0.001, visualWeight);
        return sizeOne(el, w, visualRoom * share, fontScale);
      });
      sizedByRow.push(sized);
      rowHeights.push(Math.max(...sized.map((s) => s.height)));
    });

    const total = rowHeights.reduce((a, b) => a + b, 0);
    return { rowHeights, sizedByRow, total };
  };

  let { rowHeights, sizedByRow, total } = solve(1);

  // Pass 2 — if the stack is still too tall, step the type down. Visuals were
  // already capped by the room they were given, so type is what is left.
  let fontScale = 1;
  let guard = 0;
  while (total > available && fontScale > 0.62 && guard < 14) {
    fontScale *= 0.94;
    ({ rowHeights, sizedByRow, total } = solve(fontScale));
    guard += 1;
  }

  // Pass 3 — pathological case (six tall elements). Squeeze everything
  // proportionally so the composition still cannot leave the band.
  if (total > available && total > 0) {
    const squeeze = available / total;
    rowHeights = rowHeights.map((h) => h * squeeze);
    sizedByRow = sizedByRow.map((row) =>
      row.map((s) => ({ ...s, height: s.height * squeeze })),
    );
    total = rowHeights.reduce((a, b) => a + b, 0);
  }

  // Top-weighted rather than centred. A little of the slack sits above the
  // composition so it reads as placed on the frame rather than pinned to a
  // ceiling, and the rest stays at the foot where the caption block covers it.
  const slack = Math.max(0, available - total);
  let y = SAFE.top + slack * 0.3;

  const placed: PlacedElement[] = [];
  // Rebuild in the original element order so callers can match by index.
  const byIndex = new Map<number, PlacedElement>();

  rows.forEach((row, r) => {
    const w = widthFor(row);
    const sized = sizedByRow[r];
    const rowHeight = rowHeights[r];

    row.items.forEach((el, c) => {
      const h = sized[c].height;
      // Items in a shared row are centred against each other vertically, so a
      // short caption beside a tall chart does not sit awkwardly at the top.
      const offset = row.items.length > 1 ? (rowHeight - h) / 2 : 0;
      const rect: Rect = {
        x: Math.round(SAFE.left + c * (w + COL_GAP)),
        y: Math.round(y + offset),
        width: Math.round(w),
        height: Math.round(h),
      };
      byIndex.set(row.indices[c], { element: el, rect, fontSize: sized[c].fontSize });
    });

    y += rowHeight + gapAfterRow(r);
  });

  for (let i = 0; i < items.length; i++) {
    const p = byIndex.get(i);
    if (p) placed.push(p);
  }
  return placed;
};

/**
 * A photograph is not an illustration in a column — it is the shot. When the
 * visual is full-bleed media the copy sits on top of it, at the foot of the
 * safe band, the way a documentary lower third does. This returns the box for
 * that copy.
 */
export const layoutCinemaText = (el: SceneElement): PlacedElement => {
  const width = CONTENT_WIDTH;
  const { height, fontSize } = sizeOne(el, width, 0);
  return {
    element: el,
    rect: {
      x: SAFE.left,
      y: Math.round(SAFE.top + BAND_HEIGHT - height),
      width,
      height: Math.round(height),
    },
    fontSize,
  };
};
