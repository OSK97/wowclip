import React, { useMemo } from 'react';
import {
	AbsoluteFill,
	Img,
	Video,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	Easing,
	Sequence,
} from 'remotion';
import { InstagramUI, InstagramUIProps } from './InstagramUI';
import { loadFont } from '@remotion/fonts';
import { CursorSelectCaption, getCursorSelectLeadIn } from './CursorSelectCaption';
import { CaptionsDotOverlay } from './CaptionsDotOverlay';
import { PersonDetectionOverlay } from './PersonDetectionOverlay';
import { AdaptiveCaptions } from './AdaptiveCaptions';
import { KnockoutCaption } from './KnockoutCaption';
import { NeonTraceCaption } from './NeonTraceCaption';
import { TallTypeCaption } from './TallTypeCaption';
import { ArcCaption } from './ArcCaption';
import { QuoteCaptionEngine } from './QuoteCaptionEngine';

const CURSIVE_FAMILY = 'GaramondNovaPro';
const MAIN_FAMILY = 'Poppins';
const CAPTION_FAMILY = 'IntegralCF';

// loadFont({
// 	family: CURSIVE_FAMILY,
// 	url: staticFile('fonts/fonnts.com-garamond_nova_pro_cd-italic.otf'),
// 	weight: 'normal',
// 	style: 'italic',
// });

// Using direct Google Fonts WOFF2 URL for Poppins Black (900 weight)
// loadFont({
// 	family: MAIN_FAMILY,
// 	url: 'https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLBT5Z1JlFc-K.woff2',
// 	weight: '900',
// 	format: 'woff2',
// });

// Integral CF Heavy for punchy word-by-word captions
// loadFont({
// 	family: CAPTION_FAMILY,
// 	url: staticFile('fonts/IntegralCF/Demo_Fonts/Fontspring-DEMO-integralcf-heavy.otf'),
// 	weight: '900',
// 	format: 'opentype',
// });

export interface Quote_StyleProps {
	/** Video or image path in public/ or full URL (e.g. 'why_not_you.mp4', 'Space-Background-Images.jpg') */
	mediaSrc?: string;
	/** Fit mode for the media (defaults to 'cover') */
	objectFit?: 'cover' | 'contain' | 'fill';
	/** Alignment within the frame */
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
	 * far back it sits â€” the set has to stay the brightest thing in the frame.
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
	/** Display the red frame / red mask around the detected person */
	showPersonDetection?: boolean;
	/** Caption presentation style. `quote-engine` combines face-safe woven type with a word-level fallback. */
	captionStyle?: 'quote-engine' | 'adaptive-empty-space' | 'bottom-dot' | 'cursor-select';
	/** Position of the cursive accent word in the stack: 'last' (bottom) or 'first' (top) */
	cursivePosition?: 'last' | 'first';
}

const resolveSrc = (src?: string) => {
	if (!src) return '';
	if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
		return src;
	}
	return staticFile(src);
};

const isVideoFile = (src: string) => {
	const clean = src.split('?')[0];
	const ext = clean.split('.').pop()?.split('#')[0]?.toLowerCase();
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
 * look â€” the picture is clipped to it and the outline traces it.
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
	mediaSrc = 'why_not_you_hq.mp4',
	objectFit = 'cover',
	objectPosition = 'center center',
	mediaOffsetY = 0,
	mediaScale = 1.18,
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
	showInstagramUI = false, // Set to true to switch back on
	instagramUI,
	quoteText,
	kenBurns = false,
	showPersonDetection = false,
	captionStyle = 'quote-engine',
}) => {
	const frame = useCurrentFrame();
	const { durationInFrames, width: compWidth } = useVideoConfig();

	const screenW = Math.round(compWidth * tvScale);
	const screenH = Math.round(screenW * 0.825); // Slightly taller frame (785px) for better headroom
	const shape = useMemo(
		() => superellipse(screenW, screenH, shapeSquareness),
		[screenW, screenH, shapeSquareness],
	);

	// --- Cinematic Intro & Outro ------------------------------------------------
	const onDuration = 26;
	const offDuration = 20;

	let opacity = 1.0;
	let settleScale = 1.0;
	let brightness = 1.0;
	let power = 1.0;
	let outlineProgress = 1.0;

	if (animatePower && frame < onDuration) {
		// Smooth cinematic fade-in: NO stretching, uniform gentle settle
		opacity = interpolate(frame, [0, 18], [0.0, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.quad),
		});
		settleScale = interpolate(frame, [0, 24], [1.04, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.cubic),
		});
		brightness = interpolate(frame, [0, 20], [1.3, 1.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.quad),
		});
		power = interpolate(frame, [0, 22], [0, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.quad),
		});
		outlineProgress = interpolate(frame, [2, 24], [0, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.inOut(Easing.cubic),
		});
	} else if (animatePower && frame >= durationInFrames - offDuration) {
		const f = frame - (durationInFrames - offDuration);
		// Clean fade-out at the end
		opacity = interpolate(f, [0, offDuration], [1.0, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.quad),
		});
		settleScale = interpolate(f, [0, offDuration], [1.0, 0.98], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.quad),
		});
		power = interpolate(f, [0, offDuration], [1.0, 0.0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});
		outlineProgress = interpolate(f, [0, offDuration], [1.0, 0.0], {
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
		transform: `scale(${mediaScale * (kenBurns ? zoom : 1)}) translateY(${mediaOffsetY}px)`,
	};

	// One CursorSelect caption, so the animation can be checked before it is wired to the
	// full transcript. All of its motion lives in CursorSelectCaption.
	//
	// syncFrame is the word-level timestamp from the transcript — the frame "why" is
	// actually spoken. The pointer's run-up has to happen before it, so the caption is
	// mounted leadIn frames early and the word finishes rising exactly on the word.
	const captionSyncFrame = 70;
	const captionEndFrame = 151;
	const captionLeadIn = getCursorSelectLeadIn();
	const showTestCaption =
		frame >= captionSyncFrame - captionLeadIn && frame <= captionEndFrame;

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
						<Video
							src={resolveSrc(effectiveBackdrop)}
							muted
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
							transform: `scale(${settleScale})`,
							transformOrigin: 'center center',
							filter: brightness !== 1 ? `brightness(${brightness})` : undefined,
							opacity,
						}}
					>
						{resolvedMedia ? (
							<AbsoluteFill>
								{isVideo ? (
									<Video src={resolvedMedia} style={mediaStyle} />
								) : (
									<Img src={resolvedMedia} style={mediaStyle} />
								)}
							</AbsoluteFill>
						) : null}

						{/* Black shadow gradient from bottom to top inside the CRT for maximum caption contrast */}
						<AbsoluteFill
							style={{
								background:
									'linear-gradient(to top, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.65) 24%, rgba(0, 0, 0, 0.18) 45%, rgba(0, 0, 0, 0) 65%)',
								pointerEvents: 'none',
							}}
						/>
						
						{/* Text Behind Person for BRAINS (frames 160-230) */}
						<Sequence from={160} durationInFrames={71}>
							<AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
								{/* The text layer (wedged between background and foreground) */}
								<h1 style={{
									fontFamily: `"${MAIN_FAMILY}", Inter, sans-serif`,
									fontSize: Math.round(screenW * 0.22),
									fontWeight: 900,
									color: '#ffffff',
									margin: 0,
									position: 'absolute',
									top: '32%', // Positioned at head/chest depth level
									zIndex: 10,
									textShadow: '0 4px 20px rgba(0,0,0,0.8)',
								}}>
									BRAINS
								</h1>
								
								{/* The extracted transparent foreground PNG sequence (fixes WebM flicker bugs) */}
								<AbsoluteFill style={{ zIndex: 20 }}>
									<Img 
										src={staticFile(`brains_sequence/${String(frame - 160 + 1).padStart(4, '0')}.png`)} 
										style={mediaStyle} 
									/>
								</AbsoluteFill>
							</AbsoluteFill>
						</Sequence>
						
						{/* Creative Adaptive Captions: 60% Bottom Shadow Area, 40% Creative Empty-Space Slots */}
						{captionStyle === 'quote-engine' ? (
							<>
								{showTestCaption ? (
									<CursorSelectCaption
										word="WHY"
										supporting={['not you?']}
										width={screenW}
										height={screenH}
										syncFrame={captionSyncFrame}
										fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
										supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
										offsetY={-Math.round(screenH * 0.04)}
										boxGradient={['#ff7676', '#ff4d4d', '#d60000']}
									/>
								) : null}
								<QuoteCaptionEngine
									screenW={screenW}
									screenH={screenH}
									showDebug={showPersonDetection}
								/>
							</>
						) : captionStyle === 'adaptive-empty-space' ? (
							<>
								{showTestCaption ? (
									<CursorSelectCaption
										word="WHY"
										supporting={['not you?']}
										width={screenW}
										height={screenH}
										syncFrame={captionSyncFrame}
										fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
										supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
										offsetY={-Math.round(screenH * 0.04)}
										boxGradient={['#ff7676', '#ff4d4d', '#d60000']}
									/>
								) : null}
								{frame >= captionEndFrame ? (
									<AdaptiveCaptions
										frame={frame}
										screenW={screenW}
										screenH={screenH}
										mediaScale={mediaScale}
										mediaOffsetY={mediaOffsetY}
										creativeRatio={0.4}
										showDebugSlot={showPersonDetection}
										cursiveFont={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
										boldFont={`"${CAPTION_FAMILY}", "${MAIN_FAMILY}", sans-serif`}
										primaryColor="#FFFFFF"
										blackoutRanges={[
											[160, 230],   // BRAINS (TextBehindPerson)
											[320, 420],   // ADVICE (ArcCaption)
											[565, 645],   // FINANCIAL (Knockout)
											[820, 920],   // LEARN (TallType)
											[1200, 1310], // JOURNEY (NeonTrace)
										]} // Hides text while creative templates are active
									/>
								) : null}
							</>
						) : (
							<>
								{/* CursorSelect caption test: WHY in the box, "not you?" underneath */}
								{showTestCaption ? (
									<CursorSelectCaption
										word="WHY"
										supporting={['not you?']}
										width={screenW}
										height={screenH}
										syncFrame={captionSyncFrame}
										fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
										supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
										offsetY={-Math.round(screenH * 0.04)}
									/>
								) : null}

								{/* CaptionsDot word-by-word flow seamlessly takes over right after CursorSelect ends */}
								{frame >= captionEndFrame ? (
									<CaptionsDotOverlay
										width={screenW}
										height={screenH}
										startFrameAfter={captionEndFrame}
										fontFamily={`"${CAPTION_FAMILY}", "${MAIN_FAMILY}", sans-serif`}
										position="bottom"
										bottomOffset="11%"
										dotColor="#E2FB00"
										textColor="#FFFFFF"
										mixBlendMode="normal"
										casing="uppercase"
									/>
								) : null}
							</>
						)}
						
						{/* Experimental Knockout Caption test for "FINANCIAL" heavy word */}
						<KnockoutCaption
							word="FINANCIAL"
							supportingText="wall around your family."
							width={screenW}
							height={screenH}
							syncFrame={582} // ~19.4s in
							fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
							supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
							slabColor="#0a0a0a"
							textColor="#FFFFFF" // Changed to white per user request
						/>

						{/* Experimental NeonTrace test for "JOURNEY" heavy word */}
						<NeonTraceCaption
							word="JOURNEY"
							supportingText="around the world."
							width={screenW}
							height={screenH}
							syncFrame={1230} // ~41.0s in
							fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
							supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
						/>

						{/* Experimental TallType test for "LEARN" heavy word */}
						<TallTypeCaption
							word="LEARN"
							supportingText="every single day."
							width={screenW}
							height={screenH}
							syncFrame={850} // ~28.3s in
							fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
							supportingFontFamily={`"${CURSIVE_FAMILY}", "Playfair Display", Georgia, serif`}
							wordColor="#c9a227"
							textColor="#ffffff"
						/>

						{/* Person Detection: Red frame, red mask & empty space zones */}
						{showPersonDetection ? (
							<PersonDetectionOverlay
								frame={frame}
								screenW={screenW}
								screenH={screenH}
								mediaScale={mediaScale}
								mediaOffsetY={mediaOffsetY}
								showMask={true}
								showSilhouetteContour={true}
								showHeadChestZones={true}
								showEmptyZones={true}
							/>
						) : null}
						
						{/* Motivational Quote Text (if provided) */}
						{quoteText ? (
							<div
								style={{
									position: 'absolute',
									bottom: '10%',
									left: '6%',
									right: '18%',
									textAlign: 'center',
									color: '#ffffff',
									fontFamily: `"${MAIN_FAMILY}", "Montserrat", -apple-system, sans-serif`,
									fontSize: Math.round(screenW * 0.052),
									fontWeight: 900,
									lineHeight: 1.25,
									letterSpacing: '-0.02em',
									textShadow:
										'0 3px 18px rgba(0,0,0,1), 0 1px 6px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.7)',
									pointerEvents: 'none',
								}}
							>
								{quoteText}
							</div>
						) : null}
					</div>
				</div>

				{/* Outline tracing the shape with animated line drawing */}
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
							pathLength={1}
							strokeDasharray={1}
							strokeDashoffset={1 - outlineProgress}
							stroke={rgba(lineColor, 0.65 * Math.min(1, power))}
							strokeWidth={Math.max(1.5, screenW * 0.0022)}
						/>
					</svg>
				) : null}

				{/* Experimental ArcCaption test for heavy word */}
				<ArcCaption
					word="DISCIPLINE"
					width={screenW}
					height={screenH}
					syncFrame={350} // ~11.6s in
					fontFamily={`"${MAIN_FAMILY}", Inter, sans-serif`}
					shape={shape}
					shapeSquareness={shapeSquareness}
					glowColor="#ff0033"
				/>
			</div>

			{/* Instagram Reels chrome, above everything (switchable via showInstagramUI) */}
			{showInstagramUI ? (
				<AbsoluteFill style={{ zIndex: 20000 }}>
					<InstagramUI {...instagramUI} enabled={showInstagramUI} />
				</AbsoluteFill>
			) : null}
		</AbsoluteFill>
	);
};

export default Quote_Style;
