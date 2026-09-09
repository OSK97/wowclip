import React from "react";
import {
	AbsoluteFill,
	Img,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	spring,
	Video,
	Sequence,
} from "remotion";
import { loadOutfit, loadInter, loadPlayfair } from "../../utils/localFonts";
import rawConfig from "./text-behind-person.json";

// ─── Font Loading ─────────────────────────────────────────────────────────────

const { fontFamily: outfitFamily } = loadOutfit("normal", {
	weights: ["400", "700"],
});
const { fontFamily: interFamily } = loadInter("normal", {
	weights: ["400", "700", "800", "900"],
});
const { fontFamily: playfairFamily } = loadPlayfair("normal", {
	weights: ["400", "600", "700"],
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextBehindPersonConfig {
	fps?: number;
	durationInSeconds?: number;
	totalFrames?: number;
	clip?: string;
	framesDir?: string;
	foregroundDir?: string;
	text?: {
		line1?: string;
		line1Style?: "italic-serif" | "bold-sans";
		line2?: string;
		line2Style?: "italic-serif" | "bold-sans";
		line3?: string;
		line3Style?: "italic-serif" | "bold-sans";
	};
	placement?: {
		textY?: number;
		textX?: number;
		fontSize?: number;
		textColor?: string;
		textShadow?: string;
		personPosition?: string;
	};
}

// ─── Foreground Layer (Person PNG Sequence) ──────────────────────────────────

const ForegroundLayer: React.FC<{
	foregroundDir: string;
	totalFrames: number;
}> = ({ foregroundDir, totalFrames }) => {
	const frame = useCurrentFrame();
	const frameNumber = Math.min(Math.max(frame + 1, 1), totalFrames);
	const paddedFrame = String(frameNumber).padStart(4, "0");
	const src = staticFile(`${foregroundDir}/frame_${paddedFrame}.png`);

	return (
		<AbsoluteFill>
			<Img
				src={src}
				style={{
					width: "100%",
					height: "100%",
					objectFit: "cover",
				}}
			/>
		</AbsoluteFill>
	);
};

// ─── Overlapping Text Layer (BEHIND person) ─────────────────────────────────

const OverlappingText: React.FC<{
	config: TextBehindPersonConfig;
}> = ({ config }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const textCfg = config.text || {};
	const placement = config.placement || {};

	const line1 = textCfg.line1 || "DISCIPLINE";
	const line2 = textCfg.line2 || "CHANGES";
	const line3 = textCfg.line3 || "everything";
	const line1Style = textCfg.line1Style || "italic-serif";
	const line2Style = textCfg.line2Style || "bold-sans";
	const line3Style = textCfg.line3Style || "italic-serif";

	const textColor = placement.textColor || "#FFFFFF";
	const fontSize = placement.fontSize || 90;
	const textY = placement.textY || 850;
	const textShadow = placement.textShadow || "0 4px 20px rgba(0,0,0,0.5)";

	// Font helpers
	const getFont = (style: string) => {
		if (style === "italic-serif") return `"${playfairFamily}", Georgia, serif`;
		return `"${interFamily}", sans-serif`;
	};
	const getWeight = (style: string) => (style === "italic-serif" ? 600 : 900);
	const getItalic = (style: string) => (style === "italic-serif" ? "italic" : "normal");
	const getSize = (style: string, base: number) =>
		style === "italic-serif" ? base * 0.65 : base;

	// Staggered spring entrance animations
	const animLine1 = spring({
		frame: frame - 8,
		fps,
		config: { damping: 22, stiffness: 100, mass: 1.0 },
	});
	const line1Y = interpolate(animLine1, [0, 1], [50, 0], {
		extrapolateRight: "clamp",
	});
	const line1Opacity = interpolate(animLine1, [0, 0.5], [0, 1], {
		extrapolateRight: "clamp",
	});

	const animLine2 = spring({
		frame: frame - 18,
		fps,
		config: { damping: 22, stiffness: 100, mass: 1.0 },
	});
	const line2Y = interpolate(animLine2, [0, 1], [50, 0], {
		extrapolateRight: "clamp",
	});
	const line2Opacity = interpolate(animLine2, [0, 0.5], [0, 1], {
		extrapolateRight: "clamp",
	});

	const animLine3 = spring({
		frame: frame - 28,
		fps,
		config: { damping: 22, stiffness: 100, mass: 1.0 },
	});
	const line3Y = interpolate(animLine3, [0, 1], [50, 0], {
		extrapolateRight: "clamp",
	});
	const line3Opacity = interpolate(animLine3, [0, 0.5], [0, 1], {
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: textY - fontSize * 1.2,
					left: 0,
					right: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 0,
				}}
			>
				{/* Line 1 (e.g. italic serif) */}
				<div
					style={{
						fontFamily: getFont(line1Style),
						fontWeight: getWeight(line1Style),
						fontStyle: getItalic(line1Style),
						fontSize: getSize(line1Style, fontSize),
						color: textColor,
						textShadow,
						letterSpacing: line1Style === "italic-serif" ? "0px" : "-2px",
						whiteSpace: "nowrap",
						textAlign: "center",
						transform: `translateY(${line1Y}px)`,
						opacity: line1Opacity,
						alignSelf: "flex-start",
						marginLeft: 80,
					}}
				>
					{line1}
				</div>

				{/* Line 2 (e.g. bold sans — main word) */}
				<div
					style={{
						fontFamily: getFont(line2Style),
						fontWeight: getWeight(line2Style),
						fontStyle: getItalic(line2Style),
						fontSize: getSize(line2Style, fontSize),
						color: textColor,
						textShadow,
						letterSpacing: line2Style === "bold-sans" ? "-3px" : "0px",
						mixBlendMode: "difference",
						whiteSpace: "nowrap",
						textAlign: "center",
						transform: `translateY(${line2Y}px)`,
						opacity: line2Opacity,
					}}
				>
					{line2}
				</div>

				{/* Line 3 (e.g. italic serif) */}
				<div
					style={{
						fontFamily: getFont(line3Style),
						fontWeight: getWeight(line3Style),
						fontStyle: getItalic(line3Style),
						fontSize: getSize(line3Style, fontSize),
						color: textColor,
						textShadow,
						letterSpacing: line3Style === "italic-serif" ? "0px" : "-2px",
						whiteSpace: "nowrap",
						textAlign: "center",
						transform: `translateY(${line3Y}px)`,
						opacity: line3Opacity,
						alignSelf: "flex-end",
						marginRight: 80,
					}}
				>
					{line3}
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const TextBehindPerson: React.FC<{
	config?: TextBehindPersonConfig;
}> = ({ config: propConfig }) => {
	const c = (propConfig || rawConfig) as TextBehindPersonConfig;

	const clipSrc = c.clip || "tbp_assets/clip.mp4";
	const foregroundDir = c.foregroundDir || "tbp_assets/foreground";
	const totalFrames = c.totalFrames || 96;

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* LAYER 1: Background Video (Muted) */}
			<AbsoluteFill>
				<Video
					src={staticFile(clipSrc)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
					muted
				/>
			</AbsoluteFill>

			{/* LAYER 1.5: Subtle dark overlay for text readability */}
			<AbsoluteFill
				style={{
					background:
						"radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 100%)",
				}}
			/>

			{/* LAYER 2: Text (BEHIND the person) */}
			<Sequence durationInFrames={totalFrames}>
				<OverlappingText config={c} />
			</Sequence>

			{/* LAYER 3: Foreground Person Cutout (ON TOP of text) */}
			<ForegroundLayer
				foregroundDir={foregroundDir}
				totalFrames={totalFrames}
			/>
		</AbsoluteFill>
	);
};

export default TextBehindPerson;
