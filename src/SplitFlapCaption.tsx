import React from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
} from 'remotion';

export type SplitFlapCaptionProps = {
	word: string;
	supportingText: string;
	width: number;
	height: number;
	syncFrame: number;
	fontFamily: string;
	supportingFontFamily: string;
};

// Deterministic random
const rand = (n: number) => {
	const x = Math.sin(n * 127.1) * 43758.5453;
	return x - Math.floor(x);
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const SplitFlapCaption: React.FC<SplitFlapCaptionProps> = ({
	word,
	supportingText,
	width,
	height,
	syncFrame,
	fontFamily,
	supportingFontFamily,
}) => {
	const frame = useCurrentFrame();

	const letters = word.toUpperCase().split('');
	const supportWords = supportingText.split(' ');

	// Timings
	const stagger = 3;
	const flipFrames = 4;
	const flips = 4;
	const totalFlipDuration = (flips + 1) * flipFrames;
	const wordRevealDuration = Math.max(0, letters.length - 1) * stagger + totalFlipDuration;
	
	const leadIn = wordRevealDuration - 10; // Let the word finish resolving slightly before the sync frame
	const origin = syncFrame - leadIn;
	const localFrame = frame - origin;

	const hold = 50;
	
	const boardW = width * 0.85;
	const maxCellW = boardW / Math.max(8, letters.length);
	const cellW = Math.min(maxCellW, 110);
	const gapPx = Math.min(8, cellW * 0.1);
	const cellH = cellW * 1.35;
	const glyphSize = cellH * 0.7;
	
	const boardWFit = letters.length * cellW + (letters.length - 1) * gapPx;
	const boardLeft = Math.round((width - boardWFit) / 2);
	const boardTop = Math.round(height / 2 - cellH / 2);
	const capSize = Math.round(width * 0.05);

	const captionAt = wordRevealDuration + 10;
	
	// Fade out the whole effect
	const fadeOutAt = captionAt + hold;
	const fadeOut = interpolate(localFrame, [fadeOutAt, fadeOutAt + 12], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic)
	});

	if (localFrame < 0 || fadeOut === 0) return null;

	return (
		<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 1000, opacity: fadeOut }}>
			{/* Dark dimming background to make the board pop */}
			<div 
				style={{ 
					position: 'absolute', 
					inset: 0, 
					backgroundColor: 'rgba(0,0,0,0.65)',
					opacity: interpolate(localFrame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) 
				}} 
			/>

			{letters.map((ch, i) => {
				const left = boardLeft + i * (cellW + gapPx);
				const start = i * stagger;
				const local = localFrame - start;
				const span = flipFrames;
				const total = (flips + 1) * span;

				let glyph = ch;
				let scaleY = 1;
				let flipOrigin = '50% 50%';
				let landed = true;

				if (local < 0) {
					glyph = '';
					landed = false;
				} else if (local < total) {
					landed = false;
					const step = Math.floor(local / span);
					const within = (local % span) / span;
					const at = (s: number) =>
						s >= flips
							? ch
							: ALPHABET[Math.floor(rand(i * 31.7 + s * 5.3) * ALPHABET.length)];
					
					if (within < 0.5) {
						glyph = at(step);
						scaleY = 1 - within * 2;
						flipOrigin = '50% 100%';
					} else {
						glyph = at(step + 1);
						scaleY = (within - 0.5) * 2;
						flipOrigin = '50% 0%';
					}
				}

				if (ch === ' ') return null;

				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left,
							top: boardTop,
							width: cellW,
							height: cellH,
							backgroundColor: '#121214',
							borderRadius: 8,
							overflow: 'hidden',
							boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
							border: '1px solid rgba(255,255,255,0.08)'
						}}
					>
						{/* Seam fold */}
						<div
							style={{
								position: 'absolute',
								left: 0,
								top: cellH / 2 - 1,
								width: '100%',
								height: 2,
								backgroundColor: '#000',
								opacity: 0.9,
								zIndex: 2,
							}}
						/>
						<div
							style={{
								position: 'absolute',
								inset: 0,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								transform: `scaleY(${Math.max(0, scaleY).toFixed(3)})`,
								transformOrigin: flipOrigin,
							}}
						>
							<span
								style={{
									fontFamily,
									fontWeight: 900,
									fontSize: glyphSize,
									lineHeight: 1,
									color: landed ? '#ffffff' : '#707070',
									textShadow: landed ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
								}}
							>
								{glyph}
							</span>
						</div>
					</div>
				);
			})}

			{/* Supporting Text - Route Label */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: boardTop + cellH + cellH * 0.25,
					width,
					textAlign: 'center',
				}}
			>
				{supportWords.map((w, i) => {
					const wordStart = captionAt + i * 4;
					const wordP = interpolate(localFrame, [wordStart, wordStart + 12], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
						easing: Easing.out(Easing.cubic),
					});
					
					return (
						<span
							key={i}
							style={{
								fontFamily: supportingFontFamily,
								fontWeight: 'normal',
								fontStyle: 'italic',
								fontSize: capSize,
								lineHeight: 1,
								color: '#E2FB00',
								opacity: wordP,
								display: 'inline-block',
								transform: `translateY(${(1 - wordP) * 15}px)`,
								marginRight: '0.25em',
							}}
						>
							{w}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

export default SplitFlapCaption;
