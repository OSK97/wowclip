import React, { useMemo } from 'react';
import {
	AbsoluteFill,
	Video,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import { planCaptions, resolveCaptionDirectorConfig } from './director';
import { FONT_PROBES } from './fonts';
import { useFontedSolve } from './metrics';
import { solveTrack } from './layout';
import { TreatmentView } from './treatments';
import type { CaptionDirectorConfigInput, Geom, PhraseLayout } from './types';

export type {
	CaptionDirectorConfig,
	CaptionDirectorConfigInput,
	Phrase,
	TranscriptWord,
	TreatmentName,
} from './types';
export {
	resolveCaptionDirectorConfig,
	getCaptionDirectorDuration,
	planCaptions,
} from './director';
export { PALETTES, resolvePalette } from './palette';

export type CaptionTrackProps = {
	config?: CaptionDirectorConfigInput;
	/** Surface the captions are composed on. Defaults to the composition size. */
	width?: number;
	height?: number;
	/** Baseline of the quiet track and the centre of the emphasis beats, as fractions of height */
	trackY?: number;
	heroY?: number;
	/** Horizontal safe inset as a fraction of width */
	padX?: number;
	/** Bottom gradient behind the quiet track. Turn off if the host composition already has one. */
	showScrim?: boolean;
	/** Overlays the plan — treatment, weight, pauses — for tuning without rendering */
	debug?: boolean;
};

/**
 * The caption layer on its own, with no background of its own.
 *
 * Separate from the composition below it so it can be dropped inside another one — over an
 * ASD crop, inside a framed screen, above an Instagram chrome mock — and be given that
 * surface's rect rather than the composition's. The whole track is positioned relative to
 * whatever box this is rendered into.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({
	config,
	width,
	height,
	trackY = 0.855,
	heroY = 0.5,
	padX = 0.075,
	showScrim = true,
	debug = false,
}) => {
	const frame = useCurrentFrame();
	const video = useVideoConfig();
	const w = width ?? video.width;
	const h = height ?? video.height;

	const c = useMemo(() => resolveCaptionDirectorConfig(config), [config]);

	const geom: Geom = useMemo(
		() => ({
			width: w,
			height: h,
			k: w / 1080,
			padX: Math.round(w * padX),
			trackY,
			heroY,
		}),
		[w, h, padX, trackY, heroY],
	);

	// Planned outside the measurement pass because it needs no metrics at all — it is pure
	// arithmetic on the timings. Keeping it separate means the schedule can be inspected, unit
	// tested, or generated upstream without a browser anywhere near it.
	const phrases = useMemo(() => planCaptions(c, video.fps), [c, video.fps]);

	// One measurement pass for the entire clip, holding the render once. See `useFontedSolve`.
	const key = useMemo(
		() =>
			[
				phrases.length,
				phrases.map((p) => `${p.id}:${p.treatment}:${p.heroIndex}`).join(','),
				w,
				h,
				trackY,
				heroY,
				padX,
				JSON.stringify(c.layout),
				c.theme.casing,
			].join('|'),
		[phrases, w, h, trackY, heroY, padX, c.layout, c.theme.casing],
	);

	const track = useFontedSolve<PhraseLayout[]>(
		key,
		FONT_PROBES,
		(ctx) => solveTrack(ctx, phrases, geom, c),
		() => [],
	);

	// Exactly one phrase is live at a time — `buildPhrases` clamps each phrase's end below the
	// next one's start so the states can never overlap. The exit tail is allowed to run past
	// that end, which is why the window is widened here and not there.
	const active = track.filter(
		(l) => frame >= l.phrase.startFrame - 2 && frame <= l.outAt + c.timing.out,
	);

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: w,
				height: h,
				overflow: 'hidden',
				pointerEvents: 'none',
			}}
		>
			{showScrim && c.theme.scrim > 0 ? (
				// Continuous rather than per phrase. A scrim that appeared and disappeared with each
				// caption would pulse at every phrase boundary, which is far more noticeable than the
				// scrim itself.
				<div
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						bottom: 0,
						height: Math.round(h * 0.42),
						background: `linear-gradient(to top, rgba(0,0,0,${c.theme.scrim}) 0%, rgba(0,0,0,${(
							c.theme.scrim * 0.62
						).toFixed(3)}) 34%, rgba(0,0,0,0) 100%)`,
					}}
				/>
			) : null}

			{active.map((l) => (
				<TreatmentView
					key={l.phrase.id}
					layout={l}
					frame={frame}
					theme={c.theme}
					timing={c.timing}
				/>
			))}

			{debug ? <PlanHud track={track} frame={frame} /> : null}
		</div>
	);
};

/**
 * What the director decided, on screen. Exists because tuning `intensity`, `threshold` and
 * `cooldown` by scrubbing a preview is far faster than tuning them by rendering, and the
 * numbers driving each decision are otherwise invisible.
 */
const PlanHud: React.FC<{ track: PhraseLayout[]; frame: number }> = ({ track, frame }) => {
	const live = track.find((l) => frame >= l.phrase.startFrame && frame <= l.outAt);
	const beats = track.filter((l) => l.treatment !== 'baseline');

	return (
		<div
			style={{
				position: 'absolute',
				left: 16,
				top: 16,
				padding: '10px 14px',
				borderRadius: 8,
				background: 'rgba(0,0,0,0.72)',
				color: '#8ef6a0',
				font: '500 15px/1.5 ui-monospace, monospace',
				whiteSpace: 'pre',
			}}
		>
			{[
				`phrases ${track.length}   beats ${beats.length}`,
				live
					? `#${live.phrase.id}  ${live.treatment.padEnd(8)} w=${live.phrase.weight.toFixed(2)}`
					: '— no phrase —',
				live
					? `lead ${live.phrase.leadPause.toFixed(2)}s  tail ${live.phrase.tailPause.toFixed(
							2,
						)}s  ${live.phrase.rate.toFixed(1)} w/s`
					: '',
				live ? `hero "${live.phrase.words[live.phrase.heroIndex]?.display ?? ''}"` : '',
			]
				.filter(Boolean)
				.join('\n')}
		</div>
	);
};

/**
 * The standalone composition: footage, a flat dim, and the track over it.
 *
 * The dim is flat rather than a vignette on purpose. Since no type in this template carries a
 * shadow or a stroke, an even field is the only thing that makes a word read the same wherever
 * in the frame it lands — a vignette would make the same caption legible in the centre and
 * marginal at the edges.
 */
export const CaptionDirector: React.FC<{
	config?: CaptionDirectorConfigInput;
	debug?: boolean;
}> = ({ config, debug = false }) => {
	const c = resolveCaptionDirectorConfig(config);

	return (
		<AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
			{c.background?.src ? (
				<AbsoluteFill style={{ pointerEvents: 'none' }}>
					<Video
						src={staticFile(c.background.src)}
						style={{ width: '100%', height: '100%', objectFit: 'cover' }}
					/>
					<AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${c.theme.dim.toFixed(3)})` }} />
				</AbsoluteFill>
			) : null}

			<CaptionTrack config={config} debug={debug} />
		</AbsoluteFill>
	);
};

export default CaptionDirector;
