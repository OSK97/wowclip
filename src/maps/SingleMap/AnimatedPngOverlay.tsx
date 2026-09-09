import React from 'react';
import { interpolate, spring } from 'remotion';

interface AnimatedPngOverlayProps {
	steps: any[];
	activeStepIdx: number;
	frame: number;
	fps: number;
	statesBounds: any[];
	stateId: string;
	imageMap: Record<string, any>;
	viewBox: { x: number, y: number, w: number, h: number };
}

export const AnimatedPngOverlay: React.FC<AnimatedPngOverlayProps> = ({
	steps,
	activeStepIdx,
	frame,
	fps,
	statesBounds,
	stateId,
	imageMap,
	viewBox,
}) => {
	const stateBound = statesBounds.find(s => s.id === stateId);
	if (!stateBound) return null;

	const { minX, minY, maxX, maxY } = stateBound;
	const w = maxX - minX;
	const h = maxY - minY;

	// Extract all unique PNGs across all steps (strictly 1 PNG max per step)
	const uniquePngs: {id: string, image: string}[] = [];
	steps.forEach(s => {
		if (s.mode === "png" && s.pngs && s.pngs.length > 0) {
			const p = s.pngs[0]; // Enforce single PNG at a time
			const uid = p.id || p.image;
			if (!uniquePngs.find(u => u.id === uid)) {
				uniquePngs.push({ id: uid, image: p.image });
			}
		}
	});

	// Helper to calculate target layout for a PNG in a specific step
	const getLayout = (stepIdx: number, pngId: string) => {
		if (stepIdx < 0 || stepIdx >= steps.length) return null;
		const step = steps[stepIdx];
		if (step.mode !== "png" || !step.pngs) return null;
		
		const pIdx = step.pngs.findIndex((p: any) => (p.id || p.image) === pngId);
		if (pIdx === -1) return null;

		const pngConfig = step.pngs[pIdx];
		const imgUrl = pngConfig.image;
		const pImg = imageMap[imgUrl];
		if (!pImg) return null;

		const N = step.pngs.length;
		const overlapFactor = 0.7; // 30% overlap

		// 1. Calculate default scale so they fit in 90% of state width
		const defaultScale = Math.min(0.85, 0.9 / (1 + overlapFactor * (N - 1)));

		// 2. Pre-calculate widths for all PNGs in this step
		const widths = step.pngs.map((p: any) => {
			const sc = p.scale ?? defaultScale;
			return w * sc;
		});

		// 3. Calculate center points relative to the first image
		const centers: number[] = [0];
		let currentX = 0;
		for (let i = 1; i < N; i++) {
			const spacing = ((widths[i-1] + widths[i]) / 2) * overlapFactor;
			currentX += spacing;
			centers.push(currentX);
		}

		// 4. Calculate offset to center the entire group
		const groupMidpoint = centers[N - 1] / 2;
		const autoOffsetX = centers[pIdx] - groupMidpoint;

		const scale = pngConfig.scale ?? defaultScale;
		const bWidth = widths[pIdx];
		const bHeight = bWidth / pImg.aspectRatio;

		const offsetX = (pngConfig.offsetX ?? 0) + autoOffsetX;
		const offsetY = pngConfig.offsetY ?? 0;

		const bX = minX + w / 2 - bWidth / 2 + offsetX;
		const bY = maxY - bHeight + 5 + offsetY;

		return { bX, bY, bWidth, bHeight };
	};

	return (
		<svg
			viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
			preserveAspectRatio="xMidYMid meet"
			style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
		>
			<defs>
				<clipPath id={`local-state-clip-${stateId}`}>
					{stateBound.pathDatas.map((d: string, i: number) => (
						<path key={i} d={d} />
					))}
				</clipPath>
			</defs>
			{uniquePngs.map((pngObj, idx) => {
				const imgUrl = pngObj.image;
				const currentLayout = getLayout(activeStepIdx, pngObj.id);
				
				// Find the previous known layout if it existed before the current step
				let prevLayout = null;
				let prevStepIdx = -1;
				for (let i = activeStepIdx - 1; i >= 0; i--) {
					const l = getLayout(i, pngObj.id);
					if (l) {
						prevLayout = l;
						prevStepIdx = i;
						break;
					}
				}

				// If it's not in the current step AND not in the previous step, hide it
				if (!currentLayout && !prevLayout) return null;

				const activeStepStartFrame = steps[activeStepIdx]?.startFrame ?? 0;
				const localFrame = frame - activeStepStartFrame;

				// Animation Progress (0 to 1) when transitioning into the current step
				const progress = spring({
					frame: localFrame,
					fps,
					config: { damping: 16, stiffness: 140 },
				});

				let finalX = 0;
				let finalY = 0;
				let finalW = 0;
				let finalH = 0;
				let opacity = 1;

				if (currentLayout && prevLayout) {
					// Slide between previous and current layout smoothly
					finalX = interpolate(progress, [0, 1], [prevLayout.bX, currentLayout.bX]) as number;
					finalY = interpolate(progress, [0, 1], [prevLayout.bY, currentLayout.bY]) as number;
					finalW = interpolate(progress, [0, 1], [prevLayout.bWidth, currentLayout.bWidth]) as number;
					finalH = interpolate(progress, [0, 1], [prevLayout.bHeight, currentLayout.bHeight]) as number;
				} else if (currentLayout && !prevLayout) {
					// Newly appearing: slide up from bottom
					finalX = currentLayout.bX;
					finalW = currentLayout.bWidth;
					finalH = currentLayout.bHeight;
					const slideStart = currentLayout.bY + 300;
					finalY = interpolate(progress, [0, 1], [slideStart, currentLayout.bY]) as number;
					opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) as number;
				} else if (!currentLayout && prevLayout) {
					// Disappearing: fade out and slide down
					finalX = prevLayout.bX;
					finalW = prevLayout.bWidth;
					finalH = prevLayout.bHeight;
					const slideEnd = prevLayout.bY + 300;
					finalY = interpolate(progress, [0, 1], [prevLayout.bY, slideEnd]) as number;
					opacity = interpolate(progress, [0, 0.5], [1, 0], { extrapolateRight: "clamp" }) as number;
				}

				// Only render if opacity > 0
				if (opacity <= 0) return null;

				const cutOffY = minY + h * 0.24;
				const popRectTop = finalY - 500;
				const popRectHeight = Math.max(0, cutOffY - popRectTop);
				const popoutClipId = `dynamic-popout-${idx}`;
				const stateClipId = `local-state-clip-${stateId}`;

				const pImg = imageMap[imgUrl];
				if (!pImg) return null;

				return (
					<g key={pngObj.id} style={{ opacity }}>
						<defs>
							<clipPath id={popoutClipId}>
								<rect x={finalX - 500} y={popRectTop} width={finalW + 1000} height={popRectHeight} />
							</clipPath>
						</defs>
						{/* Inside State Mask */}
						<g clipPath={`url(#${stateClipId})`}>
							<image
								href={pImg.url}
								x={finalX}
								y={finalY}
								width={finalW}
								height={finalH}
								preserveAspectRatio="xMidYMax slice"
							/>
						</g>
						{/* Popout (Above State Mask) */}
						<g clipPath={`url(#${popoutClipId})`}>
							<image
								href={pImg.url}
								x={finalX}
								y={finalY}
								width={finalW}
								height={finalH}
								preserveAspectRatio="xMidYMax slice"
							/>
						</g>
					</g>
				);
			})}
		</svg>
	);
};
