/**
 * Caption Engine — glyph metrics.
 *
 * Everything the layout does depends on knowing where the ink actually is, letter by letter.
 * A line box will not do: a letter's sidebearings are empty space, so aligning small type to a
 * line box leaves a few pixels of slop on every edge, and that slop is the entire difference
 * between type that looks set and type that looks typed.
 *
 * So each line is measured against the real font with `measureText`, and the hero word is
 * measured one character at a time to get its skyline. Pen positions come from prefix advances
 * (so kerning and tracking are respected) while the edges come from each character's own
 * bounding box.
 */

import { useEffect, useMemo, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export interface Face {
	family: string;
	weight: number;
	/** Letter-spacing in em. Applied through canvas `letterSpacing` while measuring. */
	trackingEm: number;
}

/**
 * One character, in coordinates where the pen origin is x=0 and the baseline is y=0, with y
 * growing downwards. `top` is negative and `bottom` positive.
 *
 * Keeping the character beside its measured box is important. Browser metrics tell us where the
 * ink happens to end in this font; the character tells us why. The pocket detector combines both,
 * using an explicit ascender/descender table for Latin and measured geometry for every other
 * script. That avoids a one-pixel antialiasing difference turning an x-height letter into a false
 * ascender and changing the layout between machines.
 */
export interface Glyph {
	char: string;
	inkL: number;
	inkR: number;
	top: number;
	bottom: number;
}

export interface Ink {
	/** Ink edges of the whole line, relative to the pen origin. */
	inkL: number;
	inkR: number;
	/** `inkR - inkL` — the width the letters occupy, not the advance. */
	width: number;
	/** Ink extent relative to the baseline: `top` negative, `bottom` positive. */
	top: number;
	bottom: number;
	/** Cap height, from `H`. Drives spacing, so rhythm follows visible letter size. */
	cap: number;
	/** x-height, from `x`. Distinguishes the pockets from the ascenders. */
	xHeight: number;
	/** Where the baseline sits inside a `line-height: 1` box. */
	baseline: number;
	glyphs: Glyph[];
}

/** A support line, plus every consecutive run of its words so it can split across pockets. */
export interface MeasuredLine {
	ink: Ink;
	words: string[];
	/** Keyed `"firstWordIndex:lastWordIndex"`. */
	runs: Record<string, Ink>;
}

export const fontString = (face: Face, size: number): string =>
	`${face.weight} ${size}px ${face.family}`;

const applyFace = (ctx: CanvasRenderingContext2D, face: Face, size: number): void => {
	ctx.font = fontString(face, size);
	(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
		`${face.trackingEm}em`;
};

export const measureInk = (
	ctx: CanvasRenderingContext2D,
	text: string,
	face: Face,
	size: number,
): Ink => {
	applyFace(ctx, face, size);

	const whole = ctx.measureText(text);
	const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.7;
	const xHeight = ctx.measureText('x').actualBoundingBoxAscent || size * 0.52;

	const glyphs: Glyph[] = [];
	let pen = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const m = ctx.measureText(char);
		if (char !== ' ') {
			glyphs.push({
				char,
				inkL: pen - m.actualBoundingBoxLeft,
				inkR: pen + m.actualBoundingBoxRight,
				top: -m.actualBoundingBoxAscent,
				bottom: m.actualBoundingBoxDescent,
			});
		}
		// Prefix advances preserve kerning and the canvas letter-spacing setting.
		pen = ctx.measureText(text.slice(0, i + 1)).width;
	}

	const fontAscent = whole.fontBoundingBoxAscent || size * 0.78;
	const fontDescent = whole.fontBoundingBoxDescent || size * 0.22;
	const half = (size - (fontAscent + fontDescent)) / 2;
	const inkL = -whole.actualBoundingBoxLeft;
	const inkR = whole.actualBoundingBoxRight;

	return {
		inkL,
		inkR,
		width: Math.max(0, inkR - inkL),
		top: -whole.actualBoundingBoxAscent,
		bottom: whole.actualBoundingBoxDescent,
		cap,
		xHeight,
		baseline: half + fontAscent,
		glyphs,
	};
};

// ─────────────────────────────────────────────────────────────────────────────
// Browserless fallback metrics
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_ASCENDERS = /[bdfhijklt]/;
const FALLBACK_DESCENDERS = /[gjpqyQ]/;
const isLatinCapital = (char: string): boolean => /^[A-Z]$/.test(char);

/**
 * Plausible Poppins-like metrics for frames before fonts resolve and environments without canvas.
 * A finished browser render uses `measureInk`; this only has to be structurally honest.
 *
 * Unlike the old one-box fallback, this emits one glyph per character with a hardcoded Latin
 * anatomy. Therefore the preview does not first show a stacked layout and jump to an interlocked
 * layout after the font promise resolves.
 */
export const guessInk = (text: string, face: Face, size: number): Ink => {
	const isHero = face.weight >= 700;
	const defaultAdvance = size * (isHero ? 0.59 : 0.53);
	const spaceAdvance = size * 0.27;
	const tracking = size * face.trackingEm;
	const glyphs: Glyph[] = [];
	let pen = 0;
	let inkL = Infinity;
	let inkR = -Infinity;
	let top = 0;
	let bottom = 0;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const isSpace = char === ' ';
		const narrow = /[fijltI1.,'!]/.test(char);
		const wide = /[mwMW@%]/.test(char);
		const advance = isSpace
			? spaceAdvance
			: defaultAdvance * (narrow ? 0.58 : wide ? 1.34 : 1);

		if (!isSpace) {
			const reachesTop = isLatinCapital(char) || FALLBACK_ASCENDERS.test(char);
			const reachesBottom = FALLBACK_DESCENDERS.test(char);
			const glyphTop = -size * (reachesTop ? 0.73 : 0.55);
			const glyphBottom = size * (reachesBottom ? 0.2 : 0.02);
			const glyph: Glyph = {
				char,
				inkL: pen,
				inkR: pen + advance * 0.94,
				top: glyphTop,
				bottom: glyphBottom,
			};
			glyphs.push(glyph);
			inkL = Math.min(inkL, glyph.inkL);
			inkR = Math.max(inkR, glyph.inkR);
			top = Math.min(top, glyphTop);
			bottom = Math.max(bottom, glyphBottom);
		}

		pen += advance + (i < text.length - 1 ? tracking : 0);
	}

	if (glyphs.length === 0) {
		inkL = 0;
		inkR = Math.max(1, pen);
		top = -size * 0.55;
		bottom = size * 0.02;
	}

	return {
		inkL,
		inkR,
		width: Math.max(1, inkR - inkL),
		top,
		bottom,
		cap: size * 0.7,
		xHeight: size * 0.55,
		baseline: size * 0.78,
		glyphs,
	};
};

export const scaleInk = (ink: Ink, s: number): Ink => ({
	inkL: ink.inkL * s,
	inkR: ink.inkR * s,
	width: ink.width * s,
	top: ink.top * s,
	bottom: ink.bottom * s,
	cap: ink.cap * s,
	xHeight: ink.xHeight * s,
	baseline: ink.baseline * s,
	glyphs: ink.glyphs.map((g) => ({
		char: g.char,
		inkL: g.inkL * s,
		inkR: g.inkR * s,
		top: g.top * s,
		bottom: g.bottom * s,
	})),
});

// ─────────────────────────────────────────────────────────────────────────────
// Measuring a whole caption track in one pass
// ─────────────────────────────────────────────────────────────────────────────

export interface MeasureRequest {
	/** Stable key, used for lookup and cache invalidation. */
	key: string;
	text: string;
	face: Face;
	size: number;
	/** Measure every consecutive run of words too, so the line can split across pockets. */
	withRuns: boolean;
}

export type MeasuredMap = Record<string, MeasuredLine>;

const measureOne = (
	ctx: CanvasRenderingContext2D | null,
	req: MeasureRequest,
): MeasuredLine => {
	const words = req.text.split(/\s+/).filter((w) => w.length > 0);
	const runs: Record<string, Ink> = {};
	const take = (textToMeasure: string): Ink =>
		ctx
			? measureInk(ctx, textToMeasure, req.face, req.size)
			: guessInk(textToMeasure, req.face, req.size);

	if (req.withRuns) {
		for (let a = 0; a < words.length; a++) {
			for (let b = a; b < words.length; b++) {
				runs[`${a}:${b}`] = take(words.slice(a, b + 1).join(' '));
			}
		}
	}

	return { ink: take(req.text), words, runs };
};

const buildMap = (
	ctx: CanvasRenderingContext2D | null,
	requests: MeasureRequest[],
): MeasuredMap => {
	const out: MeasuredMap = {};
	for (let i = 0; i < requests.length; i++) {
		out[requests[i].key] = measureOne(ctx, requests[i]);
	}
	return out;
};

/**
 * Measures the whole track once behind one `delayRender`.
 *
 * `fontProbes` matters: `document.fonts.ready` only waits for loads already in flight, so each face
 * must be requested by name first. Otherwise a line can be measured in the fallback and drawn in
 * the real face, putting every pocket a few pixels out.
 */
export const useMeasuredTrack = (
	requests: MeasureRequest[],
	fontProbes: string[],
): MeasuredMap => {
	const [handle] = useState(() => delayRender('Measuring caption glyph metrics'));
	const [measured, setMeasured] = useState<MeasuredMap | null>(null);

	const key = useMemo(
		() =>
			requests
				.map(
					(r) =>
						`${r.key}|${r.face.family}|${r.face.weight}|${r.face.trackingEm}|${r.size}|${r.text}`,
				)
				.join('~'),
		[requests],
	);

	useEffect(() => {
		let cancelled = false;
		let released = false;
		const release = () => {
			if (!released) {
				released = true;
				continueRender(handle);
			}
		};

		let ctx: CanvasRenderingContext2D | null = null;
		try {
			ctx = document.createElement('canvas').getContext('2d');
		} catch {
			ctx = null;
		}

		if (!ctx) {
			setMeasured(buildMap(null, requests));
			release();
			return;
		}

		const usableCtx = ctx;
		Promise.all(fontProbes.map((f) => document.fonts.load(f).catch(() => undefined)))
			.then(() => document.fonts.ready)
			.then(() => {
				if (cancelled) return;
				setMeasured(buildMap(usableCtx, requests));
			})
			.catch(() => {
				if (cancelled) return;
				setMeasured(buildMap(usableCtx, requests));
			})
			.then(release, release);

		return () => {
			cancelled = true;
			release();
		};
		// `key` is the actual dependency; `requests` is rebuilt but content-identical.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, handle]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => measured ?? buildMap(null, requests), [measured, key]);
};
