// src/graphs/PieChart/PieChart.tsx — Config-driven dynamic pie chart with dynamic angle calculation
import React from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { loadInter, loadOutfit } from "../../utils/localFonts";

const { fontFamily: interFontFamily } = loadInter();
const { fontFamily: outfitFontFamily } = loadOutfit();

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface SectorItem {
	id: string;
	name: string;
	percentage: number;
	color: string;
	drawRange?: [number, number];
	labelRange?: [number, number];
	lineRange?: [number, number];
	textRange?: [number, number];
}

export interface PieChartProps {
	composition: {
		width: number;
		height: number;
		fps: number;
		durationSeconds: number;
	};
	logo?: {
		show: boolean;
		url: string;
		height?: number;
	};
	theme: {
		backgroundColor: string;
		backgroundGradient: string;
		textColor: string;
		subtextColor: string;
		gridColor: string;
	};
	elements?: {
		showTitles?: boolean;
	};
	chart: {
		cx: number;
		cy: number;
		radius: number;
		gridWidth: number;
		gridHeight: number;
	};
	sectors: SectorItem[];
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export const PieChart: React.FC<PieChartProps> = (config) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const { cx, cy, radius, gridWidth: GRID_W, gridHeight: GRID_H } = config.chart;

	// ─── Dynamic Angle & Timing Computations ─────────────────────────────────
	let currentAngle = -90; // Start at top center of the circle
	const calculatedSectors = config.sectors.map((sector, i) => {
		const angleSpan = (sector.percentage / 100) * 360;
		const startAngle = currentAngle;
		const endAngle = currentAngle + angleSpan;
		const middleAngle = currentAngle + angleSpan / 2;
		currentAngle = endAngle;

		// Staggered timing for wedge and labels drawing based on index
		const startDraw = 10 + i * 8;
		const endDraw = startDraw + 22;

		return {
			...sector,
			startAngle,
			endAngle,
			middleAngle,
			drawRange: sector.drawRange || ([startDraw, endDraw] as [number, number]),
			labelRange: sector.labelRange || ([startDraw + 14, startDraw + 24] as [number, number]),
			lineRange: sector.lineRange || ([startDraw + 20, startDraw + 32] as [number, number]),
			textRange: sector.textRange || ([startDraw + 26, startDraw + 36] as [number, number]),
		};
	});

	// Split coordinates for dividers
	const boundaryAngles = calculatedSectors.slice(0, -1).map((s) => s.endAngle);

	// Coordinate calculator helpers
	const getCoord = (angleDeg: number, r: number) => {
		const angleRad = (angleDeg * Math.PI) / 180;
		return {
			x: cx + r * Math.cos(angleRad),
			y: cy + r * Math.sin(angleRad),
		};
	};

	const getWedgePath = (startAngle: number, endAngle: number, rValue: number) => {
		const start = getCoord(startAngle, rValue);
		const end = getCoord(endAngle, rValue);
		const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
		return `M ${cx} ${cy} L ${start.x} ${start.y} A ${rValue} ${rValue} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
	};

	// ─── Animation values ─────────────────────────────────────────────────────
	const backgroundOpacity = interpolate(frame, [0, 20], [0, 1], clamp);
	const cameraScale = 1 + Math.sin(frame / 60) * 0.003;
	const cameraRotX = Math.sin(frame / 70) * 0.12;
	const cameraRotY = Math.cos(frame / 80) * 0.1;

	// Grid and Dividers fade in timing
	const gridOpacity = interpolate(frame, [5, 25], [0, 0.85], clamp);
	
	// Final sector finishes drawing at ~ 10 + (sectors.length - 1) * 8 + 22 = 64
	const dividersOpacity = interpolate(frame, [60, 75], [0, 1], clamp);

	const logoOpacity = interpolate(frame, [10, 30], [0, 1], clamp);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				fontFamily: `${interFontFamily}, sans-serif`,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				opacity: backgroundOpacity,
			}}
		>
			{/* Radial gradients and grain overlays */}
			<div style={{ position: "absolute", inset: 0, background: config.theme.backgroundGradient }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

			{/* Centered grid background */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: GRID_W,
					height: GRID_H,
					opacity: gridOpacity,
					WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					pointerEvents: "none",
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: Math.round(GRID_W / 80) + 1 }).map((_, i) => (
						<line
							key={`v-${i}`}
							x1={i * 80}
							y1={0}
							x2={i * 80}
							y2={GRID_H}
							stroke={config.theme.gridColor}
							strokeWidth={1.5}
						/>
					))}
					{Array.from({ length: Math.round(GRID_H / 80) + 1 }).map((_, i) => (
						<line
							key={`h-${i}`}
							x1={0}
							y1={i * 80}
							x2={GRID_W}
							y2={i * 80}
							stroke={config.theme.gridColor}
							strokeWidth={1.5}
						/>
					))}
				</svg>
			</div>

			{/* ── Logo (top-left) ── Rendered outside of breathing camera container to remain perfectly static */}
			{config.logo?.show && config.logo?.url && (() => {
				const logoHeight = config.logo.height || 90;
				const padding = logoHeight * 0.2;
				return (
					<div
						style={{
							position: "absolute",
							top: 80,
							left: 80,
							width: "auto",
							height: logoHeight,
							paddingLeft: padding,
							paddingRight: padding,
							boxSizing: "border-box",
							opacity: logoOpacity,
							zIndex: 30,
							background: "rgba(255, 255, 255, 0.95)",
							backdropFilter: "blur(20px)",
							borderRadius: 24,
							border: "1px solid rgba(255, 255, 255, 0.6)",
							boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
							overflow: "hidden",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<img
							src={config.logo.url}
							alt="logo"
							style={{
								height: "60%",
								width: "auto",
								objectFit: "contain",
							}}
						/>
					</div>
				);
			})()}

			{/* Centered camera rotation container */}
			<div
				style={{
					width: config.composition.width,
					height: config.composition.height,
					position: "relative",
					transform: `scale(${cameraScale}) rotateX(${cameraRotX}deg) rotateY(${cameraRotY}deg)`,
					transformStyle: "preserve-3d",
					perspective: 1200,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{/* SVG Layer */}
				<svg
					width={config.composition.width}
					height={config.composition.height}
					viewBox={`0 0 ${config.composition.width} ${config.composition.height}`}
					style={{
						position: "absolute",
						overflow: "visible",
					}}
				>
					<defs>
						<filter id="pieShadow" x="-15%" y="-15%" width="130%" height="130%">
							<feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#1e1b18" floodOpacity="0.08" />
						</filter>
					</defs>

					{/* Sectors & Dividers Shadow Group */}
					<g filter="url(#pieShadow)">
						{/* 1. Dynamic Sectors drawing */}
						{calculatedSectors.map((sector) => {
							const drawVal = interpolate(frame, sector.drawRange, [0, 1], {
								...clamp,
								easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
							});
							
							const angleSpan = (sector.percentage / 100) * 360;
							const currentEndAngle = sector.startAngle + drawVal * angleSpan;

							if (drawVal <= 0.001) return null;

							return (
								<path
									key={sector.id}
									d={getWedgePath(sector.startAngle, currentEndAngle, radius)}
									fill={sector.color}
								/>
							);
						})}

						{/* 2. White sector dividers */}
						{dividersOpacity > 0.001 &&
							boundaryAngles.map((angle) => {
								const { x: xOuter, y: yOuter } = getCoord(angle, radius);

								return (
									<line
										key={`divider-${angle}`}
										x1={cx}
										y1={cy}
										x2={xOuter}
										y2={yOuter}
										stroke="#FFFFFF"
										strokeWidth="3.5"
										opacity={dividersOpacity}
									/>
								);
							})}
					</g>

					{/* 3. Pointer lines */}
					{calculatedSectors.map((sector) => {
						const lineProgress = interpolate(frame, sector.lineRange, [0, 1], clamp);
						if (lineProgress <= 0.001) return null;

						const { x: xStart, y: yStart } = getCoord(sector.middleAngle, radius + 5);
						const { x: xMid, y: yMid } = getCoord(sector.middleAngle, radius + 55);
						const isRight = Math.cos((sector.middleAngle * Math.PI) / 180) >= 0;
						const xEnd = isRight ? xMid + 40 : xMid - 40;
						const yEnd = yMid;

						const linePath = `M ${xStart} ${yStart} L ${xMid} ${yMid} L ${xEnd} ${yEnd}`;

						return (
							<path
								key={`line-${sector.id}`}
								d={linePath}
								fill="none"
								stroke={config.theme.subtextColor || "#475569"}
								strokeWidth="3.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								pathLength={100}
								strokeDasharray={100}
								strokeDashoffset={100 - lineProgress * 100}
							/>
						);
					})}
				</svg>

				{/* 4. Labels inside sectors */}
				{calculatedSectors.map((sector) => {
					const labelOpacity = interpolate(frame, sector.labelRange, [0, 1], clamp);
					const labelScale = spring({
						frame: frame - sector.labelRange[0],
						fps,
						config: { damping: 10, stiffness: 120, mass: 0.75 },
					});

					if (labelOpacity <= 0.001) return null;

					// Position inside the sector wedge (roughly 140px out from center)
					const { x, y } = getCoord(sector.middleAngle, 140);

					return (
						<div
							key={`inner-label-${sector.id}`}
							style={{
								position: "absolute",
								left: x,
								top: y,
								transform: `translate(-50%, -50%) scale(${labelScale})`,
								opacity: labelOpacity,
								fontFamily: `${outfitFontFamily}, sans-serif`,
								fontSize: 34,
								fontWeight: 900,
								color: "#FFFFFF",
								textShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
								pointerEvents: "none",
								zIndex: 20,
							}}
						>
							{sector.percentage}%
						</div>
					);
				})}

				{/* 5. Outer sector titles */}
				{config.elements?.showTitles !== false && calculatedSectors.map((sector) => {
					const textOpacity = interpolate(frame, sector.textRange, [0, 1], clamp);
					if (textOpacity <= 0.001) return null;

					const { x: xMid, y: yMid } = getCoord(sector.middleAngle, radius + 55);
					const isRight = Math.cos((sector.middleAngle * Math.PI) / 180) >= 0;
					const xEnd = isRight ? xMid + 40 : xMid - 40;
					const yEnd = yMid;

					return (
						<div
							key={`ref-${sector.id}`}
							style={{
								position: "absolute",
								left: xEnd,
								top: yEnd,
								transform: `translate(${isRight ? "12px" : "-100%"}, -50%)`,
								marginLeft: isRight ? 0 : -12,
								opacity: textOpacity,
								pointerEvents: "none",
								display: "flex",
								flexDirection: "column",
								alignItems: isRight ? "flex-start" : "flex-end",
								textAlign: isRight ? "left" : "right",
								zIndex: 30,
								whiteSpace: "nowrap",
							}}
						>
							<span
								style={{
									fontFamily: `${outfitFontFamily}, sans-serif`,
									fontSize: 26,
									fontWeight: 800,
									color: config.theme.textColor,
									lineHeight: 1,
								}}
							>
								{sector.name}
							</span>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

export default PieChart;
