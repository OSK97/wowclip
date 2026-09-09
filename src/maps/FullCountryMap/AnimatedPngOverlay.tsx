import React from "react";
import { interpolate, spring } from "remotion";

interface AnimatedPngOverlayProps {
	steps: any[];
	activeStepIdx: number;
	frame: number;
	fps: number;
	countryBounds: { minX: number; minY: number; maxX: number; maxY: number; pathDatas: string[] } | null;
	imageMap: Record<string, any>;
	viewBox: { x: number; y: number; w: number; h: number };
}

export const AnimatedPngOverlay: React.FC<AnimatedPngOverlayProps> = ({
	steps,
	activeStepIdx,
	frame,
	fps,
	countryBounds,
	imageMap,
	viewBox,
}) => {
	if (!countryBounds) return null;

	const { minX, minY, maxX, maxY, pathDatas } = countryBounds;
	const w = maxX - minX;
	const h = maxY - minY;

	// Extract all unique PNGs across all steps
	const uniquePngs: { id: string; image: string }[] = [];
	steps.forEach((s) => {
		if (s.mode === "png" && s.pngs && s.pngs.length > 0) {
			const p = s.pngs[0]; // Single PNG per step
			const uid = p.id || p.image;
			if (!uniquePngs.find((u) => u.id === uid)) {
				uniquePngs.push({ id: uid, image: p.image });
			}
		}
	});

	const getLayout = (stepIdx: number, pngId: string) => {
		if (stepIdx < 0 || stepIdx >= steps.length) return null;
		const step = steps[stepIdx];
		if (step.mode !== "png" || !step.pngs) return null;

		const pIdx = step.pngs.findIndex((p: any) => (p.id || p.image) === pngId);
		if (pIdx === -1) return null;

		const pngConfig = step.pngs[pIdx];
		const pImg = imageMap[pngConfig.image];
		if (!pImg) return null;

		const scale = pngConfig.scale ?? 0.85;
		const bWidth = w * scale;
		const bHeight = bWidth / pImg.aspectRatio;

		const offsetX = pngConfig.offsetX ?? 0;
		const offsetY = pngConfig.offsetY ?? 0;

		const bX = minX + w / 2 - bWidth / 2 + offsetX;
		const bY = maxY - bHeight + 10 + offsetY;

		return { bX, bY, bWidth, bHeight };
	};

	return (
		<svg
			viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
			preserveAspectRatio="xMidYMid meet"
			style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
		>
			<defs>
				<clipPath id="full-country-path-clip">
					{pathDatas.map((d: string, i: number) => (
						<path key={i} d={d} />
					))}
				</clipPath>
			</defs>
			{uniquePngs.map((pngObj, idx) => {
				let pngStepIdx = -1;
				for (let i = 0; i < steps.length; i++) {
					const l = getLayout(i, pngObj.id);
					if (l) {
						pngStepIdx = i;
						break;
					}
				}

				if (pngStepIdx === -1) return null;
				const pngStep = steps[pngStepIdx];
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
				const slideStart = layout.bY + 250;
				const finalY = interpolate(progress, [0, 1], [slideStart, layout.bY]) as number;
				const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) as number;

				if (opacity <= 0) return null;

				// Cutoff at 45% of image height (below chin/collar) so entire face & head pop out without facial cuts
				const cutOffY = finalY + finalH * 0.45;
				const popRectTop = finalY - 500;
				const popRectHeight = Math.max(0, cutOffY - popRectTop);
				const popoutClipId = `full-country-popout-${idx}`;

				const pImg = imageMap[pngObj.image];
				if (!pImg) return null;

				return (
					<g key={`${pngObj.id}-${idx}`} style={{ opacity }}>
						<defs>
							<clipPath id={popoutClipId}>
								<rect x={finalX - 500} y={popRectTop} width={finalW + 1000} height={popRectHeight} />
							</clipPath>
						</defs>
						{/* Body masked strictly inside India silhouette */}
						<g clipPath="url(#full-country-path-clip)">
							<image
								href={pImg.url}
								x={finalX}
								y={finalY}
								width={finalW}
								height={finalH}
								preserveAspectRatio="xMidYMax slice"
							/>
						</g>
						{/* Head popping out over Northern Kashmir tip */}
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
