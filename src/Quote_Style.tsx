import React from 'react';
import {
	AbsoluteFill,
	Img,
	OffthreadVideo,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	Easing,
} from 'remotion';
import { InstagramUI, InstagramUIProps } from './InstagramUI';

export interface Quote_StyleProps {
	/** Video or image path in public/ or full URL (e.g. 'quote_video.mp4', 'Space-Background-Images.jpg') */
	mediaSrc?: string;
	/** Fit mode for the media (defaults to 'cover') */
	objectFit?: 'cover' | 'contain' | 'fill';
	/** Alignment within the frame. Defaults to 'center 18%' so a face near the top stays framed */
	objectPosition?: string;
	/** Fine-tuning vertical pixel offset */
	mediaOffsetY?: number;
	/** Additional scale multiplier for the media inside the frame */
	mediaScale?: number;
	/** Stage background color behind the frame (defaults to '#000000') */
	stageBackground?: string;
	/** Enable the CRT power on/off animation (defaults to true) */
	animatePower?: boolean;

	/** Width of the screen as a fraction of the frame width */
	tvScale?: number;
	/** Nudge the whole frame up (negative) or down (positive), in px */
	tvOffsetY?: number;
	/**
	 * How square the old-TV silhouette is. 4 is a soft squircle, 6 is close to a
	 * rectangle with rounded corners. Around 4.5 reads as a CRT.
	 */
	shapeSquareness?: number;
	/** Draw the thin outline around the shape */
	showOutline?: boolean;
	/** Colour of that outline */
	lineColor?: string;
	/** Colour of the light the screen throws into the room. Set opacity with glowStrength. */
	glowColor?: string;
	/** How much light spills onto the background. 0 turns it off. */
	glowStrength?: number;

	/**
	 * Backdrop behind the set. Point `backdropSrc` at an image in public/ (or a URL) to
	 * blur it out behind the TV; leave it empty and the two `backdropColors` are bloomed
	 * into a soft wash instead. Either way `backdropDim` and `backdropGrain` control how
	 * far back it sits — the set has to stay the brightest thing in the frame.
	 */
	backdropSrc?: string;
	backdropColors?: [string, string];
	/**
	 * Colours sampled from the clip itself, spread evenly across its duration, so the
	 * light behind the set follows the picture the way a real TV lights a dark room.
	 * Takes priority over backdropSrc and backdropColors when supplied.
	 */
	ambientColors?: string[];
	/** Blur radius applied to a backdrop image, in px */
	backdropBlur?: number;
	/** Black laid over the backdrop, 0-1 */
	backdropDim?: number;
	/** Film-grain texture over the backdrop, 0-1 */
	backdropGrain?: number;

	/** Draw the Instagram Reels chrome on top, to preview what the feed UI covers */
	showInstagramUI?: boolean;
	/** Overrides for the Instagram chrome (username, counts, caption, insets) */
	instagramUI?: InstagramUIProps;
	/** Motivational quote text displayed inside the frame */
	quoteText?: string;
	/** Enable subtle cinematic slow-zoom on static images */
	kenBurns?: boolean;
}

const resolveSrc = (src?: string) => {
	if (!src) return '';
	if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
		return src;
	}
	return staticFile(src);
};

const isVideoFile = (src: string) => {
	const clean = src.split('?')[0].split('#')[0];
	const ext = clean.split('.').pop()?.toLowerCase();
	return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext || '');
};

const rgba = (hex: string, a: number) => {
	const h = hex.replace('#', '');
	const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
	const n = parseInt(full, 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const mixHex = (a: string, b: string, t: number) => {
	const parse = (hex: string) => {
		const h = hex.replace('#', '');
		const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
		const n = parseInt(full, 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	const [r1, g1, b1] = parse(a);
	const [r2, g2, b2] = parse(b);
	const c = (x: number, y: number) => Math.round(x + (y - x) * t);
	return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
};

/** Reads a colour off an evenly-spaced timeline at position t (0-1), blending neighbours. */
const sampleTimeline = (list: string[], t: number) => {
	if (list.length === 1) return list[0];
	const pos = Math.min(Math.max(t, 0), 1) * (list.length - 1);
	const i = Math.floor(pos);
	return mixHex(list[i], list[Math.min(i + 1, list.length - 1)], pos - i);
};

// Fine fractal noise, used as the backdrop's texture. Static, so it never crawls.
const GRAIN =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>\")";

/**
 * The old-TV outline is a superellipse, not a rounded rectangle: its sides stay flat
 * through the middle and then bow into the corners. That single curve is the whole
 * look — the picture is clipped to it and the outline traces it.
 */
const superellipse = (w: number, h: number, n: number, steps = 256) => {
	const a = w / 2;
	const b = h / 2;
	const e = 2 / n;
	const pts: string[] = [];
	for (let i = 0; i < steps; i++) {
		const t = (i / steps) * Math.PI * 2;
		const c = Math.cos(t);
		const s = Math.sin(t);
		const x = a * Math.sign(c) * Math.abs(c) ** e;
		const y = b * Math.sign(s) * Math.abs(s) ** e;
		pts.push(`${(a + x).toFixed(2)},${(b + y).toFixed(2)}`);
	}
	return `M${pts.join('L')}Z`;
};

export const Quote_Style: React.FC<Quote_StyleProps> = ({
	mediaSrc = 'test_frame.jpg',
	objectFit = 'cover',
	objectPosition = 'center 22%',
	mediaOffsetY = 0,
	mediaScale = 1.0,
	stageBackground = '#000000',
	animatePower = true,
	tvScale = 0.88,
	tvOffsetY = 0,
	shapeSquareness = 5.4,
	showOutline = true,
	lineColor = '#8e8e8e',
	glowColor = '#ff4d4d',
	glowStrength = 0.14,
	backdropSrc,
	backdropColors = ['#3a2415', '#122a30'],
	ambientColors,
	backdropBlur = 110,
	backdropDim = 0.62,
	backdropGrain = 0.06,
	showInstagramUI = true,
	instagramUI,
	quoteText,
	kenBurns = true,
}) => {
	const frame = useCurrentFrame();
	const { durationInFrames, width: compWidth } = useVideoConfig();

	const screenW = Math.round(compWidth * tvScale);
	const screenH = Math.round((screenW * 3) / 4); // 4:3, the shape of the old set
	const shape = superellipse(screenW, screenH, shapeSquareness);

	// --- Power on / off ----------------------------------------------------------
	const onDuration = 28;
	const offDuration = 22;

	let opacity = 1.0;
	let scaleX = 1.0;
	let scaleY = 1.0;
	let brightness = 1.0;
	// Drives the room glow and the outline, so the whole set lights up together
	let power = 1.0;

	if (animatePower && frame < onDuration) {
		// Beam power-on: a horizontal slit expands first, then blooms open vertically
		scaleX = interpolate(frame, [0, 8, 22], [0.08, 1.0, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.cubic),
		});
		scaleY = interpolate(frame, [0, 7, 24], [0.008, 0.008, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.cubic),
		});
		opacity = interpolate(frame, [0, 4, 22], [0.0, 1.0, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
		brightness = interpolate(frame, [0, 8, 26], [2.2, 1.35, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.quad),
		});
		power = interpolate(frame, [0, 6, 26], [0, 0.75, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
	} else if (animatePower && frame >= durationInFrames - offDuration) {
		const f = frame - (durationInFrames - offDuration);
		// Turn-off: the picture collapses vertically to a slit, then vanishes
		scaleY = interpolate(f, [0, 10, 18], [1.0, 0.006, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.quad),
		});
		scaleX = interpolate(f, [0, 12, 18, 22], [1.0, 1.0, 0.05, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.quad),
		});
		brightness = interpolate(f, [0, 10, 22], [1.0, 2.2, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
		opacity = interpolate(f, [14, 22], [1.0, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
		power = interpolate(f, [0, 12, 20], [1, 1.25, 0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
	}

	// The two blooms read off the timeline slightly apart, so they differ in hue the way
	// two walls lit by the same screen would.
	const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
	const ambient =
		ambientColors && ambientColors.length > 0
			? ([sampleTimeline(ambientColors, t), sampleTimeline(ambientColors, t + 0.12)] as const)
			: null;

	const effectiveBackdrop = backdropSrc !== undefined ? backdropSrc : mediaSrc;
	const isBackdropVideo = effectiveBackdrop ? isVideoFile(effectiveBackdrop) : false;

	const resolvedMedia = resolveSrc(mediaSrc);
	const isVideo = isVideoFile(mediaSrc);

	const zoom =
		kenBurns && !isVideo
			? interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
			  })
			: 1.0;

	const mediaStyle: React.CSSProperties = {
		width: '100%',
		height: '100%',
		objectFit,
		objectPosition,
		transform: `scale(${mediaScale * 1.02 * zoom}) translateY(${mediaOffsetY}px)`,
	};

	return (
		<AbsoluteFill
			style={{
				backgroundColor: stageBackground,
				alignItems: 'center',
				justifyContent: 'center',
				overflow: 'hidden',
			}}
		>
			{/* Backdrop: colours pulled off the clip, an image blurred back, or a fixed wash */}
			<AbsoluteFill style={{ pointerEvents: 'none' }}>
				{ambient ? (
					<AbsoluteFill
						style={{
							background: [
								`radial-gradient(62% 40% at 20% 22%, ${ambient[0]} 0%, rgba(0,0,0,0) 64%)`,
								`radial-gradient(68% 44% at 82% 78%, ${ambient[1]} 0%, rgba(0,0,0,0) 66%)`,
								stageBackground,
							].join(', '),
						}}
					/>
				) : effectiveBackdrop ? (
					isBackdropVideo ? (
						<OffthreadVideo
							src={resolveSrc(effectiveBackdrop)}
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								// Overscan so the blur does not pull transparent edges into frame
								transform: `scale(${1 + backdropBlur / 260})`,
								filter: `blur(${backdropBlur}px) saturate(0.8)`,
							}}
						/>
					) : (
						<Img
							src={resolveSrc(effectiveBackdrop)}
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								// Overscan so the blur does not pull transparent edges into frame
								transform: `scale(${1 + backdropBlur / 260})`,
								filter: `blur(${backdropBlur}px) saturate(0.8)`,
							}}
						/>
					)
				) : (
					<AbsoluteFill
						style={{
							background: [
								`radial-gradient(62% 40% at 20% 22%, ${backdropColors[0]} 0%, rgba(0,0,0,0) 64%)`,
								`radial-gradient(68% 44% at 82% 78%, ${backdropColors[1]} 0%, rgba(0,0,0,0) 66%)`,
								stageBackground,
							].join(', '),
						}}
					/>
				)}
				<AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${backdropDim})` }} />
				{backdropGrain > 0 ? (
					<AbsoluteFill
						style={{
							backgroundImage: GRAIN,
							backgroundSize: `${Math.round(compWidth * 0.14)}px ${Math.round(
								compWidth * 0.14,
							)}px`,
							opacity: backdropGrain,
							mixBlendMode: 'overlay',
						}}
					/>
				) : null}
				{/* Keeps the set the brightest thing in the frame */}
				<AbsoluteFill
					style={{
						background:
							'radial-gradient(72% 52% at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.4) 76%, rgba(0,0,0,0.75) 100%)',
					}}
				/>
			</AbsoluteFill>

			{/* Light the screen throws into the room */}
			{glowStrength > 0 ? (
				<div
					style={{
						position: 'absolute',
						left: '50%',
						top: '50%',
						width: compWidth * 1.9,
						height: compWidth * 1.9,
						marginLeft: -compWidth * 0.95,
						marginTop: -compWidth * 0.95 + tvOffsetY,
						borderRadius: '50%',
						background: `radial-gradient(circle, ${rgba(
							glowColor,
							glowStrength,
						)} 0%, ${rgba(glowColor, glowStrength * 0.35)} 32%, rgba(0,0,0,0) 64%)`,
						opacity: power,
						pointerEvents: 'none',
					}}
				/>
			) : null}

			<div
				style={{
					position: 'relative',
					width: screenW,
					height: screenH,
					marginTop: tvOffsetY,
				}}
			>
				{/* The picture, cut to the old-TV silhouette. Nothing is drawn over it. */}
				<div
					style={{
						width: '100%',
						height: '100%',
						backgroundColor: '#000000',
						clipPath: `path("${shape}")`,
					}}
				>
					<div
						style={{
							width: '100%',
							height: '100%',
							transform: `scale(${scaleX}, ${scaleY})`,
							transformOrigin: 'center center',
							filter: `brightness(${brightness})`,
							opacity,
						}}
					>
						{resolvedMedia ? (
							<AbsoluteFill>
								{isVideo ? (
									<OffthreadVideo src={resolvedMedia} style={mediaStyle} />
								) : (
									<Img src={resolvedMedia} style={mediaStyle} />
								)}
							</AbsoluteFill>
						) : null}
						{quoteText ? (
							<div
								style={{
									position: 'absolute',
									bottom: '10%',
									left: '6%',
									right: '18%',
									textAlign: 'center',
									color: '#ffffff',
									fontFamily:
										'Inter, "Montserrat", -apple-system, sans-serif',
									fontSize: Math.round(screenW * 0.052),
									fontWeight: 800,
									lineHeight: 1.25,
									letterSpacing: '-0.02em',
									textShadow:
										'0 2px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)',
									pointerEvents: 'none',
								}}
							>
								{quoteText}
							</div>
						) : null}
					</div>
				</div>

				{/* One thin line tracing the shape */}
				{showOutline ? (
					<svg
						width={screenW}
						height={screenH}
						viewBox={`0 0 ${screenW} ${screenH}`}
						style={{
							position: 'absolute',
							left: 0,
							top: 0,
							overflow: 'visible',
							pointerEvents: 'none',
						}}
					>
						<path
							d={shape}
							fill="none"
							stroke={rgba(lineColor, 0.55 * Math.min(1, power))}
							strokeWidth={Math.max(1.5, screenW * 0.0022)}
						/>
					</svg>
				) : null}
			</div>

			{/* Instagram Reels chrome, above everything */}
			<AbsoluteFill style={{ zIndex: 20000 }}>
				<InstagramUI {...instagramUI} enabled={showInstagramUI} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export default Quote_Style;
