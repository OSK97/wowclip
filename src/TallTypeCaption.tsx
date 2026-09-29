import React from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

export type TallTypeCaptionProps = {
	word: string;
	supportingText: string;
	width: number;
	height: number;
	syncFrame: number;
	fontFamily: string;
	supportingFontFamily: string;
	wordColor?: string;
	textColor?: string;
	blackoutColor?: string;
};

export const TallTypeCaption: React.FC<TallTypeCaptionProps> = ({
	word,
	supportingText,
	width,
	height,
	syncFrame,
	fontFamily,
	supportingFontFamily,
	wordColor = '#c9a227', // Gold
	textColor = '#ffffff',
	blackoutColor = 'rgba(0,0,0,0.85)',
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Timing
	const leadIn = 15;
	const hold = 50;
	const origin = syncFrame - leadIn;
	const localFrame = frame - origin;

	const STRETCH = 1.85;
	const size = width * 0.16;
	const capSize = width * 0.055;
	
	const supportWords = supportingText.split(' ');
	
	const fadeOut = interpolate(localFrame, [leadIn + hold, leadIn + hold + 15], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	if (localFrame < 0 || fadeOut === 0) return null;

	const grow = spring({ frame: localFrame, fps, config: { damping: 24, stiffness: 120, mass: 1 } });
	const rise = interpolate(grow, [0, 1], [0.16, 1]);
	const wordOpacity = interpolate(grow, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });
	const footAt = 18;
	const FOOT_STEP = 5;

	return (
		<AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 1000, opacity: fadeOut }}>
			
			<div style={{
				position: 'absolute',
				bottom: '12%', // Placed at the bottom where the shadow sits
				left: 0,
				right: 0,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			}}>
				<div style={{
					transform: `scaleY(${STRETCH})`,
					transformOrigin: 'bottom center',
					marginBottom: 0,
				}}>
					<div style={{ transform: `scaleY(${rise})`, transformOrigin: 'bottom center', opacity: wordOpacity }}>
						<div style={{
							fontFamily,
							fontWeight: 900,
							fontSize: size,
							lineHeight: 1,
							letterSpacing: '-0.025em',
							color: wordColor,
							textTransform: 'uppercase',
							textShadow: `0 0 26px ${wordColor}55, 0 0 90px ${wordColor}33`,
						}}>
							{word}
						</div>
					</div>
				</div>

				{/* Supporting Words */}
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					width: `${word.length * size * 0.65}px`, // Approximate visual width of the main word
					maxWidth: '85%',
					marginTop: `-${size * 0.30}px`, // <-- TWEAK THIS LINE to control the vertical gap
				}}>
					{supportWords.map((f, i) => {
						const p = interpolate(localFrame, [footAt + i * FOOT_STEP, footAt + i * FOOT_STEP + 12], [0, 1], {
							extrapolateLeft: 'clamp',
							extrapolateRight: 'clamp',
							easing: Easing.out(Easing.cubic),
						});
						return (
							<div
								key={i}
								style={{
									fontFamily: supportingFontFamily,
									fontStyle: 'italic',
									fontSize: capSize,
									lineHeight: 1,
									color: textColor,
									opacity: p,
									transform: `translateY(${(1 - p) * 20}px)`,
									textShadow: '0 0 16px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)',
								}}
							>
								{f}
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default TallTypeCaption;
