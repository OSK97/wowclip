import React, { useMemo } from 'react';
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

export type ArcCaptionProps = {
	word: string;
	width: number;
	height: number;
	syncFrame: number;
	fontFamily: string;
	shape: string;
	shapeSquareness: number;
	glowColor?: string;
};

// Generates the precise top arc of the CRT shape, offset by yOffset
const generateTopArc = (w: number, h: number, n: number, yOffset: number) => {
	const a = w / 2;
	const b = h / 2;
	const e = 2 / n;
	const pts: string[] = [];
	
	// We only need the top half of the curve, going from left to right.
	// t goes from pi to 0 (top-left to top-right)
	const steps = 128;
	for (let i = 0; i <= steps; i++) {
		// Sweep from left (-PI) to right (0) across the top
		const t = Math.PI + (i / steps) * Math.PI; 
		const c = Math.cos(t);
		const s = Math.sin(t);
		const x = a * Math.sign(c) * Math.abs(c) ** e;
		const y = b * Math.sign(s) * Math.abs(s) ** e;
		
		pts.push(`${(a + x).toFixed(2)},${(b + y + yOffset).toFixed(2)}`);
	}
	return `M${pts.join('L')}`;
};

export const ArcCaption: React.FC<ArcCaptionProps> = ({
	word,
	width,
	height,
	syncFrame,
	fontFamily,
	shape,
	shapeSquareness,
	glowColor = '#ff0033', // Neon Red
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const leadIn = 15;
	const hold = 50;
	const origin = syncFrame - leadIn;
	const localFrame = frame - origin;

	const fadeOutAt = leadIn + hold;
	const fadeOut = interpolate(localFrame, [fadeOutAt, fadeOutAt + 15], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	if (localFrame < 0 || fadeOut === 0) return null;

	const opacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
	const blurIn = interpolate(localFrame, [0, 15], [20, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

	// Size calculation to keep it within safe margins
	const maxLetterWidth = width * 0.85 / word.length; 
	const size = Math.min(width * 0.18, maxLetterWidth * 1.4); 
	
	const strokeWidth = width * 0.0025;
	
	// Drop down animation
	const drop = spring({ frame: localFrame, fps, config: { damping: 14, mass: 0.8, stiffness: 100 } });
	const dropY = interpolate(drop, [0, 1], [-height * 0.25, 0]);
	
	// Exact mathematical curve matching the top of the CRT
	const yOffset = (size * 0.3) + dropY; // 70/30 split, plus animated drop
	const curvePath = generateTopArc(width, height, shapeSquareness, yOffset);

	return (
		<AbsoluteFill style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 5000, opacity: fadeOut * opacity }}>
			<svg width={width} height={height} style={{ overflow: 'visible', filter: `blur(${blurIn}px)` }}>
				<defs>
					{/* The curve the text will follow */}
					<path id="arc-curve" d={curvePath} />
					
					{/* Mask for OUTSIDE the CRT (Solid text) */}
					{/* White reveals, Black hides. So we fill the whole screen White, and draw the CRT shape Black. */}
					<mask id="outside-crt-mask">
						<rect x={-width} y={-height} width={width * 3} height={height * 3} fill="white" />
						<path d={shape} fill="black" />
					</mask>

					{/* ClipPath for INSIDE the CRT (Hollow text) */}
					<clipPath id="inside-crt-clip">
						<path d={shape} />
					</clipPath>

					<filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.08} result="blur1" />
						<feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.04} result="blur2" />
						<feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.01} result="blur3" />
						<feMerge>
							<feMergeNode in="blur1" />
							<feMergeNode in="blur2" />
							<feMergeNode in="blur3" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				{/* LAYER 1 & 2: Both get the neon glow */}
				<g filter="url(#neon-glow)">
					{/* LAYER 1: Solid text outside the CRT */}
					<text
						fontFamily={fontFamily}
						fontWeight={900}
						fontSize={size}
						letterSpacing="0em"
						fill={glowColor}
						mask="url(#outside-crt-mask)"
					>
						<textPath href="#arc-curve" startOffset="50%" textAnchor="middle">
							{word}
						</textPath>
					</text>

					{/* LAYER 2: Hollow text inside the CRT (Fully bright, thin stroke) */}
					<text
						fontFamily={fontFamily}
						fontWeight={900}
						fontSize={size}
						letterSpacing="0em"
						fill="none"
						stroke={glowColor}
						strokeWidth={strokeWidth}
						clipPath="url(#inside-crt-clip)"
					>
						<textPath href="#arc-curve" startOffset="50%" textAnchor="middle">
							{word}
						</textPath>
					</text>
				</g>
			</svg>
		</AbsoluteFill>
	);
};

export default ArcCaption;
