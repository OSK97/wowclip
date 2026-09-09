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
	Easing,
} from "remotion";
import { loadOutfit, loadInter, loadPlayfair, loadLora } from "../../utils/localFonts";
import rawConfigJson from "./quote-card.json";

// ─── Font Loading ─────────────────────────────────────────────────────────────

const { fontFamily: outfitFamily } = loadOutfit("normal", {
	weights: ["400", "600", "700", "800", "900"],
});

const { fontFamily: interFamily } = loadInter("normal", {
	weights: ["400", "500", "600", "700", "800"],
});

const { fontFamily: playfairFamily } = loadPlayfair("normal", {
	weights: ["400", "600", "700", "900"],
});

const { fontFamily: loraFamily } = loadLora("normal", {
	weights: ["400", "700"],
});

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

export interface QuoteCardConfig {
	fps?: number;
	durationInSeconds?: number;
	backgroundVideo?: string;
	whiteOverlayOpacity?: number;
	theme?: {
		backgroundColor?: string;
		showQuoteSymbols?: boolean;
		quoteSymbolColor?: string;
		fontFamily?: "Outfit" | "Inter" | "Playfair" | "Lora";
	};
	quote?: {
		text?: string;
		color?: string;
		highlightColor?: string;
		fontSize?: number;
		fontWeight?: number;
	};
	author?: {
		name?: string;
		nameColor?: string;
	};
}

export const QuoteCard: React.FC<{ config?: QuoteCardConfig }> = ({ config: propConfig }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const c = (propConfig || rawConfigJson) as QuoteCardConfig;

	// Background Video & Whitish Overlay control index
	const bgVideoUrl = c.backgroundVideo || "planner_bg.mp4";
	const whiteOverlayOpacity = c.whiteOverlayOpacity ?? 0.52;

	// Theme Settings
	const theme = c.theme || {};
	const showQuoteSymbols = theme.showQuoteSymbols ?? true;
	const quoteSymbolColor = theme.quoteSymbolColor || "rgba(37, 99, 235, 0.22)";

	let mainFont = outfitFamily;
	if (theme.fontFamily === "Inter") mainFont = interFamily;
	if (theme.fontFamily === "Playfair") mainFont = playfairFamily;
	if (theme.fontFamily === "Lora") mainFont = loraFamily;

	// Quote Settings
	const quoteCfg = c.quote || {};
	const quoteText = quoteCfg.text || "If you don't find a way to make money while you sleep, you will work until you die.";
	const quoteColor = quoteCfg.color || "#0F172A";
	const highlightColor = quoteCfg.highlightColor || "#2563EB";
	const baseFontSize = quoteCfg.fontSize || 72;
	const quoteFontWeight = quoteCfg.fontWeight || 900;

	// Dynamic auto-scaling font size based on character count
	const charCount = quoteText.length;
	let adjustedFontSize = baseFontSize;
	if (charCount > 160) {
		adjustedFontSize = 46;
	} else if (charCount > 100) {
		adjustedFontSize = 54;
	} else if (charCount > 60) {
		adjustedFontSize = 68;
	} else if (charCount < 30) {
		adjustedFontSize = 80;
	}

	// Author Settings (Right-aligned like classic letters & old books)
	const authorCfg = c.author || {};
	const authorName = authorCfg.name || "Warren Buffett";
	const nameColor = authorCfg.nameColor || "#0F172A";

	// ─── Animations ─────────────────────────────────────────────────────────────

	// Opening & Closing Quote Marks Entrance
	const quoteSymbolSpring = spring({
		frame: Math.max(0, frame - 5),
		fps,
		config: { damping: 14, stiffness: 60 },
	});
	const quoteSymbolScale = interpolate(quoteSymbolSpring, [0, 1], [0.5, 1]);
	const quoteSymbolOpacity = interpolate(quoteSymbolSpring, [0, 1], [0, 1]);

	// Word-by-word kinetic animation timing
	const words = quoteText.split(" ");
	const wordStagger = 3;

	// Right-aligned Author Name Entrance after quote completes
	const quoteFinishFrame = 10 + words.length * wordStagger;

	const authorSpring = spring({
		frame: Math.max(0, frame - (quoteFinishFrame + 2)),
		fps,
		config: { damping: 16, stiffness: 75 },
	});
	const authorOpacity = interpolate(authorSpring, [0, 1], [0, 1]);
	const authorTranslateX = interpolate(authorSpring, [0, 1], [25, 0]);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#FFFFFF",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				overflow: "hidden",
				fontFamily: `"${interFamily}", sans-serif`,
			}}
		>
			{/* 1. Background Video with Whitish Overlay */}
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
				{/* Whiteness Control Mask */}
				{whiteOverlayOpacity > 0 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							backgroundColor: `rgba(255, 255, 255, ${whiteOverlayOpacity})`,
							backgroundImage: `radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, ${Math.max(0, whiteOverlayOpacity - 0.15)}) 0%, rgba(255, 255, 255, ${Math.min(1, whiteOverlayOpacity + 0.15)}) 100%)`,
						}}
					/>
				)}
			</div>

			{/* 2. Main Vertical Quote Container */}
			<div
				style={{
					position: "relative",
					zIndex: 10,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					maxWidth: "960px",
					width: "88%",
					padding: "40px 0",
					boxSizing: "border-box",
				}}
			>
				{/* Center Quote Block Wrapper - fit-content wrapper so quote marks tightly frame the text */}
				<div
					style={{
						position: "relative",
						display: "inline-block",
						maxWidth: "860px",
						width: "fit-content",
						textAlign: "center",
						padding: "15px 35px",
					}}
				>
					{/* Opening Quote Mark “ (Tightly framed top-left) */}
					{showQuoteSymbols && (
						<div
							style={{
								position: "absolute",
								top: -30,
								left: -25,
								fontSize: 130,
								fontFamily: `"${playfairFamily}", Georgia, serif`,
								color: quoteSymbolColor,
								lineHeight: 0.6,
								transform: `scale(${quoteSymbolScale})`,
								opacity: quoteSymbolOpacity,
								pointerEvents: "none",
								userSelect: "none",
							}}
						>
							“
						</div>
					)}

					{/* Kinetic Large Quote Text Block */}
					<div
						style={{
							position: "relative",
							zIndex: 5,
							fontFamily: `"${mainFont}", sans-serif`,
							width: "100%",
							textAlign: "center",
							lineHeight: 1.18,
						}}
					>
						{words.map((word, i) => {
							const wordStartFrame = 10 + i * wordStagger;
							
							// Current word active highlight frame window
							const isActiveWord =
								frame >= wordStartFrame && frame < wordStartFrame + wordStagger + 6;

							const wordOpacity = interpolate(frame - wordStartFrame, [0, 8], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							});

							const wordScale = isActiveWord
								? interpolate(frame - wordStartFrame, [0, 5, 10], [1, 1.08, 1], {
										extrapolateLeft: "clamp",
										extrapolateRight: "clamp",
								  })
								: 1;

							const currentWordColor = isActiveWord ? highlightColor : quoteColor;

							return (
								<span
									key={i}
									style={{
										display: "inline-block",
										fontSize: adjustedFontSize,
										fontWeight: quoteFontWeight,
										color: currentWordColor,
										letterSpacing: "-1.5px",
										opacity: wordOpacity,
										transform: `scale(${wordScale})`,
										transition: "color 0.15s ease",
										marginRight: i === words.length - 1 ? 0 : "0.24em",
									}}
								>
									{word}
								</span>
							);
						})}
					</div>

					{/* Closing Quote Mark ” (Tightly framed bottom-right) */}
					{showQuoteSymbols && (
						<div
							style={{
								position: "absolute",
								bottom: -60,
								right: -25,
								fontSize: 130,
								fontFamily: `"${playfairFamily}", Georgia, serif`,
								color: quoteSymbolColor,
								lineHeight: 0.6,
								transform: `scale(${quoteSymbolScale})`,
								opacity: quoteSymbolOpacity,
								pointerEvents: "none",
								userSelect: "none",
							}}
						>
							”
						</div>
					)}
				</div>

				{/* Right-Aligned Author Name (Classic Book & Letter Style) */}
				{authorName && (
					<div
						style={{
							width: "100%",
							display: "flex",
							justifyContent: "flex-end",
							marginTop: 32,
							paddingRight: 24,
							opacity: authorOpacity,
							transform: `translateX(${authorTranslateX}px)`,
						}}
					>
						<div
							style={{
								fontFamily: `"${playfairFamily}", "${outfitFamily}", serif`,
								fontSize: 34,
								fontWeight: 700,
								fontStyle: "italic",
								color: nameColor,
								letterSpacing: "-0.5px",
							}}
						>
							— {authorName}
						</div>
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};

export default QuoteCard;
