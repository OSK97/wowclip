import React, { useMemo } from 'react';
import { useVideoConfig } from 'remotion';
import { AdaptiveCaptionsProps } from './types';
import { buildAdaptiveChunks } from './layoutEngine';
import { BottomCaption } from './BottomCaption';
import { EmptySpaceCaption } from './EmptySpaceCaption';
import { AnchorStackGroupView, resolveAnchorStackConfig } from '../AnchorStack/AnchorStack';

export const AdaptiveCaptions: React.FC<AdaptiveCaptionsProps> = ({
	frame,
	screenW,
	screenH,
	mediaScale = 1.18,
	mediaOffsetY = 0,
	videoAspect = 1280 / 720,
	creativeRatio = 0.40,
	showDebugSlot = false,
	cursiveFont = 'GaramondNovaPro, serif',
	boldFont = 'Poppins, sans-serif',
	primaryColor = '#FFFFFF',
	blackoutRanges = [],
}) => {
	const { fps } = useVideoConfig();

	const chunks = useMemo(() => {
		return buildAdaptiveChunks({
			fps,
			screenW,
			screenH,
			mediaScale,
			mediaOffsetY,
			videoAspect,
			creativeRatio,
		});
	}, [fps, screenW, screenH, mediaScale, mediaOffsetY, videoAspect, creativeRatio]);

	const activeChunk = chunks.find(
		(ch) => frame >= ch.startFrame && frame <= ch.endFrame,
	);

	const anchorConfig = useMemo(() => {
		if (!activeChunk || activeChunk.placement !== 'empty-anchor') return null;
		
		const words = activeChunk.words.map(w => w.punctuated.toLowerCase());
		const heroIdx = words.reduce((best, w, i) => w.length >= words[best].length ? i : best, 0);
		
		const before = words.slice(0, heroIdx).join(' ');
		const hero = words[heroIdx];
		const after = words.slice(heroIdx + 1).join(' ');

		const lines: any[] = [];
		if (before) lines.push({ text: before, role: 'mid' });
		lines.push({ text: hero, role: 'hero' });
		if (after) lines.push({ text: after, role: 'soft' });
		
		const slotWidth = activeChunk.slot?.width || screenW;
		const baseHeroSize = Math.max(160, activeChunk.fontSize * 1.8);
		
		return resolveAnchorStackConfig({
			groups: [{
				at: activeChunk.startFrame,
				hold: activeChunk.endFrame - activeChunk.startFrame,
				lines: lines as any,
			}],
			theme: { textColor: primaryColor, backdropDim: 0 },
			layout: {
				heroFontSize: Math.round(baseHeroSize * (1080 / slotWidth)),
				overhang: 1.2, // massively increase overhang so long words can fit in open-ended hollows
				sideClear: 0.15, // allow it to sit very tight against the ascender (e.g. 'k')
				midRatio: words.join(' ').includes('around your family') ? 1.3 : 0.70, // visually balanced for Garamond cursive which is naturally tiny
				softRatio: 0.65,
			},
			timing: { reveal: 11, stagger: 3, out: 7 }
		});
	}, [activeChunk, primaryColor]);

	if (!activeChunk) {
		return null;
	}

	const isBlackout = blackoutRanges.some(
		(range) => frame >= range[0] && frame <= range[1]
	);
	if (isBlackout) {
		return null;
	}

	// Determine which renderer to use
	const useAnchor = activeChunk.placement === 'empty-anchor' && anchorConfig;
	const useEmptySpace = activeChunk.placement === 'empty-right' || activeChunk.placement === 'empty-left';

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: screenW,
				height: screenH,
				pointerEvents: 'none',
				zIndex: 35,
				overflow: 'hidden',
			}}
		>
			{useAnchor ? (
				<div
					style={{
						position: 'absolute',
						left: activeChunk.slot?.x || 0,
						top: activeChunk.slot?.y || 0,
						width: activeChunk.slot?.width || screenW,
						height: activeChunk.slot?.maxHeight || screenH,
						pointerEvents: 'none',
					}}
				>
					<AnchorStackGroupView
						group={anchorConfig.groups[0]}
						config={anchorConfig}
						width={activeChunk.slot?.width || screenW}
						height={activeChunk.slot?.maxHeight || screenH}
						fallback={
							<BottomCaption
								chunk={activeChunk}
								frame={frame}
								fps={fps}
								screenW={screenW}
								screenH={screenH}
								boldFont={boldFont}
								primaryColor={primaryColor}
							/>
						}
					/>
				</div>
			) : useEmptySpace ? (
				<EmptySpaceCaption
					chunk={activeChunk}
					frame={frame}
					cursiveFont={cursiveFont}
					boldFont={boldFont}
					primaryColor={primaryColor}
					showDebugSlot={showDebugSlot}
				/>
			) : (
				<BottomCaption
					chunk={activeChunk}
					frame={frame}
					fps={fps}
					screenW={screenW}
					screenH={screenH}
					boldFont={boldFont}
					primaryColor={primaryColor}
				/>
			)}
		</div>
	);
};

export default AdaptiveCaptions;
