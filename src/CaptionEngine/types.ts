/**
 * Caption Engine — shared types.
 *
 * Two stages, split on purpose:
 *
 *   1. PLAN (pure, no DOM)      TranscriptWord[] -> chunks, hero word, casing, timing
 *   2. SOLVE (needs real fonts) chunk + glyph metrics -> placed fragments in px
 *
 * The plan is serialisable and deterministic, so it can be generated server-side, inspected, and
 * handed to a render as JSON. The solve cannot be — placing small type into the hollows of a
 * heavy lowercase word requires knowing where that word's ink actually is, which means measuring
 * against the real font in a browser.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One word from a word-level ASR transcript (WhisperX / AI4Bharat shape).
 * `start` / `end` are in **seconds**.
 */
export interface TranscriptWord {
	/** Bare token, no trailing punctuation. Used for scoring. */
	text: string;
	/** Display token: original casing + punctuation. Falls back to `text`. */
	punctuated?: string;
	start: number;
	end: number;
	/**
	 * Optional emphasis signal in 0..1 (loudness percentile, PANNs energy, LLM-marked keyword).
	 * When present it dominates hero-word selection.
	 */
	emphasis?: number;
}

/** Internal word after normalization: times repaired, frames computed. */
export interface NormalizedWord {
	text: string;
	display: string;
	start: number;
	end: number;
	startFrame: number;
	endFrame: number;
	emphasis: number;
	breakClass: BreakClass;
}

export type BreakClass = 'none' | 'soft' | 'hard';

export type ScriptKind = 'latin' | 'devanagari' | 'gujarati' | 'other';

// ─────────────────────────────────────────────────────────────────────────────
// Plan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `anchored` — one big hero word with the supporting fragments set into its own hollows.
 * `flat`     — a plain readable track. Every failure path lands here.
 */
export type LayoutMode = 'anchored' | 'flat';

export type FragmentRole = 'hero' | 'lead' | 'tail';

/** Why a chunk fell back to `flat`. Null when the anchored layout was used. */
export type FallbackReason =
	| 'no-hero-candidate'
	| 'hero-too-long'
	| 'block-too-tall'
	| 'unsupported-script'
	| 'too-many-words'
	| 'no-metrics'
	| 'forced-by-config';

/**
 * Per-chunk styling decisions. Deliberately typographic rather than decorative.
 *
 * An earlier version of this had glow, colour pops, chromatic splits, underline swipes and
 * particle bursts. On screen they read as a cheap template, not as editing — a yellow line
 * through the descender of `somebody`, a purple halo behind `decide`. They are gone. What varies
 * now is casing, optical weight, which side a fragment leans to, and the rhythm of the landing,
 * which is what actually varies between two captions set by a person.
 */
export interface ChunkVariation {
	/**
	 * `lower` is the default and matches the reference look. `firstUpper` capitalises only the
	 * first letter. `upper` is reserved for short words, where it reads as a shout rather than as
	 * a wall. `preserve` is forced for scripts without case.
	 */
	heroCasing: 'lower' | 'firstUpper' | 'upper' | 'preserve';
	/** Multiplier on the hero's target size. Small — this is a nudge, not a feature. */
	heroScaleJitter: number;
	/** Which way the lead-in fragment leans when two pockets are equally deep. */
	leadLean: -1 | 1;
	tailLean: -1 | 1;
	/** Lead-in set in the heavier support weight, for a slightly firmer run-up. */
	emphasiseLead: boolean;
	/** Frames one fragment takes to rise into place. */
	revealFrames: number;
	/** Frames between one fragment starting and the next. */
	staggerFrames: number;
	/**
	 * Hero colour. Equal to `style.textColor` unless `variation.accentChance` fired, in which case
	 * it is a flat colour from the palette — flat, with no glow behind it.
	 */
	heroColor: string;
}

export interface CaptionChunk {
	id: number;
	/** First frame on screen (the first word's start). */
	startFrame: number;
	/** Frame the last word stops being spoken. */
	endFrame: number;
	/** Frame the chunk is removed. `endFrame + tail`, clamped to the next chunk. */
	visibleUntil: number;
	/** True when there is real dead air after this chunk, so an exit is worth playing. */
	hasExitGap: boolean;

	/** Words spoken before the hero, in order. Already display-cased. */
	lead: string[];
	/** The hero word, already cased. Null in `flat` mode. */
	hero: string | null;
	/** Words spoken after the hero. */
	tail: string[];
	/** Every display word in order. Used by `flat` mode. */
	words: string[];

	/** What the planner intends. The solver may still downgrade to `flat` once it can measure. */
	mode: LayoutMode;
	fallbackReason: FallbackReason | null;
	variation: ChunkVariation;
	script: ScriptKind;
	/** Plain joined text, for debugging and LLM round-trips. */
	text: string;
}

export interface CaptionPlan {
	chunks: CaptionChunk[];
	fps: number;
	width: number;
	height: number;
	warnings: string[];
	/** Last frame any caption is visible. Used to size the composition. */
	lastFrame: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export interface SegmenterConfig {
	/** Hard ceiling on words per chunk. */
	maxWords: number;
	/** Hard ceiling on characters per chunk. */
	maxChars: number;
	/** Seconds of silence between words that forces a break. */
	pauseBreakSeconds: number;
	maxChunkSeconds: number;
	/** Shortest a chunk may stay on screen. Short chunks get padded. */
	minChunkSeconds: number;
	/** Break after `,` `;` `:` once the chunk has this many words. */
	softBreakMinWords: number;
	/** Below this score, no word is worth going big on -> `flat`. */
	heroScoreThreshold: number;
	/** Words this long are never the hero. */
	heroMaxWordLength: number;
	/** Words this short are never the hero. */
	heroMinWordLength: number;
}

export interface LayoutConfig {
	/** Hero size in px at a 1080px-wide canvas. Everything else scales off it. */
	heroSize: number;
	/** Support sizes as fractions of the hero before density fitting. */
	leadRatio: number;
	tailRatio: number;
	/**
	 * Lowest acceptable scale for an anchored block that contains helper text. Below this the
	 * solver uses flat mode rather than quietly making the helper unreadable.
	 */
	supportMinScale: number;
	/**
	 * Vertical clearance between a support fragment and whatever bounds it, as a fraction of that
	 * fragment's own CAP HEIGHT — not its font size and not its ink box. Cap height is the only one
	 * of the three that tracks the size the letters look, so the rhythm stays even whether or not a
	 * line happens to contain a `g`.
	 */
	nestleAbove: number;
	nestleBelow: number;
	/** Sideways clearance from the letter bounding a pocket, in the fragment's cap heights. */
	sideClear: number;
	/** Depth a pocket must buy over the flush position before it is used, in cap heights. */
	minGain: number;
	/**
	 * What splitting a fragment across an extra pocket costs, same units. Defaults to 0: breaking a
	 * helper line so it threads through the hero is the look, not a compromise. Raise it if splits
	 * start happening where an unbroken line would have read fine.
	 */
	splitPenalty: number;
	/**
	 * Reward for threading a line further across the hero, times the fraction of hero width spanned.
	 * This is what decides between breaking a helper line and parking it whole in one pocket.
	 */
	coverageBonus: number;
	/**
	 * Reward for landing in a pocket closed by hero letters on both sides, rather than one that runs
	 * off the end of the word. Enclosed is the woven-looking case.
	 */
	enclosureBonus: number;
	/** How far a fragment may overhang the hero on an open side, as a fraction of hero width. */
	overhang: number;
	/** Most pieces one support line may be broken into. The solver still keeps a whole line when it fits. */
	maxParts: number;
	/** Tie-break bias: lead leans left, tail leans right. Well below `minGain`. */
	sideBias: number;

	/** Widest the finished block may get, as a fraction of canvas width. */
	maxWidth: number;
	/** Tallest, as a fraction of canvas height. */
	maxHeight: number;
	/** Vertical centre of the block, as a fraction of canvas height. */
	anchorY: number;
	/** Horizontal safe inset, as a fraction of canvas width. */
	safeInsetX: number;
	/** Vertical safe insets, as fractions of canvas height. */
	safeInsetTop: number;
	safeInsetBottom: number;
	/**
	 * The block may shrink to fit, but if the hero ends up below this fraction of its target the
	 * chunk goes `flat` instead. A hero that had to shrink 30% is no longer a hero — it is a long
	 * word in a big font sitting edge to edge, which is exactly what reads as broken.
	 */
	heroMinScale: number;

	/** `flat` mode size at a 1080px-wide canvas. */
	flatSize: number;
	flatMaxLines: number;
	/** Gap between flat lines, as a fraction of cap height. */
	flatLineGap: number;

	/** Extra frames a chunk lingers after its last word. */
	tailFrames: number;
}

export interface StyleConfig {
	textColor: string;
	/** Flat colours the accent option draws from. No gradients, no glow. */
	accentPalette: string[];
	/** Letter-spacing in em. The hero is set tight; that tightness is most of the look. */
	heroTracking: number;
	supportTracking: number;
	/**
	 * Flat black over the media, 0..1. The type carries no shadow or stroke, so this is what keeps
	 * it legible — it does the work an outline would, without touching the letterforms.
	 */
	backdropDim: number;
	/**
	 * Optional CSS text-shadow. Empty is the default and the right answer: a shadow on type this
	 * heavy muddies the hollows the layout is built on.
	 */
	textShadow: string;
}

export interface VariationConfig {
	/** Same seed + same transcript = identical output. */
	seed: string;
	/** Probability the hero is set with a capital first letter. */
	firstUpperChance: number;
	/** Probability a standalone short hero is set in full caps. */
	upperChance: number;
	/** Longest a regular hero may be and still be allowed full caps. */
	upperMaxLength: number;
	/**
	 * Probability a high-impact hero is set in full caps. This may also fire with one helper row,
	 * producing the deliberate poster-style exception to the normal lowercase interlocking layout.
	 */
	powerUpperChance: number;
	/** High-impact words may be longer than ordinary shout words. */
	powerUpperMaxLength: number;
	/** Probability the lead-in gets the heavier support weight. */
	emphasiseLeadChance: number;
	/**
	 * Probability the hero takes a flat accent colour from the palette. Defaults to 0 — the
	 * reference look is white type, and colour on one caption in five reads as a glitch.
	 */
	accentChance: number;
	/** Hero scale jitter, as +/- fraction of the target size. */
	scaleJitter: number;
	/** Frames one fragment takes to rise, jittered between these two. */
	revealMin: number;
	revealMax: number;
	/** Frames between one fragment landing and the next, jittered between these two. */
	staggerMin: number;
	staggerMax: number;
}

export interface CaptionEngineConfig {
	fps: number;
	width: number;
	height: number;
	segmenter: SegmenterConfig;
	layout: LayoutConfig;
	style: StyleConfig;
	variation: VariationConfig;
	/** Force every chunk to `flat`. */
	forceFlat: boolean;
	/** Frame ranges where captions hide, e.g. because an overlay owns the screen. */
	blackoutRanges: [number, number][];
}

export type CaptionEngineConfigInput = {
	fps?: number;
	width?: number;
	height?: number;
	segmenter?: Partial<SegmenterConfig>;
	layout?: Partial<LayoutConfig>;
	style?: Partial<StyleConfig>;
	variation?: Partial<VariationConfig>;
	forceFlat?: boolean;
	blackoutRanges?: [number, number][];
};
