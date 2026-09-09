import React, { useEffect, useState } from "react";
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	staticFile,
	delayRender,
	continueRender,
} from "remotion";
import configJson from "./config.json";
import { loadMontserrat } from "../../utils/localFonts";

// Configuration Interfaces
interface StateConfig {
	id: string;
	name: string;
	color?: string;
}

interface RawConfig {
	country?: string;
	states?: StateConfig[];
	rows?: any[][]; // Array of arrays of cells
	theme?: {
		mapColor?: string;
		backgroundColor?: string;
		backgroundGradient?: string;
		textColor?: string;
		rowBorderColor?: string;
		highlightColor?: string;
		fontFamily?: string;
		gridColor?: string;
	};
	layout?: {
		width?: number;
		headerHeight?: number;
		minRowHeight?: number;
		cellFontSize?: number;
		headerFontSize?: number;
		imageSize?: number;
	};
	animation?: {
		entranceDurationFrames?: number;
		rowStaggerFrames?: number;
		cellStaggerFrames?: number;
	};
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	states: rawConfig.states || [],
	rows: rawConfig.rows || [],
	theme: {
		mapColor: rawConfig.theme?.mapColor || "#475569",
		backgroundColor: rawConfig.theme?.backgroundColor || "#FAF9F6",
		backgroundGradient: rawConfig.theme?.backgroundGradient || "radial-gradient(circle at center, #ffffff 40%, #f1f5f9 100%)",
		textColor: rawConfig.theme?.textColor || "#0F172A",
		rowBorderColor: rawConfig.theme?.rowBorderColor || "rgba(15, 23, 42, 0.12)",
		highlightColor: rawConfig.theme?.highlightColor || "rgba(253, 224, 71, 0.8)",
		fontFamily: rawConfig.theme?.fontFamily || "system-ui, sans-serif",
		gridColor: rawConfig.theme?.gridColor || "rgba(0,0,0,0.05)"
	},
	layout: {
		width: rawConfig.layout?.width || 1000,
		headerHeight: rawConfig.layout?.headerHeight || 220,
		minRowHeight: rawConfig.layout?.minRowHeight || 80,
		cellFontSize: rawConfig.layout?.cellFontSize || 20,
		headerFontSize: rawConfig.layout?.headerFontSize || 14,
		imageSize: rawConfig.layout?.imageSize || 100
	},
	animation: {
		entranceDurationFrames: rawConfig.animation?.entranceDurationFrames || 35,
		rowStaggerFrames: rawConfig.animation?.rowStaggerFrames || 12,
		cellStaggerFrames: rawConfig.animation?.cellStaggerFrames || 4
	}
};

const highlightIds = config.states.map((s) => s.id);

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

export const TableMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { width: compositionWidth, height: compositionHeight } = useVideoConfig();
	const { fontFamily: montserratFontFamily } = loadMontserrat();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [rawSvgText, setRawSvgText] = useState<string | null>(null);
	const [statesBounds, setStatesBounds] = useState<StateBounds[]>([]);

	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		
		fetch(svgUrl).then((res) => res.text()).then((rawText) => {
			setRawSvgText(rawText);
			const bounds = measureAllStatesBounds(rawText, highlightIds);
			setStatesBounds(bounds);
			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load map:", err);
			continueRender(handle);
		});
	}, [handle]);

	// Dynamic sizing based on data count to optimize layout
	const colsCount = config.states.length || 1;
	const rowsCount = config.rows.length;

	let baseCellFontSize = 22;
	let baseHeaderFontSize = 32;
	let baseMinRowHeight = 110;
	let baseImageSize = 100;

	if (colsCount >= 4) {
		baseCellFontSize = 18;
		baseHeaderFontSize = 24;
		baseImageSize = 80;
	} else if (colsCount <= 2) {
		baseCellFontSize = 26;
		baseHeaderFontSize = 38;
		baseImageSize = 140;
	}

	if (rowsCount > 6) {
		baseMinRowHeight = 85;
		baseCellFontSize = Math.min(baseCellFontSize, 16);
	} else if (rowsCount > 4) {
		baseMinRowHeight = 100;
		baseCellFontSize = Math.min(baseCellFontSize, 20);
	} else if (rowsCount <= 3) {
		baseMinRowHeight = 125;
		baseCellFontSize = Math.max(baseCellFontSize, 24);
	}

	const dynamicHeaderHeight = baseImageSize + baseHeaderFontSize + 65;
	const expectedTableHeight = dynamicHeaderHeight + (rowsCount * baseMinRowHeight) + 120;
	const maxSafeWidth = compositionWidth - 160;
	const maxSafeHeight = compositionHeight - 320;
	
	let fitScale = Math.min(maxSafeWidth / config.layout.width, maxSafeHeight / expectedTableHeight);
	if (fitScale > 1.4) fitScale = 1.4;

	// Setup columns layout dynamically split equally
	const colWidth = `${config.layout.width / colsCount}px`;
	
	const backgroundOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				fontFamily: config.theme.fontFamily,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				opacity: backgroundOpacity,
			}}
		>
			{/* Radial gradients and grain overlays (Matching PieChart) */}
			<div style={{ position: "absolute", inset: 0, background: config.theme.backgroundGradient }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />



			<div
				style={{
					transform: `scale(${fitScale})`,
					transformOrigin: "center center",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					width: "100%",
				}}
			>
				<div
					style={{
						position: "relative",
						width: `${config.layout.width}px`,
						display: "flex",
						flexDirection: "column",
						zIndex: 1,
					}}
				>
					{/* Header Row (State Mini Maps) */}
					<div
						style={{
							position: "relative",
							display: "flex",
							flexDirection: "row",
							height: `${dynamicHeaderHeight}px`,
							alignItems: "center",
							paddingBottom: 15,
							marginBottom: 25,
						}}
					>
						<div
							style={{
								position: "absolute",
								bottom: 0,
								left: 0,
								right: 0,
								height: 2,
								background: `linear-gradient(to right, transparent 0%, ${config.theme.rowBorderColor} 20%, ${config.theme.rowBorderColor} 80%, transparent 100%)`,
							}}
						/>

						{/* Header: Mini Maps */}
						{config.states.map((stateConf, stateIdx) => {
							const stateBound = statesBounds.find((b) => b.id === stateConf.id);
							const highlightColor = (stateConf.color || config.theme.textColor) as string;
							const isLast = stateIdx === config.states.length - 1;

							// Staggered panel map entrances (simple fast fade-in)
							const headerStart = 10 + stateIdx * 6;
							const headerOpacity = interpolate(
								frame,
								[headerStart, headerStart + 8],
								[0, 1],
								{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
							);

							return (
								<div
									key={stateConf.id}
									style={{
										position: "relative",
										width: colWidth,
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										gap: "10px",
										boxSizing: "border-box",
										opacity: headerOpacity,
									}}
								>
									{/* Vertical border */}
									{!isLast && (
										<div
											style={{
												position: "absolute",
												right: 0,
												top: "10%",
												bottom: "10%",
												width: 1,
												background: `linear-gradient(to bottom, transparent 0%, ${config.theme.rowBorderColor} 20%, ${config.theme.rowBorderColor} 80%, transparent 100%)`,
											}}
										/>
									)}

									{/* Mini SVG State Map */}
									<div
										style={{
											width: `${baseImageSize}px`,
											height: `${baseImageSize}px`,
											display: "flex",
											justifyContent: "center",
											alignItems: "center",
										}}
									>
										{rawSvgText && (stateBound || stateConf.id === "INDIA" || stateConf.id === "ALL") && (
											<MiniHeaderMap
												rawSvgText={rawSvgText}
												stateConf={stateConf}
												stateBound={stateBound}
												imageMap={{}}
												highlightColor={highlightColor}
												mapColor={config.theme.mapColor}
											/>
										)}
									</div>

									{/* State Name */}
									<span
										style={{
											fontFamily: `"${montserratFontFamily}", sans-serif`,
											fontSize: `${baseHeaderFontSize}px`,
											fontWeight: 800,
											color: highlightColor,
											textTransform: "uppercase",
											letterSpacing: "1px",
											textAlign: "center",
										}}
									>
										{stateConf.name}
									</span>
								</div>
							);
						})}
					</div>

					{/* Rows comparing Attributes */}
					{config.rows.map((row, rowIndex) => {
						const rowStartFrame = config.animation.entranceDurationFrames + (rowIndex * config.animation.rowStaggerFrames);
						const rowBorderOpacity = interpolate(
							frame,
							[rowStartFrame, rowStartFrame + 10],
							[0, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
						);

						const isLastRow = rowIndex === config.rows.length - 1;

						// Animate the entire row cells together (simple fast fade-in)
						const cellStart = rowStartFrame;
						const cellOpacity = interpolate(
							frame,
							[cellStart, cellStart + 8],
							[0, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
						);

						return (
							<div
								key={rowIndex}
								style={{
									position: "relative",
									display: "flex",
									flexDirection: "row",
									minHeight: `${baseMinRowHeight}px`,
									padding: "15px 0",
									alignItems: "center",
								}}
							>
								{/* Border */}
								{!isLastRow && (
									<div
										style={{
											position: "absolute",
											bottom: 0,
											left: 0,
											right: 0,
											height: 1,
											opacity: rowBorderOpacity,
											background: `linear-gradient(to right, transparent 0%, ${config.theme.rowBorderColor} 20%, ${config.theme.rowBorderColor} 80%, transparent 100%)`,
										}}
									/>
								)}

								{/* Row Cells */}
								{row.slice(0, colsCount).map((valRaw: any, valIdx) => {
									const isLastCell = valIdx === colsCount - 1;

                                    const isObject = typeof valRaw === 'object' && valRaw !== null;
                                    const valStr = isObject ? valRaw.text : String(valRaw);
                                    const highlight = isObject ? valRaw.highlight : null;

									let scaleFactor = 1;
									if (valStr.length > 20) {
										scaleFactor = 0.75;
									} else if (valStr.length > 14) {
										scaleFactor = 0.85;
									} else if (valStr.length < 8) {
										scaleFactor = 1.15;
									}
									const finalFontSize = baseCellFontSize * scaleFactor;

                                    const cellTextColor = "#475569";
                                    let highlightProgress = 0;
                                    const hColor = "rgba(253, 224, 71, 0.85)";

                                    if (highlight && highlight.startFrame !== undefined) {
                                        const hStart = highlight.startFrame;
                                        const hDuration = Math.max(1, highlight.durationFrames || 99999);
                                        
                                        const fadeDur = Math.min(10, hDuration * 0.4);
                                        highlightProgress = interpolate(
                                            frame,
                                            [hStart, hStart + fadeDur, hStart + hDuration - fadeDur, hStart + hDuration],
                                            [0, 1, 1, 0],
                                            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                                        );
                                    }

									return (
										<div
											key={`val-${valIdx}`}
											style={{
												position: "relative",
												width: colWidth,
												textAlign: "center",
												display: "flex",
												justifyContent: "center",
												alignItems: "center",
												fontSize: `${finalFontSize}px`,
												fontWeight: 500,
												color: cellTextColor,
												opacity: cellOpacity,
												boxSizing: "border-box",
												padding: "10px 15px",
											}}
										>
											{!isLastCell && (
												<div
													style={{
														position: "absolute",
														right: 0,
														top: "20%",
														bottom: "20%",
														width: 1,
														background: `linear-gradient(to bottom, transparent 0%, ${config.theme.rowBorderColor} 20%, ${config.theme.rowBorderColor} 80%, transparent 100%)`,
													}}
												/>
											)}
											{highlight && highlight.startFrame !== undefined ? (
												<span
													style={{
														display: 'inline-block',
														backgroundImage: `linear-gradient(to right, ${hColor} 0%, ${hColor} 100%)`,
														backgroundRepeat: 'no-repeat',
														backgroundPosition: 'left center',
														backgroundSize: `${highlightProgress * 100}% 85%`,
														borderRadius: '4px',
														padding: '2px 6px',
														margin: '0 -6px',
													}}
												>
													{valStr}
												</span>
											) : (
												<span>{valStr}</span>
											)}
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default TableMap;

const MiniHeaderMap: React.FC<{
	rawSvgText: string;
	stateConf: StateConfig;
	stateBound?: StateBounds;
	imageMap: any;
	highlightColor: string;
	mapColor: string;
}> = ({ rawSvgText, stateConf, stateBound, highlightColor, mapColor }) => {
	
	let svgHtml = rawSvgText;
	let vbStr = "";

	if (stateBound) {
		const { minX, minY, maxX, maxY } = stateBound;
		const w = maxX - minX;
		const h = maxY - minY;
		const padding = Math.max(w, h) * 0.1;
		const vbX = minX - padding;
		const vbY = minY - padding;
		const vbW = w + padding * 2;
		const vbH = h + padding * 2;
		vbStr = `viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`;
	} else {
		const match = rawSvgText.match(/viewBox="([^"]+)"/i);
		vbStr = match ? `viewBox="${match[1]}"` : `viewBox="0 0 1000 1000"`;
	}
	
	// Strip viewBox, style, width, and height attributes
	svgHtml = svgHtml
		.replace(/\s+width="[^"]*"/ig, "")
		.replace(/\s+height="[^"]*"/ig, "")
		.replace(/\s*viewBox="[^"]*"/ig, "")
		.replace(/\s*style="[^"]*"/ig, "");

	// Inject viewBox and styles to make it scale correctly and hide overflow
	svgHtml = svgHtml.replace(
		/<svg([^>]*)>/,
		`<svg$1 ${vbStr} style="width: 100%; height: 100%; overflow: hidden;" preserveAspectRatio="xMidYMid meet">`
	);

	const isCountry = stateConf.id === "INDIA" || stateConf.id === "ALL";
	const containerId = `mini-map-container-${stateConf.id}`;
	
	const cssRules = isCountry
		? `
			#${containerId} svg path {
				fill: ${highlightColor} !important;
				stroke: #ffffff !important;
				stroke-width: 0.5px !important;
			}
		  `
		: `
			#${containerId} svg path {
				display: none !important;
				fill: ${mapColor} !important;
				stroke: #ffffff !important;
				stroke-width: 0.5px !important;
			}
			#${containerId} svg #${stateConf.id},
			#${containerId} svg #${stateConf.id} path {
				display: block !important;
				fill: ${highlightColor} !important;
				stroke: #ffffff !important;
				stroke-width: 0.5px !important;
			}
		  `;

	return (
		<div id={containerId} style={{ width: "100%", height: "100%", position: "relative" }}>
			<style dangerouslySetInnerHTML={{ __html: cssRules }} />
			<div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: svgHtml }} />
		</div>
	);
};
