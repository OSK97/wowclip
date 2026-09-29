/**
 * Type measurement for the director.
 *
 * Everything is measured off `actualBoundingBox*` — the ink — and spaced off cap height
 * rather than font size. A caption composed against the font's line box instead of its ink
 * sits a few pixels off on every edge, and at 180px a few pixels is the difference between
 * "set" and "roughly placed". Cap height is the only one of the three vertical metrics that
 * tracks how big the letters actually look, so it drives every gap.
 *
 * Self-contained by design: no imports outside React and Remotion, so the folder drops into
 * any project.
 */
import { useEffect, useMemo, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { FACES, type FaceName } from './fonts';

export { clamp, hash } from './util';

export type TextSpec = {
	text: string;
	size: number;
	face: FaceName;
};

export type Ink = {
	/** Ink edges relative to the pen origin. inkL is usually a pixel or two positive. */
	inkL: number;
	inkR: number;
	/** inkR - inkL — the width the letters occupy, not the advance */
	width: number;
	/** Relative to the baseline: top negative, bottom positive */
	top: number;
	bottom: number;
	height: number;
	/** Pen advance of the whole string, including the trailing sidebearing */
	advance: number;
	/** From the letter H. Use this, not font size, to drive spacing. */
	cap: number;
	/** From the letter x. Tells hollows apart from ascenders. */
	xHeight: number;
	/** Where the baseline sits inside a line-height:1 box, from the font's own metrics */
	baseline: number;
};

const fontString = (spec: TextSpec) => {
	const f = FACES[spec.face];
	return `${f.italic ? 'italic ' : ''}${f.weight} ${spec.size}px ${f.family}`;
};

/**
 * Both spacing properties are set on the canvas as well as on the element, so a string is
 * measured under exactly the conditions it is drawn under. Missing either one here would put
 * every position in a multi-word run out by the accumulated difference — which is the kind of
 * error that looks like a layout bug and is actually a measurement bug.
 *
 * Cast because `letterSpacing`/`wordSpacing` on the 2D context are newer than the DOM typings
 * in use here. Both are present in the Chrome that Remotion renders in.
 */
type SpacedContext = CanvasRenderingContext2D & { letterSpacing: string; wordSpacing: string };

export const applyFont = (ctx: CanvasRenderingContext2D, spec: TextSpec) => {
	const f = FACES[spec.face];
	ctx.font = fontString(spec);
	(ctx as SpacedContext).letterSpacing = f.tracking;
	(ctx as SpacedContext).wordSpacing = f.spacing;
};

export const measureInk = (ctx: CanvasRenderingContext2D, spec: TextSpec): Ink => {
	applyFont(ctx, spec);
	const m = ctx.measureText(spec.text);
	const cap = ctx.measureText('H').actualBoundingBoxAscent || spec.size * 0.7;
	const xHeight = ctx.measureText('x').actualBoundingBoxAscent || spec.size * 0.52;
	const half = (spec.size - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;

	const inkL = -m.actualBoundingBoxLeft;
	const inkR = m.actualBoundingBoxRight;
	const top = -m.actualBoundingBoxAscent;
	const bottom = m.actualBoundingBoxDescent;

	return {
		inkL,
		inkR,
		width: inkR - inkL,
		top,
		bottom,
		height: bottom - top,
		advance: m.width,
		cap,
		xHeight,
		baseline: half + m.fontBoundingBoxAscent,
	};
};

/** Pen advance only. Used to find where word `i` starts inside a line of set text. */
export const measureAdvance = (ctx: CanvasRenderingContext2D, spec: TextSpec) => {
	applyFont(ctx, spec);
	return ctx.measureText(spec.text).width;
};

/**
 * Plausible metrics for the frames before the fonts resolve, and for any environment with no
 * 2D canvas. Never used in a finished render — the solve is held behind `delayRender` — but a
 * layout built from it must still be structurally valid rather than NaN.
 */
export const guessInk = (spec: TextSpec): Ink => {
	const narrow = spec.face === 'serif';
	const w = spec.size * (narrow ? 0.44 : 0.58) * Math.max(1, spec.text.length);
	return {
		inkL: 0,
		inkR: w,
		width: w,
		top: -spec.size * 0.72,
		bottom: spec.size * 0.02,
		height: spec.size * 0.74,
		advance: w * 1.03,
		cap: spec.size * 0.7,
		xHeight: spec.size * 0.52,
		baseline: spec.size * 0.78,
	};
};

/**
 * Runs `solve` once, after every face has resolved, holding the render until it has.
 *
 * The whole clip is solved in that one pass rather than per phrase per frame. Two reasons:
 * the render is only held once instead of at every phrase boundary, and — the real one — a
 * layout that is recomputed while frames advance can shift between consecutive frames as
 * measurements land. Solving the entire track up front makes the geometry a constant that
 * the animation reads from, so frame 300 is identical whether or not frame 299 was rendered.
 */
export const useFontedSolve = <T,>(
	key: string,
	probes: string[],
	solve: (ctx: CanvasRenderingContext2D) => T,
	fallback: () => T,
): T => {
	const [handle] = useState(() => delayRender('Solving caption director layout'));
	const [value, setValue] = useState<T | null>(null);

	useEffect(() => {
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) {
			continueRender(handle);
			return;
		}
		Promise.all(probes.map((f) => document.fonts.load(f).catch(() => undefined)))
			.then(() => document.fonts.ready)
			.then(() => {
				setValue(solve(ctx));
				continueRender(handle);
			})
			.catch(() => continueRender(handle));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, handle]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => value ?? fallback(), [value, key]);
};

/**
 * Positions a run so its ink top-left lands exactly at (0, 0) of its container. Spread onto
 * the text element inside a relatively positioned box placed at the target point.
 */
export const inkAnchor = (ink: Ink, spec: TextSpec): React.CSSProperties => {
	const f = FACES[spec.face];
	return {
		position: 'absolute',
		left: -ink.inkL,
		top: -(ink.baseline + ink.top),
		fontFamily: f.family,
		fontWeight: f.weight,
		fontStyle: f.italic ? 'italic' : 'normal',
		fontSize: spec.size,
		lineHeight: 1,
		letterSpacing: f.tracking,
		wordSpacing: f.spacing,
		whiteSpace: 'nowrap',
	};
};
