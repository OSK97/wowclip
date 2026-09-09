import React, { useEffect, useState, useMemo } from "react";
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	staticFile,
	delayRender,
	continueRender,
	interpolate,
	spring,
	Easing,
	Img,
} from "remotion";
import configJson from "./config.json";
import { loadInter, loadMontserrat, loadDancingScript } from "../../utils/localFonts";
import { SmartTextView, Segment, ThemeConfig as SmartTextThemeConfig } from "../SingleMap/SmartTextView";

// Define configuration interfaces
interface StateConfig {
	id: string;
	displayName?: string;
	image?: string;
	mode?: "number" | "smart_text" | "points" | "image_only";
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
	points?: string[];
	contentImage?: string;
	value?: {
		prefix?: string;
		number: number;
		suffix?: string;
		label?: string;
	};
	theme?: {
		highlightColor?: string;
	};
}

interface ThemeConfig {
	mapColor?: string;
	highlightColor?: string;
	backgroundColor?: string;
	gridColor?: string;
	textColor?: string;
	dividerColor?: string;
}

interface RawConfig {
	country?: string;
	states?: StateConfig[];
	theme?: ThemeConfig;
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	theme: rawConfig.theme || {
		mapColor: "#dadada",
		highlightColor: "#E63946",
		backgroundColor: "#FAF9F6",
		gridColor: "rgba(30, 27, 24, 0.20)",
		textColor: "#0F172A",
		dividerColor: "rgba(15, 23, 42, 0.15)",
	}
};

const statesConfig: StateConfig[] = rawConfig.states || [];

interface StateBounds {
	id: string;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	pathDatas: string[];
}

function measureAllStatesBounds(
	svgText: string,
	pathIds: string[]
): StateBounds[] {
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.left = "0";
	container.style.top = "0";
	container.style.width = "1000px";
	container.style.height = "1000px";
	container.style.opacity = "0";
	container.style.pointerEvents = "none";
	container.style.zIndex = "-9999";
	container.innerHTML = svgText;
	document.body.appendChild(container);

	const svgEl = container.querySelector("svg");
	if (!svgEl) {
		document.body.removeChild(container);
		return [];
	}

	svgEl.setAttribute("width", "1000");
	svgEl.setAttribute("height", "1000");

	const results: StateBounds[] = [];

	for (const id of pathIds) {
		const el = svgEl.querySelector(`#${id}`) as SVGGraphicsElement | null;
		if (el) {
			const bbox = el.getBBox();
			const pathDatas: string[] = [];

			if (el.tagName.toLowerCase() === "path") {
				const d = el.getAttribute("d");
				if (d) pathDatas.push(d);
			} else {
				const childPaths = el.querySelectorAll("path");
				childPaths.forEach((cp) => {
					const d = cp.getAttribute("d");
					if (d) pathDatas.push(d);
				});
			}

			if (pathDatas.length > 0) {
				results.push({
					id,
					minX: bbox.x,
					minY: bbox.y,
					maxX: bbox.x + bbox.width,
					maxY: bbox.y + bbox.height,
					pathDatas
				});
			}
		}
	}

	document.body.removeChild(container);
	return results;
}

interface LoadedImage {
	url: string;
	aspectRatio: number;
}

interface LoadedImageWithMap extends LoadedImage {
	path: string;
}

function injectBuildingLayers(
	svg: string,
	states: StateBounds[],
	statesConfigArray: StateConfig[],
	imageMap: Record<string, LoadedImage>
): string {
	if (states.length === 0) return svg;

	let defsStr = "";
	let layersStr = "";

	states.forEach((state) => {
		const stateConf = statesConfigArray.find((s) => s.id === state.id);
		if (!stateConf || !stateConf.image) return;

		const img = imageMap[stateConf.image];
		if (!img) return;

		const { minX, minY, maxX, maxY, pathDatas } = state;
		const w = maxX - minX;
		const h = maxY - minY;

		const bWidth = w * 0.85;
		const bHeight = bWidth / img.aspectRatio;
		const bX = minX + w / 2 - bWidth / 2;
		const bY = maxY - bHeight + 5;

		const clipPaths = pathDatas.map((d) => `<path d="${d}"/>`).join("\n");
		const stateClipId = `state-clip-${state.id}`;
		defsStr += `
  <clipPath id="${stateClipId}">
    ${clipPaths}
  </clipPath>
`;

		const cutOffY = minY + h * 0.24;
		const popRectTop = bY - 500;
		const popRectHeight = cutOffY - popRectTop;

		const popoutClipId = `popout-clip-${state.id}`;
		defsStr += `
  <clipPath id="${popoutClipId}">
    <rect x="${bX - 500}" y="${popRectTop}" width="${bWidth + 1000}" height="${popRectHeight}"/>
  </clipPath>
`;

		layersStr += `
<!-- State ${state.id} Image Layer 1: Bottom half strictly clipped to the state border -->
<image class="building-overlay" href="${img.url}" x="${bX}" y="${bY}" width="${bWidth}" height="${bHeight}"
  clip-path="url(#${stateClipId})" preserveAspectRatio="xMidYMax slice"></image>

<!-- State ${state.id} Image Layer 2: Top half popping out above the cut-off line -->
<image class="building-overlay" href="${img.url}" x="${bX}" y="${bY}" width="${bWidth}" height="${bHeight}"
  clip-path="url(#${popoutClipId})" preserveAspectRatio="xMidYMax slice"></image>
`;
	});

	if (!defsStr && !layersStr) return svg;

	const injection = `
<!-- POP-OUT BUILDING LAYERS -->
<defs>
  ${defsStr}
</defs>
${layersStr}
`;

	return svg.replace("</svg>", `${injection}\n</svg>`);
}

export const ComparisonMap: React.FC = () => {
	const { width: compWidth, height: compHeight } = useVideoConfig();
	const { fontFamily: montserratFontFamily } = loadMontserrat();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [rawSvgText, setRawSvgText] = useState<string | null>(null);
	const [imageMap, setImageMap] = useState<Record<string, LoadedImage>>({});

	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		
		const uniqueImages = Array.from(
			new Set(statesConfig.map((s) => s.image).filter(Boolean))
		) as string[];

		const imagePromises = uniqueImages.map((imagePath) => {
			const imgUrl = staticFile(imagePath);
			const img = new globalThis.Image();
			img.src = imgUrl;
			return new Promise<LoadedImageWithMap>((resolve) => {
				img.onload = () => resolve({ path: imagePath, url: imgUrl, aspectRatio: img.width / img.height });
				img.onerror = () => resolve({ path: imagePath, url: imgUrl, aspectRatio: 1.0 });
			});
		});

		Promise.all([
			fetch(svgUrl).then((res) => res.text()),
			Promise.all(imagePromises)
		]).then(([rawText, loadedImages]) => {
			setRawSvgText(rawText);

			const imgMap: Record<string, LoadedImage> = {};
			loadedImages.forEach((img) => {
				imgMap[img.path] = { url: img.url, aspectRatio: img.aspectRatio };
			});
			setImageMap(imgMap);

			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load map:", err);
			continueRender(handle);
		});
	}, [handle]);

	const gridOpacity = 0.85;
	const comparisonStates = statesConfig.slice(0, 3);
	const numPanels = comparisonStates.length;
	const isPortrait = compWidth < compHeight;

	if (numPanels < 2) {
		return (
			<AbsoluteFill style={{ backgroundColor: "#FAF9F6", display: "flex", justifyContent: "center", alignItems: "center" }}>
				<span style={{ fontSize: "24px", color: "#0F172A" }}>Please specify at least 2 states to compare in config.json</span>
			</AbsoluteFill>
		);
	}

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				overflow: "hidden",
				display: "flex",
				flexDirection: isPortrait ? "column" : "row",
			}}
		>
			{/* Grid */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: isPortrait ? compWidth : compWidth * 0.9,
					height: isPortrait ? compHeight * 0.9 : compHeight,
					opacity: gridOpacity,
					WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					pointerEvents: "none",
					zIndex: 1,
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: 15 }).map((_, i) => (
						<line key={`v-${i}`} x1={i * 80} y1={0} x2={i * 80} y2={compHeight} stroke={config.theme.gridColor} strokeWidth={1} />
					))}
					{Array.from({ length: 25 }).map((_, i) => (
						<line key={`h-${i}`} x1={0} y1={i * 80} x2={compWidth} y2={i * 80} stroke={config.theme.gridColor} strokeWidth={1} />
					))}
				</svg>
			</div>

			{/* Panels */}
			{comparisonStates.map((stateConf, idx) => (
				<StateComparisonPanel
					key={stateConf.id}
					stateConf={stateConf}
					index={idx}
					total={numPanels}
					rawSvgText={rawSvgText}
					imageMap={imageMap}
					theme={config.theme}
					compWidth={compWidth}
					compHeight={compHeight}
				/>
			))}

			{/* Divider and circular VS badge if comparing 2 states */}
			{numPanels === 2 && (
				<Divider
					vertical={!isPortrait}
					dividerColor={config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"}
					showVs={true}
					fontFamily={montserratFontFamily}
				/>
			)}

			{/* Simple dividers if comparing 3 states */}
			{numPanels === 3 && (
				<>
					<div
						style={{
							position: "absolute",
							left: isPortrait ? 0 : "33.33%",
							top: isPortrait ? "33.33%" : 0,
							width: isPortrait ? "100%" : "1.5px",
							height: isPortrait ? "1.5px" : "100%",
							background: isPortrait 
								? `linear-gradient(to right, transparent, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 15%, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 85%, transparent)`
								: `linear-gradient(to bottom, transparent, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 15%, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 85%, transparent)`,
							zIndex: 30,
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: isPortrait ? 0 : "66.66%",
							top: isPortrait ? "66.66%" : 0,
							width: isPortrait ? "100%" : "1.5px",
							height: isPortrait ? "1.5px" : "100%",
							background: isPortrait 
								? `linear-gradient(to right, transparent, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 15%, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 85%, transparent)`
								: `linear-gradient(to bottom, transparent, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 15%, ${config.theme.dividerColor || "rgba(15, 23, 42, 0.15)"} 85%, transparent)`,
							zIndex: 30,
						}}
					/>
				</>
			)}
		</AbsoluteFill>
	);
};

const StateComparisonPanel: React.FC<{
	stateConf: StateConfig;
	index: number;
	total: number;
	rawSvgText: string | null;
	imageMap: Record<string, LoadedImage>;
	theme: ThemeConfig;
	compWidth: number;
	compHeight: number;
}> = ({
	stateConf,
	index,
	total,
	rawSvgText,
	imageMap,
	theme,
	compWidth,
	compHeight,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const { fontFamily: interFontFamily } = loadInter();
	const { fontFamily: montserratFontFamily } = loadMontserrat();
	const { fontFamily: dancingScriptFontFamily } = loadDancingScript();

	const stateBounds = useMemo(() => {
		if (!rawSvgText) return null;
		const results = measureAllStatesBounds(rawSvgText, [stateConf.id]);
		return results.length > 0 ? results[0] : null;
	}, [rawSvgText, stateConf.id]);

	const svgToRender = useMemo(() => {
		if (!rawSvgText || !stateBounds) return null;

		let svg = rawSvgText
			.replace(/\s+width="[^"]*"/g, "")
			.replace(/\s+height="[^"]*"/g, "");

		const { minX, minY, maxX, maxY } = stateBounds;
		const w = maxX - minX;
		const h = maxY - minY;
		const padding = Math.max(w, h) * 0.22;
		const vb = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

		if (/view[bB]ox="[^"]*"/i.test(svg)) {
			svg = svg.replace(/view[bB]ox="[^"]*"/i, `viewBox="${vb}"`);
		} else {
			svg = svg.replace(/<svg/i, `<svg viewBox="${vb}"`);
		}

		if (stateConf.image && imageMap[stateConf.image]) {
			svg = injectBuildingLayers(svg, [stateBounds], [stateConf], imageMap);
		}

		return svg;
	}, [rawSvgText, stateBounds, stateConf, imageMap]);

	const panelStartFrame = 10 + index * 18;
	const localFrame = Math.max(0, frame - panelStartFrame);

	const mapSpring = spring({
		frame: localFrame,
		fps,
		config: { damping: 15, stiffness: 75, mass: 1 },
	});
	const mapOpacity = interpolate(mapSpring, [0, 1], [0, 1]);
	const mapScale = interpolate(mapSpring, [0, 1], [0.85, 1]);

	const cardSpring = spring({
		frame: Math.max(0, localFrame - 5),
		fps,
		config: { damping: 15, stiffness: 80, mass: 0.9 },
	});
	const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
	const cardTranslateY = interpolate(cardSpring, [0, 1], [30, 0]);

	const countProgress = interpolate(localFrame, [15, 55], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.bezier(0.16, 1, 0.3, 1),
	});

	const valNumber = stateConf.value?.number || 0;
	const targetDecimals = valNumber.toString().split(".")[1]?.length || 0;
	const currentValue = valNumber * countProgress;
	const parts = currentValue.toFixed(targetDecimals).split(".");
	const formattedInteger = Number(parts[0]).toLocaleString();
	const formattedNumber = parts[1] ? `${formattedInteger}.${parts[1]}` : formattedInteger;

	const numberSpring = spring({
		frame: Math.max(0, localFrame - 15),
		fps,
		config: { damping: 14, stiffness: 90, mass: 0.8 },
	});
	const numberScale = interpolate(numberSpring, [0, 1], [0.85, 1]);
	const numberBlur = interpolate(localFrame, [15, 30], [20, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const numberOpacity = interpolate(localFrame, [15, 27], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const numberY = interpolate(numberSpring, [0, 1], [40, 0]);

	const highlightColor = stateConf.theme?.highlightColor || theme.highlightColor;
	const isPortrait = compWidth < compHeight;

	const panelWidth = isPortrait ? "100%" : `${100 / total}%`;
	const panelHeight = isPortrait ? `${100 / total}%` : "100%";

	return (
		<div
			className={`panel-container-${stateConf.id}`}
			style={{
				width: panelWidth,
				height: panelHeight,
				position: "relative",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				overflow: "hidden",
			}}
		>
			<style>{`
				.panel-container-${stateConf.id} svg path {
					display: none !important;
				}
				.panel-container-${stateConf.id} svg #${stateConf.id},
				.panel-container-${stateConf.id} svg #${stateConf.id} path {
					display: block !important;
					fill: ${highlightColor} !important;
					stroke-width: 0.5px !important;
				}
				.panel-container-${stateConf.id} svg clipPath path {
					display: block !important;
				}
				.panel-container-${stateConf.id} svg image.building-overlay {
					display: block !important;
					pointer-events: none;
				}
				.panel-container-${stateConf.id} svg {
					filter: drop-shadow(0px 15px 25px rgba(0,0,0,0.12));
					overflow: visible !important;
				}
			`}</style>

			<div
				style={{
					width: isPortrait ? "70%" : "85%",
					height: isPortrait ? "70%" : "85%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					opacity: svgToRender ? mapOpacity : 0,
					transform: `scale(${mapScale})`,
					marginTop: isPortrait ? "-80px" : "-100px",
				}}
			>
				{svgToRender && (
					<div
						style={{ width: "100%", height: "100%" }}
						dangerouslySetInnerHTML={{ __html: svgToRender }}
					/>
				)}
			</div>

			<div
				style={{
					position: "absolute",
					bottom: isPortrait ? "40px" : "50px",
					left: "30px",
					right: "30px",
					backgroundColor: "rgba(255, 255, 255, 0.85)",
					backdropFilter: "blur(16px)",
					borderRadius: "28px",
					padding: "25px 35px",
					boxShadow: "0 20px 45px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.02)",
					border: "1px solid rgba(255, 255, 255, 0.6)",
					display: "flex",
					flexDirection: "column",
					gap: "4px",
					zIndex: 20,
					opacity: cardOpacity,
					transform: `translateY(${cardTranslateY}px)`,
				}}
			>
				<span
					style={{
						fontFamily: `"${montserratFontFamily}", sans-serif`,
						fontSize: "18px",
						fontWeight: 700,
						textTransform: "uppercase",
						color: highlightColor,
						letterSpacing: "2px",
					}}
				>
					{stateConf.displayName || stateConf.id}
				</span>

				{/* Generic Dynamic Content Container inside the Card */}
				{(() => {
					const mode = stateConf.mode || (stateConf.smartTextSegments ? "smart_text" : stateConf.points ? "points" : stateConf.contentImage ? "image_only" : "number");

					if (mode === "smart_text" && stateConf.smartTextSegments) {
						return (
							<div style={{ marginTop: "10px", width: "100%", display: "flex", justifyContent: "flex-start" }}>
								<SmartTextView 
									segments={stateConf.smartTextSegments} 
									isOverlay={true} 
									theme={{ textAlign: "left", textFontSize: 24, numberFontSize: 40, contentPaddingX: 0, ...stateConf.smartTextTheme }} 
								/>
							</div>
						);
					}

					if (mode === "points" && stateConf.points) {
						return (
							<ul style={{ 
								textAlign: "left", 
								listStyleType: "disc", 
								paddingLeft: "20px", 
								color: theme.textColor || "#0F172A", 
								margin: "10px 0 0 0",
								fontFamily: `"${interFontFamily}", sans-serif`
							}}>
								{stateConf.points.map((pt, ptIdx) => (
									<li key={ptIdx} style={{ fontSize: "16px", marginBottom: "6px", fontWeight: 500, lineHeight: 1.4 }}>
										{pt}
									</li>
								))}
							</ul>
						);
					}

					if (mode === "image_only" && stateConf.contentImage) {
						const imgUrl = stateConf.contentImage.startsWith("http") || stateConf.contentImage.startsWith("data:") 
							? stateConf.contentImage 
							: staticFile(stateConf.contentImage);
						return (
							<div style={{ marginTop: "10px", width: "100%", borderRadius: "12px", overflow: "hidden", display: "flex", justifyContent: "center" }}>
								<Img 
									src={imgUrl} 
									style={{ 
										width: "100%", 
										maxHeight: "180px", 
										objectFit: "cover",
										borderRadius: "8px" 
									}} 
								/>
							</div>
						);
					}

					// Default "number" layout
					if (stateConf.value) {
						return (
							<div
								style={{
									fontFamily: `"${interFontFamily}", sans-serif`,
									fontSize: "56px",
									fontWeight: 900,
									color: theme.textColor,
									lineHeight: 1.05,
									letterSpacing: "-2px",
									opacity: numberOpacity,
									transform: `translateY(${numberY}px) scale(${numberScale}) scaleY(1.12)`,
									filter: `blur(${numberBlur}px)`,
									display: "flex",
									alignItems: "center",
									marginTop: "4px",
								}}
							>
								{stateConf.value.prefix && (
									<span style={{ color: highlightColor, marginRight: "4px" }}>
										{stateConf.value.prefix}
									</span>
								)}
								<span>{formattedNumber}</span>
								{stateConf.value.suffix && (
									<span style={{ color: highlightColor, marginLeft: "4px" }}>
										{stateConf.value.suffix}
									</span>
								)}
							</div>
						);
					}

					return null;
				})()}

				{/* Label (rendered in number mode, or as fallback) */}
				{(!stateConf.mode || stateConf.mode === "number") && stateConf.value?.label && (
					<span
						style={{
							fontFamily: `"${dancingScriptFontFamily}", cursive`,
							fontSize: "26px",
							fontWeight: 500,
							color: theme.textColor,
							opacity: 0.65,
							marginTop: "-2px",
						}}
					>
						{stateConf.value.label}
					</span>
				)}
			</div>
		</div>
	);
};

const Divider: React.FC<{
	vertical: boolean;
	dividerColor: string;
	showVs: boolean;
	fontFamily: string;
}> = ({ vertical, dividerColor, showVs, fontFamily }) => {
	const frame = useCurrentFrame();
	const entrance = spring({
		frame: Math.max(0, frame - 15),
		fps: 60,
		config: { damping: 18, stiffness: 60 },
	});
	const opacity = interpolate(entrance, [0, 1], [0, 1]);

	return (
		<div
			style={{
				position: "absolute",
				left: vertical ? "50%" : 0,
				top: vertical ? 0 : "50%",
				width: vertical ? "1.5px" : "100%",
				height: vertical ? "100%" : "1.5px",
				background: vertical 
					? `linear-gradient(to bottom, transparent, ${dividerColor} 20%, ${dividerColor} 80%, transparent)`
					: `linear-gradient(to right, transparent, ${dividerColor} 20%, ${dividerColor} 80%, transparent)`,
				zIndex: 30,
				opacity,
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{showVs && (
				<div
					style={{
						position: "absolute",
						width: "80px",
						height: "80px",
						borderRadius: "50%",
						backgroundColor: "#FFFFFF",
						border: `1.5px solid ${dividerColor}`,
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
						transform: `scale(${interpolate(entrance, [0, 1], [0, 1])})`,
					}}
				>
					<span
						style={{
							fontFamily: `"${fontFamily}", sans-serif`,
							fontSize: "24px",
							fontWeight: 900,
							color: "#0F172A",
							letterSpacing: "-1px",
							marginTop: "-2px",
						}}
					>
						VS
					</span>
				</div>
			)}
		</div>
	);
};

export default ComparisonMap;
