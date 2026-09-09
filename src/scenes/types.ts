// The JSON contract for the scene system.
// The LLM controls WHAT appears, in WHICH ORDER, and FOR HOW LONG.
// It never controls size or position — layout.ts owns all geometry.

export type ElementType =
  | "text"
  | "smartText"
  | "barGraph"
  | "lineGraph"
  | "pieChart"
  | "table"
  | "image"
  | "video"
  | "number"
  | "portrait"
  | "map"
  | "socialEmbed"
  // Editorial devices. These are what give a frame the documentary feel:
  // a small label above the statement, a list that builds, a pulled quote,
  // a contact sheet of images, and a row of figures.
  | "kicker"
  | "bullets"
  | "quote"
  | "gallery"
  | "statRow"
  | "divider";

export interface BaseElement {
  id?: string;
  type: ElementType;
  /** Seconds after the scene starts. Omitted = automatic stagger. */
  at?: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  value: string;
  /** Optional set of lines to cycle through while the partner image stays put.
      Each one cross-fades to the next across the scene. `value` is used when
      this is omitted (or as the first line when present). Every line shares the
      same tone/emphasis so the type never jumps size between swaps. */
  values?: string[];
  /** Seconds each line holds before swapping. Default 1.8. */
  swapEvery?: number;
  tone?: "title" | "body" | "caption";
  align?: "left" | "center" | "right";
  emphasis?: string[];
  fontSize?: number;
}

export interface SmartTextElement extends BaseElement {
  type: "smartText";
  segments: unknown[];
}

export interface BarGraphElement extends BaseElement {
  type: "barGraph";
  title?: string;
  bars: { label: string; value: number; color?: string }[];
  highlight?: number | number[];
  valueSuffix?: string;
}

export interface LineGraphElement extends BaseElement {
  type: "lineGraph";
  title?: string;
  points: { label: string; value: number }[];
  highlight?: number;
}

export interface PieChartElement extends BaseElement {
  type: "pieChart";
  sectors: { label: string; value: number; color?: string }[];
  highlight?: number;
}

export interface TableElement extends BaseElement {
  type: "table";
  columns: string[];
  rows: (string | number | null)[][];
  /** [row, column] pairs, 0-indexed on the body rows. */
  highlight?: [number, number][];
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  /** Optional set of images to cycle through while the partner text stays put.
      Each one cross-fades to the next across the scene. `src` is used when this
      is omitted (or as the first frame when present). */
  srcs?: string[];
  /** Seconds each image holds before swapping. Default 1.6. */
  swapEvery?: number;
  caption?: string;
  shape?: "card" | "circle" | "full";
}

export interface VideoElement extends BaseElement {
  type: "video";
  src: string;
  caption?: string;
}

export interface NumberElement extends BaseElement {
  type: "number";
  value: string | number;
  label?: string;
  prefix?: string;
  suffix?: string;
}

export interface PortraitElement extends BaseElement {
  type: "portrait";
  src: string;
  name?: string;
  subtitle?: string;
}

export interface MapElement extends BaseElement {
  type: "map";
  country?: string;
  highlight?: string[];
  caption?: string;
}

export interface SocialEmbedElement extends BaseElement {
  type: "socialEmbed";
  platform?: "twitter" | "instagram" | "reddit";
  author?: string;
  handle?: string;
  text?: string;
  avatar?: string;
  image?: string;
}

/** A small uppercase label that sits above the statement. One or two words —
    "THE NUMBERS", "2024", "WHAT CHANGED". The cheapest way to make a frame
    read as a page from a documentary rather than a slide. */
export interface KickerElement extends BaseElement {
  type: "kicker";
  value: string;
  /** Draws a short accent rule before the label. Default true. */
  rule?: boolean;
}

/** A list that builds line by line. Each item is one short phrase. */
export interface BulletsElement extends BaseElement {
  type: "bullets";
  items: string[];
  /** "dash" (default), "number", "dot", "check" */
  marker?: "dash" | "number" | "dot" | "check";
  /** Index of the item that carries the accent. */
  highlight?: number;
}

/** A pulled quote, set larger and with a hanging mark. */
export interface QuoteElement extends BaseElement {
  type: "quote";
  value: string;
  author?: string;
}

/** A contact sheet of images. The engine lays them out in a grid that fits the
    slot and keeps every tile the same shape, so nothing is ever stretched. */
export interface GalleryElement extends BaseElement {
  type: "gallery";
  srcs: string[];
  captions?: string[];
  /** Index of the tile that carries the accent ring. */
  highlight?: number;
  /** Tiles fill their cell (default) or sit whole inside it. */
  fit?: "cover" | "contain";
}

/** Two to four figures across one row — the "by the numbers" strip. */
export interface StatRowElement extends BaseElement {
  type: "statRow";
  stats: { value: string | number; label?: string; prefix?: string; suffix?: string }[];
  highlight?: number;
}

/** A hairline rule. Pure rhythm — separates a statement from what follows. */
export interface DividerElement extends BaseElement {
  type: "divider";
}

export type SceneElement =
  | TextElement
  | SmartTextElement
  | BarGraphElement
  | LineGraphElement
  | PieChartElement
  | TableElement
  | ImageElement
  | VideoElement
  | NumberElement
  | PortraitElement
  | MapElement
  | SocialEmbedElement
  | KickerElement
  | BulletsElement
  | QuoteElement
  | GalleryElement
  | StatRowElement
  | DividerElement;

export interface Connection {
  from: string;
  to: string;
}

/**
 * How the elements are arranged. Omit it and the engine picks — that is the
 * normal case and it gets the right answer for almost every mix.
 *
 *  "stack"   one under the other, full width. The default.
 *  "split"   two visuals side by side, then anything else beneath.
 *  "grid"    three or more visuals in a fitted grid.
 *  "hero"    the first element takes the frame; the rest sit under it small.
 *  "cinema"  the first media element fills the frame, copy over the bottom.
 */
export type SceneLayout = "auto" | "stack" | "split" | "grid" | "hero" | "cinema";

export interface Scene {
  id?: string;
  durationInSeconds?: number;
  /** Arrangement hint. "auto" (or omitted) lets the engine decide. */
  layout?: SceneLayout;
  /** Everything on screen, in reading order. Up to 6 elements; the engine
      measures them and fits them inside the safe band without overflow. */
  elements: SceneElement[];
  connections?: Connection[];
}

export interface StoryTheme {
  mode?: "light" | "dark";
  accent?: string;
}

export interface StoryConfig {
  fps?: number;
  theme?: StoryTheme;
  scenes: Scene[];
}

export interface ResolvedTheme {
  mode: "light" | "dark";
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  connector: string;
  /** Colour of the board grid the camera travels over. */
  grid: string;
}

// Palette follows the AppleAnimation reference: a plain white stage, deep slate
// type, and a blue accent. No off-white, no card surfaces, no borders — nothing
// on screen should read as a box sitting on a page.
export const resolveTheme = (theme?: StoryTheme): ResolvedTheme => {
  const mode = theme?.mode === "dark" ? "dark" : "light";
  const accent = theme?.accent || (mode === "dark" ? "#38BDF8" : "#0284C7");
  return mode === "dark"
    ? {
        mode,
        accent,
        background: "#0B1120",
        surface: "transparent",
        text: "#F8FAFC",
        muted: "#94A3B8",
        border: "transparent",
        connector: "#94A3B8",
        grid: "rgba(226, 232, 240, 0.06)",
      }
    : {
        mode,
        accent,
        background: "#FFFFFF",
        surface: "transparent",
        text: "#0F172A",
        muted: "#64748B",
        border: "rgba(15, 23, 42, 0.08)",
        connector: "#94A3B8",
        // Barely there. A clearly visible grid on white is the tell that reads
        // as a design-tool canvas rather than as a frame of video.
        grid: "rgba(15, 23, 42, 0.024)",
      };
};
