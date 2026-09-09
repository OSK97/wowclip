// src/graphs/BarGraph/BarGraph.tsx — Fully JSON controllable animated bar chart
import React from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
	staticFile,
} from "remotion";
import { loadInter, loadOutfit } from "../../utils/localFonts";

const { fontFamily: inter } = loadInter();
const { fontFamily: outfit } = loadOutfit();

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

/* ─── Types ────────────────────────────────────────────── */

export interface BarData {
	label: string;
	value: number;
	gradientFrom: string;
	gradientTo: string;
	startFrame?: number;
	image?: string;
	highlight?: boolean;
}

export interface BarGraphProps {
	title: {
		text: string;
		subtitle?: string;
		show: boolean;
	};
	unit: string;
	bars: BarData[];
	/** Stage to draw on. Defaults to the full 1080x1920 frame; a scene passes
	    the slot it allocated so the chart fills it instead of being cropped. */
	composition?: {
		width?: number;
		height?: number;
	};
	logo?: {
		show: boolean;
		url: string;
		height?: number;
	};
	theme?: {
		backgroundColor?: string;
		backgroundGradient?: string;
		textColor?: string;
		mutedTextColor?: string;
		accentColor?: string;
		gridColor?: string;
	};
	animation?: {
		labelsFadeIn: [number, number];
		gridFadeIn: [number, number];
	};
}

/* ─── Duration Calculator ──────────────────────────────── */

export const getBarGraphDuration = (config: any, defaultFps: number = 30): number => {
	const fps = config?.composition?.fps ?? defaultFps;
	if (typeof config?.durationInSeconds === "number" && config.durationInSeconds > 0) {
		return Math.ceil(config.durationInSeconds * fps);
	}
	if (typeof config?.composition?.durationInSeconds === "number" && config.composition.durationInSeconds > 0) {
		return Math.ceil(config.composition.durationInSeconds * fps);
	}
	const bars: BarData[] = config?.bars || [];
	if (bars.length === 0) return 150; // default 5 sec fallback

	const maxStartFrame = bars.reduce((max, b, i) => {
		const sf = b.startFrame ?? (10 + i * 7);
		return Math.max(max, sf);
	}, 0);

	// Entrance animation (~30 frames) + 3 second hold buffer (90 frames)
	return Math.max(maxStartFrame + 120, 180);
};

/* ─── Component ────────────────────────────────────────── */

export const BarGraph: React.FC<BarGraphProps> = ({
	title,
	unit,
	bars,
	logo,
	composition,
	theme = {},
	animation = { labelsFadeIn: [15, 35], gridFadeIn: [5, 25] }
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const embedded = (theme.backgroundColor ?? "") === "transparent";
	const bgColor = theme.backgroundColor || "#050A07";
	const bgGradient = theme.backgroundGradient || "radial-gradient(circle at center, #0F1F17 10%, #050A07 60%, #020403 100%)";

	// Smart Dark Mode color fallback computation
	const isDark = ["#0", "#1", "#2", "#3", "black", "rgb(0", "rgb(1", "rgb(2"].some((prefix) =>
		bgColor.toLowerCase().startsWith(prefix)
	);

	const textColor = theme.textColor || (isDark ? "#FFFFFF" : "#1E1B18");
	const mutedTextColor = theme.mutedTextColor || (isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(30, 27, 24, 0.45)");
	const accentColor = theme.accentColor || (isDark ? "#10B981" : "#3B82F6");
	const gridColor = theme.gridColor || (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(30, 27, 24, 0.12)");

	// Safe limit warning
	if (bars.length > 7) {
		console.warn("BarGraph: Displaying more than 7 bars may cause overlap or distortion.");
	}

	const totalValue = bars.reduce((s, b) => s + b.value, 0);
	const maxValue = Math.max(...bars.map((b) => b.value));

	// Layout Logic — proportional to the stage, so the same chart works at
	// 1080x1920 and inside whatever slot a scene hands it.
	const STAGE_W = composition?.width ?? 1080;
	const STAGE_H = composition?.height ?? 1920;
	const CHART = {
		left: STAGE_W * 0.0926,
		right: STAGE_W * 0.9074,
		top: title.show ? STAGE_H * 0.3177 : STAGE_H * (embedded ? 0.13 : 0.1771),
		bottom: title.show ? STAGE_H * 0.6667 : STAGE_H * (embedded ? 0.855 : 0.7604),
	};

	const chartW = CHART.right - CHART.left;
	const chartH = CHART.bottom - CHART.top;
	const barSpacing = chartW / Math.max(bars.length, 1);
	
	// Dynamic sizing based on number of bars
	const BAR_W = Math.min(barSpacing * 0.56, 260);
	const BAR_R = BAR_W * 0.22;

	// ── Header entrance ──────────────────────────────────
	const headerSpring = spring({
		frame,
		fps,
		config: { damping: 14, stiffness: 100, mass: 0.7 },
	});
	const headerO = interpolate(headerSpring, [0, 1], [0, 1], clamp);
	const headerY = interpolate(headerSpring, [0, 1], [24, 0], clamp);

	// ── Counter (fast count-up) ──────────────────────────
	const counter = Math.round(
		interpolate(frame, [8, 70], [0, totalValue], {
			...clamp,
			easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
		}),
	);

	// ── Grid ─────────────────────────────────────────────
	const gridO = interpolate(frame, animation.gridFadeIn, [0, 0.45], clamp);

	// ── Category labels ──────────────────────────────────
	const labelsO = interpolate(frame, animation.labelsFadeIn, [0, 1], clamp);

	const camS = 1;
	const camRx = 0;
	const camRy = 0;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: bgColor,
				fontFamily: `${inter}, sans-serif`,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* ── Background layers ─────────────────────────── */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: embedded ? "none" : bgGradient,
				}}
			/>
			{/* Vignette. Embedded it becomes a visible grey panel behind the
			    chart, which is exactly the "box on the page" look to avoid. */}
			{!embedded && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						pointerEvents: "none",
						background:
							"radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)",
					}}
				/>
			)}
			{/* ── Centered studio grid background (PieChart style) ── */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: 960,
					height: 1680,
					opacity: embedded ? 0 : gridO * 1.5,
					WebkitMaskImage: "radial-gradient(ellipse 75% 85% at 50% 50%, black 25%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 75% 85% at 50% 50%, black 25%, transparent 95%)",
					pointerEvents: "none",
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: Math.round(960 / 80) + 1 }).map((_, i) => (
						<line
							key={`v-grid-${i}`}
							x1={i * 80}
							y1={0}
							x2={i * 80}
							y2={1680}
							stroke={gridColor}
							strokeWidth={1.5}
						/>
					))}
					{Array.from({ length: Math.round(1680 / 80) + 1 }).map((_, i) => (
						<line
							key={`h-grid-${i}`}
							x1={0}
							y1={i * 80}
							x2={960}
							y2={i * 80}
							stroke={gridColor}
							strokeWidth={1.5}
						/>
					))}
				</svg>
			</div>

			{/* ── Logo (top-left) ────────────── */}
			{logo?.show && logo?.url && (() => {
				const logoHeight = logo.height || 90;
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
							opacity: headerO,
							zIndex: 30,
							background: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.95)",
							backdropFilter: "blur(20px)",
							borderRadius: 24,
							border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.08)",
							boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
							overflow: "hidden",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<img
							src={logo.url}
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

			<div
				style={{
					width: STAGE_W,
					height: STAGE_H,
					position: "relative",
					transform: `scale(${camS}) rotateX(${camRx}deg) rotateY(${camRy}deg)`,
					transformStyle: "preserve-3d",
					perspective: 1200,
				}}
			>
				{/* ── Header: title + animated counter ─────────── */}
				{title.show && (
					<div
						style={{
							position: "absolute",
							top: 200,
							left: 0,
							right: 0,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							opacity: headerO,
							transform: `translateY(${headerY}px)`,
							zIndex: 10,
						}}
					>
						<div
							style={{
								fontFamily: `${outfit}, sans-serif`,
								fontSize: 22,
								fontWeight: 700,
								letterSpacing: "6px",
								textTransform: "uppercase",
								color: mutedTextColor,
							}}
						>
							{title.text}
						</div>
						<div
							style={{
								fontFamily: `${outfit}, sans-serif`,
								fontSize: 120,
								fontWeight: 800,
								color: textColor,
								letterSpacing: "-5px",
								lineHeight: 1,
								marginTop: 12,
							}}
						>
							{counter.toLocaleString()}
							{unit}
						</div>
						{title.subtitle && (
							<div
								style={{
									fontFamily: `${inter}, sans-serif`,
									fontSize: 24,
									fontWeight: 500,
									color: accentColor,
									marginTop: 10,
									letterSpacing: "1px",
								}}
							>
								{title.subtitle}
							</div>
						)}
					</div>
				)}

				{/* ── Chart area ────────────────────────────────── */}
				<div
					style={{
						position: "absolute",
						left: CHART.left,
						top: CHART.top,
						width: chartW,
						height: chartH,
					}}
				>
					{/* Subtle horizontal guides */}
					<svg
						width={chartW}
						height={chartH}
						style={{
							position: "absolute",
							inset: 0,
							opacity: gridO,
							maskImage:
								"linear-gradient(180deg, transparent 0%, black 5%, black 95%, transparent 100%)",
							WebkitMaskImage:
								"linear-gradient(180deg, transparent 0%, black 5%, black 95%, transparent 100%)",
						}}
					>
						{[0.25, 0.5, 0.75].map((pct) => (
							<line
								key={pct}
								x1={0}
								y1={chartH * (1 - pct)}
								x2={chartW}
								y2={chartH * (1 - pct)}
								stroke={gridColor}
								strokeWidth={1.5}
								strokeDasharray="8 8"
							/>
						))}
					</svg>

					{/* SVG bars */}
					<svg
						width={chartW}
						height={chartH + 60}
						viewBox={`0 0 ${chartW} ${chartH + 60}`}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							overflow: "visible",
						}}
					>
						<defs>
							{/* Bottom fade-out mask applied to each bar */}
							<linearGradient id="barFadeMask" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="white" stopOpacity={1} />
								<stop offset="75%" stopColor="white" stopOpacity={1} />
								<stop offset="100%" stopColor="white" stopOpacity={0} />
							</linearGradient>
							{bars.map((bar, i) => (
								<React.Fragment key={`d-${i}`}>
									<linearGradient
										id={`bg-${i}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor={bar.gradientFrom}
										/>
										<stop
											offset="100%"
											stopColor={bar.gradientTo}
										/>
									</linearGradient>
									<filter
										id={`bs-${i}`}
										x="-20%"
										y="-10%"
										width="140%"
										height="130%"
									>
										<feDropShadow
											dx="0"
											dy="8"
											stdDeviation="8"
											floodColor={bar.gradientTo}
											floodOpacity={bar.highlight ? 0.4 : 0.18}
										/>
									</filter>
									{/* Per-bar fade mask */}
									<mask id={`fade-${i}`}>
										<rect x="0" y="0" width={chartW} height={chartH + 60} fill="url(#barFadeMask)" />
									</mask>
								</React.Fragment>
							))}
						</defs>

						{bars.map((bar, i) => {
							const cx = barSpacing * (i + 0.5);
							const x = cx - BAR_W / 2;

							// JSON controlled timing via bar.startFrame, defaults to staggered
							const startFrame = bar.startFrame ?? (10 + i * 7);
							const barSpr = spring({
								frame: frame - startFrame,
								fps,
								config: {
									damping: 13,
									stiffness: 100,
									mass: 0.8,
								},
							});

							// Safeguard against maxValue being 0
							const targetH = maxValue > 0 ? (bar.value / maxValue) * chartH : 0;
							const h = barSpr * targetH;
							const y = chartH - h;

							// Rounded top corners, extends past chartH so the fade dissolves it
							const rx = Math.min(BAR_R, BAR_W / 2, Math.max(0, h / 2));
							const bottomExtend = chartH + 50; // extend past bottom so fade mask dissolves it
							const pathD = h > 1
								? `M ${x} ${bottomExtend} L ${x} ${y + rx} Q ${x} ${y} ${x + rx} ${y} L ${x + BAR_W - rx} ${y} Q ${x + BAR_W} ${y} ${x + BAR_W} ${y + rx} L ${x + BAR_W} ${bottomExtend} Z`
								: "";

							return h > 1 ? (
								<g key={`bar-${i}`} mask={`url(#fade-${i})`}>
									{/* Main Bar Body */}
									<path
										d={pathD}
										fill={`url(#bg-${i})`}
										filter={`url(#bs-${i})`}
										stroke={bar.highlight ? accentColor : "rgba(255,255,255,0.1)"}
										strokeWidth={bar.highlight ? 2.5 : 1}
									/>

									{bar.image && (() => {
										// Maximize image size to fit bar width with small margin
										const maxImgSize = BAR_W * 0.78;
										const imgSize = Math.min(maxImgSize, Math.max(36, h * 0.55));
										const imageHref = bar.image.startsWith("http") ? bar.image : staticFile(bar.image);
										const imgY = chartH - h / 2 - imgSize / 2;
										return h > imgSize + 30 ? (
											<image
												key={`img-${i}`}
												href={imageHref}
												x={cx - imgSize / 2}
												y={imgY}
												width={imgSize}
												height={imgSize}
												preserveAspectRatio="xMidYMid meet"
												style={{ filter: "drop-shadow(0px 6px 12px rgba(0,0,0,0.4))" }}
											/>
										) : null;
									})()}
								</g>
							) : null;
						})}
					</svg>
				</div>

				{/* ── Value labels (pure minimalist floating numbers without white boxes!) ──────────── */}
				{(() => {
					// Single uniform font size for ALL value numbers to ensure perfect consistency
					const globalBadgeFontSize = Math.max(32, Math.min(48, Math.floor(barSpacing * 0.2)));

					return bars.map((bar, i) => {
						const cx = CHART.left + barSpacing * (i + 0.5);
						const targetH = maxValue > 0 ? (bar.value / maxValue) * chartH : 0;
						const barTop = CHART.top + chartH - targetH;

						const startFrame = bar.startFrame ?? (10 + i * 7);
						const pop = spring({
							frame: frame - (startFrame + 14),
							fps,
							config: { damping: 12, stiffness: 120, mass: 0.7 },
						});
						const o = interpolate(pop, [0, 1], [0, 1], clamp);
						const sc = interpolate(pop, [0, 1], [0.4, 1], clamp);

						return frame > startFrame + 14 ? (
							<div
								key={`v-${i}`}
								style={{
									position: "absolute",
									left: cx,
									top: barTop - (globalBadgeFontSize + 18),
									transform: `translate(-50%, -50%) scale(${sc})`,
									opacity: o,
									fontFamily: `${outfit}, sans-serif`,
									fontSize: globalBadgeFontSize,
									fontWeight: 900,
									color: bar.highlight ? accentColor : textColor,
									letterSpacing: "-0.5px",
									whiteSpace: "nowrap",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									zIndex: 20,
								}}
							>
								<span>
									{bar.value}
									{unit}
								</span>
							</div>
						) : null;
					});
				})()}


				{/* ── Clean Floating Category Labels ──── */}
				{(() => {
					const globalCatFontSize = Math.min(50, Math.max(34, Math.floor(barSpacing * 0.21)));

					return bars.map((bar, i) => {
						const cx = CHART.left + barSpacing * (i + 0.5);

						return (
							<div
								key={`l-${i}`}
								style={{
									position: "absolute",
									left: cx,
									top: CHART.bottom + 30,
									width: barSpacing + 20,
									transform: "translateX(-50%)",
									opacity: labelsO,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									textAlign: "center",
									zIndex: 25,
								}}
							>
								<div
									style={{
										fontFamily: `${outfit}, sans-serif`,
										fontSize: globalCatFontSize,
										fontWeight: 800,
										color: bar.highlight ? accentColor : textColor,
										letterSpacing: "-0.5px",
										lineHeight: 1.15,
									}}
								>
									{bar.label}
								</div>
							</div>
						);
					});
				})()}
			</div>
		</AbsoluteFill>
	);
};

export default BarGraph;
