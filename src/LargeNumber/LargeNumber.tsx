import React from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { loadInter, loadMontserrat, loadDancingScript } from "../utils/localFonts";

const { fontFamily: interFontFamily } = loadInter();
const { fontFamily: montserratFontFamily } = loadMontserrat();
const { fontFamily: dancingScriptFontFamily } = loadDancingScript();

export interface TextAnimationConfig {
	style: "word-by-word-fade" | "word-by-word-slide-up" | "line-fade" | "line-slide-up";
	startFrame: number;
	staggerFrames: number;
}

export interface NumberAnimationConfig {
	startFrame: number;
	durationFrames: number;
}

export interface LargeNumberProps {
	composition: {
		width: number;
		height: number;
		fps: number;
		durationSeconds: number;
	};
	theme: {
		backgroundColor: string;
		backgroundGradient: string;
		textColor: string;
		subtextColor: string;
		gridColor: string;
		accentColor?: string;
	};
	content: {
		showTopText?: boolean;
		topText: string;
		prefix: string;
		number: number;
		suffix: string;
		showBottomText?: boolean;
		bottomText: string;
		subtitle?: string;
	};
	animation?: {
		topText?: TextAnimationConfig;
		number?: NumberAnimationConfig;
		bottomText?: TextAnimationConfig;
	};
}

interface ParsedSubtitle {
	topText: string;
	prefix: string;
	number: number;
	suffix: string;
	bottomText: string;
}

export function parseSubtitle(text: string): ParsedSubtitle {
	const regex = /(?:([$€£¥])\s*)?(\d+(?:[.,]\d+)?)(?:\s*([a-zA-Z%+\-]+))?/g;
	const candidates: any[] = [];
	let match;

	while ((match = regex.exec(text)) !== null) {
		const matchedString = match[0];
		const prefix = match[1] || "";
		const numberStr = match[2];
		const suffix = match[3] || "";
		const number = parseFloat(numberStr.replace(/,/g, "")) || 0;
		const index = match.index;

		let score = 0;
		if (prefix) score += 2;
		const isCommonSuffix = /^(k|m|b|t|%|x|plus|k\+|m\+|b\+|K|M|B|T|percent)$/i.test(suffix);
		if (suffix) score += isCommonSuffix ? 2 : 1;
		if (!prefix && !suffix && number < 10) score -= 2;

		candidates.push({ matchedString, prefix, number, suffix, index, score });
	}

	if (candidates.length === 0) {
		return { topText: text, prefix: "", number: 0, suffix: "", bottomText: "" };
	}

	candidates.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return Math.abs(b.number) - Math.abs(a.number);
	});

	const best = candidates[0];
	let topText = text.substring(0, best.index).trim();
	if (topText.endsWith(",")) topText = topText.slice(0, -1).trim();

	let bottomText = text.substring(best.index + best.matchedString.length).trim();
	if (bottomText.endsWith(".")) bottomText = bottomText.slice(0, -1).trim();

	return { topText, prefix: best.prefix, number: best.number, suffix: best.suffix, bottomText };
}

const AnimatedText: React.FC<{
	text: string;
	startFrame: number;
	fontFamily: string;
	color: string;
	fps: number;
	frame: number;
	isCursive?: boolean;
	style: "fade" | "slide-up";
}> = ({ text, startFrame, fontFamily, color, fps, frame, isCursive, style }) => {
	const textSpring = spring({
		frame: Math.max(0, frame - startFrame),
		fps,
		config: { damping: 14, stiffness: 85, mass: 0.8 },
	});

	let textY = 0;
	let textOpacity = 1;
	let textBlur = 0;

	if (style === "slide-up") {
		textY = interpolate(textSpring, [0, 1], [25, 0]);
		textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
		textBlur = interpolate(textSpring, [0, 1], [10, 0]);
	} else if (style === "fade") {
		textY = 0;
		textOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
		textBlur = 0;
	}

	return (
		<span
			style={{
				display: "inline-block",
				fontFamily: `"${fontFamily}", ${isCursive ? "cursive" : "sans-serif"}`,
				color,
				opacity: textOpacity,
				transform: `translateY(${textY}px) scaleY(1.15)`,
				filter: `blur(${textBlur}px)`,
				lineHeight: isCursive ? 1.2 : 1.05,
				textShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
			}}
		>
			{text}
		</span>
	);
};

const renderText = (
	text: string, 
	config: TextAnimationConfig | undefined, 
	defaultStart: number, 
	fontFamily: string, 
	isCursive: boolean,
	color: string,
	fps: number,
	frame: number
) => {
	const animStyle = config?.style || "word-by-word-slide-up";
	const start = config?.startFrame ?? defaultStart;
	const stagger = config?.staggerFrames ?? 5;

	const isLine = animStyle.startsWith("line-");
	const baseStyle = animStyle.endsWith("fade") ? "fade" : "slide-up";

	if (isLine) {
		return (
			<AnimatedText
				text={text}
				startFrame={start}
				fontFamily={fontFamily}
				color={color}
				fps={fps}
				frame={frame}
				isCursive={isCursive}
				style={baseStyle}
			/>
		);
	} else {
		// word by word
		const words = text.split(" ").filter(Boolean);
		return (
			<>
				{words.map((word, i) => (
					<React.Fragment key={i}>
						<AnimatedText
							text={word}
							startFrame={start + i * stagger}
							fontFamily={fontFamily}
							color={color}
							fps={fps}
							frame={frame}
							isCursive={isCursive}
							style={baseStyle}
						/>
						{" "}
					</React.Fragment>
				))}
			</>
		);
	}
}

export const LargeNumber: React.FC<LargeNumberProps> = (config) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const parsed = config.content?.subtitle
		? parseSubtitle(config.content.subtitle)
		: null;

	const content = {
		showTopText: config.content?.showTopText ?? true,
		topText: parsed?.topText ?? (config.content?.topText || ""),
		prefix: parsed?.prefix || (config.content?.prefix || ""),
		number: parsed?.number ?? (config.content?.number || 0),
		suffix: parsed?.suffix || (config.content?.suffix || ""),
		showBottomText: config.content?.showBottomText ?? true,
		bottomText: parsed?.bottomText ?? (config.content?.bottomText || ""),
	};

	const textColor = config.theme?.textColor || "#0F172A";
	const accentColor = config.theme?.accentColor || "#EB6F2D";
	const backgroundColor = config.theme?.backgroundColor || "#FAF9F6";
	const backgroundGradient = config.theme?.backgroundGradient || "radial-gradient(circle at center, #FFFFFF 20%, #F5F3ED 70%, #EAE7DC 100%)";
	const gridColor = config.theme?.gridColor || "rgba(30, 27, 24, 0.15)";

	const topWords = content.topText.split(" ").filter(Boolean);

	// Dynamic font size calculations to fit on exactly one line (optimized for legibility)
	const topTextLength = content.topText.length || 1;
	const topFontSize = Math.min(84, Math.max(48, Math.floor(1350 / topTextLength)));

	const bottomTextLength = content.bottomText.length || 1;
	// Bottom text uses cursive font (optically shorter), needs 35% boost + dynamic sizing for long text
	const bottomFontSize = Math.min(
		Math.round(topFontSize * 1.35),
		Math.max(48, Math.floor(1350 / bottomTextLength * 1.35))
	);

	const targetDecimals = content.number.toString().split(".")[1]?.length || 0;
	const finalParts = content.number.toFixed(targetDecimals).split(".");
	const finalFormattedInteger = Number(finalParts[0]).toLocaleString();
	const finalFormattedNumber = finalParts[1] ? `${finalFormattedInteger}.${finalParts[1]}` : finalFormattedInteger;
	const numberLength = (content.prefix + finalFormattedNumber + content.suffix).length || 1;
	const numberFontSize = Math.min(145, Math.max(70, Math.floor(1600 / numberLength)));

	const startFrameTop = config.animation?.topText?.startFrame ?? 10;
	const metricStartFrame = config.animation?.number?.startFrame ?? (startFrameTop + (topWords.length * 5) + 15);
	const durationFrames = config.animation?.number?.durationFrames ?? 40;
	const bottomStartFrame = config.animation?.bottomText?.startFrame ?? (metricStartFrame + 25);

	// Number Count-up
	const countProgress = interpolate(frame, [metricStartFrame, metricStartFrame + durationFrames], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});

	const currentValue = 0 + (content.number - 0) * countProgress;
	const parts = currentValue.toFixed(targetDecimals).split(".");
	const formattedInteger = Number(parts[0]).toLocaleString();
	const formattedNumber = parts[1] ? `${formattedInteger}.${parts[1]}` : formattedInteger;

	// Large number entrance
	const numberScaleSpring = spring({
		frame: Math.max(0, frame - metricStartFrame),
		fps,
		config: { damping: 14, stiffness: 90, mass: 0.8 },
	});
	const numberScale = interpolate(numberScaleSpring, [0, 1], [0.85, 1]);

	const numberBlur = interpolate(frame, [metricStartFrame, metricStartFrame + 15], [20, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const numberOpacity = interpolate(frame, [metricStartFrame, metricStartFrame + 12], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const numberY = interpolate(numberScaleSpring, [0, 1], [40, 0]);

	const GRID_W = config.composition?.width || 1080;
	const GRID_H = config.composition?.height || 1920;
	const LINE_SPACING = 80;
	const vLinesCount = Math.ceil(GRID_W / LINE_SPACING) + 1;
	const hLinesCount = Math.ceil(GRID_H / LINE_SPACING) + 1;

	return (
		<AbsoluteFill
			style={{
				backgroundColor,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				position: "relative",
			}}
		>
			<div style={{ position: "absolute", inset: 0, background: backgroundGradient }} />
			<div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)", pointerEvents: "none" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay", pointerEvents: "none" }} />

			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: 0.85,
					WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 20%, transparent 90%)",
					maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 20%, transparent 90%)",
					pointerEvents: "none",
					transform: `scale(${interpolate(frame, [0, 300], [1, 1.08], { extrapolateRight: "clamp" })}) rotate(${interpolate(frame, [0, 300], [0, 1.5], { extrapolateRight: "clamp" })}deg)`,
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: vLinesCount }).map((_, i) => (
						<line key={`v-${i}`} x1={i * LINE_SPACING} y1={0} x2={i * LINE_SPACING} y2={GRID_H} stroke={gridColor} strokeWidth={1.5} />
					))}
					{Array.from({ length: hLinesCount }).map((_, i) => (
						<line key={`h-${i}`} x1={0} y1={i * LINE_SPACING} x2={GRID_W} y2={i * LINE_SPACING} stroke={gridColor} strokeWidth={1.5} />
					))}
				</svg>
			</div>

			{/* Content Wrapper */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
					zIndex: 10,
					padding: "0 40px",
					width: "100%",
					boxSizing: "border-box",
					gap: "15px", 
				}}
			>
				{/* Top Text - Normal Sans-Serif Font */}
				{content.showTopText && content.topText.length > 0 && (
					<div
						style={{
							fontSize: `${topFontSize}px`,
							fontWeight: 400,
							textTransform: "uppercase",
							whiteSpace: "nowrap",
							maxWidth: "100%",
							textAlign: "center",
							opacity: 0.7,
						}}
					>
						{renderText(content.topText, config.animation?.topText, startFrameTop, montserratFontFamily, false, textColor, fps, frame)}
					</div>
				)}

				{/* Huge Animated Number Statement - Constant Sans-Serif Font */}
				<div
					style={{
						fontFamily: `"${interFontFamily}", sans-serif`,
						fontSize: `${numberFontSize}px`,
						fontWeight: 900,
						color: textColor,
						lineHeight: 1,
						letterSpacing: "-4px",
						opacity: numberOpacity,
						transform: `translateY(${numberY}px) scale(${numberScale}) scaleY(1.15)`,
						filter: `blur(${numberBlur}px)`,
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						textShadow: "0 12px 40px rgba(0, 0, 0, 0.06)",
						whiteSpace: "nowrap",
					}}
				>
					{content.prefix && (
						<span style={{ color: accentColor, marginRight: "5px" }}>
							{content.prefix}
						</span>
					)}
					<span>{formattedNumber}</span>
					{content.suffix && (
						<span style={{ color: accentColor, marginLeft: "5px" }}>
							{content.suffix}
						</span>
					)}
				</div>

				{/* Bottom Text - Cursive Font matching top text spacing and size */}
				{content.showBottomText && content.bottomText.length > 0 && (
					<div
						style={{
							fontSize: `${bottomFontSize}px`,
							fontWeight: 500,
							whiteSpace: "nowrap",
							maxWidth: "100%",
							textAlign: "center",
							opacity: 0.7,
						}}
					>
						{renderText(content.bottomText, config.animation?.bottomText, bottomStartFrame, dancingScriptFontFamily, true, textColor, fps, frame)}
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};

export default LargeNumber;
