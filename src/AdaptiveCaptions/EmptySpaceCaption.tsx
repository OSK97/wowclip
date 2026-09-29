import React from 'react';
import { interpolate } from 'remotion';
import { AdaptiveCaptionChunk } from './types';
import { estimateWordWidth } from './layoutEngine';

export interface EmptySpaceCaptionProps {
	chunk: AdaptiveCaptionChunk;
	frame: number;
	cursiveFont: string;
	boldFont: string;
	primaryColor: string;
	showDebugSlot?: boolean;
}

export const EmptySpaceCaption: React.FC<EmptySpaceCaptionProps> = ({
	chunk,
	frame,
	cursiveFont,
	boldFont,
	primaryColor,
	showDebugSlot = false,
}) => {
	const { words, endFrame, slot, fontSize, accentFontSize, placement } = chunk;

	// Clean exit fade out only (no incoming animation)
	const chunkOpacity = interpolate(
		frame,
		[endFrame - 4, endFrame],
		[1, 0],
		{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
	);

	// Safe apostrophe rendering to prevent demo font glyph glitches (like '±')
	const renderTextWithSafeApos = (text: string, isItalic: boolean) => {
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
									fontWeight: isItalic ? 500 : 900,
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

	return (
		<>
			{/* Optional Debug Slot Box */}
			{showDebugSlot && (
				<div
					style={{
						position: 'absolute',
						left: slot.x,
						top: slot.y - 8,
						width: slot.width,
						height: Math.min(slot.maxHeight, 260),
						border: '1.5px dashed rgba(34, 197, 94, 0.7)',
						backgroundColor: 'rgba(34, 197, 94, 0.06)',
						borderRadius: 6,
						boxSizing: 'border-box',
						pointerEvents: 'none',
					}}
				>
					<div
						style={{
							position: 'absolute',
							top: -16,
							left: 0,
							background: '#22c55e',
							color: '#000',
							fontFamily: 'monospace',
							fontSize: 9,
							fontWeight: 900,
							padding: '1px 5px',
							borderRadius: 3,
							whiteSpace: 'nowrap',
						}}
					>
						SLOT [{placement.toUpperCase()}] {slot.width}px
					</div>
				</div>
			)}

			{/* Stacked Words Container: strictly bounded inside CRT safe area */}
			<div
				style={{
					position: 'absolute',
					left: slot.x,
					top: slot.y,
					width: slot.width,
					maxHeight: slot.maxHeight,
					textAlign: slot.textAlign || 'left',
					display: 'flex',
					flexDirection: 'column',
					alignItems: slot.textAlign === 'center' ? 'center' : (slot.textAlign === 'right' ? 'flex-end' : 'flex-start'),
					opacity: chunkOpacity,
					overflow: 'visible',
					pointerEvents: 'none',
				}}
			>
				{words.map((wordObj, wIdx) => {
					// Word-by-word reveal: "just add the word ok"
					const isSpoken = frame >= wordObj.startFrame;
					if (!isSpoken) return null;

					const isAccentLine = wIdx === 0 && words.length >= 2;
					const thisSize = isAccentLine ? accentFontSize : fontSize;

					const displayText = wordObj.punctuated;
					const estWidth = estimateWordWidth(
						isAccentLine ? displayText : displayText.toUpperCase(),
						thisSize,
						isAccentLine,
					);
					let finalSize = thisSize;
					if (estWidth > slot.width - 16) {
						finalSize = Math.max(48, Math.round(thisSize * ((slot.width - 16) / estWidth)));
					}

					const slideDir = wIdx % 2 === 0 ? -40 : 40;
					const translateX = interpolate(
						frame,
						[wordObj.startFrame, wordObj.startFrame + 5],
						[slideDir, 0],
						{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
					);
					const opacity = interpolate(
						frame,
						[wordObj.startFrame, wordObj.startFrame + 3],
						[0, 1],
						{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
					);

					return (
						<div
							key={`${wordObj.text}-${wIdx}`}
							style={{
								transform: `translateX(${translateX}px)`,
								opacity: opacity,
								color: primaryColor, // Pure clean white, no shadow
								fontFamily: isAccentLine ? cursiveFont : boldFont,
								fontWeight: isAccentLine ? 500 : 900,
								fontStyle: isAccentLine ? 'italic' : 'normal',
								fontSize: finalSize,
								lineHeight: isAccentLine ? 1.05 : 0.94,
								letterSpacing: 0,
								textTransform: isAccentLine ? 'capitalize' : 'uppercase',
								marginBottom: isAccentLine ? -2 : 3,
								overflow: 'visible',
								whiteSpace: 'nowrap',
							}}
						>
							{renderTextWithSafeApos(displayText, isAccentLine)}
						</div>
					);
				})}
			</div>
		</>
	);
};

export default EmptySpaceCaption;
