/**
 * Caption Engine — plan builder.
 *
 * Entry point for the pure half of the engine:
 *
 *   buildCaptionPlan(transcriptWords, configOverrides) -> CaptionPlan
 *
 * The result is serialisable data with no geometry in it. Pixel placement happens later, in the
 * solver, because it needs real glyph metrics. What the plan decides is the editorial part: where
 * the phrases break, which word carries each one, how it is cased, and when it lands.
 */

import {
	CaptionChunk,
	CaptionEngineConfig,
	CaptionEngineConfigInput,
	CaptionPlan,
	LayoutMode,
	TranscriptWord,
} from './types';
import { detectScript, isPowerHeroWord } from './text';
import { groupWords, normalizeWords, pickHeroWord } from './segmenter';
import { applyHeroCasing, buildVariation } from './variation';

export const DEFAULT_CAPTION_CONFIG: CaptionEngineConfig = {
	fps: 30,
	width: 1080,
	height: 1920,

	segmenter: {
		maxWords: 5,
		maxChars: 30,
		pauseBreakSeconds: 0.28,
		maxChunkSeconds: 2.4,
		minChunkSeconds: 0.5,
		softBreakMinWords: 2,
		heroScoreThreshold: 3.2,
		heroMaxWordLength: 11,
		heroMinWordLength: 4,
	},

	layout: {
		// At a 1080-wide canvas. Poppins 800 is wider than a grotesque at the same size, and the
		// block is fitted afterwards, so this is a target rather than a promise.
		heroSize: 210,
		leadRatio: 0.3,
		tailRatio: 0.27,
		supportMinScale: 0.9,
		nestleAbove: 0.18,
		nestleBelow: 0.2,
		// 0.42 was too generous: the gap between the `j` and the `d` of `judge` is only about one
		// letter wide, and padding both sides by 0.42 cap heights left "Do" a few px short of
		// fitting, so the split was rejected on a rounding margin.
		sideClear: 0.32,
		minGain: 0.18,
		splitPenalty: 0,
		coverageBonus: 0.6,
		enclosureBonus: 0.55,
		overhang: 0.22,
		maxParts: 4,
		sideBias: 0.04,

		maxWidth: 0.86,
		maxHeight: 0.42,
		anchorY: 0.66,
		safeInsetX: 0.07,
		safeInsetTop: 0.12,
		// Instagram's action rail and caption block eat the bottom of the frame.
		safeInsetBottom: 0.16,
		heroMinScale: 0.7,

		flatSize: 74,
		flatMaxLines: 3,
		flatLineGap: 0.42,

		tailFrames: 4,
	},

	style: {
		textColor: '#ffffff',
		accentPalette: ['#FFE24B', '#FF5A5A', '#4DE1FF'],
		heroTracking: -0.03,
		supportTracking: -0.012,
		backdropDim: 0.46,
		// No shadow. On type this heavy a shadow muddies the hollows the layout is built on.
		textShadow: '',
	},

	variation: {
		seed: 'wowclip-v1',
		// Kept low. A capital first letter turns the leftmost letter full-height, which closes the
		// leftmost pocket — and every one of the reference captions is set lowercase.
		firstUpperChance: 0.08,
		upperChance: 0.07,
		upperMaxLength: 7,
		powerUpperChance: 0.2,
		powerUpperMaxLength: 11,
		emphasiseLeadChance: 0.35,
		// Off by default. The reference look is white type; colour on one caption in five reads as
		// a glitch rather than as a choice.
		accentChance: 0,
		scaleJitter: 0.035,
		revealMin: 9,
		revealMax: 13,
		staggerMin: 2,
		staggerMax: 4,
	},

	forceFlat: false,
	blackoutRanges: [],
};

/** Merges partial overrides over the defaults, one level deep per section. */
export const resolveCaptionConfig = (
	input?: CaptionEngineConfigInput,
): CaptionEngineConfig => {
	const d = DEFAULT_CAPTION_CONFIG;
	if (!input) return d;
	return {
		fps: input.fps ?? d.fps,
		width: input.width ?? d.width,
		height: input.height ?? d.height,
		segmenter: { ...d.segmenter, ...(input.segmenter ?? {}) },
		layout: { ...d.layout, ...(input.layout ?? {}) },
		style: { ...d.style, ...(input.style ?? {}) },
		variation: { ...d.variation, ...(input.variation ?? {}) },
		forceFlat: input.forceFlat ?? d.forceFlat,
		blackoutRanges: input.blackoutRanges ?? d.blackoutRanges,
	};
};

/** Strips sentence punctuation from the hero. `!` and `?` earn their place; `.` and `,` do not. */
const heroDisplay = (display: string): string =>
	display.replace(/[.,;:\u0964]+$/g, '').trim() || display;

export const buildCaptionPlan = (
	transcript: TranscriptWord[] | undefined | null,
	configInput?: CaptionEngineConfigInput,
): CaptionPlan => {
	const config = resolveCaptionConfig(configInput);
	const { fps } = config;

	const normalized = normalizeWords(transcript, fps);
	const warnings = normalized.warnings.slice();

	if (normalized.words.length === 0) {
		return { chunks: [], fps, width: config.width, height: config.height, warnings, lastFrame: 0 };
	}

	const groups = groupWords(normalized.words, config.segmenter);
	const minChunkFrames = Math.max(1, Math.round(config.segmenter.minChunkSeconds * fps));
	const chunks: CaptionChunk[] = [];

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (group.length === 0) continue;

		const words = group.map((w) => w.display);
		const text = words.join(' ');
		const script = detectScript(text);
		const hero = pickHeroWord(group, config.segmenter);

		let mode: LayoutMode = 'anchored';
		let fallbackReason: CaptionChunk['fallbackReason'] = null;

		if (hero.index === null) {
			mode = 'flat';
			fallbackReason = 'no-hero-candidate';
		} else if (script === 'other') {
			// The pocket finding assumes Latin or Indic letterform behaviour. For anything else the
			// skyline cannot be trusted, so the chunk gets the plain track.
			mode = 'flat';
			fallbackReason = 'unsupported-script';
		} else if (group.length > config.segmenter.maxWords + 2) {
			mode = 'flat';
			fallbackReason = 'too-many-words';
		}

		const heroIndex = mode === 'anchored' ? hero.index : null;
		const heroWord = heroIndex === null ? null : heroDisplay(group[heroIndex].display);

		const variation = buildVariation(
			{
				chunkId: i,
				heroWord,
				script,
				hasLead: heroIndex !== null && heroIndex > 0,
				hasTail: heroIndex !== null && heroIndex < group.length - 1,
				isPowerHero: heroWord !== null && isPowerHeroWord(heroWord),
			},
			config.variation,
			config.style,
		);

		const startFrame = group[0].startFrame;
		let endFrame = group[group.length - 1].endFrame;
		if (endFrame - startFrame < minChunkFrames) endFrame = startFrame + minChunkFrames;

		chunks.push({
			id: i,
			startFrame,
			endFrame,
			visibleUntil: endFrame + config.layout.tailFrames,
			hasExitGap: true,
			lead: heroIndex === null ? [] : words.slice(0, heroIndex),
			hero: heroWord === null ? null : applyHeroCasing(heroWord, variation.heroCasing, script),
			tail: heroIndex === null ? [] : words.slice(heroIndex + 1),
			words,
			mode,
			fallbackReason,
			variation,
			script,
			text,
		});
	}

	// Second pass: no two chunks may be on screen at once, and a chunk only earns an exit animation
	// when there is real dead air after it. Back-to-back speech hard-cuts, which is what keeps a
	// fast track feeling tight rather than mushy.
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const next = chunks[i + 1];
		if (!next) continue;
		if (next.startFrame <= chunk.visibleUntil) {
			chunk.visibleUntil = Math.max(chunk.startFrame + 1, next.startFrame);
			chunk.hasExitGap = false;
		}
	}

	let lastFrame = 0;
	for (let i = 0; i < chunks.length; i++) {
		if (chunks[i].visibleUntil > lastFrame) lastFrame = chunks[i].visibleUntil;
	}

	return { chunks, fps, width: config.width, height: config.height, warnings, lastFrame };
};

/** Composition length for a plan, with a tail of hold frames. */
export const getCaptionPlanDuration = (plan: CaptionPlan, tailSeconds = 0.5): number =>
	Math.max(1, plan.lastFrame + Math.round(tailSeconds * plan.fps));

export interface PlanSummary {
	chunks: number;
	anchored: number;
	flat: number;
	fallbacks: Record<string, number>;
	casings: Record<string, number>;
	warnings: string[];
}

/** Counts what the planner decided. Cheap sanity check before paying for a render. */
export const summarizePlan = (plan: CaptionPlan): PlanSummary => {
	const summary: PlanSummary = {
		chunks: plan.chunks.length,
		anchored: 0,
		flat: 0,
		fallbacks: {},
		casings: {},
		warnings: plan.warnings,
	};

	for (let i = 0; i < plan.chunks.length; i++) {
		const c = plan.chunks[i];
		if (c.mode === 'anchored') summary.anchored++;
		else summary.flat++;
		if (c.fallbackReason) {
			summary.fallbacks[c.fallbackReason] = (summary.fallbacks[c.fallbackReason] ?? 0) + 1;
		}
		summary.casings[c.variation.heroCasing] = (summary.casings[c.variation.heroCasing] ?? 0) + 1;
	}

	return summary;
};
