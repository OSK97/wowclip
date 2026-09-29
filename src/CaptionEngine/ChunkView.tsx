/**
 * Caption Engine — chunk renderer.
 *
 * Draws one solved chunk. All geometry is already decided; this file only animates, and it
 * animates one thing per fragment: a rise into place behind a mask, briefly out of focus, then
 * settled. That is the whole motion vocabulary.
 *
 * The restraint is the point. The previous version had six entry animations, six accent
 * treatments and three particle bursts, and the result looked like a template showing off. What
 * professional caption work actually does is land type cleanly and then leave it alone.
 *
 * Positioning is off the ink, not off line boxes. Each fragment gets a wrapper sized to its ink
 * box, with the text pulled up inside it by however far the ink sits below the line box top. The
 * wrapper is what gets clipped, so the rise is masked while the letterforms still bleed sideways.
 */

import React from 'react';
import { Easing, interpolate } from 'remotion';
import { HERO_STACK, SUPPORT_STACK, SUPPORT_MID_WEIGHT, SUPPORT_SOFT_WEIGHT, HERO_WEIGHT } from './fonts';
import { PlacedItem, SolvedChunk } from './layout';
import { CaptionChunk, CaptionEngineConfig } from './types';

const EXIT_FRAMES = 7;

interface FragmentStyle {
	family: string;
	weight: number;
	trackingEm: number;
	color: string;
}

const styleFor = (
	item: PlacedItem,
	chunk: CaptionChunk,
	config: CaptionEngineConfig,
): FragmentStyle => {
	const { style } = config;
	if (item.role === 'hero') {
		return {
			family: HERO_STACK,
			weight: HERO_WEIGHT,
			trackingEm: style.heroTracking,
			color: chunk.variation.heroColor,
		};
	}
	const firm = item.role === 'lead' ? chunk.variation.emphasiseLead : false;
	return {
		family: SUPPORT_STACK,
		weight: firm ? SUPPORT_MID_WEIGHT : SUPPORT_SOFT_WEIGHT,
		trackingEm: style.supportTracking,
		color: style.textColor,
	};
};

export interface ChunkViewProps {
	chunk: CaptionChunk;
	solved: SolvedChunk;
	/** Absolute composition frame. */
	frame: number;
	config: CaptionEngineConfig;
}

export const ChunkView: React.FC<ChunkViewProps> = ({ chunk, solved, frame, config }) => {
	if (solved.items.length === 0) return null;

	const local = frame - chunk.startFrame;
	if (local < 0 || frame >= chunk.visibleUntil) return null;

	const visibleFrames = chunk.visibleUntil - chunk.startFrame;
	const exitStart = visibleFrames - EXIT_FRAMES;
	// Only fade out into real dead air, and never on a chunk so short it would start leaving before
	// it finished arriving.
	const exit =
		chunk.hasExitGap && visibleFrames > EXIT_FRAMES + 4
			? interpolate(local, [exitStart, visibleFrames], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: Easing.in(Easing.quad),
				})
			: 0;

	const { revealFrames, staggerFrames } = chunk.variation;

	return (
		<>
			{solved.items.map((item, idx) => {
				const f = styleFor(item, chunk, config);
				const inkH = item.ink.bottom - item.ink.top;
				const start = item.order * staggerFrames;

				// A long-tailed bezier: most of the travel happens quickly, the last few pixels are
				// slow, so the fragment arrives fast and still settles calmly.
				const rise = interpolate(local, [start, start + revealFrames], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: Easing.bezier(0.16, 1, 0.3, 1),
				});
				const fade = interpolate(local, [start, start + 4], [0, 1], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				});
				const focus = interpolate(local, [start, start + revealFrames * 0.55], [1, 0], {
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
					easing: Easing.out(Easing.quad),
				});
				const blur = focus * item.size * 0.045 + exit * item.size * 0.03;

				return (
					<div
						key={`${item.order}-${idx}`}
						style={{
							position: 'absolute',
							left: item.left,
							top: item.inkTop,
							width: Math.ceil(item.ink.inkR - item.ink.inkL) + 2,
							height: Math.ceil(inkH),
							// Clipped top and bottom only, so the rise is masked while the ink and the
							// blur still bleed sideways.
							clipPath: 'inset(-1px -45% 0px -45%)',
							opacity: fade * (1 - exit),
							willChange: 'transform, opacity',
						}}
					>
						<div
							style={{
								position: 'relative',
								transform: `translateY(${((1 - rise) * 100).toFixed(3)}%)`,
							}}
						>
							<div
								style={{
									position: 'absolute',
									left: 0,
									// The wrapper's top IS the ink top, so pull the line box up by however
									// far the ink sits below it.
									top: -(item.ink.baseline + item.ink.top),
									fontFamily: f.family,
									fontWeight: f.weight,
									fontSize: item.size,
									lineHeight: 1,
									letterSpacing: `${f.trackingEm}em`,
									color: f.color,
									whiteSpace: 'pre',
									textShadow: config.style.textShadow || undefined,
									filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
									WebkitFontSmoothing: 'antialiased',
									textRendering: 'geometricPrecision',
								}}
							>
								{item.text}
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
};

export default ChunkView;
