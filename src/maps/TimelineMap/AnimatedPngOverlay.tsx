import React from 'react';
import { interpolate, spring } from 'remotion';

interface AnimatedPngOverlayProps {
	timeline: any[];
	activeEventIdx: number;
	activeStepIdx: number;
	frame: number;
	fps: number;
	statesBounds: any[];
	imageMap: Record<string, any>;
	viewBox: { x: number, y: number, w: number, h: number };
}

export const AnimatedPngOverlay: React.FC<AnimatedPngOverlayProps> = ({
	timeline,
	activeEventIdx,
	activeStepIdx,
	frame,
	fps,
	statesBounds,
	imageMap,
	viewBox,
}) => {
	// Flatten the timeline into a single array of steps
	const allSteps = timeline.flatMap((ev, eIdx) => 
		ev.steps.map((step: any, sIdx: number) => ({
			...step,
			eventIdx: eIdx,
			stepIdx: sIdx,
			stateId: ev.stateId,
			startFrame: step.startFrame,
		}))
	);

	// Find the flat index of the currently active step
	let flatActiveStepIdx = -1;
	for (let i = 0; i < allSteps.length; i++) {
		if (allSteps[i].eventIdx === activeEventIdx && allSteps[i].stepIdx === activeStepIdx) {
			flatActiveStepIdx = i;
			break;
		}
	}

	// Extract all unique PNGs across all steps (by id if provided, else image)
	const uniquePngs: {id: string, image: string}[] = [];
	allSteps.forEach(s => {
		if (s.mode === "png" && s.pngs) {
			s.pngs.forEach((p: any) => {
				const uid = p.id || p.image;
				if (!uniquePngs.find(u => u.id === uid)) {
					uniquePngs.push({ id: uid, image: p.image });
				}
			});
		}
	});

	// Helper to calculate target layout for a PNG in a specific flat step
	const getLayout = (flatStepIdx: number, pngId: string) => {
		if (flatStepIdx < 0 || flatStepIdx >= allSteps.length) return null;
		const step = allSteps[flatStepIdx];
		if (step.mode !== "png" || !step.pngs) return null;
		
		const pIdx = step.pngs.findIndex((p: any) => (p.id || p.image) === pngId);
		if (pIdx === -1) return null;

		const pngConfig = step.pngs[pIdx];
		const pImg = imageMap[pngConfig.image];
		if (!pImg) return null;

		const stateBound = statesBounds.find(s => s.id === step.stateId);
		if (!stateBound) return null;

		const { minX, minY, maxX, maxY } = stateBound;
		const w = maxX - minX;
		const h = maxY - minY;

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

		return { bX, bY, bWidth, bHeight, stateId: step.stateId, stateBound };
	};

	return (
		<svg
			viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
			preserveAspectRatio="xMidYMid meet"
			style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
		>
			<defs>
				{statesBounds.map(s => (
					<clipPath key={s.id} id={`local-state-clip-${s.id}`}>
						{s.pathDatas.map((d: string, i: number) => (
							<path key={i} d={d} />
						))}
					</clipPath>
				))}
			</defs>
			{uniquePngs.map((pngObj, idx) => {
				// Find the first flat step where this PNG was configured
				let pngStepIdx = -1;
				for (let i = 0; i < allSteps.length; i++) {
					const l = getLayout(i, pngObj.id);
					if (l) {
						pngStepIdx = i;
						break;
					}
				}

				if (pngStepIdx === -1) return null;
				const pngStep = allSteps[pngStepIdx];
				const layout = getLayout(pngStepIdx, pngObj.id);
				if (!layout) return null;

				const stepStartFrame = pngStep.startFrame ?? 0;
				if (frame < stepStartFrame) return null;

				const localFrame = frame - stepStartFrame;
				const progress = spring({
					frame: localFrame,
					fps,
					config: { damping: 18, stiffness: 90, mass: 1.0 },
				});

				const finalX = layout.bX;
				const finalW = layout.bWidth;
				const finalH = layout.bHeight;
				const slideStart = layout.bY + 200;
				const finalY = interpolate(progress, [0, 1], [slideStart, layout.bY]) as number;
				const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) as number;

				if (opacity <= 0) return null;

				const stateId = layout.stateId;
				const { minY, maxY } = layout.stateBound;
				const h = maxY - minY;

				// Top 40% of state pops out above, rest is masked inside state
				const cutOffY = minY + h * 0.4;
				const popRectTop = finalY - 500;
				const popRectHeight = Math.max(0, cutOffY - popRectTop);
				const popoutClipId = `dynamic-popout-${idx}`;
				const stateClipId = `local-state-clip-${stateId}`;

				const pImg = imageMap[pngObj.image];
				if (!pImg) return null;

				return (
					<g key={`${pngObj.id}-${idx}`} style={{ opacity }}>
						<defs>
							<clipPath id={popoutClipId}>
								<rect x={finalX - 500} y={popRectTop} width={finalW + 1000} height={popRectHeight} />
							</clipPath>
						</defs>
						{/* Inside State Mask (Body & arms strictly clipped to state shape) */}
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
						{/* 3D Popout (Head portion pops out above top boundary) */}
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
