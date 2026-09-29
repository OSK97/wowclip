import React from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
} from 'remotion';

export type KnockoutCaptionProps = {
	word: string;
	supportingText: string;
	width: number;
	height: number;
	syncFrame: number;
	fontFamily: string;
	supportingFontFamily: string;
	slabColor?: string;
	textColor?: string;
};

export const KnockoutCaption: React.FC<KnockoutCaptionProps> = ({
	word,
	supportingText,
	width,
	height,
	syncFrame,
	fontFamily,
	supportingFontFamily,
	slabColor = '#000000',
	textColor = '#ffffff',
}) => {
	const frame = useCurrentFrame();

	// Timing
	const leadIn = 15;
	const hold = 45;
	const origin = syncFrame - leadIn;
	const localFrame = frame - origin;

	const slabIn = 12;
	const settle = 10;
	const settleAt = slabIn;

	// Scale and dimensions
	const size = Math.round(width * 0.135); // Decreased size as requested
	const capSize = Math.round(width * 0.08);
	const baselineY = Math.round(height / 2 + size * 0.35);

	// Slab smooth fade in (replacing the wipe up)
	const slabOpacity = interpolate(localFrame, [0, slabIn], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.ease),
	});

	// Settle punch
	const punchScale = interpolate(localFrame, [settleAt, settleAt + settle], [1.1, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});

	// Words of the supporting text for word-by-word animation
	const supportWords = supportingText.split(' ');

	// Fade out the whole effect
	const fadeOut = interpolate(localFrame, [slabIn + settle + hold, slabIn + settle + hold + 10], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	if (localFrame < 0 || fadeOut === 0) return null;

	return (
		<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 1000, opacity: fadeOut }}>
			<svg
				width={width}
				height={height}
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					opacity: slabOpacity, // Smoother fade in instead of wipe
				}}
			>
				<defs>
					<mask id="knockout-mask-custom" maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
						<rect x={0} y={0} width={width} height={height} fill="#ffffff" />
						<g transform={`translate(${width / 2} ${baselineY}) scale(${punchScale}) translate(${-width / 2} ${-baselineY})`}>
							<text
								x={width / 2}
								y={baselineY}
								fill="#000000"
								fontFamily={fontFamily}
								fontWeight={900}
								fontSize={size}
								textAnchor="middle"
								letterSpacing="-0.03em"
							>
								{word}
							</text>
						</g>
					</mask>
				</defs>
				
				{/* The solid slab */}
				<rect
					x={0}
					y={0}
					width={width}
					height={height}
					fill={slabColor}
					mask="url(#knockout-mask-custom)"
				/>

				{/* Overlay a subtle whiteness and stroke inside the punched word so it stands out over dark videos */}
				<g transform={`translate(${width / 2} ${baselineY}) scale(${punchScale}) translate(${-width / 2} ${-baselineY})`}>
					<text
						x={width / 2}
						y={baselineY}
						fill="rgba(255, 255, 255, 0.25)"
						stroke="rgba(255, 255, 255, 0.7)"
						strokeWidth={Math.max(1, size * 0.015)}
						fontFamily={fontFamily}
						fontWeight={900}
						fontSize={size}
						textAnchor="middle"
						letterSpacing="-0.03em"
					>
						{word}
					</text>
				</g>
			</svg>

			{/* Supporting Text - Word by word animation */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: baselineY + size * 0.2,
					width,
					textAlign: 'center',
				}}
			>
				{supportWords.map((w, i) => {
					// Stagger the animation for each word
					const wordStart = settleAt + 3 + i * 4;
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
								color: textColor,
								textShadow: '0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.4)', // White glow
								opacity: wordP,
								display: 'inline-block',
								transform: `translateY(${(1 - wordP) * 20}px)`,
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

export default KnockoutCaption;
