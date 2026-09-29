/**
 * Caption Engine — full-screen reel scene.
 *
 * The plain 9:16 stage the captions live on: no bezel, no blurred backdrop, no frame. The clip
 * fills the composition, which is what you want once the source is already vertical (an
 * ASD-cropped podcast, or a portrait clip).
 *
 * `mediaSrc` is optional. Left empty the stage is flat black, which is how you review the
 * typography without a video arguing with it.
 *
 * Legibility is handled by a flat dim over the footage, not by shadows or outlines on the type.
 * That is deliberate: a shadow on a 200px ExtraBold word muddies the hollows the layout places
 * small type into, so the dim does the work an outline would while leaving the letterforms clean.
 *
 * B-roll is intentionally not handled here — it belongs on a separate layer.
 */

import React from 'react';
import {
	AbsoluteFill,
	Img,
	Video,
	interpolate,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import { CaptionEngine } from './CaptionEngine';
import { CaptionEngineConfigInput, CaptionPlan, TranscriptWord } from './types';
import { InstagramUI, InstagramUIProps } from '../InstagramUI';

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];

const resolveSrc = (src?: string): string => {
	if (!src) return '';
	if (src.indexOf('http://') === 0 || src.indexOf('https://') === 0 || src.indexOf('data:') === 0) {
		return src;
	}
	return staticFile(src);
};

const isVideoFile = (src: string): boolean => {
	const clean = src.split('?')[0];
	const ext = clean.split('.').pop()?.split('#')[0]?.toLowerCase() ?? '';
	return VIDEO_EXTENSIONS.indexOf(ext) !== -1;
};

export interface FullScreenReelProps {
	/** Video or image in `public/`, or an absolute URL. Empty renders a flat colour stage. */
	mediaSrc?: string;
	objectFit?: 'cover' | 'contain' | 'fill';
	objectPosition?: string;
	mediaScale?: number;
	mediaOffsetY?: number;
	backgroundColor?: string;
	/**
	 * Flat black over the footage, 0..1. The only thing keeping the type legible, since it carries
	 * no shadow or stroke. Raise it for a bright or busy shot; do not take it to zero.
	 * Defaults to `captionConfig.style.backdropDim`.
	 */
	dim?: number;
	/** Slow zoom, for stills only. */
	kenBurns?: boolean;

	/** Word-level transcript. Ignored if `captionPlan` is given. */
	transcript?: TranscriptWord[];
	/** Pre-built caption plan, e.g. generated server-side. */
	captionPlan?: CaptionPlan;
	captionConfig?: CaptionEngineConfigInput;
	/** Engine diagnostics overlay. Preview only. */
	showDebug?: boolean;

	showInstagramUI?: boolean;
	instagramUI?: InstagramUIProps;
}

export const FullScreenReel: React.FC<FullScreenReelProps> = ({
	mediaSrc,
	objectFit = 'cover',
	objectPosition = 'center center',
	mediaScale = 1,
	mediaOffsetY = 0,
	backgroundColor = '#000000',
	dim,
	kenBurns = false,
	transcript,
	captionPlan,
	captionConfig,
	showDebug = false,
	showInstagramUI = false,
	instagramUI,
}) => {
	const frame = useCurrentFrame();
	const { durationInFrames } = useVideoConfig();

	const resolved = resolveSrc(mediaSrc);
	const isVideo = resolved.length > 0 && isVideoFile(mediaSrc ?? '');
	const effectiveDim = dim ?? captionConfig?.style?.backdropDim ?? 0.46;

	const zoom =
		kenBurns && !isVideo
			? interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.07], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				})
			: 1;

	const mediaStyle: React.CSSProperties = {
		width: '100%',
		height: '100%',
		objectFit,
		objectPosition,
		transform: `scale(${mediaScale * zoom}) translateY(${mediaOffsetY}px)`,
	};

	return (
		<AbsoluteFill style={{ backgroundColor, overflow: 'hidden' }}>
			{resolved ? (
				<AbsoluteFill>
					{isVideo ? (
						<Video src={resolved} style={mediaStyle} />
					) : (
						<Img src={resolved} style={mediaStyle} />
					)}
				</AbsoluteFill>
			) : null}

			{resolved && effectiveDim > 0 ? (
				<AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${effectiveDim})` }} />
			) : null}

			<CaptionEngine
				transcript={transcript}
				plan={captionPlan}
				config={captionConfig}
				showDebug={showDebug}
			/>

			{showInstagramUI ? (
				<AbsoluteFill style={{ zIndex: 20000 }}>
					<InstagramUI {...instagramUI} enabled={showInstagramUI} />
				</AbsoluteFill>
			) : null}
		</AbsoluteFill>
	);
};

export default FullScreenReel;
