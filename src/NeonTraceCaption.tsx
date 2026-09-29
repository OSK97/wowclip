import React from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
} from 'remotion';

export type NeonTraceCaptionProps = {
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

export const NeonTraceCaption: React.FC<NeonTraceCaptionProps> = ({
	word,
	supportingText,
	width,
	height,
	syncFrame,
	fontFamily,
	supportingFontFamily,
}) => {
	const frame = useCurrentFrame();

	const supportWords = supportingText.split(' ');

	// Timings
	const traceDuration = 18;
	const flickerDuration = 15;
	const hold = 50;

	const leadIn = traceDuration + flickerDuration - 5; // Finish flickering exactly on syncFrame
	const origin = syncFrame - leadIn;
	const localFrame = frame - origin;
	
	const size = Math.round(width * 0.16);
	const capSize = Math.round(width * 0.07);
	const baselineY = Math.round(height / 2 + size * 0.25);

	const captionAt = traceDuration + flickerDuration + 5;
	
	// Fade out the whole effect
	const fadeOutAt = captionAt + hold;
	const fadeOut = interpolate(localFrame, [fadeOutAt, fadeOutAt + 12], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic)
	});

	if (localFrame < 0 || fadeOut === 0) return null;

	// Trace animation
	const traceP = interpolate(localFrame, [0, traceDuration], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.2, 0.8, 0.2, 1),
	});

	// Flicker effect
	const flickerStart = traceDuration;
	let opacity = 0;
	let chromatic = 0;

	if (localFrame >= flickerStart) {
		const f = localFrame - flickerStart;
		if (f < flickerDuration) {
			// Random flickering
			opacity = rand(f * 2.3) > 0.4 ? 1 : 0.2;
			chromatic = rand(f * 5.1) * 8;
		} else {
			// Fully on
			opacity = 1;
			chromatic = 0;
		}
	}

	return (
		<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 1000, opacity: fadeOut }}>
			{/* Dark dimming background to make the neon pop */}
			<div 
				style={{ 
					position: 'absolute', 
					inset: 0, 
					backgroundColor: 'rgba(0,0,0,0.85)',
					opacity: interpolate(localFrame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) 
				}} 
			/>
			
			<svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
				{/* The glowing trace outline */}
				<text
					x={width / 2}
					y={baselineY}
					fill="none"
					stroke="#E2FB00"
					strokeWidth={size * 0.02}
					strokeDasharray={size * 5}
					strokeDashoffset={size * 5 * (1 - traceP)}
					fontFamily={fontFamily}
					fontWeight={900}
					fontSize={size}
					textAnchor="middle"
					letterSpacing="-0.03em"
					style={{
						filter: `drop-shadow(0 0 ${size * 0.15}px rgba(226,251,0,0.8))`
					}}
				>
					{word}
				</text>

				{/* The solid fill that flickers on */}
				{opacity > 0 && (
					<g style={{ opacity }}>
						{chromatic > 0 && (
							<>
								<text
									x={width / 2 - chromatic}
									y={baselineY}
									fill="#ff0055"
									fontFamily={fontFamily}
									fontWeight={900}
									fontSize={size}
									textAnchor="middle"
									letterSpacing="-0.03em"
									style={{ mixBlendMode: 'screen' }}
								>
									{word}
								</text>
								<text
									x={width / 2 + chromatic}
									y={baselineY}
									fill="#00ffcc"
									fontFamily={fontFamily}
									fontWeight={900}
									fontSize={size}
									textAnchor="middle"
									letterSpacing="-0.03em"
									style={{ mixBlendMode: 'screen' }}
								>
									{word}
								</text>
							</>
						)}
						<text
							x={width / 2}
							y={baselineY}
							fill="#ffffff"
							fontFamily={fontFamily}
							fontWeight={900}
							fontSize={size}
							textAnchor="middle"
							letterSpacing="-0.03em"
							style={{
								filter: `drop-shadow(0 0 ${size * 0.25}px rgba(255,255,255,0.8))`
							}}
						>
							{word}
						</text>
					</g>
				)}
			</svg>

			{/* Supporting Text - Route Label */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: baselineY + size * 0.1,
					width,
					textAlign: 'center',
				}}
			>
				{supportWords.map((w, i) => {
					const wordStart = captionAt + i * 5;
					const wordP = interpolate(localFrame, [wordStart, wordStart + 15], [0, 1], {
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
								color: '#ffffff',
								opacity: wordP,
								display: 'inline-block',
								filter: `blur(${(1 - wordP) * 10}px)`, // Text breathes into focus
								transform: `scale(${1 + (1 - wordP) * 0.1})`,
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

export default NeonTraceCaption;
