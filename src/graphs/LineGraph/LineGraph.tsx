// src/graphs/LineGraph/LineGraph.tsx — Config-driven, highly responsive line graph for portrait layouts
import React from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	useCurrentFrame,
} from "remotion";
import { loadInter, loadOutfit } from "../../utils/localFonts";

const { fontFamily: interFontFamily } = loadInter();
const { fontFamily: outfitFontFamily } = loadOutfit();

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface LegendItem {
	label: string;
	color: string;
	colorGradient: string[];
	dotSize: number;
}

export interface Keyframe {
	frame: number;
	progress: number;
}

export interface SeriesItem {
	name: string;
	values: number[];
	color: string;
	strokeGradient: string[];
	areaColor: string;
	shadowColor: string;
	drawRange?: number[];
	keyframes?: Keyframe[];
}

export interface YLabelItem {
	value: number;
	label: string;
}

export interface LineGraphProps {
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
		fontPrimary: string;
		fontDisplay: string;
	};
	legend: {
		position: string;
		layout: string;
		items: LegendItem[];
		fontSize: number;
		fontWeight: number;
		gap: number;
		marginTop: number;
		marginRight: number;
	};
	bottomHeading: {
		show: boolean;
		text: string;
		fontSize: number;
		fontWeight: number;
		letterSpacing: number;
		lineHeight: number;
		marginBottom: number;
	};
	indicator: {
		show: boolean;
		fontSize: number;
		fontWeight: number;
		suffix: string;
		color: string;
		opacity: number;
		position: string;
		marginBottom: number;
		marginLeft: number;
	};
	graph: {
		marginX: number;
		marginY: number;
		gridWidth: number;
		gridHeight: number;
		positionY: string;
		strokeWidth: number;
		dotRadius: number;
		dotPulseRadius: number;
		showArea: boolean;
		areaOpacityStart: number;
		areaOpacityEnd: number;
		showTooltip: boolean;
		showGridLines: boolean;
		gridLineWidth: number;
	};
	data: {
		series: SeriesItem[];
		maxValue: number;
		timeline: string[];
		yLabels: YLabelItem[];
	};
	animation: {
		gridFadeIn: number[];
		legendFadeIn: number[];
		drawLineRange: number[];
		drawLineEasing: string;
		bottomTextFadeIn: number[];
		indicatorFadeIn: number[];
		dotAppearFrame: number;
		tooltipAppearFrame: number;
		labelsFadeIn: number[];
		breathingAmplitude: number;
		breathingSpeed: number;
	};
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export const LineGraph: React.FC<LineGraphProps> = (config) => {
	const frame = useCurrentFrame();
	const anim = config.animation;

	// ─── Layout Constants ──────────────────────────────────────────────────────
	const GRID_W = config.graph.gridWidth;
	const GRID_H = config.graph.gridHeight;
	const MARGIN_X = config.graph.marginX;
	const MARGIN_Y = config.graph.marginY;
	const GRAPH_W = GRID_W - 2 * MARGIN_X;
	const GRAPH_H = GRID_H - 2 * MARGIN_Y;
	const MAX_VAL = config.data.maxValue;

	// ─── Helpers ────────────────────────────────────────────────────────────────
	const normalise = (values: number[]) => values.map((v) => (v / MAX_VAL) * 100);

	const valToX = (index: number, total: number) => {
		const pct = index / (total - 1);
		return MARGIN_X + pct * GRAPH_W;
	};

	const valToY = (val: number) => GRID_H - MARGIN_Y - (val / 100) * GRAPH_H;

	const getCurvePath = (points: number[]) => {
		let path = `M ${valToX(0, points.length)} ${valToY(points[0])}`;
		const segW = GRAPH_W / (points.length - 1);
		for (let i = 0; i < points.length - 1; i++) {
			const x0 = valToX(i, points.length);
			const y0 = valToY(points[i]);
			const x1 = valToX(i + 1, points.length);
			const y1 = valToY(points[i + 1]);
			path += ` C ${x0 + segW / 2} ${y0}, ${x0 + segW / 2} ${y1}, ${x1} ${y1}`;
		}
		return path;
	};

	const getAreaPath = (points: number[]) => {
		const curve = getCurvePath(points);
		const lastX = valToX(points.length - 1, points.length);
		const firstX = valToX(0, points.length);
		const baseY = GRID_H - MARGIN_Y;
		return `${curve} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
	};

	const getGraphY = (x: number, points: number[]) => {
		const relX = Math.max(0, Math.min(GRAPH_W, x - MARGIN_X));
		const segW = GRAPH_W / (points.length - 1);
		const idx = Math.min(Math.floor(relX / segW), points.length - 2);
		const t = (relX - idx * segW) / segW;
		const y0 = valToY(points[idx]);
		const y1 = valToY(points[idx + 1]);
		const mu = 3 * t * t - 2 * t * t * t;
		return y0 * (1 - mu) + y1 * mu;
	};

	const getInterpolatedValue = (progress: number, data: number[]) => {
		const relX = progress * GRAPH_W;
		const segW = GRAPH_W / (data.length - 1);
		const idx = Math.min(Math.floor(relX / segW), data.length - 2);
		const t = (relX - idx * segW) / segW;
		const mu = 3 * t * t - 2 * t * t * t;
		return data[idx] * (1 - mu) + data[idx + 1] * mu;
	};

	// ─── Progress & Animation Calculations ─────────────────────────────────────
	const getSeriesProgress = (idx: number) => {
		const s = config.data.series[idx];

		if (s.keyframes && s.keyframes.length > 0) {
			if (frame < s.keyframes[0].frame) return s.keyframes[0].progress;
			if (frame >= s.keyframes[s.keyframes.length - 1].frame) return s.keyframes[s.keyframes.length - 1].progress;

			for (let i = 0; i < s.keyframes.length - 1; i++) {
				const current = s.keyframes[i];
				const next = s.keyframes[i + 1];
				if (frame >= current.frame && frame <= next.frame) {
					return interpolate(frame, [current.frame, next.frame], [current.progress, next.progress], {
						...clamp,
						easing: Easing.bezier(0.22, 0.61, 0.36, 1), // smooth out each keyframe transition
					});
				}
			}
		}

		const range = s.drawRange || anim.drawLineRange;
		return interpolate(frame, range, [0, 1], {
			...clamp,
			easing: Easing.bezier(0.22, 0.61, 0.36, 1),
		});
	};



	// Pre-compute normalised points for each series
	const seriesData = config.data.series.map((s) => ({
		...s,
		normPoints: normalise(s.values),
	}));

	// ── Animations ──────────────────────────────────────────────────────────
	const gridOpacity = interpolate(frame, anim.gridFadeIn, [0, 0.7], clamp);

	const legendOpacity = interpolate(frame, anim.legendFadeIn, [0, 1], clamp);
	const legendSlide = interpolate(frame, anim.legendFadeIn, [16, 0], clamp);

	// We use series 0 for primary drawing progress metric
	const primaryProgress = getSeriesProgress(0);

	const bottomTextOpacity = interpolate(frame, anim.bottomTextFadeIn, [0, 1], clamp);
	const bottomTextSlide = interpolate(frame, anim.bottomTextFadeIn, [30, 0], clamp);

	const indicatorOpacity = interpolate(
		frame,
		anim.indicatorFadeIn,
		[0, config.indicator.opacity],
		clamp,
	);

	const labelsOpacity = interpolate(frame, anim.labelsFadeIn, [0, 1], clamp);

	const logoOpacity = interpolate(
		frame,
		anim.legendFadeIn || [10, 30],
		[0, 1],
		clamp,
	);

	const interactiveReveal = interpolate(
		frame,
		[anim.dotAppearFrame, anim.dotAppearFrame + 12],
		[0, 1],
		clamp,
	);

	// Breathing (disabled for perfectly static look)
	const breathScale = 1;

	// Dot pulse scaling (always 1 to remain perfectly static in size without sudden snaps or scaling jumps)
	const dotPulse = 1;

	// Compute series-specific X and Y positions for active dots
	const activePoints = seriesData.map((s, idx) => {
		const progress = getSeriesProgress(idx);
		const x = MARGIN_X + progress * GRAPH_W;
		const y = getGraphY(x, s.normPoints);
		return { x, y, progress };
	});

	// Current interpolated real values for indicator
	const primaryVal = getInterpolatedValue(
		primaryProgress,
		config.data.series[0].values,
	);

	// Dynamic sizing for bottom heading based on safe limit
	const textLen = config.bottomHeading.text.length;
	// Safe limit ~40 chars. Scale down font slightly for very long text
	const adjustedFontSize = textLen > 40 
		? Math.max(16, config.bottomHeading.fontSize * Math.min(1, 40 / textLen + 0.3)) 
		: config.bottomHeading.fontSize;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				fontFamily: `${interFontFamily}, sans-serif`,
				overflow: "hidden",
			}}
		>
			{/* Background gradient */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: config.theme.backgroundGradient,
				}}
			/>

			{/* Subtle grain overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: 0.015,
					pointerEvents: "none",
					backgroundImage:
						"repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)",
					mixBlendMode: "overlay",
				}}
			/>

			{/* ── Studio grid background (PieChart style) ── */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: 960,
					height: 1700,
					opacity: gridOpacity * 1.2,
					WebkitMaskImage: "radial-gradient(ellipse 80% 85% at 50% 45%, black 25%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 80% 85% at 50% 45%, black 25%, transparent 95%)",
					pointerEvents: "none",
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: Math.round(960 / 80) + 1 }).map((_, i) => (
						<line
							key={`vg-${i}`}
							x1={i * 80}
							y1={0}
							x2={i * 80}
							y2={1700}
							stroke={config.theme.gridColor}
							strokeWidth={1.5}
						/>
					))}
					{Array.from({ length: Math.round(1700 / 80) + 1 }).map((_, i) => (
						<line
							key={`hg-${i}`}
							x1={0}
							y1={i * 80}
							x2={960}
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

			{/* Main container */}
			<div
				style={{
					width: config.composition.width,
					height: config.composition.height,
					position: "relative",
					transform: `scale(${breathScale})`,
					transformOrigin: "center center",
				}}
			>
				{/* ── Legend (sleek minimalist pills) ───────────── */}
				<div
					style={{
						position: "absolute",
						top: config.legend.marginTop,
						...(config.legend.layout === "row"
							? { left: 60, right: 60, justifyContent: "center" }
							: { right: config.legend.marginRight, alignItems: "flex-end" }),
						display: "flex",
						flexDirection: config.legend.layout === "row" ? ("row" as const) : ("column" as const),
						flexWrap: config.legend.layout === "row" ? ("wrap" as const) : ("nowrap" as const),
						gap: config.legend.gap,
						opacity: legendOpacity,
						transform: config.legend.layout === "row" ? `translateY(${legendSlide}px)` : `translateX(${legendSlide}px)`,
						zIndex: 20,
					}}
				>
					{config.legend.items.map((item) => (
						<div
							key={item.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
							}}
						>
							{/* Sleek rounded-pill line indicator instead of plain dot */}
							<div
								style={{
									width: 32,
									height: 5,
									borderRadius: 3,
									background: item.colorGradient && item.colorGradient.length >= 2
										? `linear-gradient(90deg, ${item.colorGradient.join(", ")})`
										: item.color,
									flexShrink: 0,
									boxShadow: `0 2px 8px ${item.color}30`,
								}}
							/>
							<span
								style={{
									fontFamily: `${interFontFamily}, sans-serif`,
									fontSize: config.legend.fontSize,
									fontWeight: config.legend.fontWeight,
									color: config.theme.subtextColor,
									letterSpacing: "-0.3px",
									whiteSpace: "nowrap",
								}}
							>
								{item.label}
							</span>
						</div>
					))}
				</div>

				{/* ── Large indicator number (bottom-left, behind content) ──── */}
				{config.indicator.show && (
					<div
						style={{
							position: "absolute",
							bottom: config.indicator.marginBottom,
							left: config.indicator.marginLeft,
							fontFamily: `${outfitFontFamily}, sans-serif`,
							fontSize: config.indicator.fontSize,
							fontWeight: config.indicator.fontWeight,
							color: config.indicator.color,
							opacity: indicatorOpacity,
							letterSpacing: "-4px",
							lineHeight: 1,
							pointerEvents: "none",
							userSelect: "none",
							zIndex: 5,
							textShadow: "0 0 25px rgba(255, 255, 255, 0.35)",
						}}
					>
						{Math.round(primaryVal)}
						{config.indicator.suffix}
					</div>
				)}

				{/* ── Bottom heading with accent stripe ─────────────────── */}
				{config.bottomHeading.show && (
					<div
						style={{
							position: "absolute",
							bottom: config.bottomHeading.marginBottom,
							left: 60,
							right: 60,
							opacity: bottomTextOpacity,
							transform: `translateY(${bottomTextSlide}px)`,
							zIndex: 15,
						}}
					>
						{/* Subtle accent gradient stripe */}
						{config.legend.items.length > 0 && (
							<div
								style={{
									width: 48,
									height: 4,
									borderRadius: 2,
									background: config.legend.items[0].colorGradient && config.legend.items[0].colorGradient.length >= 2
										? `linear-gradient(90deg, ${config.legend.items[0].colorGradient.join(", ")})`
										: config.legend.items[0].color,
									marginBottom: 16,
									opacity: 0.7,
								}}
							/>
						)}
						<div
							style={{
								fontFamily: `${outfitFontFamily}, sans-serif`,
								fontSize: adjustedFontSize,
								fontWeight: config.bottomHeading.fontWeight,
								color: config.theme.textColor,
								letterSpacing: config.bottomHeading.letterSpacing,
								lineHeight: config.bottomHeading.lineHeight,
								wordBreak: "break-word",
								overflowWrap: "break-word",
								textAlign: "left",
							}}
						>
							{config.bottomHeading.text}
						</div>
					</div>
				)}

				{/* ── Graph area ───────────────────────────────────────────── */}
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: config.graph.positionY,
						transform: "translate(-50%, -50%)",
						width: GRID_W,
						height: GRID_H,
					}}
				>
					{/* Grid lines */}
					{config.graph.showGridLines && (
						<div
							style={{
								position: "absolute",
								inset: 0,
								opacity: gridOpacity,
								WebkitMaskImage:
									"radial-gradient(ellipse 70% 75% at 50% 50%, black 30%, transparent 90%)",
								maskImage:
									"radial-gradient(ellipse 70% 75% at 50% 50%, black 30%, transparent 90%)",
							}}
						>
							<svg width="100%" height="100%">
								{/* Horizontal */}
								{Array.from({ length: Math.round(GRID_H / 100) + 1 }).map(
									(_, i) => (
										<line
											key={`h-${i}`}
											x1={MARGIN_X}
											y1={MARGIN_Y + i * ((GRID_H - 2 * MARGIN_Y) / Math.round(GRID_H / 100))}
											x2={GRID_W - MARGIN_X}
											y2={MARGIN_Y + i * ((GRID_H - 2 * MARGIN_Y) / Math.round(GRID_H / 100))}
											stroke={config.theme.gridColor}
											strokeWidth={config.graph.gridLineWidth}
										/>
									),
								)}
							</svg>
						</div>
					)}

					{/* Y-axis labels */}
					<div
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							opacity: labelsOpacity,
						}}
					>
						{config.data.yLabels.map(({ value, label }) => (
							<div
								key={label}
								style={{
									position: "absolute",
									right: GRID_W - MARGIN_X + 16,
									top: valToY(value),
									transform: "translateY(-50%)",
									fontSize: 18,
									fontWeight: 700,
									color: config.theme.subtextColor,
									fontFamily: interFontFamily,
									textAlign: "left",
									whiteSpace: "nowrap",
								}}
							>
								{label}
							</div>
						))}
					</div>

					{/* SVG lines */}
					<svg
						width={GRID_W}
						height={GRID_H}
						style={{ position: "absolute", inset: 0, overflow: "visible" }}
					>
						<defs>
							{seriesData.map((s, idx) => (
								<React.Fragment key={s.name}>
									{/* Area gradient */}
									<linearGradient
										id={`areaGrad-${idx}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor={s.areaColor}
											stopOpacity={config.graph.areaOpacityStart}
										/>
										<stop
											offset="100%"
											stopColor={s.areaColor}
											stopOpacity={config.graph.areaOpacityEnd}
										/>
									</linearGradient>
									{/* Stroke gradient */}
									<linearGradient
										id={`strokeGrad-${idx}`}
										x1="0"
										y1="0"
										x2="1"
										y2="0"
									>
										{s.strokeGradient.map((c: string, gi: number) => (
											<stop
												key={gi}
												offset={`${(gi / (s.strokeGradient.length - 1)) * 100}%`}
												stopColor={c}
											/>
										))}
									</linearGradient>
									{/* Shadow filter */}
									<filter
										id={`shadow-${idx}`}
										x="-10%"
										y="-10%"
										width="120%"
										height="120%"
									>
										<feDropShadow
											dx="0"
											dy="6"
											stdDeviation="6"
											floodColor={s.shadowColor}
											floodOpacity="0.12"
										/>
									</filter>
								</React.Fragment>
							))}
							{/* Reveal clip path specifically for this series */}
							{seriesData.map((s, idx) => (
								<clipPath key={`clip-${idx}`} id={`revealClip-${idx}`}>
									<rect x={0} y={0} width={activePoints[idx].x} height={GRID_H} />
								</clipPath>
							))}
						</defs>

						{/* Area fills */}
						{config.graph.showArea &&
							seriesData.map((s, idx) => {
								const progress = getSeriesProgress(idx);
								if (progress <= 0.0001) return null;
								return (
									<path
										key={`area-${idx}`}
										d={getAreaPath(s.normPoints)}
										fill={`url(#areaGrad-${idx})`}
										clipPath={`url(#revealClip-${idx})`}
									/>
								);
							})}

						{/* Lines (draw in reverse so first series is on top) */}
						{[...seriesData].reverse().map((s, ri) => {
							const idx = seriesData.length - 1 - ri;
							const progress = getSeriesProgress(idx);
							if (progress <= 0.0001) return null;
							return (
								<path
									key={`line-${idx}`}
									d={getCurvePath(s.normPoints)}
									fill="none"
									stroke={`url(#strokeGrad-${idx})`}
									strokeWidth={config.graph.strokeWidth}
									strokeLinecap="round"
									strokeLinejoin="round"
									filter={`url(#shadow-${idx})`}
									clipPath={`url(#revealClip-${idx})`}
								/>
							);
						})}
					</svg>

					{/* Dots & Tooltip */}
					{primaryProgress > 0.001 && interactiveReveal > 0.01 && (
						<div style={{ opacity: interactiveReveal, pointerEvents: "none", zIndex: 100 }}>
							{seriesData.map((s, idx) => {
								const { x, y } = activePoints[idx];
								return (
									<React.Fragment key={`dot-${idx}`}>
										{/* Pulse ring */}
										<div
											style={{
												position: "absolute",
												left: x,
												top: y,
												transform: "translate(-50%, -50%)",
												width: config.graph.dotPulseRadius * 2,
												height: config.graph.dotPulseRadius * 2,
												borderRadius: "50%",
												backgroundColor: `${s.color}22`,
												scale: `${dotPulse}`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										/>
										{/* Solid dot — uses theme-aware border */}
										<div
											style={{
												position: "absolute",
												left: x,
												top: y,
												transform: "translate(-50%, -50%)",
												width: config.graph.dotRadius * 2,
												height: config.graph.dotRadius * 2,
												borderRadius: "50%",
												backgroundColor: s.color,
												border: `3.5px solid ${config.theme.backgroundColor}`,
												boxShadow: `0 3px 14px ${s.color}50`,
											}}
										/>
									</React.Fragment>
								);
							})}

							{/* Tooltip */}
							{config.graph.showTooltip && (() => {
								const TOOLTIP_W = 280;
								const containerLeft = (1080 - GRID_W) / 2;
								const firstSeriesX = activePoints[0].x;
								const rawScreenLeft = firstSeriesX - TOOLTIP_W / 2 + containerLeft;
								const clampedScreenLeft = Math.max(40, Math.min(1080 - 40 - TOOLTIP_W, rawScreenLeft));
								const tooltipLeft = clampedScreenLeft - containerLeft;
								const caretLeft = firstSeriesX - tooltipLeft;

								return (
									<div
										style={{
											position: "absolute",
											left: tooltipLeft,
											top: Math.min(...activePoints.map((p) => p.y)),
											transform: "translateY(-115%)",
											background: "rgba(255,255,255,0.96)",
											backdropFilter: "blur(20px)",
											border: "1.5px solid rgba(0,0,0,0.06)",
											color: config.theme.textColor,
											padding: "16px 22px",
											borderRadius: 18,
											boxShadow:
												"0 20px 48px rgba(0,0,0,0.08), 0 6px 20px rgba(0,0,0,0.04)",
											display: "flex",
											flexDirection: "column",
											gap: 8,
											width: TOOLTIP_W,
										}}
									>
										{seriesData.map((s, idx) => {
											const val = getInterpolatedValue(
												getSeriesProgress(idx),
												config.data.series[idx].values,
											);
											return (
												<div
													key={s.name}
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														gap: 20,
													}}
												>
													<div
														style={{
															display: "flex",
															alignItems: "center",
															gap: 10,
														}}
													>
														<div
															style={{
																width: 12,
																height: 12,
																borderRadius: "50%",
																backgroundColor: s.color,
																flexShrink: 0,
															}}
														/>
														<span
															style={{
																fontSize: 22,
																fontWeight: 700,
																color: config.theme.subtextColor,
																whiteSpace: "nowrap",
															}}
														>
															{s.name}
														</span>
													</div>
													<span
														style={{
															fontFamily: `${outfitFontFamily}, sans-serif`,
															fontSize: 26,
															fontWeight: 800,
															color: s.color,
															fontVariantNumeric: "tabular-nums",
														}}
													>
														{Math.round(val)}
													</span>
												</div>
											);
										})}
										{/* Caret */}
										<div
											style={{
												position: "absolute",
												bottom: -6,
												left: caretLeft,
												transform: "translateX(-50%)",
												width: 0,
												height: 0,
												borderLeft: "6px solid transparent",
												borderRight: "6px solid transparent",
												borderTop: "6px solid rgba(255,255,255,0.96)",
											}}
										/>
									</div>
								);
							})()}
						</div>
					)}

					{/* X-axis labels */}
					<div
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							opacity: labelsOpacity,
						}}
					>
						{config.data.timeline.map((label, i) => (
							<div
								key={label}
								style={{
									position: "absolute",
									left: valToX(i, config.data.timeline.length),
									transform: "translateX(-50%)",
									top: GRID_H - MARGIN_Y + 24,
									width: 100,
									textAlign: "center",
									fontSize: 16,
									fontWeight: 700,
									color: config.theme.subtextColor,
									fontFamily: interFontFamily,
									whiteSpace: "nowrap",
								}}
							>
								{label}
							</div>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default LineGraph;
