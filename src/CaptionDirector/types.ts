import type { FaceName } from './fonts';
import type { Ink } from './metrics';

/**
 * One word from the ASR, in seconds. This is exactly the shape WhisperX word-level output
 * already has, so nothing upstream has to be reshaped.
 */
export type TranscriptWord = {
	text: string;
	/** Same word with its punctuation, if the ASR provides it. Drives phrase breaks. */
	punctuated?: string;
	start: number;
	end: number;
	/**
	 * 0-1 emphasis hint. Optional, and when present it overrides everything the engine
	 * infers. This is the hook for the pro LLM: it reads the clip and marks the two or three
	 * words the reel actually turns on, and the engine handles where and how they land.
	 */
	weight?: number;
};

/**
 * The looks. `baseline` is the floor and runs most of the clip; the other four are the
 * emphasis beats, rationed by the director.
 */
export type TreatmentName = 'baseline' | 'lit' | 'slam' | 'ribbon' | 'cascade';

export type PhraseWord = {
	/** What gets drawn, after casing and punctuation stripping */
	display: string;
	/** The original, kept for hashing and hero picking */
	raw: string;
	startFrame: number;
	/** Where this word stops being the active one — the next word's start, or its own end */
	endFrame: number;
	weight: number;
};

export type Phrase = {
	id: number;
	words: PhraseWord[];
	startFrame: number;
	endFrame: number;
	/** Seconds of silence before the first word and after the last */
	leadPause: number;
	tailPause: number;
	/** Words per second across the phrase */
	rate: number;
	/** 0-1, how much this phrase carries */
	weight: number;
	/** The word the phrase rests on */
	heroIndex: number;
	treatment: TreatmentName;
};

/** Where the captions are allowed to live, in px of the surface being drawn on. */
export type Geom = {
	width: number;
	height: number;
	/** Scale factor against the 1080px-wide canvas all sizes in `layout` are quoted at */
	k: number;
	/** Horizontal safe inset, px */
	padX: number;
	/** Baseline of the quiet track, as a fraction of height */
	trackY: number;
	/** Optical centre for the emphasis beats, as a fraction of height */
	heroY: number;
};

export type Palette = {
	/** The word being spoken right now */
	ink: string;
	/** Words already spoken in this phrase */
	spent: string;
	/** Words not yet spoken in this phrase */
	pending: string;
	/** Emphasis colour. In the monochrome palettes this is still white — weight carries it. */
	accent: string;
	/** Ink laid on top of a filled accent shape */
	onAccent: string;
};

export type CaptionDirectorTheme = {
	palette: Palette;
	/** Flat black over the footage, 0-1. Applied to the whole frame. */
	dim: number;
	/**
	 * Black gradient rising from the bottom, 0-1, behind the quiet track only. The type
	 * carries no shadow or stroke anywhere in this template, so the scrim is the whole
	 * legibility budget for the track — the emphasis beats are big enough not to need it.
	 */
	scrim: number;
	casing: 'upper' | 'lower' | 'as-is';
	/** Drop commas and full stops from the drawn text. Captions are not prose. */
	stripPunctuation: boolean;
};

export type CaptionDirectorLayout = {
	/** Quiet-track size in px at a 1080px canvas */
	trackFontSize: number;
	/** Emphasis-beat size, same scale. The gap between the two IS the escalation. */
	heroFontSize: number;
	/** Supporting type in an emphasis beat, as a fraction of the hero */
	supportRatio: number;
	/** Leading as a fraction of cap height */
	leading: number;
	/** Widest anything may get, as a fraction of the surface */
	maxWidth: number;
	/** Nudge the quiet track and the beats independently, px at a 1080px canvas */
	trackOffsetY: number;
	heroOffsetY: number;
};

export type CaptionDirectorTiming = {
	/** Frames a word's entrance takes in the quiet track */
	wordIn: number;
	/** Frames one line of an emphasis beat takes to arrive */
	reveal: number;
	/** Frames between lines of an emphasis beat */
	stagger: number;
	/** Frames a beat takes to clear */
	out: number;
	/** Frames a phrase is held past its last word, so a line does not vanish on the syllable */
	tailHold: number;
};

export type CaptionDirectorPhrasing = {
	/** Hard cap on words in one phrase */
	maxWords: number;
	/** A gap this long or longer always breaks the phrase, in seconds */
	breathGap: number;
	/** Hard cap on phrase duration, in seconds */
	maxSeconds: number;
};

export type CaptionDirectorPlan = {
	/**
	 * Roughly what fraction of phrases get an emphasis beat. 0 is a pure clean track, 1 is
	 * every phrase styled — which reads as noise, not emphasis.
	 */
	intensity: number;
	/** A phrase under this weight is never promoted, however much budget is left */
	threshold: number;
	/** Minimum frames between two emphasis beats */
	cooldown: number;
	/** Which looks the director may reach for */
	pool: TreatmentName[];
};

/** The fully resolved config. Every field present, every number already clamped. */
export type CaptionDirectorConfig = {
	words: TranscriptWord[];
	theme: CaptionDirectorTheme;
	layout: CaptionDirectorLayout;
	timing: CaptionDirectorTiming;
	phrasing: CaptionDirectorPhrasing;
	plan: CaptionDirectorPlan;
	background?: { src?: string };
};

/**
 * A palette by name, or a partial override of one. `"ember"` and
 * `{ accent: "#ff3b2f" }` are both valid, and so is neither.
 */
export type PaletteInput = string | Partial<Palette>;

/**
 * What a caller — or an LLM — actually writes. Deliberately looser than the resolved config:
 * everything is optional, and `palette` may be a name rather than five colours. The resolver
 * is the only thing that ever sees the difference.
 */
export type CaptionDirectorConfigInput = {
	words?: TranscriptWord[];
	theme?: Partial<Omit<CaptionDirectorTheme, 'palette'>> & { palette?: PaletteInput };
	layout?: Partial<CaptionDirectorLayout>;
	timing?: Partial<CaptionDirectorTiming>;
	phrasing?: Partial<CaptionDirectorPhrasing>;
	plan?: Partial<CaptionDirectorPlan>;
	background?: { src?: string };
};

// ---------------------------------------------------------------------------------------
// Solved layout — the output of the one measurement pass, read by the animators
// ---------------------------------------------------------------------------------------

export type PlacedRun = {
	text: string;
	/** Index into `phrase.words`, or -1 for decorative type the phrase does not own */
	wordIndex: number;
	face: FaceName;
	size: number;
	ink: Ink;
	/** Ink top-left, in surface px */
	x: number;
	y: number;
	/** Which line of the composition, so a stack can be staggered as lines and not as words */
	line: number;
	/** Set on the run carrying the hero word, so an animator can treat it differently */
	hero: boolean;
};

export type PlacedRule = {
	x: number;
	y: number;
	w: number;
	h: number;
	/** 'center' sweeps out from the middle, 'left' draws left to right */
	from: 'center' | 'left';
};

export type PhraseLayout = {
	phrase: Phrase;
	treatment: TreatmentName;
	runs: PlacedRun[];
	rules: PlacedRule[];
	/** Ink extent of everything in the beat, for masks and scrims */
	box: { x: number; y: number; w: number; h: number };
	/** Frame the beat starts clearing */
	outAt: number;
	/** Stable 0-1 value derived from the phrase text, for choices that should vary but not drift */
	seed: number;
};
