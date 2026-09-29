/**
 * Geometry for every look, solved once for the whole clip.
 *
 * Each `solve*` builds its composition in local coordinates at the requested size, and
 * `finalize` then fits and centres the whole thing as one object. Fitting at the end rather
 * than per line is what lets a fragment overhang its hero and still leave the composition
 * optically centred instead of clamped against a margin.
 *
 * The scaling is exact rather than approximate: ink boxes scale linearly with font size, and
 * tracking is quoted in em so it scales with them, so multiplying a measured layout by `fit`
 * gives the same numbers as re-measuring at the smaller size. That is what makes a single
 * measurement pass enough for the entire track.
 */
import { FACES } from './fonts';
import { measureInk, type Ink, type TextSpec } from './metrics';
import { clamp, hash } from './util';
import type {
	CaptionDirectorConfig,
	Geom,
	Phrase,
	PhraseLayout,
	PlacedRule,
	PlacedRun,
	TreatmentName,
} from './types';
import type { FaceName } from './fonts';

type LocalRun = Omit<PlacedRun, 'x' | 'y'> & { x: number; y: number };

const scaleInk = (ink: Ink, s: number): Ink => ({
	inkL: ink.inkL * s,
	inkR: ink.inkR * s,
	width: ink.width * s,
	top: ink.top * s,
	bottom: ink.bottom * s,
	height: ink.height * s,
	advance: ink.advance * s,
	cap: ink.cap * s,
	xHeight: ink.xHeight * s,
	baseline: ink.baseline * s,
});

type Placement = {
	maxW: number;
	maxH: number;
	/** Horizontal centre of the finished block */
	cx: number;
	/** Vertical centre, or the ink bottom if `anchor` is 'bottom' */
	cy: number;
	anchor: 'center' | 'bottom';
};

/**
 * Fits and positions a solved composition. Everything is snapped to whole pixels at the end:
 * type on a half pixel is resampled across two columns, which softens the letterforms and
 * makes a shared edge look like it is out by one — exactly what reads as careless.
 */
const finalize = (
	local: LocalRun[],
	rules: PlacedRule[],
	phrase: Phrase,
	treatment: TreatmentName,
	place: Placement,
): PhraseLayout => {
	const boxes = [
		...local.map((r) => ({ x0: r.x, x1: r.x + r.ink.width, y0: r.y, y1: r.y + r.ink.height })),
		...rules.map((r) => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h })),
	];

	const minX = Math.min(...boxes.map((b) => b.x0));
	const maxX = Math.max(...boxes.map((b) => b.x1));
	const minY = Math.min(...boxes.map((b) => b.y0));
	const maxY = Math.max(...boxes.map((b) => b.y1));

	const blockW = Math.max(1, maxX - minX);
	const blockH = Math.max(1, maxY - minY);
	const fit = Math.min(1, place.maxW / blockW, place.maxH / blockH);

	const shiftX = place.cx - (minX + blockW / 2) * fit;
	const shiftY =
		place.anchor === 'bottom' ? place.cy - maxY * fit : place.cy - (minY + blockH / 2) * fit;

	const runs: PlacedRun[] = local.map((r) => ({
		...r,
		size: r.size * fit,
		ink: scaleInk(r.ink, fit),
		x: Math.round(r.x * fit + shiftX),
		y: Math.round(r.y * fit + shiftY),
	}));

	const placedRules: PlacedRule[] = rules.map((r) => ({
		...r,
		x: Math.round(r.x * fit + shiftX),
		y: Math.round(r.y * fit + shiftY),
		w: Math.max(1, Math.round(r.w * fit)),
		h: Math.max(1, Math.round(r.h * fit)),
	}));

	return {
		phrase,
		treatment,
		runs,
		rules: placedRules,
		box: {
			x: Math.round(minX * fit + shiftX),
			y: Math.round(minY * fit + shiftY),
			w: Math.round(blockW * fit),
			h: Math.round(blockH * fit),
		},
		outAt: phrase.endFrame,
		seed: hash(phrase.words.map((w) => w.raw).join(' ')),
	};
};

const run = (
	ctx: CanvasRenderingContext2D,
	text: string,
	face: FaceName,
	size: number,
	wordIndex: number,
	line: number,
	hero: boolean,
): LocalRun => {
	const spec: TextSpec = { text, size, face };
	return { text, wordIndex, face, size, ink: measureInk(ctx, spec), x: 0, y: 0, line, hero };
};

// ---------------------------------------------------------------------------------------
// baseline — the quiet track
// ---------------------------------------------------------------------------------------

/**
 * The floor, and the most important look in the set even though it is the plainest.
 *
 * The whole phrase is on screen at once with the spoken word lit and the rest held back. That
 * combination is the point: one-word-at-a-time captions give the viewer no idea where the
 * sentence is going, and a fully-lit line gives them nothing to follow. Showing the phrase and
 * moving only the light means the line can be read ahead of the audio while the eye still
 * knows exactly where it is — which is what lets the viewer keep up with a fast speaker.
 *
 * It is also what makes the escalations work. A viewer who has been reading a calm, fixed
 * track for eight seconds feels a slam. A viewer being shouted at continuously feels nothing.
 */
const solveBaseline = (
	ctx: CanvasRenderingContext2D,
	phrase: Phrase,
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout => {
	const { layout } = config;
	const maxW = geom.width * layout.maxWidth - geom.padX * 0.5;
	let size = layout.trackFontSize * geom.k;

	const inkOf = (text: string, s: number) => measureInk(ctx, { text, size: s, face: 'heavy' });

	// A single word wider than the safe area sets the size for the whole phrase, so the track
	// never changes size mid-line for one long word.
	const widest = Math.max(...phrase.words.map((w) => inkOf(w.display, size).width));
	if (widest > maxW) size *= maxW / widest;

	/**
	 * Word spacing is set explicitly rather than left to the space glyph.
	 *
	 * The heavy face is tracked to -0.035em, and CSS letter-spacing applies to the space
	 * character like any other — so at this weight `CAN MAKE` closes up until it reads as one
	 * word. Since each word is positioned individually anyway (they need their own colours), the
	 * fix is to ignore the space entirely and place words a measured distance apart. Driven off
	 * cap height so it stays proportional at any size.
	 */
	const gapFor = (s: number) => inkOf('H', s).cap * 0.3;

	// Greedy wrap, then shrink if it needs more than two lines. Two is the most a viewer reads
	// in the half second a caption is up.
	const wrap = (s: number) => {
		const gap = gapFor(s);
		const widths = phrase.words.map((w) => inkOf(w.display, s).width);
		const lines: number[][] = [];
		let line: number[] = [];
		let used = 0;

		phrase.words.forEach((_, i) => {
			const add = widths[i] + (line.length > 0 ? gap : 0);
			if (line.length > 0 && used + add > maxW) {
				lines.push(line);
				line = [i];
				used = widths[i];
			} else {
				line.push(i);
				used += add;
			}
		});
		if (line.length > 0) lines.push(line);
		return lines;
	};

	let lines = wrap(size);
	for (let attempt = 0; attempt < 6 && lines.length > 2; attempt++) {
		size *= 0.9;
		lines = wrap(size);
	}

	const local: LocalRun[] = [];
	const gap = gapFor(size);
	const probe = inkOf('Hxg', size);
	const step = probe.cap * (1 + clamp(config.layout.leading, 0, 1.2));

	lines.forEach((lineWords, li) => {
		const runs = lineWords.map((wordIndex) =>
			run(
				ctx,
				phrase.words[wordIndex].display,
				'heavy',
				size,
				wordIndex,
				li,
				wordIndex === phrase.heroIndex,
			),
		);

		// Each line is centred on the block's own axis, so a two-line phrase reads as one shape
		// rather than two left-aligned rows.
		const lineWidth = runs.reduce((acc, r) => acc + r.ink.width, 0) + gap * (runs.length - 1);
		let x = -lineWidth / 2;

		runs.forEach((r) => {
			r.x = x;
			r.y = li * step + r.ink.top;
			x += r.ink.width + gap;
			local.push(r);
		});
	});

	return finalize(local, [], phrase, 'baseline', {
		maxW,
		maxH: geom.height * 0.3,
		cx: geom.width / 2,
		cy: geom.height * geom.trackY + config.layout.trackOffsetY * geom.k,
		anchor: 'bottom',
	});
};

// ---------------------------------------------------------------------------------------
// lit — the same idea, escalated
// ---------------------------------------------------------------------------------------

/**
 * One word per line on a shared left spine, large, with the spoken word lit and the rest held
 * right down. Nothing moves once the stack has landed — only the light travels down it.
 *
 * The restraint is the effect. It is the calmest of the four escalations, which makes it the
 * right one for a line delivered quietly, where a bouncing word would contradict the
 * delivery.
 */
const solveLit = (
	ctx: CanvasRenderingContext2D,
	phrase: Phrase,
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout => {
	const { layout } = config;
	const size = layout.heroFontSize * geom.k * 0.78;
	const local: LocalRun[] = [];
	const lead = clamp(layout.leading * 0.62, 0.08, 1);
	let y = 0;

	phrase.words.forEach((w, i) => {
		const r = run(ctx, w.display, 'heavy', size, i, i, i === phrase.heroIndex);
		// Left spine at x=0. `PlacedRun.x` is the INK left edge, not the pen origin — the
		// sidebearing is backed off once, inside the renderer — so every line sharing x=0 shares
		// the edge the eye actually sees rather than the edge the font declares.
		r.x = 0;
		// Advanced line by line off each line's OWN cap height rather than stepped on a fixed
		// grid. Every line here is the same size so it makes no difference yet, but it makes the
		// stack safe against a per-line size change later — which is exactly what broke the
		// cascade below.
		r.y = y;
		y += r.ink.cap * (1 + lead);
		local.push(r);
	});

	return finalize(local, [], phrase, 'lit', {
		maxW: geom.width * layout.maxWidth,
		maxH: geom.height * 0.74,
		cx: geom.width / 2,
		cy: geom.height * geom.heroY + layout.heroOffsetY * geom.k,
		anchor: 'center',
	});
};

// ---------------------------------------------------------------------------------------
// slam — the one loudest moment
// ---------------------------------------------------------------------------------------

/**
 * The hero word alone, as big as the frame allows, between two rules, with the rest of the
 * phrase shrunk to a caption underneath it.
 *
 * Throwing away the other words is the whole design. Every other look here is a way of
 * keeping the sentence readable; this one gives that up for a single frame of impact, which is
 * why the director allows exactly one per clip. Used twice it stops being the loudest moment
 * and becomes a habit.
 */
const solveSlam = (
	ctx: CanvasRenderingContext2D,
	phrase: Phrase,
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout => {
	const { layout } = config;
	const size = layout.heroFontSize * geom.k * 1.06;
	const hero = phrase.words[phrase.heroIndex];

	const heroRun = run(ctx, hero.display, 'heavy', size, phrase.heroIndex, 0, true);
	// Ink left at 0, so the rules below can run from 0 to the hero's ink width and land flush
	// with the letters rather than with the glyph advance.
	heroRun.x = 0;
	heroRun.y = heroRun.ink.top;

	const cap = heroRun.ink.cap;
	const local: LocalRun[] = [heroRun];
	const rules: PlacedRule[] = [];

	// Rules set off the cap height rather than the ink box, so they sit the same distance from
	// the letters whether or not the word happens to contain a descender.
	const ruleH = Math.max(2, cap * 0.05);
	const gap = cap * 0.3;
	rules.push({
		x: 0,
		y: heroRun.y - gap - ruleH,
		w: heroRun.ink.width,
		h: ruleH,
		from: 'center',
	});
	rules.push({
		x: 0,
		y: heroRun.y + heroRun.ink.height + gap,
		w: heroRun.ink.width,
		h: ruleH,
		from: 'center',
	});

	const rest = phrase.words
		.filter((_, i) => i !== phrase.heroIndex)
		.map((w) => w.display)
		.join(' ');

	if (rest.length > 0) {
		const supportSize = size * clamp(layout.supportRatio, 0.14, 0.44);
		const r = run(ctx, rest, 'medium', supportSize, -1, 1, false);
		// Centred under the lower rule on the hero's optical axis, not the composition's — the
		// hero is the thing being annotated.
		r.x = heroRun.ink.width / 2 - r.ink.width / 2;
		r.y = rules[1].y + ruleH + cap * 0.34;
		local.push(r);
	}

	return finalize(local, rules, phrase, 'slam', {
		maxW: geom.width * layout.maxWidth,
		maxH: geom.height * 0.7,
		cx: geom.width / 2,
		cy: geom.height * geom.heroY + layout.heroOffsetY * geom.k,
		anchor: 'center',
	});
};

// ---------------------------------------------------------------------------------------
// ribbon — heavy sans against a serif tail
// ---------------------------------------------------------------------------------------

/**
 * Lead-in above the hero in small sans, the hero heavy and huge, and the tail set in serif
 * italic tucked under the hero's right edge behind a hairline rule.
 *
 * The mixed faces are doing something specific: the tail is the part of the line that is said
 * after the punch, and setting it in a different voice stops it competing with the punch while
 * still letting it be read. Flushing it right rather than centring it is what makes the pair
 * look composed instead of stacked — the hero's own right edge becomes the reference, so the
 * two shapes share a real alignment.
 */
const solveRibbon = (
	ctx: CanvasRenderingContext2D,
	phrase: Phrase,
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout => {
	const { layout } = config;
	const size = layout.heroFontSize * geom.k * 0.92;
	const hero = phrase.words[phrase.heroIndex];

	const heroRun = run(ctx, hero.display, 'heavy', size, phrase.heroIndex, 1, true);
	// Ink left at 0. The lead flushes to it and the tail flushes to the ink RIGHT edge, so both
	// supporting parts share a real alignment with the hero's letters.
	heroRun.x = 0;
	heroRun.y = heroRun.ink.top;

	const cap = heroRun.ink.cap;
	const supportSize = size * clamp(layout.supportRatio, 0.14, 0.44);
	const local: LocalRun[] = [heroRun];
	const rules: PlacedRule[] = [];

	const lead = phrase.words
		.slice(0, phrase.heroIndex)
		.map((w) => w.display)
		.join(' ');
	if (lead.length > 0) {
		const r = run(ctx, lead, 'medium', supportSize, -1, 0, false);
		// Flush with the hero's left ink edge, clear of its ascenders.
		r.x = 0;
		r.y = heroRun.y - cap * 0.26 - r.ink.height;
		local.push(r);
	}

	const tail = phrase.words
		.slice(phrase.heroIndex + 1)
		.map((w) => w.display)
		.join(' ');
	if (tail.length > 0) {
		const ruleH = Math.max(1.5, cap * 0.022);
		const ruleY = heroRun.y + heroRun.ink.height + cap * 0.16;
		rules.push({ x: 0, y: ruleY, w: heroRun.ink.width, h: ruleH, from: 'left' });

		// Playfair italic at the same nominal size reads noticeably smaller than the sans, so
		// the serif is stepped up to match it optically rather than numerically.
		const r = run(ctx, tail, 'serif', supportSize * 1.42, -1, 2, false);
		r.x = heroRun.ink.width - r.ink.width;
		r.y = ruleY + ruleH + cap * 0.14;
		local.push(r);
	}

	return finalize(local, rules, phrase, 'ribbon', {
		maxW: geom.width * layout.maxWidth,
		maxH: geom.height * 0.72,
		cx: geom.width / 2,
		cy: geom.height * geom.heroY + layout.heroOffsetY * geom.k,
		anchor: 'center',
	});
};

// ---------------------------------------------------------------------------------------
// cascade — the line falls down the frame
// ---------------------------------------------------------------------------------------

/**
 * Words on their own lines, each stepped sideways from the last, arriving one at a time on
 * their own timestamps so the stair builds at the speed of the sentence.
 *
 * This is the look for a fast run of words, where holding them all still would waste the
 * energy already in the delivery. The stair leans left or right depending on a hash of the
 * phrase itself, so two cascades in one clip are visibly different compositions without
 * anything being random — the same transcript always leans the same way.
 */
const solveCascade = (
	ctx: CanvasRenderingContext2D,
	phrase: Phrase,
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout => {
	const { layout } = config;
	const size = layout.heroFontSize * geom.k * 0.6;
	const lean = hash(phrase.words.map((w) => w.raw).join('|')) < 0.5 ? 1 : -1;

	const local: LocalRun[] = [];
	const probe = measureInk(ctx, { text: 'Hxg', size, face: 'heavy' });
	const lead = clamp(layout.leading, 0.16, 1);
	let y = 0;

	phrase.words.forEach((w, i) => {
		const isHero = i === phrase.heroIndex;
		// The hero is a step larger rather than a different colour: in a stack this fast, size
		// registers and hue does not.
		const r = run(ctx, w.display, 'heavy', size * (isHero ? 1.16 : 1), i, i, isHero);
		// The stair step is measured off cap height rather than font size, so it stays even
		// between a line that happens to contain a descender and one that does not.
		r.x = lean * i * probe.cap * 0.34;
		// Cumulative, off this line's own cap height. A fixed step cannot work here: the hero is
		// 16% larger, so its ink reaches 16% of a cap height higher than a uniform grid allows
		// for, and it collided with the line above it. Advancing by what was actually just set is
		// the only version that stays correct when the lines are not all the same size.
		r.y = y;
		y += r.ink.cap * (1 + lead);
		local.push(r);
	});

	return finalize(local, [], phrase, 'cascade', {
		maxW: geom.width * layout.maxWidth,
		maxH: geom.height * 0.76,
		cx: geom.width / 2,
		cy: geom.height * geom.heroY + layout.heroOffsetY * geom.k,
		anchor: 'center',
	});
};

const SOLVERS: Record<
	TreatmentName,
	(
		ctx: CanvasRenderingContext2D,
		phrase: Phrase,
		geom: Geom,
		config: CaptionDirectorConfig,
	) => PhraseLayout
> = {
	baseline: solveBaseline,
	lit: solveLit,
	slam: solveSlam,
	ribbon: solveRibbon,
	cascade: solveCascade,
};

/**
 * Solves every phrase in the clip. Any solver that throws — a zero-width measurement, an empty
 * phrase that slipped through — falls back to the quiet track rather than taking the render
 * down with it. A caption that is plainer than intended is a far better outcome than a failed
 * render.
 */
export const solveTrack = (
	ctx: CanvasRenderingContext2D,
	phrases: Phrase[],
	geom: Geom,
	config: CaptionDirectorConfig,
): PhraseLayout[] =>
	phrases.map((p) => {
		try {
			return SOLVERS[p.treatment](ctx, p, geom, config);
		} catch {
			return solveBaseline(ctx, { ...p, treatment: 'baseline' }, geom, config);
		}
	});

export { FACES };
