import React, { useEffect, useMemo, useState } from 'react';
import {
	AbsoluteFill,
	Easing,
	Video,
	continueRender,
	delayRender,
	interpolate,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/fonts';

/**
 * Poppins ExtraBold × Inter.
 *
 * The face is not a style choice here, it is a structural one. This template drops the
 * small type into the hollows in the big word — over the `ngs` of `things`, under the `thin`
 * before the `g` — so the hero face has to actually have hollows. Two properties decide it:
 *
 *   depth — how far the ascenders rise above the x-height. That difference IS the pocket.
 *   width — how wide the short letters are. That decides whether a fragment fits.
 *
 * Grotesques are the wrong tool: Anton, Archivo, Helvetica and Inter all have very large
 * x-heights, so their ascenders barely clear it and the pockets are both shallow and, being
 * condensed, narrow. Poppins is geometric — small x-height (~0.55em), tall ascenders
 * (~0.73em), and wide circular lowercase — which gives the deepest, widest pockets of any
 * of the popular heavy sans. Inter is the neutral partner for the small type.
 *
 * Poppins 800 rather than 900: at 240px the Black is heavy enough to close up its own
 * counters, which muddies the hollows the layout depends on.
 */
const HERO_FACE = 'Poppins';
const HERO_WEIGHT = 900;
const HERO_STACK = `"${HERO_FACE}", "Century Gothic", sans-serif`;
const SUPPORT_FACE = 'GaramondNovaPro';
const SUPPORT_STACK = `"${SUPPORT_FACE}", "Helvetica Neue", Arial, sans-serif`;
const MID_WEIGHT = 400; // Cursive might not have 600 weight
const SOFT_WEIGHT = 400;

/**
 * hero — the word the line rests on, big and heavy
 * mid  — a small supporting fragment, the run-up into the hero
 * soft — a small supporting fragment, the tail after it
 */
export type AnchorStackRole = 'hero' | 'mid' | 'soft';

export type AnchorStackLine = {
	text: string;
	role?: AnchorStackRole;
};

export type AnchorStackGroup = {
	/** Frame the first line lands on — the word-level timestamp from the transcript */
	at: number;
	/** Frames the finished stack holds before it clears */
	hold?: number;
	/** Top to bottom, which is also the order they are spoken and the order they land */
	lines: AnchorStackLine[];
};

export type AnchorStackConfig = {
	groups: AnchorStackGroup[];
	theme: {
		textColor: string;
		/**
		 * Black laid over the footage, 0-1. The type carries no shadow or outline at all, so
		 * this is the only thing keeping it legible — it does the work a stroke would.
		 */
		backdropDim: number;
	};
	layout: {
		/** Hero size in px at a 1080px-wide canvas; everything scales off this */
		heroFontSize: number;
		/** Supporting sizes as a fraction of the hero. Small — they have to fit the hollows. */
		midRatio: number;
		softRatio: number;
		/**
		 * Vertical clearance between a supporting line and whatever is above or below it, as
		 * a fraction of that line's own CAP HEIGHT — not its font size, and not its ink box.
		 * Cap height is the only one of the three that tracks the size the letters actually
		 * look, so the rhythm stays even whether or not a line happens to contain a `g`.
		 */
		nestleAbove: number;
		nestleBelow: number;
		/**
		 * Sideways clearance kept from the letter bounding a hollow, as a fraction of the
		 * small line's cap height. This is the gap between the `i` of `things` and the `a` of
		 * `avoid` — too small and they touch, too large and the fragment stops fitting.
		 */
		sideClear: number;
		/**
		 * How much lower a fragment has to end up, in multiples of its own cap height, before
		 * nesting it into a hollow is preferred over the plain stacked position. Guards
		 * against breaking the left edge for a gain nobody can see.
		 */
		minGain: number;
		/**
		 * What splitting a line across two hollows costs, in the same cap-height units. A
		 * split has to clear this on top of `minGain`, so an unbroken line always wins when
		 * the two are close.
		 */
		splitPenalty: number;
		/** How far a fragment may overhang the hero on an open side, as a fraction of hero width */
		overhang: number;
		/** Widest the finished block may get, as a fraction of the canvas */
		maxWidth: number;
		/** Nudge the whole block up (negative) or down (positive), in px */
		offsetY: number;
		/** Letter-spacing in em */
		heroTracking: number;
		supportTracking: number;
	};
	timing: {
		/** Frames one line takes to rise into place */
		reveal: number;
		/** Frames between one line starting and the next */
		stagger: number;
		/** Frames the stack takes to clear once its hold is up */
		out: number;
	};
	background?: {
		src?: string;
	};
};

export const ANCHOR_STACK_DEFAULTS: Omit<AnchorStackConfig, 'groups'> = {
	theme: { textColor: '#ffffff', backdropDim: 0.46 },
	layout: {
		heroFontSize: 224,
		midRatio: 0.29,
		softRatio: 0.26,
		nestleAbove: 0.2,
		nestleBelow: 0.22,
		sideClear: 0.42,
		minGain: 0.18,
		splitPenalty: 0.55,
		overhang: 0.22,
		maxWidth: 0.86,
		offsetY: 0,
		heroTracking: -0.03,
		supportTracking: -0.014,
	},
	timing: { reveal: 11, stagger: 3, out: 7 },
};

const clampTo = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Config comes from an LLM, so every knob is clamped to a range that still reads well. */
export const resolveAnchorStackConfig = (
	input?: Partial<AnchorStackConfig>,
): AnchorStackConfig => {
	const d = ANCHOR_STACK_DEFAULTS;
	const layout = { ...d.layout, ...input?.layout };
	const timing = { ...d.timing, ...input?.timing };
	const groups = (input?.groups ?? []).map((g) => ({
		at: Math.max(0, Math.round(g.at)),
		hold: clampTo(g.hold ?? 40, 12, 240),
		// Four lines is already a paragraph; past that the stack stops reading as one shape
		lines: g.lines.slice(0, 4).map((l) => ({
			text: l.text.trim().slice(0, 26),
			role: l.role,
		})),
	}));
	return {
		groups,
		theme: { ...d.theme, ...input?.theme },
		layout: {
			heroFontSize: clampTo(layout.heroFontSize, 40, 2000),
			// Allow very large mid/soft ratios because cursive fonts (like GaramondNovaPro) 
			// render visually much smaller than geometric sans-serifs (like Poppins) for the same font-size.
			midRatio: clampTo(layout.midRatio, 0.18, 1.5),
			softRatio: clampTo(layout.softRatio, 0.18, 1.5),
			nestleAbove: clampTo(layout.nestleAbove, 0.04, 0.6),
			nestleBelow: clampTo(layout.nestleBelow, 0.04, 0.6),
			sideClear: clampTo(layout.sideClear, 0.1, 1.2),
			minGain: clampTo(layout.minGain, 0.04, 1),
			splitPenalty: clampTo(layout.splitPenalty, 0, 2),
			overhang: clampTo(layout.overhang, 0, 2.0),
			maxWidth: clampTo(layout.maxWidth, 0.5, 0.94),
			offsetY: layout.offsetY,
			// Past about -0.04em Poppins ExtraBold starts closing its own counters, and since
			// the layout is measured off the glyph boxes, collapsing counters do not just look
			// bad — they move the hollows the small type is placed into.
			heroTracking: clampTo(layout.heroTracking, -0.04, 0.04),
			supportTracking: clampTo(layout.supportTracking, -0.04, 0.08),
		},
		timing: {
			reveal: clampTo(timing.reveal, 5, 30),
			stagger: clampTo(timing.stagger, 0, 14),
			out: clampTo(timing.out, 3, 24),
		},
		background: input?.background,
	};
};

export const getAnchorStackDuration = (input?: Partial<AnchorStackConfig>) => {
	const c = resolveAnchorStackConfig(input);
	if (c.groups.length === 0) return 60;
	const last = c.groups.reduce((acc, g) => Math.max(acc, g.at + (g.hold ?? 40)), 0);
	return Math.round(last + c.timing.out + 6);
};

const roleOf = (line: AnchorStackLine, isHero: boolean): AnchorStackRole =>
	isHero ? 'hero' : (line.role ?? 'mid');

const cssFont = (role: AnchorStackRole, layout: AnchorStackConfig['layout']) =>
	role === 'hero'
		? { family: HERO_STACK, weight: HERO_WEIGHT, tracking: `${layout.heroTracking}em` }
		: {
				family: SUPPORT_STACK,
				weight: role === 'mid' ? MID_WEIGHT : SOFT_WEIGHT,
				tracking: `${layout.supportTracking}em`,
			};

// ---------------------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------------------

/**
 * One letter, in coordinates where the pen origin is x=0 and the baseline is y=0, with y
 * growing downwards. `inkL`/`inkR` are the real ink edges, not the advance — a letter's
 * sidebearings are empty space, and aligning to them instead of to the ink is what leaves a
 * few pixels of slop on every edge. `top` is negative (how far it reaches up), `bottom`
 * positive (how far it hangs below).
 */
type Glyph = { inkL: number; inkR: number; top: number; bottom: number };

type Ink = {
	/** Ink edges of the whole line, relative to the pen origin */
	inkL: number;
	inkR: number;
	/** inkR - inkL */
	width: number;
	/** Ink top and bottom relative to the baseline: top negative, bottom positive */
	top: number;
	bottom: number;
	/** From the letter H. Drives every gap, so the rhythm follows the visible letter size. */
	cap: number;
	/** From the letter x. Tells the hollows apart from the ascenders. */
	xHeight: number;
	/** Where the baseline sits inside a line-height:1 box, from the font's own metrics */
	baseline: number;
	glyphs: Glyph[];
};

const measure = (
	ctx: CanvasRenderingContext2D,
	text: string,
	role: AnchorStackRole,
	size: number,
	layout: AnchorStackConfig['layout'],
): Ink => {
	const f = cssFont(role, layout);
	const fStyle = role === 'hero' ? 'normal' : 'italic';
	ctx.font = `${fStyle} ${f.weight} ${size}px ${f.family}`;
	(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = f.tracking;

	const whole = ctx.measureText(text);
	const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.7;
	const xHeight = ctx.measureText('x').actualBoundingBoxAscent || size * 0.52;

	// Pen positions come from prefix advances, so kerning and tracking are both respected;
	// ink edges come from each letter's own bounding box.
	const glyphs: Glyph[] = [];
	let pen = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = ctx.measureText(text[i]);
		if (text[i] !== ' ') {
			glyphs.push({
				inkL: pen - ch.actualBoundingBoxLeft,
				inkR: pen + ch.actualBoundingBoxRight,
				top: -ch.actualBoundingBoxAscent,
				bottom: ch.actualBoundingBoxDescent,
			});
		}
		pen = ctx.measureText(text.slice(0, i + 1)).width;
	}

	const half = (size - (whole.fontBoundingBoxAscent + whole.fontBoundingBoxDescent)) / 2;
	const inkL = -whole.actualBoundingBoxLeft;
	const inkR = whole.actualBoundingBoxRight;

	return {
		inkL,
		inkR,
		width: inkR - inkL,
		top: -whole.actualBoundingBoxAscent,
		bottom: whole.actualBoundingBoxDescent,
		cap,
		xHeight,
		baseline: half + whole.fontBoundingBoxAscent,
		glyphs,
	};
};

const guessInk = (text: string, role: AnchorStackRole, size: number): Ink => {
	const w = size * (role === 'hero' ? 0.6 : 0.55) * text.length;
	return {
		inkL: 0,
		inkR: w,
		width: w,
		top: -size * 0.73,
		bottom: size * 0.02,
		cap: size * 0.7,
		xHeight: size * 0.52,
		baseline: size * 0.78,
		glyphs: [{ inkL: 0, inkR: w, top: -size * 0.73, bottom: size * 0.02 }],
	};
};

const scaleInk = (ink: Ink, s: number): Ink => ({
	inkL: ink.inkL * s,
	inkR: ink.inkR * s,
	width: ink.width * s,
	top: ink.top * s,
	bottom: ink.bottom * s,
	cap: ink.cap * s,
	xHeight: ink.xHeight * s,
	baseline: ink.baseline * s,
	glyphs: ink.glyphs.map((g) => ({
		inkL: g.inkL * s,
		inkR: g.inkR * s,
		top: g.top * s,
		bottom: g.bottom * s,
	})),
});

/** A line, plus every consecutive run of its words measured on its own so it can be split. */
type LineInk = { ink: Ink; words: string[]; runs: Record<string, Ink> };

const useInk = (
	entries: { text: string; role: AnchorStackRole; size: number }[],
	layout: AnchorStackConfig['layout'],
) => {
	const [handle] = useState(() => delayRender('Measuring anchor stack text'));
	const [measured, setMeasured] = useState<LineInk[] | null>(null);
	const key = useMemo(
		() =>
			entries.map((e) => `${e.role}|${e.size}|${e.text}`).join('~') +
			`|${layout.heroTracking}|${layout.supportTracking}`,
		[entries, layout.heroTracking, layout.supportTracking],
	);

	useEffect(() => {
		let isCancelled = false;
		setMeasured(null); // Invalidate on change
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) return;
		const want = [
			`normal ${HERO_WEIGHT} 100px "${HERO_FACE}"`,
			`italic ${MID_WEIGHT} 100px "${SUPPORT_FACE}"`,
			`italic ${SOFT_WEIGHT} 100px "${SUPPORT_FACE}"`,
		];
		Promise.all(want.map((f) => document.fonts.load(f).catch(() => undefined)))
			.then(() => document.fonts.ready)
			.then(() => {
				if (isCancelled) return;
				setMeasured(
					entries.map((e) => {
						const words = e.text.split(/\s+/).filter(Boolean);
						const runs: Record<string, Ink> = {};
						for (let a = 0; a < words.length; a++) {
							for (let b = a; b < words.length; b++) {
								const text = words.slice(a, b + 1).join(' ');
								runs[`${a}:${b}`] = measure(ctx, text, e.role, e.size, layout);
							}
						}
						return { ink: measure(ctx, e.text, e.role, e.size, layout), words, runs };
					}),
				);
				continueRender(handle);
			});
		return () => { isCancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, handle]);

	return (
		(measured && measured.length === entries.length ? measured : null) ??
		entries.map((e) => {
			const words = e.text.split(/\s+/).filter(Boolean);
			const runs: Record<string, Ink> = {};
			for (let a = 0; a < words.length; a++) {
				for (let b = a; b < words.length; b++) {
					runs[`${a}:${b}`] = guessInk(words.slice(a, b + 1).join(' '), e.role, e.size);
				}
			}
			return { ink: guessInk(e.text, e.role, e.size), words, runs };
		})
	);
};

// ---------------------------------------------------------------------------------------
// The hollows
// ---------------------------------------------------------------------------------------

/** Something a supporting line has to stay clear of: a hero letter, or a line already set. */
type Obstacle = { x0: number; x1: number; top: number; bottom: number };

/**
 * A run of the hero where nothing tall gets in the way. Above the baseline that is a run of
 * x-height letters with no ascender among them — the `ngs` of `things`, the `sc` and `ne` of
 * `discipline`. Below it, a run with no descender — the `thin` of `things`.
 *
 * `x0`/`x1` are how far the hollow reaches, which is up to whatever bounds it: the ink edge
 * of the tall letter beside it, or open space if it runs off the end of the word. Which
 * sides are bounded decides which edge a fragment aligns to, and that is what makes the
 * small type start exactly at the `i` and stop exactly at the `g`.
 */
type Hollow = {
	x0: number;
	x1: number;
	limit: number;
	boundedLeft: boolean;
	boundedRight: boolean;
};

const buildHollows = (
	glyphs: Glyph[],
	dir: -1 | 1,
	xHeight: number,
	spanX0: number,
	spanX1: number,
	overhang: number,
): Hollow[] => {
	// Above: a letter is in the way if it rises meaningfully past the x-height, so the dot
	// of an `i` blocks but the shoulder of an `n` does not. Below: if it hangs past the
	// baseline by more than a round letter's overshoot.
	const blocks = (g: Glyph) => (dir < 0 ? g.top < -xHeight * 1.14 : g.bottom > xHeight * 0.09);

	const out: Hollow[] = [];
	let run: Glyph[] = [];
	let leftBound: number | null = null;

	const close = (rightBound: number | null) => {
		if (run.length === 0) return;
		const limit = run.reduce(
			(acc, g) => (dir < 0 ? Math.min(acc, g.top) : Math.max(acc, g.bottom)),
			dir < 0 ? 0 : 0,
		);
		out.push({
			x0: leftBound ?? spanX0 - overhang,
			x1: rightBound ?? spanX1 + overhang,
			limit,
			boundedLeft: leftBound !== null,
			boundedRight: rightBound !== null,
		});
		run = [];
	};

	for (const g of glyphs) {
		if (blocks(g)) {
			close(g.inkL);
			leftBound = g.inkR;
		} else {
			run.push(g);
		}
	}
	close(null);
	return out;
};

/**
 * How close to the hero's baseline a box of width `w` sitting at `x` may come. `pad` widens
 * the window sideways, so a tall letter just beside it still holds it back — that sideways
 * clearance is the difference between tucked in and crashed into. Returns a y in
 * hero-baseline coordinates.
 */
const clearanceAt = (obstacles: Obstacle[], x: number, w: number, pad: number, dir: -1 | 1) => {
	const a = x - pad;
	const b = x + w + pad;
	let limit = 0;
	for (const o of obstacles) {
		if (o.x1 <= a || o.x0 >= b) continue;
		limit = dir < 0 ? Math.min(limit, o.top) : Math.max(limit, o.bottom);
	}
	return limit;
};

/** Every way of cutting `n` words into at most `maxParts` consecutive runs. */
const partitions = (n: number, maxParts: number) => {
	const out: [number, number][][] = [];
	const walk = (start: number, acc: [number, number][]) => {
		if (start === n) {
			out.push([...acc]);
			return;
		}
		if (acc.length === maxParts) return;
		for (let end = start; end < n; end++) {
			acc.push([start, end]);
			walk(end + 1, acc);
			acc.pop();
		}
	};
	walk(0, []);
	return out;
};

/** Every ordered choice of `k` hollows out of `n`, left to right. */
const combinations = (n: number, k: number) => {
	const out: number[][] = [];
	const walk = (start: number, acc: number[]) => {
		if (acc.length === k) {
			out.push([...acc]);
			return;
		}
		for (let i = start; i < n; i++) {
			acc.push(i);
			walk(i + 1, acc);
			acc.pop();
		}
	};
	walk(0, []);
	return out;
};

type Fragment = { text: string; ink: Ink; x: number };
type Plan = { fragments: Fragment[]; limit: number };

/**
 * Works out where one supporting line goes. The plain stacked position — flush with the
 * hero's left ink edge, clear of everything under it — is the baseline to beat. Then every
 * way of dropping the line into the hero's hollows is costed against it, including breaking
 * it across two hollows so that `and the` can sit either side of the `pli` of `discipline`.
 *
 * A candidate wins only if it ends up meaningfully lower than the stacked position, and a
 * split has to beat an unbroken line by a further margin. So the interlocking happens
 * whenever the letters allow it and quietly stops when they do not, which is what keeps
 * different chunks looking like the same piece of design.
 */
const planLine = (
	line: LineInk,
	hollows: Hollow[],
	obstacles: Obstacle[],
	dir: -1 | 1,
	layout: AnchorStackConfig['layout'],
): Plan => {
	const { ink, words, runs } = line;
	const pad = ink.cap * layout.sideClear;
	const deeper = (a: number, b: number) => (dir < 0 ? a - b : b - a);

	// The position to beat: flush left with the hero, sitting clear of whatever is under it
	const fallback: Plan = {
		fragments: [{ text: words.join(' '), ink, x: 0 }],
		limit: clearanceAt(obstacles, 0, ink.width, pad, dir),
	};

	let best = fallback;
	let bestScore = 0;
	const maxParts = Math.min(3, words.length);

	for (const parts of partitions(words.length, maxParts)) {
		for (const pick of combinations(hollows.length, parts.length)) {
			const fragments: Fragment[] = [];
			let limit = dir < 0 ? 0 : 0;
			let ok = true;

			for (let j = 0; j < parts.length && ok; j++) {
				const [a, b] = parts[j];
				const frag = runs[`${a}:${b}`];
				const hollow = hollows[pick[j]];
				if (!frag) {
					ok = false;
					break;
				}

				// Clearance is only owed to a side that actually has a letter on it
				const clearL = hollow.boundedLeft ? pad : 0;
				const clearR = hollow.boundedRight ? pad : 0;
				if (frag.width > hollow.x1 - clearR - (hollow.x0 + clearL)) {
					ok = false;
					break;
				}

				// Align to the bounded side: hard against the letter that closes the hollow,
				// which reads as deliberate. Left wins when both sides are closed, and when
				// neither is, the hero's own left edge is the only sensible reference.
				const x = hollow.boundedLeft
					? hollow.x0 + clearL
					: hollow.boundedRight
						? hollow.x1 - clearR - frag.width
						: 0;

				// Two fragments must not run into each other
				const prev = fragments[fragments.length - 1];
				if (prev && x < prev.x + prev.ink.width + pad) {
					ok = false;
					break;
				}

				fragments.push({ text: words.slice(a, b + 1).join(' '), ink: frag, x });
				const local = clearanceAt(obstacles, x, frag.width, pad, dir);
				limit = dir < 0 ? Math.min(limit, local) : Math.max(limit, local);
			}

			if (!ok || fragments.length === 0) continue;

			// One shared limit across the fragments, so a broken line still sits on one
			// baseline and reads as a single line with the hero growing through it.
			const gain = deeper(limit, fallback.limit) / ink.cap;
			const score = gain - layout.splitPenalty * (fragments.length - 1);
			if (gain > layout.minGain && score > bestScore) {
				bestScore = score;
				best = { fragments, limit };
			}
		}
	}

	return best;
};

// ---------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------

type Placed = {
	text: string;
	role: AnchorStackRole;
	size: number;
	ink: Ink;
	left: number;
	inkTop: number;
	/** Which line this came from. Fragments of one line share it, so they animate as one. */
	order: number;
};

// Safe apostrophe rendering to prevent demo font glyph glitches (like '±' or floral icons)
const renderTextWithSafeApos = (text: string, isItalic: boolean) => {
	if (!text.includes("'") && !text.includes('’')) {
		return <>{text}</>;
	}
	const parts = text.split(/(['’])/g);
	return (
		<>
			{parts.map((part, i) => {
				if (part === "'" || part === '’') {
					return (
						<span
							key={i}
							style={{
								fontFamily: HERO_STACK,
								fontWeight: isItalic ? 500 : HERO_WEIGHT,
								fontStyle: 'normal',
								display: 'inline-block',
								margin: '0',
							}}
						>
							'
						</span>
					);
				}
				return <span key={i}>{part}</span>;
			})}
		</>
	);
};

export const AnchorStackGroupView: React.FC<{
	group: AnchorStackGroup;
	config: AnchorStackConfig;
	width: number;
	height: number;
	fallback?: React.ReactNode;
}> = ({ group, config, width, height, fallback }) => {
	const frame = useCurrentFrame();
	const { layout, timing, theme } = config;

	const heroSize = layout.heroFontSize * (width / 1080);

	// The hero is whichever line says it is; failing that, the longest one, because that is
	// the word the eye lands on anyway.
	const declared = group.lines.findIndex((l) => l.role === 'hero');
	const heroIndex =
		declared >= 0
			? declared
			: group.lines.reduce(
					(best, l, i) => (l.text.length > group.lines[best].text.length ? i : best),
					0,
				);

	const entries = useMemo(
		() =>
			group.lines.map((l, i) => {
				const role = roleOf(l, i === heroIndex);
				const size =
					role === 'hero'
						? heroSize
						: heroSize * (role === 'soft' ? layout.softRatio : layout.midRatio);
				return { text: l.text, role, size };
			}),
		[group.lines, heroIndex, heroSize, layout.midRatio, layout.softRatio],
	);

	const lines = useInk(entries, layout);

	const placed: Placed[] = useMemo(() => {
		const heroInk = lines[heroIndex].ink;
		const heroW = heroInk.width;
		const shiftToHero = -heroInk.inkL;

		// Laid out in hero-ink coordinates: x from the hero's leftmost ink, y from its
		// baseline, downwards positive. Nothing is scaled or centred until the end — every
		// quantity below is linear in size, so the layout is identical at any scale.
		const heroGlyphs = heroInk.glyphs.map((g) => ({
			inkL: g.inkL + shiftToHero,
			inkR: g.inkR + shiftToHero,
			top: g.top,
			bottom: g.bottom,
		}));
		const obstacles: Obstacle[] = heroGlyphs.map((g) => ({
			x0: g.inkL,
			x1: g.inkR,
			top: g.top,
			bottom: g.bottom,
		}));

		const overhang = heroW * layout.overhang;
		const hollowsAbove = buildHollows(heroGlyphs, -1, heroInk.xHeight, 0, heroW, overhang);
		const hollowsBelow = buildHollows(heroGlyphs, 1, heroInk.xHeight, 0, heroW, overhang);

		const out: { frag: Fragment; role: AnchorStackRole; size: number; top: number; order: number }[] =
			[];
		out.push({
			frag: { text: entries[heroIndex].text, ink: heroInk, x: 0 },
			role: 'hero',
			size: entries[heroIndex].size,
			top: heroInk.top,
			order: heroIndex,
		});

		// Worked outwards from the hero so each new line also clears the ones already set.
		// Only the line touching the hero gets to nest into it — a second line further out
		// has the first one in the way, so nesting it would mean nesting into a straight
		// edge, which just reintroduces arbitrary offsets.
		const order = [
			...Array.from({ length: heroIndex }, (_, i) => heroIndex - 1 - i),
			...Array.from({ length: lines.length - heroIndex - 1 }, (_, i) => heroIndex + 1 + i),
		];

		for (const i of order) {
			const above = i < heroIndex;
			const dir: -1 | 1 = above ? -1 : 1;
			const adjacent = Math.abs(i - heroIndex) === 1;
			const line = lines[i];
			const pad = line.ink.cap * layout.sideClear;
			const gap = line.ink.cap * (above ? layout.nestleAbove : layout.nestleBelow);

			const plan = adjacent
				? planLine(line, above ? hollowsAbove : hollowsBelow, obstacles, dir, layout)
				: {
						fragments: [{ text: entries[i].text, ink: line.ink, x: 0 }],
						limit: clearanceAt(obstacles, 0, line.ink.width, pad, dir),
					};

			const inkH = line.ink.bottom - line.ink.top;
			const top = above ? plan.limit - gap - inkH : plan.limit + gap;

			for (const frag of plan.fragments) {
				out.push({ frag, role: entries[i].role, size: entries[i].size, top, order: i });
				obstacles.push({
					x0: frag.x,
					x1: frag.x + frag.ink.width,
					top,
					bottom: top + (frag.ink.bottom - frag.ink.top),
				});
			}
		}

		// The block is scaled and centred as one, by its real ink extent on both axes. Doing
		// it here rather than per line means a fragment that overhangs the hero still leaves
		// the composition centred, instead of being clamped at the margin.
		const minX = Math.min(...out.map((o) => o.frag.x));
		const maxX = Math.max(...out.map((o) => o.frag.x + o.frag.ink.width));
		const minY = Math.min(...out.map((o) => o.top));
		const maxY = Math.max(...out.map((o) => o.top + (o.frag.ink.bottom - o.frag.ink.top)));

		const blockW = maxX - minX;
		const fit = blockW > width * layout.maxWidth ? (width * layout.maxWidth) / blockW : 1;

		// MINIMUM READABLE SIZE GUARD: If any support text would end up smaller than
		// 28px after fit-scaling, the anchor layout is not viable for this word combination.
		// Return empty so the caller can fall back to a general/bottom layout.
		const MIN_SUPPORT_SIZE = 28;
		const tooSmall = out.some((o) => o.role !== 'hero' && o.size * fit < MIN_SUPPORT_SIZE);
		if (tooSmall) return [];

		const shiftX = (width - blockW * fit) / 2 - minX * fit;
		// Align to the top of the provided bounding box, similar to standard text layouts, 
		// instead of vertically centering it which pushes it down to the chest level.
		const shiftY = (height - (maxY - minY) * fit) * 0.1 - minY * fit + layout.offsetY;

		return out.map((o) => {
			const ink = scaleInk(o.frag.ink, fit);
			return {
				text: o.frag.text,
				role: o.role,
				size: o.size * fit,
				ink,
				// Snapped to whole pixels. Type on a half pixel is resampled across two
				// columns, which both softens the letterforms and makes a shared edge look
				// like it is out by one — the exact thing that reads as imprecise.
				// The wrapper's box starts at the pen origin, so back off the left sidebearing.
				left: Math.round(o.frag.x * fit + shiftX - ink.inkL),
				inkTop: Math.round(o.top * fit + shiftY),
				order: o.order,
			};
		});
	}, [entries, lines, heroIndex, width, height, layout]);

	const outAt = group.at + (group.hold ?? 40);
	const exit = interpolate(frame, [outAt, outAt + timing.out], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.in(Easing.quad),
	});

	// If placed is empty, the min-size guard triggered — fall back to bottom layout
	if (placed.length === 0 && fallback) {
		return <>{fallback}</>;
	}

	return (
		<>
			{placed.map((p, idx) => {
				const start = group.at + p.order * timing.stagger;
				const inkH = p.ink.bottom - p.ink.top;

				// A long-tailed bezier: most of the travel is over quickly, the last few
				// pixels are slow, so the line arrives fast and still settles calmly.
				const rise = interpolate(frame, [start, start + timing.reveal], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: Easing.bezier(0.16, 1, 0.3, 1),
				});
				const fade = interpolate(frame, [start, start + 4], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				});
				const focus = interpolate(frame, [start, start + timing.reveal * 0.55], [1, 0], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: Easing.out(Easing.quad),
				});
				const blur = focus * p.size * 0.05 + exit * p.size * 0.035;
				const f = cssFont(p.role, layout);

				return (
					<div
						key={`${p.order}-${idx}`}
						style={{
							position: 'absolute',
							left: p.left,
							top: p.inkTop,
							width: Math.ceil(p.ink.inkR) + 2,
							height: Math.ceil(inkH),
							// Clipped top and bottom only, so the rise is masked while the ink
							// and the blur still bleed sideways.
							clipPath: 'inset(-1px -45% 0px -45%)',
							opacity: fade * (1 - exit),
							filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
							willChange: 'transform, opacity',
						}}
					>
						<div
							style={{
								position: 'relative',
								transform: `translateY(${((1 - rise) * 100).toFixed(3)}%)`,
							}}
						>
							<div
								style={{
									position: 'absolute',
									left: 0,
									// The wrapper's box top IS the ink top, so pull the line box up
									// by however far the ink sits below it
									top: -(p.ink.baseline + p.ink.top),
									fontFamily: f.family,
									fontWeight: f.weight,
									fontStyle: p.role === 'hero' ? 'normal' : 'italic',
									fontSize: p.size,
									lineHeight: 1,
									letterSpacing: f.tracking,
									color: theme.textColor,
									whiteSpace: 'nowrap',
									WebkitFontSmoothing: 'antialiased',
									textRendering: 'geometricPrecision',
								}}
							>
								{renderTextWithSafeApos(p.text, p.role !== 'hero')}
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
};

export const AnchorStack: React.FC<{ config?: Partial<AnchorStackConfig> }> = ({ config }) => {
	const c = resolveAnchorStackConfig(config);
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();

	const active = c.groups.filter(
		(g) => frame >= g.at - 2 && frame <= g.at + (g.hold ?? 40) + c.timing.out,
	);

	return (
		<>
			{active.map((g) => (
				<AnchorStackGroupView key={g.at} group={g} config={c} width={width} height={height} />
			))}
		</>
	);
};

export default AnchorStack;
