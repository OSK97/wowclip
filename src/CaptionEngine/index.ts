/**
 * Caption Engine — public surface.
 *
 *   TranscriptWord[] -> buildCaptionPlan() -> CaptionPlan -> <CaptionEngine plan={...} />
 *
 * Or hand the transcript straight to the component and let it plan:
 *   <CaptionEngine transcript={words} />
 */

export * from './types';

export {
	DEFAULT_CAPTION_CONFIG,
	buildCaptionPlan,
	getCaptionPlanDuration,
	resolveCaptionConfig,
	summarizePlan,
} from './buildPlan';
export type { PlanSummary } from './buildPlan';

export { normalizeWords, groupWords, pickHeroWord } from './segmenter';
export { buildVariation, applyHeroCasing } from './variation';
export {
	detectScript,
	heroSemanticWeight,
	heroTypographyPotential,
	isLatinScript,
	isPowerHeroWord,
	isStopword,
	isWeakHeroWord,
	normalizeToken,
	visibleLength,
} from './text';

export { buildHollows, classifyGlyphZone, clearanceAt, planLine } from './anchor';
export type {
	AnchorTuning,
	Fragment,
	GlyphZone,
	Hollow,
	Obstacle,
	Placement,
} from './anchor';

export { measureInk, guessInk, scaleInk, useMeasuredTrack } from './metrics';
export type { Face, Glyph, Ink, MeasuredLine, MeasuredMap, MeasureRequest } from './metrics';

export { solveChunk, heroKey, leadKey, tailKey, flatKey } from './layout';
export type { PlacedItem, SolvedChunk } from './layout';

export {
	FONT_PROBES,
	HERO_FAMILY,
	HERO_STACK,
	HERO_WEIGHT,
	SUPPORT_FAMILY,
	SUPPORT_STACK,
	registerCaptionFonts,
} from './fonts';

export { CaptionEngine } from './CaptionEngine';
export type { CaptionEngineProps } from './CaptionEngine';
export { ChunkView } from './ChunkView';
export type { ChunkViewProps } from './ChunkView';
export { FullScreenReel } from './FullScreenReel';
export type { FullScreenReelProps } from './FullScreenReel';

export {
	DUMMY_TRANSCRIPT,
	DUMMY_TRANSCRIPT_SECONDS,
	buildDummyTranscript,
} from './dummyTranscript';

export {
	TYPOGRAPHY_LAB_TRANSCRIPT,
	TYPOGRAPHY_LAB_SECONDS,
	buildTypographyLabTranscript,
} from './typographyLabTranscript';
