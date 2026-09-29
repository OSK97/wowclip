/**
 * Caption Engine — variation.
 *
 * What makes a caption track look edited rather than generated is not effects, it is that no two
 * captions are set quite the same way while all of them clearly belong to the same piece of
 * design. So what varies here is typographic: casing, optical weight of the run-up, which side a
 * fragment leans to when the letterforms offer a choice, and the rhythm of the landing.
 *
 * What does not vary: colour (by default), glow, outlines, underline swipes, particle bursts. An
 * earlier version had all of those and the result read as a cheap template — a yellow rule cut
 * straight through the descender of `somebody`, a purple halo sat behind `decide`. They are gone.
 * A single flat accent colour is still available via `variation.accentChance`, defaulting to 0.
 *
 * Every decision comes from Remotion's seeded `random()`. `Math.random()` would give a different
 * answer on every frame of a render, since each frame is a fresh evaluation, which shows up as
 * captions that strobe between styles. Same transcript plus same seed always renders identically.
 */

import { random } from 'remotion';
import { ChunkVariation, ScriptKind, StyleConfig, VariationConfig } from './types';
import { isLatinScript, visibleLength } from './text';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface VariationContext {
	chunkId: number;
	/** The hero word as spoken, before casing. Null for a flat chunk. */
	heroWord: string | null;
	script: ScriptKind;
	hasLead: boolean;
	hasTail: boolean;
	/** True for a value, identity, high-stakes emotion, or transformative action word. */
	isPowerHero: boolean;
}

export const buildVariation = (
	ctx: VariationContext,
	cfg: VariationConfig,
	style: StyleConfig,
): ChunkVariation => {
	const base = `${cfg.seed}-${ctx.chunkId}`;

	// Lowercase is structural, not merely stylistic: it creates the ascenders, descenders and
	// x-height openings that helper fragments interlock with. Therefore any ordinary hero carrying
	// helpers is always lowercase. A first capital is also disallowed there because it closes the
	// first upper pocket.
	//
	// Full caps is a deliberately rare poster beat. A normal word may use it only when standalone.
	// A high-impact word may use it with one helper row (lead XOR tail), where a clean flush row plus
	// a solid capital headline reads intentionally. It is never used with helpers on both sides,
	// which would collapse back into the three-line auto-caption stack.
	const heroLength = ctx.heroWord ? visibleLength(ctx.heroWord) : 0;
	const hasHelpers = ctx.hasLead || ctx.hasTail;
	const hasOneHelperSide = ctx.hasLead !== ctx.hasTail;
	const regularUpperAllowed =
		!hasHelpers && heroLength > 0 && heroLength <= cfg.upperMaxLength;
	const powerUpperAllowed =
		ctx.isPowerHero &&
		(!hasHelpers || hasOneHelperSide) &&
		heroLength > 0 &&
		heroLength <= cfg.powerUpperMaxLength;

	const caseRoll = random(`${base}-case`);
	let heroCasing: ChunkVariation['heroCasing'];
	if (!isLatinScript(ctx.script)) {
		heroCasing = 'preserve';
	} else if (powerUpperAllowed && caseRoll < cfg.powerUpperChance) {
		heroCasing = 'upper';
	} else if (
		regularUpperAllowed &&
		random(`${base}-regular-upper`) < cfg.upperChance
	) {
		heroCasing = 'upper';
	} else if (
		!hasHelpers &&
		random(`${base}-first-upper`) < cfg.firstUpperChance
	) {
		heroCasing = 'firstUpper';
	} else {
		heroCasing = 'lower';
	}

	const jitterRoll = random(`${base}-jitter`);
	const heroScaleJitter = 1 + (jitterRoll * 2 - 1) * cfg.scaleJitter;

	// Reading direction is not a place for randomness. A lead establishes the left edge and a tail
	// closes the right edge; pockets may still pull either fragment inward when the letter anatomy
	// earns it. The old 28% direction flip put `Choose` above the right edge of `courage`, forcing
	// the eye to begin on the right and then jump back to the hero.
	const leadLean: -1 | 1 = -1;
	const tailLean: -1 | 1 = 1;

	const emphasiseLead =
		ctx.hasLead && random(`${base}-lead-weight`) < cfg.emphasiseLeadChance;

	const revealFrames = Math.max(
		1,
		Math.round(lerp(cfg.revealMin, cfg.revealMax, random(`${base}-reveal`))),
	);
	const staggerFrames = Math.max(
		0,
		Math.round(lerp(cfg.staggerMin, cfg.staggerMax, random(`${base}-stagger`))),
	);

	let heroColor = style.textColor;
	if (
		cfg.accentChance > 0 &&
		style.accentPalette.length > 0 &&
		random(`${base}-accent`) < cfg.accentChance
	) {
		const idx = Math.floor(random(`${base}-accent-pick`) * style.accentPalette.length);
		heroColor = style.accentPalette[Math.min(style.accentPalette.length - 1, Math.max(0, idx))];
	}

	return {
		heroCasing,
		heroScaleJitter,
		leadLean,
		tailLean,
		emphasiseLead,
		revealFrames,
		staggerFrames,
		heroColor,
	};
};

/**
 * Applies the chosen casing.
 *
 * Interior capitals (`disciplinE`) are deliberately not offered. They were considered as a
 * uniqueness lever, but a capital in the middle of a word reads as a typo rather than as design,
 * and it also destroys a pocket by putting a full-height letter where an x-height one was. The
 * variation that does the same job without that cost is which pocket a fragment lands in, which
 * the layout already varies word by word because it follows the letterforms.
 */
export const applyHeroCasing = (
	text: string,
	casing: ChunkVariation['heroCasing'],
	script: ScriptKind,
): string => {
	if (!isLatinScript(script) || casing === 'preserve') return text;
	if (casing === 'upper') return text.toUpperCase();
	const lower = text.toLowerCase();
	if (casing === 'firstUpper') {
		return lower.charAt(0).toUpperCase() + lower.slice(1);
	}
	return lower;
};
