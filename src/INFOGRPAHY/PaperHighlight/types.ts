export type LayoutPreset =
  | "body-focus"
  | "body-focus-with-lower-headline"
  | "headline-focus"
  | "two-line-headline-focus"
  | "dense-column-focus"
  | "sparse-paper-focus"
  | "cropped-headline-focus";

export interface GlobalFocusConfig {
  anchorX: number;
  anchorY: number;

  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;

  markerColor: string;
  markerOpacity: number;
  markerPaddingX: number;
  markerPaddingY: number;
  markerRoughness: number;

  maxXDrift: number;
  maxYDrift: number;
  maxSizeVariationPercent: number;
}

export interface FocusLineConfig {
  prefix?: string;
  highlight: string;
  suffix?: string;
  size?: "body" | "headline" | "subheadline"; // kept for logic if needed, but not for sizing the highlight itself
}

export interface PageTransform {
  scale: number;
  translateX: number;
  translateY: number;
  rotate: number;
}

export interface TextureSeed {
  crease: string | null;
  tear: string | null;
  stain: string | null;
}

export interface PageConfig {
  id: string;
  layout: LayoutPreset;
  seed: number;
  focusLine: FocusLineConfig;
  headline?: string;
  subheadline?: string;
  topParagraphs?: string[];
  bottomParagraphs?: string[];
  transform: PageTransform;
  textures: TextureSeed;
}

export interface CompositionConfig {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  posterizeFps: number;
  audioLoopFrames?: number;
}

export interface TypographyConfig {
  fontFamily: string;
  bodyFontSize: number;
  bodyLineHeight: number;
  headlineFontSize: number;
  headlineLineHeight: number;
  textColor: string;
}

export interface PaperConfig {
  baseColor: string;
  globalGrainOpacity: number;
  globalFibreOpacity: number;
  globalCrumpleOpacity: number;
  stainOpacity: number;
  edgeDarkening: number;
}

export interface MotionConfig {
  globalPush: number;
  useCrossfade: boolean;
  useMotionBlur: boolean;
}

export interface PaperHighlightConfig {
  version: number;
  composition: CompositionConfig;
  highlightText: string;
  focus: GlobalFocusConfig;
  typography: TypographyConfig;
  paper: PaperConfig;
  motion: MotionConfig;
  pages: PageConfig[];
}
