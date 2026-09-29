import React, { useMemo } from 'react';
import { loadFont } from '@remotion/fonts';
import { staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import transcriptData from './transcript.json';

// Load Integral CF Heavy
// loadFont({
// 	family: 'IntegralCF',
// 	url: staticFile('fonts/IntegralCF/Demo_Fonts/Fontspring-DEMO-integralcf-heavy.otf'),
// 	weight: '900',
// 	format: 'opentype',
// });

// Load Poppins Black as clean fallback (no demo watermarks)
// loadFont({
// 	family: 'Poppins',
// 	url: 'https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLBT5Z1JlFc-K.woff2',
// 	weight: '900',
// 	format: 'woff2',
// });

export type WordItem = {
	text: string;
	punctuated: string;
	start: number;
	end: number;
};

export type CaptionsDotOverlayProps = {
	width: number;
	height: number;
	startFrameAfter?: number;
	offsetY?: number;
	fontFamily?: string;
	fallbackFont?: string;
	dotColor?: string;
	textColor?: string;
	casing?: 'lowercase' | 'uppercase';
	pauseHoldSeconds?: number;
	fontSize?: number;
	position?: 'center' | 'bottom';
	bottomOffset?: number | string;
	mixBlendMode?: React.CSSProperties['mixBlendMode'];
};

export const CaptionsDotOverlay: React.FC<CaptionsDotOverlayProps> = ({
	width,
	height,
	startFrameAfter = 151,
	offsetY = 0,
	fontFamily = '"IntegralCF", "Poppins", sans-serif',
	fallbackFont = 'Poppins',
	dotColor = '#E2FB00',
	textColor = '#FFFFFF',
	casing = 'uppercase',
	pauseHoldSeconds = 0.35,
	fontSize,
	position = 'bottom',
	bottomOffset = '11%',
	mixBlendMode = 'normal',
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Process word timing and sentence stop detection for words after the cursor animation
	const processedWords = useMemo(() => {
		const rawWords = transcriptData as WordItem[];
		return rawWords
			.map((w, idx, arr) => {
				const startFrame = Math.round(w.start * fps);
				const rawEndFrame = Math.round(w.end * fps);
				const next = arr[idx + 1];

				let displayEndFrame = rawEndFrame;
				if (next) {
					const nextStartFrame = Math.round(next.start * fps);
					const gapSeconds = next.start - w.end;

					// Rapid speech: hold word until next to prevent blinking
					if (gapSeconds < 0.32) {
						displayEndFrame = nextStartFrame;
					} else {
						// True dramatic pause: hold for pauseHoldSeconds then clear
						const holdFrames = Math.round(pauseHoldSeconds * fps);
						displayEndFrame = Math.min(rawEndFrame + holdFrames, nextStartFrame);
					}
				} else {
					displayEndFrame = rawEndFrame + Math.round(pauseHoldSeconds * fps);
				}

				const cleanText = w.text.replace(/[^a-zA-Z0-9']/g, '');
				const isSentenceEnd = /[.?!]/.test(w.punctuated);

				return {
					...w,
					cleanText,
					isSentenceEnd,
					startFrame,
					displayEndFrame,
				};
			})
			.filter((w) => w.startFrame >= startFrameAfter);
	}, [fps, pauseHoldSeconds, startFrameAfter]);

	// Find active word for this frame
	const activeWord = useMemo(() => {
		if (frame < startFrameAfter) return null;
		return processedWords.find((w) => frame >= w.startFrame && frame < w.displayEndFrame);
	}, [processedWords, frame, startFrameAfter]);

	if (!activeWord) return null;

	const displayText =
		casing === 'uppercase'
			? activeWord.cleanText.toUpperCase()
			: activeWord.cleanText.toLowerCase();

	// Fixed font size so it doesn't pop or bounce between short and long words
	const baseSize = fontSize ?? Math.round(width * 0.082);
	const dynamicFontSize = baseSize;

	// Render text safely to avoid demo watermarks on apostrophe
	const renderTextContent = (text: string) => {
		if (!text.includes("'") && !text.includes('’')) {
			return <span>{text}</span>;
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
									fontFamily: `"${fallbackFont}", sans-serif`,
									fontWeight: 900,
									display: 'inline-block',
									margin: '0 -0.03em',
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

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: position === 'bottom' ? 'flex-end' : 'center',
				flexDirection: 'column',
				paddingBottom: position === 'bottom' ? bottomOffset : 0,
				boxSizing: 'border-box',
				pointerEvents: 'none',
				// Pure text layer sharing stacking context with the video
			}}
		>
			<div
				style={{
					transform: `translateY(${
						(offsetY !== 0 ? offsetY : 0) +
						interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 4], [20, 0], {
							extrapolateLeft: 'clamp',
							extrapolateRight: 'clamp',
						})
					}px)`,
					opacity: interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 3], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}),
					display: 'inline-flex',
					alignItems: 'baseline',
					justifyContent: 'center',
					fontFamily,
					fontWeight: 900,
					fontSize: `${dynamicFontSize}px`,
					lineHeight: 1,
					letterSpacing: '-0.03em',
					color: textColor,
					mixBlendMode: mixBlendMode ?? 'difference',
					userSelect: 'none',
					WebkitFontSmoothing: 'antialiased',
					textRendering: 'geometricPrecision',
					textShadow: 'none',
				}}
			>
				{renderTextContent(displayText)}
				{activeWord.isSentenceEnd && (
					<span
						style={{
							color: dotColor,
							marginLeft: '0.02em',
							display: 'inline-block',
						}}
					>
						.
					</span>
				)}
			</div>
		</div>
	);
};

export default CaptionsDotOverlay;
