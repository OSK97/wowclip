import React from 'react';
import trackingData from './person_tracking.json';

export interface PersonDetectionOverlayProps {
	frame: number;
	screenW: number;
	screenH: number;
	mediaScale?: number;
	mediaOffsetY?: number;
	videoAspect?: number;
	showMask?: boolean;
	showSilhouetteContour?: boolean;
	showHeadChestZones?: boolean;
	showEmptyZones?: boolean;
}

export const PersonDetectionOverlay: React.FC<PersonDetectionOverlayProps> = ({
	frame,
	screenW,
	screenH,
	mediaScale = 1.18,
	mediaOffsetY = 0,
	videoAspect = 1280 / 720,
	showMask = true,
	showSilhouetteContour = true,
	showHeadChestZones = true,
	showEmptyZones = true,
}) => {
	const allFrames = (trackingData as any).tracking;
	const clampedFrame = Math.max(0, Math.min(frame, allFrames.length - 1));
	const current = allFrames[clampedFrame] || allFrames[0];

	if (!current) return null;

	// Calculate objectFit: 'cover' placement of 16:9 video inside the CRT container
	const containerAspect = screenW / screenH;
	let renderedW = screenW;
	let renderedH = screenH;
	let offsetX = 0;
	let offsetY = 0;

	if (videoAspect > containerAspect) {
		// Fits height, crops width equally on left and right
		renderedH = screenH;
		renderedW = screenH * videoAspect;
		offsetX = (screenW - renderedW) / 2;
		offsetY = 0;
	} else {
		// Fits width, crops height
		renderedW = screenW;
		renderedH = screenW / videoAspect;
		offsetX = 0;
		offsetY = (screenH - renderedH) / 2;
	}

	// Center of CRT
	const cx = screenW / 2;
	const cy = screenH / 2;

	// Transform normalized (0-1) coordinates to CRT canvas with media scale & offset
	const mapPoint = (normX: number, normY: number): [number, number] => {
		const rawX = offsetX + normX * renderedW;
		const rawY = offsetY + normY * renderedH;
		const px = Math.round(cx + (rawX - cx) * mediaScale);
		const py = Math.round(cy + (rawY - cy) * mediaScale + mediaOffsetY);
		return [px, py];
	};

	const mapBox = (b?: { x: number; y: number; w: number; h: number }) => {
		if (!b) return { x: 0, y: 0, w: 0, h: 0 };
		const [x1, y1] = mapPoint(b.x, b.y);
		const [x2, y2] = mapPoint(b.x + b.w, b.y + b.h);
		return {
			x: x1,
			y: y1,
			w: Math.max(10, x2 - x1),
			h: Math.max(10, y2 - y1),
		};
	};

	const headBox = mapBox(current.head || current.box);
	const chestBox = mapBox(current.chest || current.box);

	// Map contour points to CRT canvas
	const contourPts: [number, number][] = (current.contour || []).map(
		([nx, ny]: [number, number]) => mapPoint(nx, ny),
	);

	const svgPathD =
		contourPts.length > 0
			? `M ${contourPts[0][0]} ${contourPts[0][1]} ` +
			  contourPts
					.slice(1)
					.map(([px, py]) => `L ${px} ${py}`)
					.join(' ') +
			  ' Z'
			: '';

	// Upper empty zones (beside head / face)
	const leftHeadEmptyW = Math.max(0, headBox.x - 16);
	const rightHeadEmptyX = headBox.x + headBox.w + 16;
	const rightHeadEmptyW = Math.max(0, screenW - rightHeadEmptyX - 16);

	// Lower empty zones (beside chest / shoulders)
	const leftChestEmptyW = Math.max(0, chestBox.x - 16);
	const rightChestEmptyX = chestBox.x + chestBox.w + 16;
	const rightChestEmptyW = Math.max(0, screenW - rightChestEmptyX - 16);

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: screenW,
				height: screenH,
				pointerEvents: 'none',
				zIndex: 40,
			}}
		>
			{/* 1. Exact SVG Silhouette Red Mask on person (Head, Neck, Chest, Shoulders) */}
			<svg
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: screenW,
					height: screenH,
					overflow: 'visible',
					pointerEvents: 'none',
				}}
			>
				<defs>
					<filter id="silhouette-glow" x="-20%" y="-20%" width="140%" height="140%">
						<feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ff1111" floodOpacity="0.8" />
					</filter>
				</defs>

				{showMask && svgPathD && (
					<path
						d={svgPathD}
						fill="rgba(255, 30, 30, 0.38)"
						stroke={showSilhouetteContour ? '#ff2a2a' : 'none'}
						strokeWidth="2.5"
						filter="url(#silhouette-glow)"
					/>
				)}
			</svg>

			{/* 2. Head & Chest Anatomical Zones */}
			{showHeadChestZones && (
				<>
					{/* Tight Head & Face Zone */}
					<div
						style={{
							position: 'absolute',
							left: headBox.x,
							top: headBox.y,
							width: headBox.w,
							height: headBox.h,
							border: '2px solid rgba(255, 60, 60, 0.95)',
							borderRadius: 6,
							boxShadow: '0 0 12px rgba(255, 40, 40, 0.45)',
						}}
					>
						<div
							style={{
								position: 'absolute',
								top: -22,
								left: 0,
								background: '#ff2222',
								color: '#ffffff',
								fontFamily: 'monospace',
								fontSize: 10,
								fontWeight: 900,
								padding: '1px 6px',
								borderRadius: 3,
								letterSpacing: '0.04em',
								whiteSpace: 'nowrap',
							}}
						>
							HEAD & FACE (OCCUPIED)
						</div>
					</div>

					{/* Chest & Torso Zone */}
					<div
						style={{
							position: 'absolute',
							left: chestBox.x,
							top: chestBox.y,
							width: chestBox.w,
							height: chestBox.h,
							border: '2px dashed rgba(255, 80, 80, 0.8)',
							borderRadius: 6,
						}}
					>
						<div
							style={{
								position: 'absolute',
								bottom: -20,
								left: 0,
								background: 'rgba(255, 34, 34, 0.9)',
								color: '#ffffff',
								fontFamily: 'monospace',
								fontSize: 10,
								fontWeight: 800,
								padding: '1px 6px',
								borderRadius: 3,
								letterSpacing: '0.04em',
								whiteSpace: 'nowrap',
							}}
						>
							CHEST / SUIT (OCCUPIED)
						</div>
					</div>
				</>
			)}

			{/* 3. Empty Safe Zones (Specifically showing empty space BESIDE FACE & CHEST) */}
			{showEmptyZones && (
				<>
					{/* Space to Left of Head */}
					{leftHeadEmptyW > 40 && (
						<div
							style={{
								position: 'absolute',
								left: 16,
								top: headBox.y,
								width: leftHeadEmptyW,
								height: headBox.h,
								border: '2px dashed rgba(34, 197, 94, 0.85)',
								backgroundColor: 'rgba(34, 197, 94, 0.12)',
								borderRadius: 6,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								padding: 4,
								boxSizing: 'border-box',
							}}
						>
							<span
								style={{
									color: '#4ade80',
									fontFamily: 'monospace',
									fontSize: 10,
									fontWeight: 800,
									textAlign: 'center',
									lineHeight: 1.2,
									textShadow: '0 1px 4px #000',
								}}
							>
								SAFE ZONE
								<br />
								[BESIDE FACE]
							</span>
						</div>
					)}

					{/* Space to Right of Head */}
					{rightHeadEmptyW > 40 && (
						<div
							style={{
								position: 'absolute',
								left: rightHeadEmptyX,
								top: headBox.y,
								width: rightHeadEmptyW,
								height: headBox.h,
								border: '2px dashed rgba(34, 197, 94, 0.85)',
								backgroundColor: 'rgba(34, 197, 94, 0.12)',
								borderRadius: 6,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								padding: 4,
								boxSizing: 'border-box',
							}}
						>
							<span
								style={{
									color: '#4ade80',
									fontFamily: 'monospace',
									fontSize: 10,
									fontWeight: 800,
									textAlign: 'center',
									lineHeight: 1.2,
									textShadow: '0 1px 4px #000',
								}}
							>
								SAFE ZONE
								<br />
								[BESIDE FACE]
							</span>
						</div>
					)}

					{/* Space to Left of Chest */}
					{leftChestEmptyW > 40 && (
						<div
							style={{
								position: 'absolute',
								left: 16,
								top: chestBox.y,
								width: leftChestEmptyW,
								height: Math.round(chestBox.h * 0.7),
								border: '1.5px dashed rgba(34, 197, 94, 0.55)',
								backgroundColor: 'rgba(34, 197, 94, 0.07)',
								borderRadius: 6,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								padding: 4,
								boxSizing: 'border-box',
							}}
						>
							<span
								style={{
									color: '#4ade80',
									fontFamily: 'monospace',
									fontSize: 9,
									fontWeight: 700,
									textAlign: 'center',
								}}
							>
								EMPTY SPACE
							</span>
						</div>
					)}

					{/* Space to Right of Chest */}
					{rightChestEmptyW > 40 && (
						<div
							style={{
								position: 'absolute',
								left: rightChestEmptyX,
								top: chestBox.y,
								width: rightChestEmptyW,
								height: Math.round(chestBox.h * 0.7),
								border: '1.5px dashed rgba(34, 197, 94, 0.55)',
								backgroundColor: 'rgba(34, 197, 94, 0.07)',
								borderRadius: 6,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								padding: 4,
								boxSizing: 'border-box',
							}}
						>
							<span
								style={{
									color: '#4ade80',
									fontFamily: 'monospace',
									fontSize: 9,
									fontWeight: 700,
									textAlign: 'center',
								}}
							>
								EMPTY SPACE
							</span>
						</div>
					)}
				</>
			)}
		</div>
	);
};

export default PersonDetectionOverlay;
