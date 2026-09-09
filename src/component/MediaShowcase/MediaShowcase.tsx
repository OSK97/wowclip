import React from "react";
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	spring,
	staticFile,
	Img,
	Video,
	Easing,
} from "remotion";
import { loadOutfit, loadInter } from "../../utils/localFonts";
import configJson from "./media-showcase.json";

// ─── Font Loading ─────────────────────────────────────────────────────────────

const { fontFamily: outfitFamily } = loadOutfit("normal", {
	weights: ["400", "600", "700"],
	subsets: ["latin"],
});

const { fontFamily: interFamily } = loadInter("normal", {
	weights: ["400", "500", "600", "700"],
	subsets: ["latin"],
});

export interface MediaShowcaseConfig {
	fps?: number;
	durationInSeconds?: number;
	backgroundVideo?: string;
	whiteOverlayOpacity?: number;
	overlayOpacity?: number;
	image?: {
		url?: string;
		width?: number;
		borderRadius?: number;
	};
	text?: {
		title?: string;
		titleLines?: string[];
		description?: string;
		titleColor?: string;
		accentColor?: string;
		accentLineIndex?: number;
		descriptionColor?: string;
		fontFamily?: string;
		titleFontSize?: number;
		descriptionFontSize?: number;
		textTransform?: "uppercase" | "none" | "capitalize";
		titleStartFrame?: number;
		titleStaggerFrames?: number;
		descriptionStartFrame?: number;
		exitAnimation?: boolean;
	};
}

const rawConfig = configJson as unknown as MediaShowcaseConfig;

const resolveMediaSrc = (url: string) => {
	if (
		url.startsWith("http://") ||
		url.startsWith("https://") ||
		url.startsWith("data:")
	) {
		return url;
	}
	return staticFile(url);
};

// ─── Kinetic Diagonal Clip-Path Title Line ───────────────────────────────────

interface KineticLineProps {
	text: string;
	startFrame: number;
	durationFrames: number;
	color: string;
	fontSize: number;
	fontFamily: string;
	textTransform: "uppercase" | "none" | "capitalize";
	frame: number;
	totalDurationInFrames: number;
	exitAnimation: boolean;
}

const KineticLine: React.FC<KineticLineProps> = ({
	text,
	startFrame,
	durationFrames,
	color,
	fontSize,
	fontFamily,
	textTransform,
	frame,
	totalDurationInFrames,
	exitAnimation,
}) => {
	// Entrance animation: 0% -> 100%
	const enterProgress = interpolate(
		frame,
		[startFrame, startFrame + durationFrames],
		[0, 1],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: Easing.bezier(0.16, 1, 0.3, 1),
		}
	);

	// Diagonal cut angle starts at 80% and unmasks up to 0% (full rectangle)
	const enterClipCut = interpolate(enterProgress, [0, 1], [80, 0], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});

	// Smooth slide down from -48px to 0px
	const enterTranslateY = interpolate(enterProgress, [0, 1], [-48, 0], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});

	// Opacity ramps in fast
	const enterOpacity = interpolate(enterProgress, [0, 0.55], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Optional Exit Animation (last 24 frames of composition)
	let exitTranslateY = 0;
	let exitOpacity = 1;
	let exitClipCut = 0;

	if (exitAnimation && totalDurationInFrames && frame > totalDurationInFrames - 24) {
		const exitProgress = interpolate(
			frame,
			[totalDurationInFrames - 24, totalDurationInFrames - 6],
			[0, 1],
			{
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: Easing.bezier(0.7, 0, 0.84, 0),
			}
		);
		exitTranslateY = interpolate(exitProgress, [0, 1], [0, 48]);
		exitOpacity = interpolate(exitProgress, [0.3, 1], [1, 0], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		});
		exitClipCut = interpolate(exitProgress, [0, 1], [0, 100]);
	}

	const finalTranslateY = enterTranslateY + exitTranslateY;
	const finalOpacity = enterOpacity * exitOpacity;
	const finalClipCut = Math.max(enterClipCut, exitClipCut);

	const clipPathValue = `polygon(100% 0%, 100% 100%, 0% 100%, 0% ${finalClipCut}%)`;

	return (
		<div
			style={{
				display: "block",
				width: "100%",
				textAlign: "center",
				color,
				fontFamily: `"${fontFamily}", sans-serif`,
				fontWeight: 800,
				fontSize,
				lineHeight: 1.08,
				letterSpacing: "-0.015em",
				textTransform,
				opacity: finalOpacity,
				transform: `translateY(${finalTranslateY}px)`,
				WebkitClipPath: clipPathValue,
				clipPath: clipPathValue,
				willChange: "transform, opacity, clip-path",
			}}
		>
			{text}
		</div>
	);
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const MediaShowcase: React.FC<{ config?: any }> = ({ config: propConfig }) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	const c: MediaShowcaseConfig = propConfig || rawConfig || {};

	// Background Video & Whitish Overlay control parameter
	const bgVideoUrl = c.backgroundVideo || "planner_bg.mp4";
	const whiteOverlayOpacity = c.whiteOverlayOpacity ?? c.overlayOpacity ?? 0.5;

	// Image Settings
	const imgCfg = c.image || {};
	const imgUrl = imgCfg.url || "book_cover.jpg";
	const imgWidth = imgCfg.width ?? 380;
	const borderRadius = imgCfg.borderRadius ?? 20;

	// Text Settings
	const textCfg = c.text || {};
	const titleColor = textCfg.titleColor || "#0F172A";
	const accentColor = textCfg.accentColor || "#E11D48";
	const descriptionColor = textCfg.descriptionColor || "#475569";
	const titleFontSize = textCfg.titleFontSize ?? 72;
	const descriptionFontSize = textCfg.descriptionFontSize ?? 30;
	const textTransform = textCfg.textTransform ?? "uppercase";
	const exitAnimation = textCfg.exitAnimation ?? false;

	// Resolve title lines: supports explicit `titleLines` or single `title` string
	let lines: string[] = [];
	if (textCfg.titleLines && textCfg.titleLines.length > 0) {
		lines = textCfg.titleLines;
	} else if (textCfg.title) {
		if (textCfg.title.includes("\n")) {
			lines = textCfg.title.split("\n").map((s) => s.trim()).filter(Boolean);
		} else {
			const words = textCfg.title.split(" ").filter(Boolean);
			if (words.length >= 3) {
				// Split into 2 balanced lines
				const mid = Math.ceil(words.length / 2);
				lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
			} else {
				lines = [textCfg.title];
			}
		}
	} else {
		lines = ["LESSONS IN", "CHEMISTRY"];
	}

	const descriptionText = textCfg.description || "";

	// Animation Timing Milestones
	const titleStartFrame = textCfg.titleStartFrame ?? 12;
	const titleStaggerFrames = textCfg.titleStaggerFrames ?? 10;
	const lineDurationFrames = 18;

	// The last line of the title completes entrance at:
	const lastTitleEndFrame = titleStartFrame + (lines.length - 1) * titleStaggerFrames + lineDurationFrames;

	// Crucial fix: Description starts AFTER the title has fully entered!
	const descStartFrame = textCfg.descriptionStartFrame ?? (lastTitleEndFrame + 10);
	const descDurationFrames = 18;

	// Accent line index: default to last line (matching CSS `&:last-child { color: $secondary-color }`)
	const accentLineIndex = textCfg.accentLineIndex ?? (lines.length - 1);

	// Image Entrance (Smooth Spring Physics)
	const entranceSpring = spring({
		frame,
		fps,
		config: { damping: 18, stiffness: 85, mass: 0.8 },
	});

	const imageScale = interpolate(entranceSpring, [0, 1], [0.92, 1]);
	const imageOpacity = interpolate(entranceSpring, [0, 1], [0, 1]);

	// Description Entrance Animation
	const descProgress = interpolate(
		frame,
		[descStartFrame, descStartFrame + descDurationFrames],
		[0, 1],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: Easing.bezier(0.16, 1, 0.3, 1),
		}
	);

	const descClipCut = interpolate(descProgress, [0, 1], [80, 0], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});
	const descTranslateY = interpolate(descProgress, [0, 1], [-30, 0], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});
	const descOpacity = interpolate(descProgress, [0, 0.6], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Optional Description Exit
	let descExitOpacity = 1;
	let descExitTranslateY = 0;
	if (exitAnimation && frame > durationInFrames - 20) {
		const descExitProgress = interpolate(
			frame,
			[durationInFrames - 20, durationInFrames - 6],
			[0, 1],
			{
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: Easing.bezier(0.7, 0, 0.84, 0),
			}
		);
		descExitOpacity = interpolate(descExitProgress, [0.3, 1], [1, 0], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		});
		descExitTranslateY = interpolate(descExitProgress, [0, 1], [0, 30]);
	}

	const descClipPath = `polygon(100% 0%, 100% 100%, 0% 100%, 0% ${descClipCut}%)`;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#0F172A",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				overflow: "hidden",
				fontFamily: `"${interFamily}", sans-serif`,
			}}
		>
			{/* 1. Background Video with Bright Whitish Overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					width: "100%",
					height: "100%",
					overflow: "hidden",
				}}
			>
				<Video
					src={resolveMediaSrc(bgVideoUrl)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
					startFrom={0}
					loop
				/>
				{/* Whitish Overlay Mask */}
				{whiteOverlayOpacity > 0 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							backgroundColor: `rgba(255, 255, 255, ${whiteOverlayOpacity})`,
							backgroundImage: `radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, ${Math.max(
								0,
								whiteOverlayOpacity - 0.15
							)}) 0%, rgba(255, 255, 255, ${Math.min(1, whiteOverlayOpacity + 0.15)}) 100%)`,
						}}
					/>
				)}
			</div>

			{/* 2. Main Center Showcase Wrapper */}
			<div
				style={{
					position: "relative",
					zIndex: 10,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					opacity: imageOpacity,
					maxWidth: "960px",
					width: "90%",
					gap: 28,
				}}
			>
				{/* Direct Image Display - Clean with multi-layered studio shadow */}
				<div
					style={{
						width: imgWidth,
						maxWidth: "75vw",
						borderRadius: `${borderRadius}px`,
						overflow: "hidden",
						transform: `scale(${imageScale})`,
						boxShadow:
							"0 28px 60px -15px rgba(15, 23, 42, 0.35), 0 12px 24px -8px rgba(15, 23, 42, 0.2)",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
					}}
				>
					<Img
						src={resolveMediaSrc(imgUrl)}
						style={{
							width: "100%",
							height: "auto",
							objectFit: "contain",
							display: "block",
						}}
					/>
				</div>

				{/* 3. Kinetic Typography Section */}
				<div
					style={{
						marginTop: 20,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						maxWidth: "880px",
						width: "100%",
						gap: 14,
					}}
				>
					{/* Title Section: Multi-line kinetic diagonal clip-path typography */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							width: "100%",
							gap: 6,
						}}
					>
						{lines.map((line, idx) => {
							const lineStart = titleStartFrame + idx * titleStaggerFrames;
							const isAccent = idx === accentLineIndex;
							const color = isAccent ? accentColor : titleColor;

							return (
								<KineticLine
									key={idx}
									text={line}
									startFrame={lineStart}
									durationFrames={lineDurationFrames}
									color={color}
									fontSize={titleFontSize}
									fontFamily={outfitFamily}
									textTransform={textTransform}
									frame={frame}
									totalDurationInFrames={durationInFrames}
									exitAnimation={exitAnimation}
								/>
							);
						})}
					</div>

					{/* Description / Subtitle: Enters strictly AFTER title finishes */}
					{descriptionText && (
						<div
							style={{
								marginTop: 4,
								opacity: descOpacity * descExitOpacity,
								transform: `translateY(${descTranslateY + descExitTranslateY}px)`,
								WebkitClipPath: descClipPath,
								clipPath: descClipPath,
								willChange: "transform, opacity, clip-path",
							}}
						>
							<p
								style={{
									fontFamily: `"${interFamily}", sans-serif`,
									fontSize: descriptionFontSize,
									fontWeight: 600,
									color: descriptionColor,
									lineHeight: 1.4,
									margin: 0,
									maxWidth: "800px",
									letterSpacing: "-0.2px",
								}}
							>
								{descriptionText}
							</p>
						</div>
					)}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default MediaShowcase;
