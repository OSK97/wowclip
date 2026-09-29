import React, { useEffect, useState } from 'react';
import { Easing, continueRender, delayRender, interpolate, useCurrentFrame } from 'remotion';

export type CursorSelectCaptionProps = {
	/** The single punch word that sits inside the selection box */
	word: string;
	/** One or two short fragments that rise underneath the box */
	supporting?: string[];
	/** Canvas the caption is laid out inside (the CRT screen, not the comp) */
	width: number;
	height: number;
	/** Frame the animation starts on, in the parent's timeline */
	startFrame?: number;
	/**
	 * The frame the word is actually spoken on. The pointer's fly-in and drag are run
	 * *before* it, so the word finishes rising out of the box exactly as it is said.
	 * Takes priority over startFrame.
	 */
	syncFrame?: number;
	fontFamily?: string;
	supportingFontFamily?: string;
	fontSize?: number;
	supportingFontSize?: number;
	supportingColor?: string;
	/** How far the supporting line tucks up under the box, as a fraction of its size */
	supportingOverlap?: number;
	boxGradient?: [string, string, string];
	/** Extra px the box reaches past the ink, [sideways, upwards] */
	boxPadding?: [number, number];
	/** Nudge the whole block up (negative) or down (positive), in px */
	offsetY?: number;
	cursorFrom?: [number, number];
	cursorSize?: number;
	glitch?: number;
	glow?: number;
	timing?: {
		cursorIn?: number;
		drag?: number;
		wordReveal?: number;
		supportingGap?: number;
		/** How long the supporting line takes to rise and fade in */
		supportingReveal?: number;
	};
};

export const CURSOR_SELECT_CAPTION_TIMING = {
	cursorIn: 12,
	drag: 13,
	wordReveal: 15,
	supportingGap: 8,
	supportingReveal: 17,
};

/**
 * Frames of run-up before the word starts rising. Feed this back into the parent so the
 * caption is mounted early enough for the pointer to fly in and drag.
 */
export const getCursorSelectLeadIn = (timing?: CursorSelectCaptionProps['timing']) => {
	const cursorIn = timing?.cursorIn ?? CURSOR_SELECT_CAPTION_TIMING.cursorIn;
	return cursorIn + 3;
};

// Deterministic pseudo-random, so a glitch looks random but renders identically every time.
const rand = (n: number) => {
	const x = Math.sin(n * 127.1) * 43758.5453;
	return x - Math.floor(x);
};

type Metrics = { width: number; top: number; bottom: number };

/**
 * Measures the real ink of the word — its width and where its letters actually start and
 * stop inside the line box — so the selection hugs the glyphs instead of the line's empty
 * space, and shrinks the word if it would run off the canvas.
 */
const useWordMetrics = (text: string, fontSize: number, fontFamily: string, maxWidth: number) => {
	const [handle] = useState(() => delayRender('Measuring cursor-select caption'));
	const [m, setM] = useState<Metrics | null>(null);

	useEffect(() => {
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) return;
		document.fonts.ready.then(() => {
			ctx.font = `900 ${fontSize}px ${fontFamily}`;
			(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-0.03em';
			const t = ctx.measureText(text);
			// Where the baseline sits inside a line-height:1 box, from the font's own metrics
			const half = (fontSize - (t.fontBoundingBoxAscent + t.fontBoundingBoxDescent)) / 2;
			const baseline = half + t.fontBoundingBoxAscent;
			setM({
				// The negative letter-spacing shortens the advance after the last letter, so
				// the real ink runs past it — take whichever is wider, plus a safety pixel.
				width: Math.max(t.width, t.actualBoundingBoxRight) + 2,
				top: baseline - t.actualBoundingBoxAscent,
				bottom: baseline + t.actualBoundingBoxDescent,
			});
			continueRender(handle);
		});
	}, [text, fontSize, fontFamily, handle]);

	const raw: Metrics =
		m ?? {
			width: fontSize * 0.62 * text.length,
			top: fontSize * 0.24,
			bottom: fontSize * 0.78,
		};
	const scale = raw.width > maxWidth ? maxWidth / raw.width : 1;
	return {
		scale,
		width: raw.width * scale,
		top: raw.top * scale,
		bottom: raw.bottom * scale,
	};
};

/**
 * A mouse pointer flies in, presses, and drags a selection box open across one word. The
 * word rises out of the selection, glitches for a few frames, and short italic lines rise
 * underneath. Ported from the standalone CursorSelect template so it can be dropped
 * inside another scene (here: the CRT screen) rather than owning the whole canvas.
 */
export const CursorSelectCaption: React.FC<CursorSelectCaptionProps> = ({
	word,
	supporting = [],
	width,
	height,
	startFrame = 0,
	syncFrame,
	fontFamily = 'Poppins, Inter, sans-serif',
	supportingFontFamily = '"Playfair Display", Georgia, serif',
	fontSize: fontSizeInput,
	supportingFontSize: supportingFontSizeInput,
	supportingColor = '#ffffff',
	supportingOverlap = 0.26,
	boxGradient = ['#38bdf8', '#2f74ff', '#1e3fd0'],
	boxPadding,
	offsetY = 0,
	cursorFrom = [0.86, 0.84],
	cursorSize,
	glitch = 0.65,
	glow = 0.5,
	timing,
}) => {
	const origin =
		syncFrame !== undefined ? syncFrame - getCursorSelectLeadIn(timing) : startFrame;
	const frame = useCurrentFrame() - origin;

	// Everything scales off the canvas it is dropped into, so the caption reads the same
	// inside a 950px CRT screen as it does full-frame.
	const baseFontSize = fontSizeInput ?? Math.round(width * 0.155);
	const supportingFontSize = supportingFontSizeInput ?? Math.round(baseFontSize * 0.42);
	const [padX, padY] = boxPadding ?? [
		Math.round(baseFontSize * 0.2),
		Math.round(baseFontSize * 0.14),
	];
	const pointerSize = cursorSize ?? Math.round(width * 0.055);

	const cursorIn = timing?.cursorIn ?? CURSOR_SELECT_CAPTION_TIMING.cursorIn;
	const drag = timing?.drag ?? CURSOR_SELECT_CAPTION_TIMING.drag;
	const wordReveal = timing?.wordReveal ?? CURSOR_SELECT_CAPTION_TIMING.wordReveal;
	const supportingGap = timing?.supportingGap ?? CURSOR_SELECT_CAPTION_TIMING.supportingGap;
	const supportingReveal =
		timing?.supportingReveal ?? CURSOR_SELECT_CAPTION_TIMING.supportingReveal;

	const ink = useWordMetrics(word, baseFontSize, fontFamily, width * 0.78);
	const fontSize = baseFontSize * ink.scale;
	const inkH = ink.bottom - ink.top;

	// Laid out in canvas coordinates off the real glyph bounds, so the box hugs the
	// letters and the pointer grabs its actual corners.
	const wordLeft = (width - ink.width) / 2;
	const wordTop = height / 2 + offsetY - (ink.top + inkH / 2);
	const boxLeft = wordLeft - padX;
	const boxTop = wordTop + ink.top - padY;
	const boxW = ink.width + padX * 2;
	// The box closes under the letters too, so the word sits fully inside it
	const boxH = inkH + padY * 2;

	const dragStart = cursorIn + 2;
	const dragEnd = dragStart + drag;

	// --- Pointer: flies in diagonally, presses, then drags the selection open
	const travel = interpolate(frame, [0, cursorIn], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});
	const dragProgress = interpolate(frame, [dragStart, dragEnd], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		// Eases out much longer than it eases in, so the drag decelerates into the corner
		easing: Easing.bezier(0.32, 0, 0.16, 1),
	});
	const pressed = interpolate(frame, [cursorIn, cursorIn + 2, cursorIn + 6], [0, 1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.quad),
	});
	// The pointer leaves once the selection is open, so it never covers the words
	const pointerOpacity = interpolate(frame, [dragEnd + 1, dragEnd + 8], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.quad),
	});

	const cursorX = interpolate(travel, [0, 1], [cursorFrom[0] * width, boxLeft]) + boxW * dragProgress;
	const cursorY = interpolate(travel, [0, 1], [cursorFrom[1] * height, boxTop]) + boxH * dragProgress;

	// --- Word rises out of the selection as it opens. The bezier is a long tail, so the
	// last few pixels of travel are slow and the word settles rather than stops.
	const reveal = interpolate(frame, [dragStart + 1, dragStart + 1 + wordReveal], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.22, 1, 0.28, 1),
	});

	// --- Glitch: two short bursts, chromatic split plus a couple of sliced bands
	const burst =
		[dragEnd - 2, dragEnd + 20].reduce((acc, at) => {
			const local = frame - at;
			if (local < 0 || local > 5) return acc;
			return Math.max(acc, 1 - local / 5);
		}, 0) * glitch;
	const split = burst * 14 * (0.4 + rand(frame) * 0.6);
	const slice = (i: number) => (burst > 0 ? (rand(frame * 3 + i) - 0.5) * 50 * burst : 0);

	const wordStyle: React.CSSProperties = {
		fontFamily,
		fontWeight: 900,
		fontSize,
		lineHeight: 1,
		letterSpacing: '-0.03em',
		color: '#ffffff',
		whiteSpace: 'nowrap',
	};

	return (
		<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
			{/* Light the selection box spills onto the picture */}
			{glow > 0 ? (
				<div
					style={{
						position: 'absolute',
						left: boxLeft + boxW / 2 - boxW * 1.1,
						top: boxTop + boxH / 2 - boxH * 1.8,
						width: boxW * 2.2,
						height: boxH * 4.2,
						background: `radial-gradient(ellipse closest-side, ${boxGradient[1]} 0%, ${boxGradient[1]}00 100%)`,
						opacity: 0.3 * glow * dragProgress,
						filter: `blur(${Math.round(width * 0.02)}px)`,
					}}
				/>
			) : null}

			{/* The selection box, dragged open behind the letters */}
			<div
				style={{
					position: 'absolute',
					left: boxLeft,
					top: boxTop,
					width: boxW,
					height: boxH,
					background: `linear-gradient(105deg, ${boxGradient[0]} 0%, ${boxGradient[1]} 52%, ${boxGradient[2]} 100%)`,
					clipPath: `inset(0 ${(1 - dragProgress) * 100}% ${(1 - dragProgress) * 100}% 0)`,
					boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.38)',
				}}
			/>

			{/* The word, rising out of the selection */}
			<div
				style={{
					position: 'absolute',
					left: wordLeft,
					top: wordTop,
					width: ink.width,
					height: fontSize,
					overflow: 'hidden',
				}}
			>
				<div style={{ position: 'relative', transform: `translateY(${(1 - reveal) * 100}%)` }}>
					<div
						style={{
							...wordStyle,
							textShadow: `0 0 ${Math.round(30 * glow)}px rgba(255,255,255,${0.3 * glow})`,
						}}
					>
						{word}
					</div>
					{burst > 0 ? (
						<>
							<div
								style={{
									...wordStyle,
									position: 'absolute',
									left: -split,
									top: 0,
									color: '#22d3ee',
									mixBlendMode: 'screen',
									opacity: 0.85,
								}}
							>
								{word}
							</div>
							<div
								style={{
									...wordStyle,
									position: 'absolute',
									left: split,
									top: 0,
									color: '#f43f5e',
									mixBlendMode: 'screen',
									opacity: 0.85,
								}}
							>
								{word}
							</div>
							{[0, 1].map((i) => (
								<div
									key={i}
									style={{
										...wordStyle,
										position: 'absolute',
										left: slice(i),
										top: 0,
										clipPath: `inset(${18 + i * 34}% 0 ${52 - i * 30}% 0)`,
									}}
								>
									{word}
								</div>
							))}
						</>
					) : null}
				</div>
			</div>

			{/* Supporting lines, tucked up into the bottom of the box */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: boxTop + boxH - supportingFontSize * supportingOverlap,
					width,
					textAlign: 'center',
				}}
			>
				{supporting.map((line, i) => {
					const at = dragEnd + supportingGap * (i + 1);
					// Fade and lift are eased separately: the lift settles late so the line
					// drifts into place instead of snapping.
					const fade = interpolate(frame, [at, at + supportingReveal * 0.7], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
						easing: Easing.out(Easing.quad),
					});
					const lift = interpolate(frame, [at, at + supportingReveal], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
						easing: Easing.bezier(0.16, 1, 0.3, 1),
					});
					return (
						<div
							key={i}
							style={{
								fontFamily: supportingFontFamily,
								fontStyle: 'italic',
								fontWeight: 400,
								fontSize: supportingFontSize,
								lineHeight: 1.25,
								color: supportingColor,
								opacity: fade,
								transform: `translateY(${(1 - lift) * supportingFontSize * 0.4}px)`,
								textShadow: [
									// Legibility against the picture first, then the bloom
									'0 2px 10px rgba(0,0,0,0.95)',
									'0 4px 22px rgba(0,0,0,0.75)',
									`0 0 ${Math.round(18 * glow)}px rgba(255,255,255,${0.85 * glow})`,
									`0 0 ${Math.round(44 * glow)}px rgba(255,255,255,${0.45 * glow})`,
									`0 0 ${Math.round(70 * glow)}px ${boxGradient[1]}`,
								].join(', '),
							}}
						>
							{line}
						</div>
					);
				})}
			</div>

			{pointerOpacity > 0 ? (
				<div style={{ position: 'absolute', left: cursorX, top: cursorY, opacity: pointerOpacity }}>
					<svg
						width={pointerSize}
						height={pointerSize * 1.55}
						viewBox="0 0 14 21"
						style={{
							transform: `scale(${1 - pressed * 0.14})`,
							transformOrigin: '0 0',
							filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))',
						}}
					>
						<path
							d="M0.6 0.6 L0.6 18.4 L4.9 14.3 L7.7 20.4 L10.6 19.0 L7.8 13.1 L13.0 12.9 Z"
							fill="#0a0a0a"
							stroke="#ffffff"
							strokeWidth={1.1}
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			) : null}
		</div>
	);
};

export default CursorSelectCaption;
