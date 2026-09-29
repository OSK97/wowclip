/**
 * Caption Engine — the solver.
 *
 * Turns one planned chunk plus real glyph metrics into placed fragments in pixels.
 *
 * The whole thing works in "hero-ink coordinates": x measured from the hero's leftmost ink, y from
 * its baseline with down positive. Nothing is scaled or centred until the very end, and every
 * quantity is linear in size, so the arrangement is identical at any resolution — solve once at
 * the measured size, then fit and centre the finished block as one shape.
 *
 * Fitting the block as one shape rather than line by line is what lets a fragment overhang the
 * hero and still leave the composition optically centred, instead of being clamped at the margin.
 */

import {
	AnchorTuning,
	Fragment,
	Obstacle,
	buildContourSlots,
	buildHollows,
	planLine,
} from './anchor';
import { Ink, MeasuredLine, MeasuredMap, scaleInk } from './metrics';
import {
	CaptionChunk,
	CaptionEngineConfig,
	FallbackReason,
	FragmentRole,
	LayoutMode,
} from './types';

export interface PlacedItem {
	text: string;
	role: FragmentRole;
	/** Final font size in px. */
	size: number;
	/** Final ink metrics in px. */
	ink: Ink;
	/** Left of the text box (the pen origin, backed off by the left sidebearing). */
	left: number;
	/** Top of the ink. */
	inkTop: number;
	/** Which source line this came from. Fragments of one line share it, so they land together. */
	order: number;
}

export interface SolvedChunk {
	items: PlacedItem[];
	mode: LayoutMode;
	fallbackReason: FallbackReason | null;
	/** Final hero size in px, 0 in flat mode. */
	heroSize: number;
	/** Bounding box of the placed ink, for the debug overlay. */
	box: { left: number; top: number; width: number; height: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keys shared with the measuring pass
// ─────────────────────────────────────────────────────────────────────────────

export const heroKey = (id: number): string => `c${id}:hero`;
export const leadKey = (id: number): string => `c${id}:lead`;
export const tailKey = (id: number): string => `c${id}:tail`;
export const flatKey = (id: number): string => `c${id}:flat`;

export const canvasScale = (config: CaptionEngineConfig): number => config.width / 1080;

export const heroSizeFor = (chunk: CaptionChunk, config: CaptionEngineConfig): number =>
	config.layout.heroSize * canvasScale(config) * chunk.variation.heroScaleJitter;

export const leadSizeFor = (chunk: CaptionChunk, config: CaptionEngineConfig): number =>
	heroSizeFor(chunk, config) * config.layout.leadRatio;

export const tailSizeFor = (chunk: CaptionChunk, config: CaptionEngineConfig): number =>
	heroSizeFor(chunk, config) * config.layout.tailRatio;

export const flatSizeFor = (config: CaptionEngineConfig): number =>
	config.layout.flatSize * canvasScale(config);

// ─────────────────────────────────────────────────────────────────────────────
// Shared finishing step: fit, centre, snap
// ─────────────────────────────────────────────────────────────────────────────

interface Staged {
	frag: Fragment;
	role: FragmentRole;
	size: number;
	/** Ink top in the working coordinate space. */
	top: number;
	order: number;
}

/**
 * Scales the assembled block to fit, centres it, clamps it into the safe area, and snaps to whole
 * pixels.
 *
 * The snap matters more than it sounds: type on a half pixel is resampled across two columns,
 * which softens the letterforms and makes a shared edge look like it is out by one — the exact
 * thing that reads as imprecise rather than set.
 */
const finish = (
	staged: Staged[],
	config: CaptionEngineConfig,
	mode: LayoutMode,
	fallbackReason: FallbackReason | null,
	minScale: number,
): SolvedChunk | null => {
	if (staged.length === 0) {
		return {
			items: [],
			mode,
			fallbackReason,
			heroSize: 0,
			box: { left: 0, top: 0, width: 0, height: 0 },
		};
	}

	const { width, height, layout: L } = config;

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < staged.length; i++) {
		const s = staged[i];
		const inkH = s.frag.ink.bottom - s.frag.ink.top;
		minX = Math.min(minX, s.frag.x);
		maxX = Math.max(maxX, s.frag.x + s.frag.ink.width);
		minY = Math.min(minY, s.top);
		maxY = Math.max(maxY, s.top + inkH);
	}

	const blockW = Math.max(1, maxX - minX);
	const blockH = Math.max(1, maxY - minY);

	const maxW = width * L.maxWidth;
	const maxH = height * L.maxHeight;
	const fit = Math.min(1, maxW / blockW, maxH / blockH);
	const hasHelpers = staged.some((s) => s.role !== 'hero');

	/**
	 * An anchored caption gets its character from a stable relationship between hero and helper
	 * sizes. Once a whole block needs to shrink the helpers past this floor, it is better to use the
	 * clear flat fallback than to keep the headline and turn the spoken context into tiny text.
	 */
	if (fit < minScale || (mode === 'anchored' && hasHelpers && fit < L.supportMinScale)) {
		return null;
	}

	const scaledW = blockW * fit;
	const scaledH = blockH * fit;

	const shiftX = (width - scaledW) / 2 - minX * fit;

	const topSafe = height * L.safeInsetTop;
	const botSafe = height * (1 - L.safeInsetBottom);
	let centreY = height * L.anchorY;
	if (botSafe - topSafe > scaledH) {
		centreY = Math.max(topSafe + scaledH / 2, Math.min(botSafe - scaledH / 2, centreY));
	} else {
		centreY = (topSafe + botSafe) / 2;
	}
	const shiftY = centreY - ((minY + maxY) / 2) * fit;

	let heroSize = 0;
	const items: PlacedItem[] = staged.map((s) => {
		const ink = scaleInk(s.frag.ink, fit);
		const size = s.size * fit;
		if (s.role === 'hero') heroSize = size;
		return {
			text: s.frag.text,
			role: s.role,
			size,
			ink,
			// The text box starts at the pen origin, so back off the left sidebearing.
			left: Math.round(s.frag.x * fit + shiftX - ink.inkL),
			inkTop: Math.round(s.top * fit + shiftY),
			order: s.order,
		};
	});

	return {
		items,
		mode,
		fallbackReason,
		heroSize,
		box: {
			left: Math.round(minX * fit + shiftX),
			top: Math.round(minY * fit + shiftY),
			width: Math.round(scaledW),
			height: Math.round(scaledH),
		},
	};
};

// ─────────────────────────────────────────────────────────────────────────────
// Flat mode — the fallback every failure path lands on
// ─────────────────────────────────────────────────────────────────────────────

const solveFlat = (
	chunk: CaptionChunk,
	measured: MeasuredMap,
	config: CaptionEngineConfig,
	reason: FallbackReason | null,
): SolvedChunk => {
	const line = measured[flatKey(chunk.id)];
	const size = flatSizeFor(config);
	const { layout: L } = config;

	if (!line || line.words.length === 0) {
		return {
			items: [],
			mode: 'flat',
			fallbackReason: reason,
			heroSize: 0,
			box: { left: 0, top: 0, width: 0, height: 0 },
		};
	}

	// Greedy wrap against the safe width, using the pre-measured runs so every candidate line's
	// width is the real one rather than an estimate.
	const maxW = config.width * L.maxWidth;
	const rows: { a: number; b: number; ink: Ink }[] = [];
	let start = 0;
	while (start < line.words.length) {
		let end = start;
		let chosen: Ink | null = null;
		for (let candidate = start; candidate < line.words.length; candidate++) {
			const ink = line.runs[`${start}:${candidate}`];
			if (!ink) break;
			if (candidate > start && ink.width > maxW) break;
			end = candidate;
			chosen = ink;
		}
		if (!chosen) {
			chosen = line.runs[`${start}:${start}`] ?? line.ink;
			end = start;
		}
		rows.push({ a: start, b: end, ink: chosen });
		start = end + 1;
		// Never loop forever on a pathological input.
		if (rows.length > 8) break;
	}

	const staged: Staged[] = [];
	let cursorTop = 0;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const inkH = row.ink.bottom - row.ink.top;
		staged.push({
			frag: {
				text: line.words.slice(row.a, row.b + 1).join(' '),
				ink: row.ink,
				// Each row is centred on the block, so the flat track reads as a centred caption.
				x: -row.ink.width / 2,
			},
			role: 'tail',
			size,
			top: cursorTop,
			order: i,
		});
		cursorTop += inkH + row.ink.cap * L.flatLineGap;
	}

	// Flat mode has nowhere further to fall, so it always accepts whatever scale it needs.
	const solved = finish(staged, config, 'flat', reason, 0);
	return (
		solved ?? {
			items: [],
			mode: 'flat',
			fallbackReason: reason,
			heroSize: 0,
			box: { left: 0, top: 0, width: 0, height: 0 },
		}
	);
};

// ─────────────────────────────────────────────────────────────────────────────
// Anchored mode
// ─────────────────────────────────────────────────────────────────────────────

export const solveChunk = (
	chunk: CaptionChunk,
	measured: MeasuredMap,
	config: CaptionEngineConfig,
): SolvedChunk => {
	if (config.forceFlat) return solveFlat(chunk, measured, config, 'forced-by-config');
	if (chunk.mode === 'flat') return solveFlat(chunk, measured, config, chunk.fallbackReason);

	const hero = measured[heroKey(chunk.id)];
	if (!hero || !chunk.hero) return solveFlat(chunk, measured, config, 'no-metrics');

	const { layout: L } = config;
	const heroInk = hero.ink;
	if (!(heroInk.width > 0)) return solveFlat(chunk, measured, config, 'no-metrics');

	const tuning: AnchorTuning = {
		sideClear: L.sideClear,
		minGain: L.minGain,
		splitPenalty: L.splitPenalty,
		coverageBonus: L.coverageBonus,
		enclosureBonus: L.enclosureBonus,
		overhang: L.overhang,
		maxParts: L.maxParts,
		sideBias: L.sideBias,
	};

	// Shift into hero-ink coordinates so x=0 is the hero's leftmost ink, not its pen origin.
	const shift = -heroInk.inkL;
	const heroGlyphs = heroInk.glyphs.map((g) => ({
		char: g.char,
		inkL: g.inkL + shift,
		inkR: g.inkR + shift,
		top: g.top,
		bottom: g.bottom,
	}));

	const obstacles: Obstacle[] = heroGlyphs.map((g) => ({
		x0: g.inkL,
		x1: g.inkR,
		top: g.top,
		bottom: g.bottom,
	}));

	const overhang = heroInk.width * L.overhang;
	const sortSlots = (a: { x0: number; x1: number }, b: { x0: number; x1: number }): number =>
		a.x0 - b.x0 || a.x1 - b.x1;
	const anchorSlotsAbove = [
		...buildHollows(heroGlyphs, -1, heroInk.xHeight, 0, heroInk.width, overhang),
		...buildContourSlots(heroGlyphs),
	].sort(sortSlots);
	const anchorSlotsBelow = [
		...buildHollows(heroGlyphs, 1, heroInk.xHeight, 0, heroInk.width, overhang),
		...buildContourSlots(heroGlyphs),
	].sort(sortSlots);

	const staged: Staged[] = [
		{
			frag: { text: chunk.hero, ink: heroInk, x: 0 },
			role: 'hero',
			size: heroSizeFor(chunk, config),
			top: heroInk.top,
			order: chunk.lead.length,
		},
	];

	/** Places one support line and registers its fragments as obstacles for the next one. */
	const place = (
		line: MeasuredLine | undefined,
		role: FragmentRole,
		size: number,
		dir: -1 | 1,
		lean: -1 | 1,
		order: number,
	): void => {
		if (!line || line.words.length === 0) return;

		const plan = planLine(
			line,
			dir < 0 ? anchorSlotsAbove : anchorSlotsBelow,
			obstacles,
			dir,
			lean,
			heroInk.width,
			tuning,
		);

		if (plan.fragments.length === 0) return;

		for (let i = 0; i < plan.fragments.length; i++) {
			const frag = plan.fragments[i];
			/**
			 * A split helper is a set of individually anchored fragments, not a rigid row. Each piece
			 * follows the measured contour below it and clears the hero by a gap based on its own cap
			 * height. This keeps `or` close to an x-height pocket even when a neighbouring `things`
			 * contains a descender, and gives uppercase heroes the same safe edge-lock fallback.
			 */
			const gap = frag.ink.cap * (dir < 0 ? L.nestleAbove : L.nestleBelow);
			const limit = plan.nested ? frag.limit ?? plan.limit : plan.limit;
			const baseline =
				dir < 0
					? limit - gap - frag.ink.bottom
					: limit + gap - frag.ink.top;
			const inkTop = baseline + frag.ink.top;
			const inkBottom = baseline + frag.ink.bottom;
			staged.push({ frag, role, size, top: inkTop, order });
			obstacles.push({
				x0: frag.x,
				x1: frag.x + frag.ink.width,
				top: inkTop,
				bottom: inkBottom,
			});
		}
	};

	// Lead first: it is spoken first, and placing it first means the tail nests against it rather
	// than colliding with it.
	place(
		measured[leadKey(chunk.id)],
		'lead',
		leadSizeFor(chunk, config),
		-1,
		chunk.variation.leadLean,
		0,
	);
	place(
		measured[tailKey(chunk.id)],
		'tail',
		tailSizeFor(chunk, config),
		1,
		chunk.variation.tailLean,
		chunk.lead.length + 1,
	);

	const solved = finish(staged, config, 'anchored', null, L.heroMinScale);
	if (solved) return solved;

	// The block could not be fitted without collapsing the size hierarchy.
	return solveFlat(chunk, measured, config, 'hero-too-long');
};
