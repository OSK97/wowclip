/**
 * Quote Caption Engine
 *
 * A composition-aware adapter around CaptionEngine for the CRT quote reel. The typography engine
 * gets the compact phrases that can sit safely beside the speaker. Everything else stays a clear
 * one-word subtitle in the lower shadow band, so the video never has to sacrifice the speaker's
 * face just to force a decorative layout.
 */

import React, { useMemo } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import rawTranscript from '../transcript.json';
import rawTracking from '../person_tracking.json';
import { CaptionEngine } from '../CaptionEngine/CaptionEngine';
import { buildCaptionPlan } from '../CaptionEngine/buildPlan';
import type {
	CaptionChunk,
	CaptionEngineConfigInput,
	CaptionPlan,
	TranscriptWord,
} from '../CaptionEngine/types';
import { getCursorSelectLeadIn } from '../CursorSelectCaption';

type LaneId = 'left' | 'right' | 'lower';

interface TrackedBox {
	x: number;
	y: number;
	w?: number;
	h?: number;
	width?: number;
	height?: number;
}

interface TrackingFrame {
	box?: TrackedBox;
	head?: TrackedBox;
}

interface TrackingPayload {
	tracking?: TrackingFrame[];
}

interface QuoteLane {
	id: LaneId;
	left: number;
	top: number;
	width: number;
	height: number;
}

interface PixelBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

const QUOTE_TRANSCRIPT = rawTranscript as TranscriptWord[];
const QUOTE_TRACKING = (rawTracking as unknown as TrackingPayload).tracking ?? [];

const CURSOR_SYNC_FRAME = 70;
const CURSOR_END_FRAME = 151;

/** Windows owned by the hand-made caption treatments in Quote_Style. */
export const QUOTE_CAPTION_BLACKOUTS: [number, number][] = [
	[CURSOR_SYNC_FRAME - getCursorSelectLeadIn(), CURSOR_END_FRAME],
	[160, 230],
	[320, 420],
	[565, 645],
	[820, 920],
	[1200, 1310],
];

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const intersectsRange = (
	start: number,
	end: number,
	ranges: readonly [number, number][],
): boolean => ranges.some(([rangeStart, rangeEnd]) => start <= rangeEnd && end >= rangeStart);

const isInRange = (frame: number, ranges: readonly [number, number][]): boolean =>
	ranges.some(([start, end]) => frame >= start && frame <= end);

const cleanLength = (text: string): number => text.replace(/[^A-Za-z0-9]/g, '').length;

const makeLanes = (screenW: number, screenH: number): QuoteLane[] => {
	const inset = Math.round(screenW * 0.055);
	const width = Math.round(screenW * 0.265);
	const top = Math.round(screenH * 0.16);
	const height = Math.round(screenH * 0.45);

	return [
		{ id: 'left', left: inset, top, width, height },
		{ id: 'right', left: screenW - inset - width, top, width, height },
		{
			id: 'lower',
			left: Math.round(screenW * 0.075),
			top: Math.round(screenH * 0.53),
			width: Math.round(screenW * 0.85),
			height: Math.round(screenH * 0.4),
		},
	];
};

const trackedBoxAt = (
	tracking: TrackingFrame[],
	frame: number,
	screenW: number,
	screenH: number,
	target: 'person' | 'head' = 'person',
): PixelBox | null => {
	if (tracking.length === 0) return null;
	const index = clamp(Math.round(frame), 0, tracking.length - 1);
	const tracked = tracking[index];
	const box = target === 'head' ? tracked?.head ?? tracked?.box : tracked?.box ?? tracked?.head;
	if (!box) return null;

	const width = box.w ?? box.width ?? 0;
	const height = box.h ?? box.height ?? 0;
	if (width <= 0 || height <= 0) return null;

	return {
		left: box.x * screenW,
		top: box.y * screenH,
		right: (box.x + width) * screenW,
		bottom: (box.y + height) * screenH,
	};
};

const laneIsClear = (
	lane: QuoteLane,
	chunk: CaptionChunk,
	tracking: TrackingFrame[],
	screenW: number,
	screenH: number,
): boolean => {
	if (tracking.length === 0) return false;

	const samples = [
		chunk.startFrame,
		Math.round((chunk.startFrame + chunk.endFrame) / 2),
		chunk.endFrame,
	];
	const padX = screenW * 0.016;
	const padY = screenH * 0.025;

	for (let i = 0; i < samples.length; i++) {
		const person = trackedBoxAt(
			tracking,
			samples[i],
			screenW,
			screenH,
			lane.id === 'lower' ? 'head' : 'person',
		);
		if (!person) return false;
		const overlaps =
			lane.left < person.right + padX &&
			lane.left + lane.width > person.left - padX &&
			lane.top < person.bottom + padY &&
			lane.top + lane.height > person.top - padY;
		if (overlaps) return false;
	}

	return true;
};

const canUseWovenCaption = (chunk: CaptionChunk): boolean => {
	if (chunk.mode !== 'anchored' || !chunk.hero) return false;
	if (chunk.lead.length + chunk.tail.length === 0) return false;
	if (chunk.words.length < 2 || chunk.words.length > 4) return false;
	if (cleanLength(chunk.hero) < 3 || cleanLength(chunk.hero) > 10) return false;
	if (cleanLength(chunk.text) > 28) return false;
	return chunk.endFrame - chunk.startFrame >= 12;
};

const pickLane = (
	chunk: CaptionChunk,
	lanes: QuoteLane[],
	tracking: TrackingFrame[],
	screenW: number,
	screenH: number,
): QuoteLane | null => {
	const clearLanes = lanes.filter((lane) => laneIsClear(lane, chunk, tracking, screenW, screenH));
	if (clearLanes.length === 0) return null;

	const person = trackedBoxAt(tracking, chunk.startFrame, screenW, screenH);
	if (!person) return null;
	const centre = (person.left + person.right) / 2;
	const preferredId: LaneId = centre < screenW / 2 ? 'right' : 'left';
	const sideLanes = clearLanes.filter((lane) => lane.id !== 'lower');
	if (sideLanes.length > 0) {
		return sideLanes.find((lane) => lane.id === preferredId) ?? sideLanes[0];
	}
	return clearLanes.find((lane) => lane.id === 'lower') ?? null;
};

const planForLane = (plan: CaptionPlan, chunks: CaptionChunk[], lane: QuoteLane): CaptionPlan => ({
	...plan,
	chunks,
	width: Math.round(lane.width),
	height: Math.round(lane.height),
	lastFrame: chunks.reduce((latest, chunk) => Math.max(latest, chunk.visibleUntil), 0),
});

const laneById = (lanes: QuoteLane[], id: LaneId): QuoteLane => {
	const lane = lanes.find((candidate) => candidate.id === id);
	if (!lane) throw new Error(`Quote caption lane '${id}' is missing.`);
	return lane;
};

const laneConfig = (lane: QuoteLane, fps: number): CaptionEngineConfigInput => ({
	fps,
	width: Math.round(lane.width),
	height: Math.round(lane.height),
	layout: {
		heroSize: lane.id === 'lower' ? 215 : 260,
		leadRatio: 0.31,
		tailRatio: 0.28,
		maxWidth: 0.98,
		maxHeight: lane.id === 'lower' ? 0.9 : 0.76,
		anchorY: 0.5,
		safeInsetX: 0.01,
		safeInsetTop: 0.04,
		safeInsetBottom: 0.04,
		heroMinScale: 0.74,
		supportMinScale: 0.9,
		flatSize: 92,
		flatMaxLines: 2,
	},
	style: {
		textColor: '#ffffff',
		accentPalette: [],
		heroTracking: 0,
		supportTracking: 0,
		textShadow: '',
	},
	variation: {
		seed: `quote-side-${lane.id}`,
		firstUpperChance: 0.04,
		upperChance: 0,
		powerUpperChance: 0,
		accentChance: 0,
	},
	blackoutRanges: QUOTE_CAPTION_BLACKOUTS,
});

interface QuoteWordFallbackProps {
	transcript: TranscriptWord[];
	suppressedChunks: CaptionChunk[];
	screenW: number;
	screenH: number;
}

const QuoteWordFallback: React.FC<QuoteWordFallbackProps> = ({
	transcript,
	suppressedChunks,
	screenW,
	screenH,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const activeWord = useMemo(() => {
		for (let i = 0; i < transcript.length; i++) {
			const word = transcript[i];
			const next = transcript[i + 1];
			const startFrame = Math.round(word.start * fps);
			const endFrame = next
				? Math.round(next.start * fps)
				: Math.max(startFrame + 1, Math.round((word.end + 0.24) * fps));
			if (frame >= startFrame && frame < endFrame) {
				return { word, startFrame };
			}
		}
		return null;
	}, [frame, fps, transcript]);

	const reserved = isInRange(frame, QUOTE_CAPTION_BLACKOUTS);
	const woven = suppressedChunks.some(
		(chunk) => frame >= chunk.startFrame && frame < chunk.visibleUntil,
	);
	if (!activeWord || reserved || woven) return null;

	const display = (activeWord.word.punctuated ?? activeWord.word.text)
		.replace(/[^A-Za-z0-9']/g, '')
		.toUpperCase();
	if (display.length === 0) return null;

	const progress = interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 5], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});
	const opacity = interpolate(frame, [activeWord.startFrame, activeWord.startFrame + 3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<div
			style={{
				position: 'absolute',
				left: Math.round(screenW * 0.07),
				top: Math.round(screenH * 0.74),
				width: Math.round(screenW * 0.86),
				height: Math.round(screenH * 0.18),
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				pointerEvents: 'none',
				zIndex: 32,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					color: '#ffffff',
					fontFamily: '"IntegralCF", "Poppins", sans-serif',
					fontWeight: 900,
					fontSize: clamp(Math.round(screenW * 0.082), 46, 80),
					lineHeight: 1,
					letterSpacing: 0,
					whiteSpace: 'nowrap',
					opacity,
					transform: `translateY(${Math.round((1 - progress) * 18)}px)`,
					WebkitFontSmoothing: 'antialiased',
					textRendering: 'geometricPrecision',
				}}
			>
				{display}
			</div>
		</div>
	);
};

export interface QuoteCaptionEngineProps {
	screenW: number;
	screenH: number;
	transcript?: TranscriptWord[];
	tracking?: TrackingFrame[];
	showDebug?: boolean;
}

export const QuoteCaptionEngine: React.FC<QuoteCaptionEngineProps> = ({
	screenW,
	screenH,
	transcript = QUOTE_TRANSCRIPT,
	tracking = QUOTE_TRACKING,
	showDebug = false,
}) => {
	const { fps } = useVideoConfig();
	const lanes = useMemo(() => makeLanes(screenW, screenH), [screenW, screenH]);

	const masterPlan = useMemo(
		() =>
			buildCaptionPlan(transcript, {
				fps,
				width: screenW,
				height: screenH,
				segmenter: {
					maxWords: 4,
					maxChars: 24,
					maxChunkSeconds: 1.9,
				},
				variation: {
					seed: 'quote-caption-v1',
					firstUpperChance: 0.04,
					upperChance: 0,
					powerUpperChance: 0,
					accentChance: 0,
				},
			}),
		[fps, screenH, screenW, transcript],
	);

	const routed = useMemo(() => {
		const byLane: Record<LaneId, CaptionChunk[]> = { left: [], right: [], lower: [] };

		for (let i = 0; i < masterPlan.chunks.length; i++) {
			const chunk = masterPlan.chunks[i];
			if (!canUseWovenCaption(chunk)) continue;
			if (intersectsRange(chunk.startFrame, chunk.visibleUntil, QUOTE_CAPTION_BLACKOUTS)) continue;

			const lane = pickLane(chunk, lanes, tracking, screenW, screenH);
			if (lane) byLane[lane.id].push(chunk);
		}

		return {
			plans: {
				left: planForLane(masterPlan, byLane.left, laneById(lanes, 'left')),
				right: planForLane(masterPlan, byLane.right, laneById(lanes, 'right')),
				lower: planForLane(masterPlan, byLane.lower, laneById(lanes, 'lower')),
			},
			wovenChunks: [...byLane.left, ...byLane.right, ...byLane.lower],
		};
	}, [lanes, masterPlan, screenH, screenW, tracking]);

	const configs = useMemo(
		() => ({
			left: laneConfig(laneById(lanes, 'left'), fps),
			right: laneConfig(laneById(lanes, 'right'), fps),
			lower: laneConfig(laneById(lanes, 'lower'), fps),
		}),
		[fps, lanes],
	);

	return (
		<>
			{lanes.map((lane) => {
				const plan = routed.plans[lane.id];
				if (plan.chunks.length === 0) return null;

				return (
					<div
						key={lane.id}
						style={{
							position: 'absolute',
							left: lane.left,
							top: lane.top,
							width: lane.width,
							height: lane.height,
							overflow: 'hidden',
							pointerEvents: 'none',
							zIndex: 31,
						}}
					>
						<CaptionEngine
							plan={plan}
							config={configs[lane.id]}
							viewport={{ width: lane.width, height: lane.height }}
							showDebug={showDebug}
						/>
					</div>
				);
			})}

			<QuoteWordFallback
				transcript={transcript}
				suppressedChunks={routed.wovenChunks}
				screenW={screenW}
				screenH={screenH}
			/>
		</>
	);
};

export default QuoteCaptionEngine;
