import React, { useMemo } from 'react';
import { interpolate } from 'remotion';
import { AdaptiveCaptionChunk } from './types';

export interface BottomCaptionProps {
	chunk: AdaptiveCaptionChunk;
	frame: number;
	fps: number;
	screenW: number;
	screenH: number;
	boldFont?: string;
	primaryColor?: string;
	bottomOffset?: string | number;
}

export const BottomCaption: React.FC<BottomCaptionProps> = ({
	chunk,
	frame,
	fps,
	screenW,
	screenH,
	boldFont = '"IntegralCF", "Poppins", sans-serif',
	primaryColor = '#FFFFFF',
	bottomOffset = '11%',
}) => {
	// Find the exact single active word for the current frame
	const activeWord = useMemo(() => {
		return chunk.words.find((w, i) => {
			const next = chunk.words[i + 1];
			const rawEnd = w.endFrame;
			const holdFrames = Math.round(0.32 * fps);
			const end = next ? next.startFrame : Math.min(rawEnd + holdFrames, chunk.endFrame);
			return frame >= w.startFrame && frame < end;
		});
	}, [chunk.words, chunk.endFrame, frame, fps]);

	if (!activeWord) return null;

	// Clean text without punctuation marks, rendered uppercase
	const cleanText = activeWord.text.replace(/[^a-zA-Z0-9']/g, '');
	const displayText = cleanText.toUpperCase();

	// Fixed font size: exactly matched to the sleek proportions of CaptionsDotOverlay
	const baseSize = Math.round(screenW * 0.082); // ~78px on 950w
	const dynamicFontSize = baseSize;

	// Clean apostrophe rendering
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
									fontFamily: 'Poppins, sans-serif',
									fontWeight: 900,
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
				justifyContent: 'flex-end',
				flexDirection: 'column',
				paddingBottom: bottomOffset,
				boxSizing: 'border-box',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					transform: `translateY(${interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 4], [20, 0], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					})}px)`,
					opacity: interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 3], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}),
					display: 'inline-flex',
					alignItems: 'baseline',
					justifyContent: 'center',
					fontFamily: boldFont,
					fontWeight: 900,
					fontSize: `${dynamicFontSize}px`,
					lineHeight: 1,
					letterSpacing: 0,
					color: primaryColor,
					userSelect: 'none',
					WebkitFontSmoothing: 'antialiased',
					textRendering: 'geometricPrecision',
					textShadow: 'none',
				}}
			>
				{renderTextContent(displayText)}
			</div>
		</div>
	);
};

export default BottomCaption;
