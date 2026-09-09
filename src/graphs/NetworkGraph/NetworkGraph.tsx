// src/graphs/NetworkGraph/NetworkGraph.tsx — Config-driven premium Cluster Network Graph
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

export interface NetworkChildItem {
	label: string;
	letter: string;
	angle: number;
	distance: number;
}

export interface NetworkGraphProps {
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
		hubColorStart: string;
		hubColorEnd: string;
		childColorStart: string;
		childColorEnd: string;
		lineColor: string;
		particleColor: string;
	};
	bottomHeading: {
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
		gridWidth: number;
		gridHeight: number;
		positionY: string;
		parentX: number;
		parentY: number;
		parentR: number;
		childR: number;
		lineWidth: number;
		particleR: number;
	};
	data: {
		parentLabel: string;
		children: NetworkChildItem[];
	};
	animation: {
		gridFadeIn: number[];
		bottomTextFadeIn: number[];
		indicatorFadeIn: number[];
		parentSyncStartFrame: number;
		syncSpeedMax: number;
		lineStaggerFrame: number;
		lineDrawDuration: number;
		breathingAmplitude: number;
		breathingSpeed: number;
	};
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export const NetworkGraph: React.FC<NetworkGraphProps> = (config) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const anim = config.animation;

	const GRID_W = config.graph.gridWidth;
	const GRID_H = config.graph.gridHeight;
	const PARENT = { x: config.graph.parentX, y: config.graph.parentY };

	// ─── Resolve Child Coordinates Dynamically ───────────────────────────────
	const CHILDREN = config.data.children.map((child) => {
		const rad = (child.angle * Math.PI) / 180;
		return {
			...child,
			x: PARENT.x + child.distance * Math.cos(rad),
			y: PARENT.y + child.distance * Math.sin(rad),
		};
	});

	// ─── Animations & Transitions ────────────────────────────────────────────
	const gridOpacity = interpolate(frame, anim.gridFadeIn, [0, 0.85], clamp);
	
	const bottomTextOpacity = interpolate(frame, anim.bottomTextFadeIn, [0, 1], clamp);
	const bottomTextSlide = interpolate(frame, anim.bottomTextFadeIn, [30, 0], clamp);

	const indicatorOpacity = interpolate(
		frame,
		anim.indicatorFadeIn,
		[0, config.indicator.opacity],
		clamp,
	);

	const logoOpacity = interpolate(
		frame,
		anim.indicatorFadeIn || [15, 35],
		[0, 1],
		clamp,
	);

	// Central parent hub scale-up spring
	const parentSpring = spring({
		frame: frame - anim.parentSyncStartFrame,
		fps,
		config: { damping: 10, stiffness: 130, mass: 0.7 },
	});
	const parentR = parentSpring * config.graph.parentR;

	// Network speed count-up
	const networkSpeed = interpolate(frame, [15, 75], [0, anim.syncSpeedMax], {
		...clamp,
		easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
	});

	// Camera breathing
	const cameraScale = 1 + Math.sin(frame / anim.breathingSpeed) * anim.breathingAmplitude;
	const cameraRotX = Math.sin(frame / 60) * 0.2;
	const cameraRotY = Math.cos(frame / 70) * 0.15;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				fontFamily: `${interFontFamily}, sans-serif`,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* Warm shaded radial overlays */}
			<div style={{ position: "absolute", inset: 0, background: config.theme.backgroundGradient }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

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

			{/* Main Layout Container */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: config.composition.width,
					height: config.composition.height,
					position: "relative",
					transform: `scale(${cameraScale}) rotateX(${cameraRotX}deg) rotateY(${cameraRotY}deg)`,
					transformStyle: "preserve-3d",
					perspective: 1200,
				}}
			>

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
						}}
					>
						{Math.round(networkSpeed)}
						{config.indicator.suffix}
					</div>
				)}

				{/* ── Bottom heading ───────────────────────────────────────── */}
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
					<div
						style={{
							fontFamily: `${outfitFontFamily}, sans-serif`,
							fontSize: config.bottomHeading.fontSize,
							fontWeight: config.bottomHeading.fontWeight,
							color: config.theme.textColor,
							letterSpacing: config.bottomHeading.letterSpacing,
							lineHeight: config.bottomHeading.lineHeight,
						}}
					>
						{config.bottomHeading.text}
					</div>
				</div>

				{/* ── Grid Canvas ───────────────────────────────────────────── */}
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
					<div
						style={{
							position: "absolute",
							inset: 0,
							opacity: gridOpacity,
							WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
							maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
						}}
					>
						<svg width="100%" height="100%">
							{Array.from({ length: 11 }).map((_, i) => (
								<line
									key={`v-${i}`}
									x1={i * 100}
									y1={0}
									x2={i * 100}
									y2={GRID_H}
									stroke={config.theme.gridColor}
									strokeWidth={1.5}
								/>
							))}
							{Array.from({ length: 13 }).map((_, i) => (
								<line
									key={`h-${i}`}
									x1={0}
									y1={i * 100}
									x2={GRID_W}
									y2={i * 100}
									stroke={config.theme.gridColor}
									strokeWidth={1.5}
								/>
							))}
						</svg>
					</div>

					{/* Primary SVG Layer for Nodes & Connections */}
					<svg
						width={GRID_W}
						height={GRID_H}
						style={{ position: "absolute", inset: 0, overflow: "visible" }}
					>
						<defs>
							<linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor={config.theme.hubColorStart} />
								<stop offset="100%" stopColor={config.theme.hubColorEnd} />
							</linearGradient>
							<linearGradient id="childGrad" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor={config.theme.childColorStart} />
								<stop offset="100%" stopColor={config.theme.childColorEnd} />
							</linearGradient>
							<filter id="hubGlow" x="-30%" y="-30%" width="160%" height="160%">
								<feDropShadow dx="0" dy="8" stdDeviation="6" floodColor={config.theme.hubColorStart} floodOpacity="0.2" />
							</filter>
							<filter id="childGlow" x="-30%" y="-30%" width="160%" height="160%">
								<feDropShadow dx="0" dy="6" stdDeviation="4" floodColor={config.theme.childColorStart} floodOpacity="0.15" />
							</filter>
						</defs>

						{/* 1. Connecting lines */}
						{CHILDREN.map((child, i) => {
							const lineStartFrame = anim.parentSyncStartFrame + 10 + i * anim.lineStaggerFrame;
							const lineProgress = interpolate(
								frame,
								[lineStartFrame, lineStartFrame + anim.lineDrawDuration],
								[0, 1],
								clamp,
							);

							const currentLineX = PARENT.x + lineProgress * (child.x - PARENT.x);
							const currentLineY = PARENT.y + lineProgress * (child.y - PARENT.y);

							return lineProgress > 0.001 ? (
								<line
									key={`l-${i}`}
									x1={PARENT.x}
									y1={PARENT.y}
									x2={currentLineX}
									y2={currentLineY}
									stroke={config.theme.lineColor}
									strokeWidth={config.graph.lineWidth}
									strokeLinecap="round"
								/>
							) : null;
						})}

						{/* 2. Outer Child Nodes */}
						{CHILDREN.map((child, i) => {
							const arrivalFrame = anim.parentSyncStartFrame + 10 + i * anim.lineStaggerFrame + anim.lineDrawDuration;
							const childSpring = spring({
								frame: frame - arrivalFrame,
								fps,
								config: { damping: 11, stiffness: 120, mass: 0.6 },
							});

							const r = childSpring * config.graph.childR;

							return r > 0.01 ? (
								<g key={`g-child-${i}`}>
									<circle
										cx={child.x}
										cy={child.y}
										r={r}
										fill="url(#childGrad)"
										filter="url(#childGlow)"
									/>
									{childSpring > 0.6 && (
										<text
											x={child.x}
											y={child.y + 10}
											textAnchor="middle"
											fontFamily={`${outfitFontFamily}, sans-serif`}
											fontSize={30}
											fontWeight={900}
											fill="#FFFFFF"
											opacity={interpolate(childSpring, [0.6, 1], [0, 1], clamp)}
										>
											{child.letter}
										</text>
									)}
								</g>
							) : null;
						})}

						{/* 3. Central Hub Node */}
						{parentR > 0.01 && (
							<g>
								<circle
									cx={PARENT.x}
									cy={PARENT.y}
									r={parentR}
									fill="url(#hubGrad)"
									filter="url(#hubGlow)"
								/>
								{parentSpring > 0.6 && (
									<text
										x={PARENT.x}
										y={PARENT.y + 10}
										textAnchor="middle"
										fontFamily={`${outfitFontFamily}, sans-serif`}
										fontSize={30}
										fontWeight={900}
										fill="#FFFFFF"
										opacity={interpolate(parentSpring, [0.6, 1], [0, 1], clamp)}
									>
										{config.data.parentLabel}
									</text>
								)}
							</g>
						)}

						{/* 4. Sync traveling data particles */}
						{CHILDREN.map((child, i) => {
							const start = anim.parentSyncStartFrame + 10 + i * anim.lineStaggerFrame;
							const end = start + anim.lineDrawDuration;
							
							const progress = interpolate(frame, [start, end], [0, 1], clamp);
							const pX = PARENT.x + progress * (child.x - PARENT.x);
							const pY = PARENT.y + progress * (child.y - PARENT.y);

							return progress > 0.01 && progress < 0.99 ? (
								<circle
									key={`p-${i}`}
									cx={pX}
									cy={pY}
									r={config.graph.particleR}
									fill={config.theme.particleColor}
									filter="url(#childGlow)"
								/>
							) : null;
						})}
					</svg>

					{/* 5. Radiating Non-Overlapping Labels badge overlays */}
					{CHILDREN.map((child, i) => {
						const arrivalFrame = anim.parentSyncStartFrame + 10 + i * anim.lineStaggerFrame + anim.lineDrawDuration;
						const textReveal = spring({
							frame: frame - (arrivalFrame + 6),
							fps,
							config: { damping: 12, stiffness: 100, mass: 0.7 },
						});
						const opacity = interpolate(textReveal, [0, 1], [0, 1], clamp);
						const scale = interpolate(textReveal, [0, 1], [0.5, 1], clamp);

						// Radiate outward from node center
						const labelOffsetDist = config.graph.childR + 32;
						const rad = (child.angle * Math.PI) / 180;
						const lx = child.x + labelOffsetDist * Math.cos(rad);
						const ly = child.y + labelOffsetDist * Math.sin(rad);

						return frame > arrivalFrame + 6 ? (
							<div
								key={`label-${child.label}`}
								style={{
									position: "absolute",
									left: lx,
									top: ly,
									transform: `translate(-50%, -50%) scale(${scale})`,
									opacity,
									fontSize: 24,
									fontWeight: 800,
									color: config.theme.textColor,
									fontFamily: interFontFamily,
									pointerEvents: "none",
									whiteSpace: "nowrap",
									background: "rgba(255, 255, 255, 0.85)",
									backdropFilter: "blur(8px)",
									padding: "6px 14px",
									borderRadius: 12,
									border: "1px solid rgba(0,0,0,0.06)",
									boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
									zIndex: 100,
								}}
							>
								{child.label}
							</div>
						) : null;
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default NetworkGraph;
