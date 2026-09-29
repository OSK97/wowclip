/**
 * Caption Engine — hollow finding and fragment placement.
 *
 * This is the part that makes the captions look arranged by hand.
 *
 * A heavy lowercase word has a skyline. `judge` is tall on the left (`j` ascender, `d`) and then
 * drops to x-height across `ge`, with `j` and `g` hanging below the baseline. `things` is tall
 * across `th` and the dot of the `i`, then flat across `ngs`. Those flat runs are pockets, and
 * they are where the small type belongs — not stacked above and below the whole word with an
 * even gap, which is what every automatic caption tool does and what makes it look automatic.
 *
 * So: find the runs of hero letters with nothing tall in them, measure how deep each run goes,
 * and drop the supporting fragments into the deepest one they fit. A fragment can even be split
 * across two pockets when that buys enough. When there is no real pocket — a hero that is tall
 * the whole way across, or a fragment too wide to sit inside anything — the hunt is abandoned and
 * the line is set flush to the hero's optical edge, because an arbitrary offset is only worth
 * having when it buys a tighter fit.
 *
 * The approach here follows `Remotion-Captions/src/AnchorStack`, which already solved this well.
 */

import { Glyph, Ink, MeasuredLine } from './metrics';

/** Something a supporting fragment has to stay clear of: a hero letter, or a fragment already set. */
export interface Obstacle {
	x0: number;
	x1: number;
	top: number;
	bottom: number;
}

/**
 * A horizontal range a helper fragment may occupy. Most ranges are true pockets, where a helper
 * can settle into a low part of the hero's skyline. The solver also adds contour ranges over the
 * glyphs themselves, which lets a longer helper break naturally across tall and short letters.
 *
 * `x0`/`x1` are how far the pocket reaches — up to the ink edge of the tall letter beside it, or
 * into open space if it runs off the end of the word. Which sides are bounded decides which edge
 * a fragment aligns to, and that is what makes the small type start exactly at the `i` and stop
 * exactly at the `g` instead of near them.
 */
export interface Hollow {
	x0: number;
	x1: number;
	/** How far into the pocket the hero's own ink reaches, in hero-baseline coordinates. */
	limit: number;
	boundedLeft: boolean;
	boundedRight: boolean;
	/** A pocket needs side clearance from its walls; a contour slot already sits above its glyphs. */
	kind: 'pocket' | 'contour';
}

export interface Fragment {
	text: string;
	ink: Ink;
	x: number;
	/**
	 * The closest contour this fragment may approach, in hero-baseline coordinates.
	 *
	 * A helper line can be split across several pockets. Its pieces must not inherit the most
	 * restrictive pocket from a neighbouring word: `things` has a descender, but that should not
	 * force `or` to float higher as well. Keeping this per-fragment makes each piece follow the
	 * actual letter anatomy directly beneath or above it.
	 */
	limit?: number;
}

export interface Placement {
	fragments: Fragment[];
	/** The shared depth all fragments of this line sit against, in hero-baseline coordinates. */
	limit: number;
	/** True when the line found a real pocket rather than being set flush. */
	nested: boolean;
}

export interface AnchorTuning {
	/** Sideways clearance from the letter bounding a pocket, as a fraction of the fragment's cap. */
	sideClear: number;
	/** Vertical gain, in cap heights, a pocket must buy before it beats the flush position. */
	minGain: number;
	/** What splitting across an extra pocket costs, in the same units. */
	splitPenalty: number;
	/**
	 * Reward for threading a line further across the hero, as a multiple of the fraction of hero
	 * width the line spans.
	 *
	 * This is what makes a line break when breaking reads better. Without it, a whole fragment
	 * parked in one deep pocket always beats the same fragment split across two pockets at the same
	 * depth — same gain, plus a split penalty. But the split is the one that looks hand-set: `Do`
	 * threaded between the `ju` and the `d`, `not` after the `d`, with the big word growing through
	 * the middle. Parking the whole thing over the `ge` leaves the left half of the hero bare.
	 */
	coverageBonus: number;
	/**
	 * Reward for landing in a pocket closed by hero letters on both sides, averaged over fragments.
	 *
	 * A pocket enclosed by the word — the gap under the `ud` of `judge`, between the `j`'s descender
	 * and the `g`'s — is the interlocking case, and it is what reads as deliberate. A pocket that
	 * only has a letter on one side runs off the end of the word, so a fragment there is sitting
	 * beside the hero rather than inside it. Both reach the baseline, so without this term the two
	 * score identically and the tie falls to the lean, which parks tails off the right edge.
	 */
	enclosureBonus: number;
	/** How far a fragment may overhang the hero on an open side, as a fraction of hero width. */
	overhang: number;
	/** Most pieces one line may be broken into. */
	maxParts: number;
	/** Small bias, in cap heights, toward leaning a lead fragment left and a tail fragment right. */
	sideBias: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Explicit character anatomy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable Latin anatomy used alongside measured ink.
 *
 * The browser's bounding boxes are still used for exact coordinates. These lists only answer the
 * categorical question "does this character block a pocket above or below?" Explicit categories
 * prevent font rasterisation and one-pixel antialiasing differences from making the layout change
 * between preview, local render and Lambda.
 *
 * `i` blocks above because of its dot; `j` blocks both above (dot) and below (descender). Every
 * capital blocks above. `Q` may descend depending on the face, so it blocks below too.
 */
const LATIN_ASCENDERS = new Set('bdfhijklt'.split(''));
const LATIN_DESCENDERS = new Set('gjpqy'.split(''));
const LATIN_X_HEIGHT = new Set('acemnorsuvwxz'.split(''));

export type GlyphZone =
	| 'capital'
	| 'ascender'
	| 'descender'
	| 'ascender-descender'
	| 'x-height'
	| 'mark'
	| 'metric';

export const classifyGlyphZone = (glyph: Glyph): GlyphZone => {
	const { char } = glyph;
	if (/^[A-Z]$/.test(char)) return char === 'Q' ? 'ascender-descender' : 'capital';
	if (/^[a-z]$/.test(char)) {
		const ascends = LATIN_ASCENDERS.has(char);
		const descends = LATIN_DESCENDERS.has(char);
		if (ascends && descends) return 'ascender-descender';
		if (ascends) return 'ascender';
		if (descends) return 'descender';
		if (LATIN_X_HEIGHT.has(char)) return 'x-height';
	}
	// Apostrophes, quotes and asterisks live above x-height and must reserve their space. Periods,
	// commas and hyphens are not top blockers; their measured geometry handles the bottom side.
	if (/^["'`*^]$/.test(char)) return 'mark';
	return 'metric';
};

const blocksPocket = (glyph: Glyph, dir: -1 | 1, xHeight: number): boolean => {
	const zone = classifyGlyphZone(glyph);
	if (dir < 0) {
		if (zone === 'capital' || zone === 'ascender' || zone === 'ascender-descender' || zone === 'mark') {
			return true;
		}
		if (zone === 'x-height' || zone === 'descender') return false;
		return glyph.top < -xHeight * 1.14;
	}

	if (zone === 'descender' || zone === 'ascender-descender') return true;
	if (zone === 'capital' || zone === 'ascender' || zone === 'x-height') return false;
	return glyph.bottom > xHeight * 0.09;
};

/**
 * Splits the hero's glyphs into pockets on one side.
 *
 * `dir` is -1 above the baseline and +1 below. Exact pocket boundaries and depths always come
 * from measured ink; `classifyGlyphZone` only decides which characters form the walls.
 */
export const buildHollows = (
	glyphs: Glyph[],
	dir: -1 | 1,
	xHeight: number,
	spanX0: number,
	spanX1: number,
	overhang: number,
): Hollow[] => {
	const out: Hollow[] = [];
	let run: Glyph[] = [];
	let leftBound: number | null = null;

	const close = (rightBound: number | null): void => {
		if (run.length === 0) return;
		let limit = 0;
		for (let i = 0; i < run.length; i++) {
			limit = dir < 0 ? Math.min(limit, run[i].top) : Math.max(limit, run[i].bottom);
		}
		out.push({
			x0: leftBound ?? spanX0 - overhang,
			x1: rightBound ?? spanX1 + overhang,
			limit,
			boundedLeft: leftBound !== null,
			boundedRight: rightBound !== null,
			kind: 'pocket',
		});
		run = [];
	};

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i];
		if (blocksPocket(glyph, dir, xHeight)) {
			close(glyph.inkL);
			leftBound = glyph.inkR;
		} else {
			run.push(glyph);
		}
	}
	close(null);

	return out;
};

/**
 * Creates compact ranges over the hero's actual letters, in addition to the empty pockets.
 *
 * A pocket-only system has nowhere to put `Words can mean` around `different`: the word has a
 * single low valley between the `ff` and final `t`, so the whole helper falls back to one bland
 * row. Real typography can place `Words` above the first tall letters, let `can` drop into the
 * valley, and put `mean` near the last letter. These spans give the solver those options. Their
 * vertical clearance is still measured later with `clearanceAt`, so a fragment never overlaps the
 * hero ink it is visually attached to.
 */
export const buildContourSlots = (glyphs: Glyph[], maxGlyphs = 4): Hollow[] => {
	const out: Hollow[] = [];
	const minGlyphs = 2;
	for (let start = 0; start < glyphs.length; start++) {
		const endLimit = Math.min(glyphs.length, start + Math.max(minGlyphs, maxGlyphs));
		for (let end = start + minGlyphs - 1; end < endLimit; end++) {
			out.push({
				x0: glyphs[start].inkL,
				x1: glyphs[end].inkR,
				limit: 0,
				boundedLeft: true,
				boundedRight: true,
				kind: 'contour',
			});
		}
	}
	return out;
};

/**
 * How close to the hero's baseline a box of width `w` sitting at `x` may come.
 *
 * `pad` widens the test window sideways, so a tall letter just beside the box still holds it
 * back. That sideways clearance is the difference between tucked in and crashed into.
 */
export const clearanceAt = (
	obstacles: Obstacle[],
	x: number,
	w: number,
	pad: number,
	dir: -1 | 1,
): number => {
	const a = x - pad;
	const b = x + w + pad;
	let limit = 0;
	for (let i = 0; i < obstacles.length; i++) {
		const o = obstacles[i];
		if (o.x1 <= a || o.x0 >= b) continue;
		limit = dir < 0 ? Math.min(limit, o.top) : Math.max(limit, o.bottom);
	}
	return limit;
};

/** Every way of cutting `n` words into at most `maxParts` consecutive runs. */
const partitions = (n: number, maxParts: number): [number, number][][] => {
	const out: [number, number][][] = [];
	const acc: [number, number][] = [];
	const walk = (start: number): void => {
		if (start === n) {
			out.push(acc.slice());
			return;
		}
		if (acc.length === maxParts) return;
		for (let end = start; end < n; end++) {
			acc.push([start, end]);
			walk(end + 1);
			acc.pop();
		}
	};
	walk(0);
	return out;
};

/** Every ordered choice of `k` pockets out of `n`, left to right. */
const combinations = (n: number, k: number): number[][] => {
	const out: number[][] = [];
	const acc: number[] = [];
	const walk = (start: number): void => {
		if (acc.length === k) {
			out.push(acc.slice());
			return;
		}
		for (let i = start; i < n; i++) {
			acc.push(i);
			walk(i + 1);
			acc.pop();
		}
	};
	walk(0);
	return out;
};

/**
 * Works out where one supporting line goes.
 *
 * The flush position — aligned to the hero's ink edge, clear of everything between — is the
 * baseline to beat. Then every way of dropping the line into the hero's pockets is costed against
 * it, including breaking it across two pockets so that `and the` can sit either side of the `pli`
 * of `discipline`.
 *
 * A candidate only wins if it ends up meaningfully deeper than flush, and a split has to beat an
 * unbroken line by a further margin. So the interlocking happens whenever the letterforms allow
 * it and quietly stops when they do not, which is what keeps every chunk looking like the same
 * piece of design rather than a different experiment each time.
 */
export const planLine = (
	line: MeasuredLine,
	anchorSlots: Hollow[],
	obstacles: Obstacle[],
	dir: -1 | 1,
	/** -1 leans left (a lead-in), +1 leans right (a tail). */
	lean: -1 | 1,
	/** Ink width of the hero, in the same coordinate space as the hollows. */
	heroWidth: number,
	tuning: AnchorTuning,
): Placement => {
	const { ink, words, runs } = line;
	if (words.length === 0) return { fragments: [], limit: 0, nested: false };

	const pad = ink.cap * tuning.sideClear;

	/**
	 * How much better `candidate` is than `base`, in px, positive meaning the fragment ends up
	 * tucked closer to the hero.
	 *
	 * The sign trips people up, so spelled out: above the baseline, limits are negative and a
	 * *larger* (less negative) limit means the hero's ink stops higher up, leaving the fragment room
	 * to sit lower — against the x-height instead of above the ascenders. Below the baseline, limits
	 * are positive and a *smaller* limit means no descender in the way, so the fragment can sit
	 * higher, tucked against the baseline.
	 *
	 * This had its arguments reversed, which made every real pocket score negative, so nothing ever
	 * cleared `minGain` and every fragment fell through to the flush position. That is the whole
	 * reason the output looked like three stacked lines instead of interlocked type.
	 */
	const improvement = (candidate: number, base: number): number =>
		dir < 0 ? candidate - base : base - candidate;

	// The baseline to beat: aligned to one of the hero's optical edges, clear of everything between.
	// A lead-in aligns left, a tail aligns right. Deliberately an edge rather than a best-fit slide
	// — an arbitrary horizontal offset is only worth having when a pocket earns it.
	const flushX = lean < 0 ? 0 : Math.max(0, heroWidth - ink.width);
	const flushLimit = clearanceAt(obstacles, flushX, ink.width, pad, dir);
	const flush: Placement = {
		fragments: [{ text: words.join(' '), ink, x: flushX, limit: flushLimit }],
		limit: flushLimit,
		nested: false,
	};

	const span = Math.max(1, heroWidth);

	// The flush position is scored on the same terms as every pocket candidate, so the comparison is
	// apples to apples. Its gain is zero by definition; it still gets its coverage and lean.
	const flushCoverage = Math.max(0, Math.min(1, ink.width / span));
	const flushCentre = flushX + ink.width / 2;
	const flushScore =
		flushCoverage * tuning.coverageBonus +
		((lean * (flushCentre - span / 2)) / span) * tuning.sideBias;

	let best = flush;
	let bestScore = flushScore;
	const maxParts = Math.max(1, Math.min(tuning.maxParts, words.length));
	const wordWidths = words.map((_, index) => runs[`${index}:${index}`]?.width ?? Infinity);
	const usableSlots = anchorSlots.filter((slot) => {
		const clearL = slot.kind === 'pocket' && slot.boundedLeft ? pad : 0;
		const clearR = slot.kind === 'pocket' && slot.boundedRight ? pad : 0;
		const room = slot.x1 - clearR - (slot.x0 + clearL);
		return wordWidths.some((width) => width <= room);
	});

	const allParts = partitions(words.length, maxParts);
	for (let pi = 0; pi < allParts.length; pi++) {
		const parts = allParts[pi];
		const picks = combinations(usableSlots.length, parts.length);

		for (let ci = 0; ci < picks.length; ci++) {
			const pick = picks[ci];
			const fragments: Fragment[] = [];
			let limit = 0;
			let enclosed = 0;
			let ok = true;

			for (let j = 0; j < parts.length && ok; j++) {
				const [a, b] = parts[j];
				const frag = runs[`${a}:${b}`];
				const hollow = usableSlots[pick[j]];
				if (!frag || !hollow) {
					ok = false;
					break;
				}

				// Clearance is only owed to a side that actually has a letter on it.
				const clearL = hollow.kind === 'pocket' && hollow.boundedLeft ? pad : 0;
				const clearR = hollow.kind === 'pocket' && hollow.boundedRight ? pad : 0;
				const room = hollow.x1 - clearR - (hollow.x0 + clearL);
				if (frag.width > room) {
					ok = false;
					break;
				}

				// Align against the letter that closes the pocket. When both sides are open there is no
				// letter to align against, so preserve sentence direction: a lead starts at the hero's
				// left ink edge and a tail ends at its right ink edge. The old unconditional `x = 0`
				// is exactly why `freedom / is.` left `is.` hanging under the `f` instead of closing the
				// shape under `om`.
				const x = hollow.boundedLeft
					? hollow.x0 + clearL
					: hollow.boundedRight
						? hollow.x1 - clearR - frag.width
						: lean < 0
							? 0
							: Math.max(0, heroWidth - frag.width);

				const prev = fragments[fragments.length - 1];
				if (prev && x < prev.x + prev.ink.width + pad) {
					ok = false;
					break;
				}

				const local = clearanceAt(obstacles, x, frag.width, pad, dir);
				fragments.push({
					text: words.slice(a, b + 1).join(' '),
					ink: frag,
					x,
					limit: local,
				});
				if (hollow.boundedLeft && hollow.boundedRight) enclosed++;
				limit = dir < 0 ? Math.min(limit, local) : Math.max(limit, local);
			}

			if (!ok || fragments.length === 0) continue;

			// The aggregate limit scores the candidate conservatively; each fragment retains its own
			// limit for the final contour-following placement.
			const gain = improvement(limit, flush.limit) / ink.cap;

			// How far across the hero the line threads. A split that spans the word beats the same
			// text parked in one pocket with half the hero left bare.
			const first = fragments[0];
			const last = fragments[fragments.length - 1];
			const left = first.x;
			const right = last.x + last.ink.width;
			const coverage = Math.max(0, Math.min(1, (right - left) / span));

			// Nudge a lead-in toward the left of the hero and a tail toward the right. Breaks ties
			// only — an order of magnitude below `minGain`.
			const centre = (left + right) / 2;
			const bias = ((lean * (centre - span / 2)) / span) * tuning.sideBias;

			const enclosure = (enclosed / fragments.length) * tuning.enclosureBonus;

			const score =
				gain +
				coverage * tuning.coverageBonus +
				enclosure +
				bias -
				tuning.splitPenalty * (fragments.length - 1);

			/**
			 * A helper broken through multiple real pockets can read more deliberately than one safe
			 * fragment parked at the edge, even when the individual pockets are only marginally
			 * deeper. This is the case for a phrase like `things, or` around `somebody`: the split
			 * makes the hero participate in the sentence. Keep a clear coverage threshold so this
			 * never turns ordinary one-word helpers into fussy fragments.
			 */
			const isUsefulSplit =
				fragments.length > 1 && gain >= 0 && coverage > flushCoverage + 0.18;

			if ((gain > tuning.minGain || isUsefulSplit) && score > bestScore) {
				bestScore = score;
				best = { fragments, limit, nested: true };
			}
		}
	}

	return best;
};
