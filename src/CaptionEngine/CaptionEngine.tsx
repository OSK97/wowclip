/**
 * Caption Engine — overlay component.
 *
 * Drop it over any video and it renders the whole caption track:
 *
 *   <CaptionEngine transcript={words} />
 *
 * Takes either a raw transcript (planned on the fly, memoised) or a pre-built `plan`. Use the plan
 * path when it was generated server-side, so the renderer does no editorial work and every Lambda
 * worker agrees on the phrasing.
 *
 * Three stages happen here, in order: plan (pure), measure (one canvas pass behind a single
 * `delayRender`), solve (pure, given metrics). Measuring the whole track up front rather than per
 * chunk means one render block instead of one per caption.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionEngineConfigInput, CaptionPlan, TranscriptWord } from './types';
import { buildCaptionPlan, resolveCaptionConfig, summarizePlan } from './buildPlan';
import { FONT_PROBES, heroFace, registerCaptionFonts, supportFace } from './fonts';
import { MeasureRequest, useMeasuredTrack } from './metrics';
import {
	flatKey,
	flatSizeFor,
	heroKey,
	heroSizeFor,
	leadKey,
	leadSizeFor,
	solveChunk,
	tailKey,
	tailSizeFor,
} from './layout';
import { ChunkView } from './ChunkView';

registerCaptionFonts();

export interface CaptionEngineProps {
	/** Word-level transcript. Ignored when `plan` is supplied. */
	transcript?: TranscriptWord[];
	/** Pre-built plan. Skips planning. */
	plan?: CaptionPlan;
	config?: CaptionEngineConfigInput;
	/**
	 * Logical drawing area for an embedded use of the engine.
	 *
	 * The parent still controls the CSS position and clipping. This only tells the planner and
	 * solver how large that local canvas is, so a caption can live in a face-safe side lane rather
	 * than pretending it owns the entire composition.
	 */
	viewport?: { width: number; height: number };
	/** Draws the safe area, block boxes and the engine's decisions. Preview only. */
	showDebug?: boolean;
}

const isBlackedOut = (frame: number, ranges: [number, number][]): boolean => {
	for (let i = 0; i < ranges.length; i++) {
		if (frame >= ranges[i][0] && frame <= ranges[i][1]) return true;
	}
	return false;
};

export const CaptionEngine: React.FC<CaptionEngineProps> = ({
	transcript,
	plan: providedPlan,
	config: configInput,
	viewport,
	showDebug = false,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const layoutWidth = viewport?.width ?? width;
	const layoutHeight = viewport?.height ?? height;

	// The composition is the source of truth for size and fps, so a config authored for 1080x1920
	// keeps working if the composition is re-targeted. An embedded caller can intentionally replace
	// that canvas with its own face-safe viewport.
	const config = useMemo(
		() => resolveCaptionConfig({ ...configInput, fps, width: layoutWidth, height: layoutHeight }),
		[configInput, fps, layoutWidth, layoutHeight],
	);

	const plan = useMemo(
		() =>
			providedPlan ??
			buildCaptionPlan(transcript, {
				...configInput,
				fps,
				width: layoutWidth,
				height: layoutHeight,
			}),
		[providedPlan, transcript, configInput, fps, layoutWidth, layoutHeight],
	);

	// Everything the track needs measured, in one list.
	const requests = useMemo<MeasureRequest[]>(() => {
		const out: MeasureRequest[] = [];
		const hero = heroFace(config.style.heroTracking);
		const soft = supportFace(config.style.supportTracking, false);
		const firm = supportFace(config.style.supportTracking, true);

		for (let i = 0; i < plan.chunks.length; i++) {
			const c = plan.chunks[i];

			// Flat is measured for every chunk, not just the ones planned flat, because the solver can
			// still downgrade a chunk once it sees the real widths.
			out.push({
				key: flatKey(c.id),
				text: c.words.join(' '),
				face: soft,
				size: flatSizeFor(config),
				withRuns: true,
			});

			if (c.mode !== 'anchored' || !c.hero) continue;

			out.push({
				key: heroKey(c.id),
				text: c.hero,
				face: hero,
				size: heroSizeFor(c, config),
				withRuns: false,
			});
			if (c.lead.length > 0) {
				out.push({
					key: leadKey(c.id),
					text: c.lead.join(' '),
					face: c.variation.emphasiseLead ? firm : soft,
					size: leadSizeFor(c, config),
					withRuns: true,
				});
			}
			if (c.tail.length > 0) {
				out.push({
					key: tailKey(c.id),
					text: c.tail.join(' '),
					face: soft,
					size: tailSizeFor(c, config),
					withRuns: true,
				});
			}
		}
		return out;
	}, [plan, config]);

	const measured = useMeasuredTrack(requests, FONT_PROBES);

	const solved = useMemo(
		() => plan.chunks.map((c) => solveChunk(c, measured, config)),
		[plan, measured, config],
	);

	const activeIndex = useMemo(() => {
		for (let i = 0; i < plan.chunks.length; i++) {
			const c = plan.chunks[i];
			if (frame >= c.startFrame && frame < c.visibleUntil) return i;
		}
		return -1;
	}, [plan, frame]);

	const blacked = isBlackedOut(frame, config.blackoutRanges);

	return (
		<AbsoluteFill style={{ pointerEvents: 'none' }}>
			{!blacked && activeIndex >= 0 ? (
				<ChunkView
					chunk={plan.chunks[activeIndex]}
					solved={solved[activeIndex]}
					frame={frame}
					config={config}
				/>
			) : null}
			{showDebug ? (
				<DebugOverlay
				plan={plan}
				solvedModes={solved.map((s) => ({
					mode: s.mode,
					reason: s.fallbackReason,
					box: s.box,
					heroSize: s.heroSize,
					items: s.items.map((item) => ({
						role: item.role,
						text: item.text,
						left: item.left,
						inkTop: item.inkTop,
					})),
				}))}
					activeIndex={activeIndex}
					frame={frame}
					blacked={blacked}
					safe={{
						x: config.width * config.layout.safeInsetX,
						y: config.height * config.layout.safeInsetTop,
						w: config.width * (1 - 2 * config.layout.safeInsetX),
						h: config.height * (1 - config.layout.safeInsetTop - config.layout.safeInsetBottom),
					}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

// ─────────────────────────────────────────────────────────────────────────────
// Debug overlay
// ─────────────────────────────────────────────────────────────────────────────

interface SolvedSummary {
	mode: string;
	reason: string | null;
	box: { left: number; top: number; width: number; height: number };
	heroSize: number;
	items: { role: string; text: string; left: number; inkTop: number }[];
}

const DebugOverlay: React.FC<{
	plan: CaptionPlan;
	solvedModes: SolvedSummary[];
	activeIndex: number;
	frame: number;
	blacked: boolean;
	safe: { x: number; y: number; w: number; h: number };
}> = ({ plan, solvedModes, activeIndex, frame, blacked, safe }) => {
	const chunk = activeIndex >= 0 ? plan.chunks[activeIndex] : null;
	const solved = activeIndex >= 0 ? solvedModes[activeIndex] : null;
	const summary = useMemo(() => summarizePlan(plan), [plan]);

	const lines = [
		`frame ${frame}${blacked ? '  [BLACKOUT]' : ''}`,
		chunk && solved
			? `#${chunk.id} ${solved.mode}${solved.reason ? ` (${solved.reason})` : ''} hero=${Math.round(solved.heroSize)}px`
			: '#-- idle',
		chunk ? `"${chunk.text}"` : '',
		chunk ? `lead=[${chunk.lead.join(' ')}] hero="${chunk.hero ?? '-'}" tail=[${chunk.tail.join(' ')}]` : '',
		chunk
			? `case=${chunk.variation.heroCasing} jitter=${chunk.variation.heroScaleJitter.toFixed(3)} lead=${chunk.variation.emphasiseLead ? 'firm' : 'soft'} script=${chunk.script}`
			: '',
		solved ? `box ${solved.box.width}x${solved.box.height} @ ${solved.box.left},${solved.box.top}` : '',
		...(solved
			? solved.items.map(
					(item) => `${item.role} "${item.text}" @ ${item.left},${item.inkTop}`,
				)
			: []),
		`track ${summary.chunks} chunks  anchored ${summary.anchored}  flat ${summary.flat}`,
		`fallbacks ${JSON.stringify(summary.fallbacks)}`,
		`casings ${JSON.stringify(summary.casings)}`,
		`warnings ${summary.warnings.length}`,
	].filter((l) => l !== '');

	return (
		<AbsoluteFill style={{ pointerEvents: 'none' }}>
			<div
				style={{
					position: 'absolute',
					left: safe.x,
					top: safe.y,
					width: safe.w,
					height: safe.h,
					border: '2px dashed rgba(255,80,80,0.5)',
				}}
			/>
			{solved ? (
				<div
					style={{
						position: 'absolute',
						left: solved.box.left,
						top: solved.box.top,
						width: solved.box.width,
						height: solved.box.height,
						border: '2px solid rgba(80,200,255,0.7)',
					}}
				/>
			) : null}
			<div
				style={{
					position: 'absolute',
					left: 24,
					top: 24,
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
					fontSize: 21,
					lineHeight: '29px',
					color: '#9CFF6B',
					textShadow: '0 1px 3px #000',
					whiteSpace: 'pre',
				}}
			>
				{lines.join('\n')}
			</div>
		</AbsoluteFill>
	);
};

export default CaptionEngine;
