import React, { useEffect, useState } from "react";
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
} from "remotion";
import configJson from "./config.json";
import { Segment, ThemeConfig as SmartTextThemeConfig } from "./SmartTextView";

interface StateConfig {
	id: string;
	displayName?: string;
	image?: string;
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
	mapColor: string;
	highlightColor: string;
	backgroundColor: string;
	gridColor: string;
	textColor: string;
}

interface StepConfig {
	mode: "png" | "image" | "number" | "smart_text";
	image?: string;
	value?: {
		prefix?: string;
		prefixColor?: string;
		number: number;
		suffix?: string;
		suffixColor?: string;
		topText?: string;
		bottomText?: string;
		offsetX?: number;
		offsetY?: number;
	};
	theme?: {
		highlightColor?: string;
	};
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
	durationInFrames?: number;
}

interface RawConfig {
	country?: string;
	mode?: string;
	displayName?: string;
	states?: StateConfig[];
	highlightIds?: string[];
	highlightId?: string;
	images?: string[];
	buildingImage?: string;
	image?: string;
	transitionFrame?: number;
	theme?: ThemeConfig;
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
	steps?: StepConfig[];
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	mode: rawConfig.mode || "full_country",
	transitionFrame: rawConfig.transitionFrame || 60,
	theme: rawConfig.theme || {
		mapColor: "#dadada",
		highlightColor: "#E63946",
		backgroundColor: "#FAF9F6",
		gridColor: "rgba(30, 27, 24, 0.20)",
		textColor: "#0F172A",
	},
	smartTextSegments: rawConfig.smartTextSegments || [],
	smartTextTheme: rawConfig.smartTextTheme || {},
};

const statesConfig: StateConfig[] = (() => {
	if (Array.isArray(rawConfig.states)) {
		return rawConfig.states;
	}
	const ids = rawConfig.highlightIds || [rawConfig.highlightId].filter(Boolean) as string[];
	const imgs = rawConfig.images || [rawConfig.buildingImage || rawConfig.image].filter(Boolean) as string[];
	
	return ids.map((id, idx) => ({
		id,
		displayName: idx === 0 ? (rawConfig.displayName || "") : "",
		image: imgs[idx] || undefined,
	}));
})();

const highlightIds = statesConfig.map((s) => s.id);
const showOnlyState = config.mode === "highlight_state";

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

const steps: StepConfig[] = (() => {
	if (rawConfig.steps && rawConfig.steps.length > 0) {
		return rawConfig.steps;
	}
	const primaryState = statesConfig[0];
	const legacySteps: StepConfig[] = [];
	
	if (primaryState) {
		if (primaryState.image && primaryState.value) {
			legacySteps.push({
				mode: "png",
				image: primaryState.image,
				durationInFrames: config.transitionFrame || 60,
			});
			legacySteps.push({
				mode: "number",
				value: {
					prefix: primaryState.value.prefix,
					number: primaryState.value.number,
					suffix: primaryState.value.suffix,
					topText: primaryState.displayName || primaryState.id,
					bottomText: primaryState.value.label,
				},
				theme: {
					highlightColor: primaryState.theme?.highlightColor,
				},
				durationInFrames: 240,
			});
		} else if (primaryState.image) {
			legacySteps.push({
				mode: "png",
				image: primaryState.image,
				durationInFrames: 300,
			});
		} else if (primaryState.value) {
			legacySteps.push({
				mode: "number",
				value: {
					prefix: primaryState.value.prefix,
					number: primaryState.value.number,
					suffix: primaryState.value.suffix,
					topText: primaryState.displayName || primaryState.id,
					bottomText: primaryState.value.label,
				},
				theme: {
					highlightColor: primaryState.theme?.highlightColor,
				},
				durationInFrames: 300,
			});
		}
	}
	
	if (legacySteps.length === 0) {
		legacySteps.push({
			mode: "number",
			value: {
				prefix: "$",
				number: 290,
				suffix: "B",
				topText: "GUJARAT",
				bottomText: "Gross Domestic Product",
			},
			durationInFrames: 300,
		});
	}
	
	return legacySteps;
})();

function injectStepLayers(
	svg: string,
	states: StateBounds[],
	stepsArray: StepConfig[],
	imageMap: Record<string, LoadedImage>,
	viewBox: { x: number; y: number; w: number; h: number }
): string {
	if (states.length === 0) return svg;

	let defsStr = "";
	let layersStr = "";

	states.forEach((state) => {
		const { minX, minY, maxX, maxY, pathDatas } = state;
		const w = maxX - minX;
		const h = maxY - minY;

		const clipPaths = pathDatas.map((d) => `<path d="${d}"/>`).join("\n");
		const stateClipId = `state-clip-${state.id}`;
		defsStr += `
  <clipPath id="${stateClipId}">
    ${clipPaths}
  </clipPath>
`;

		stepsArray.forEach((step, idx) => {
			if (!step.image) return;
			const img = imageMap[step.image];
			if (!img) return;

			const layerClass = `step-layer-${idx}`;

			if (step.mode === "png") {
				const bWidth = w * 0.85;
				const bHeight = bWidth / img.aspectRatio;
				const bX = minX + w / 2 - bWidth / 2;
				const bY = maxY - bHeight + 5;

				const cutOffY = minY + h * 0.24;
				const popRectTop = bY - 500;
				const popRectHeight = cutOffY - popRectTop;

				const popoutClipId = `popout-clip-${state.id}-${idx}`;
				defsStr += `
  <clipPath id="${popoutClipId}">
    <rect x="${bX - 500}" y="${popRectTop}" width="${bWidth + 1000}" height="${popRectHeight}"/>
  </clipPath>
`;

				const slideDistance = (viewBox.y + viewBox.h) - bY;

				layersStr += `
<g clip-path="url(#${stateClipId})">
  <image class="building-overlay ${layerClass}" href="${img.url}" x="${bX}" y="${bY}" width="${bWidth}" height="${bHeight}"
    preserveAspectRatio="xMidYMax slice" style="--png-slide-dist: ${slideDistance}px;"></image>
</g>

<g clip-path="url(#${popoutClipId})">
  <image class="building-overlay ${layerClass}" href="${img.url}" x="${bX}" y="${bY}" width="${bWidth}" height="${bHeight}"
    preserveAspectRatio="xMidYMax slice" style="--png-slide-dist: ${slideDistance}px;"></image>
</g>
`;
			} else if (step.mode === "image") {
				const boxRatio = w / h;
				const imgRatio = img.aspectRatio || 1.0;
				let imgW = w;
				let imgH = h;
				let imgX = minX;
				let imgY = minY;

				if (imgRatio > boxRatio) {
					imgH = h;
					imgW = h * imgRatio;
					imgX = minX + (w - imgW) / 2;
				} else {
					imgW = w;
					imgH = w / imgRatio;
					imgY = minY + (h - imgH) / 2;
				}

				layersStr += `
<image class="full-mask-image ${layerClass}" href="${img.url}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}"
  clip-path="url(#${stateClipId})" preserveAspectRatio="none"></image>
`;
			}
		});
	});

	if (!defsStr && !layersStr) return svg;

	const injection = `
<defs>
  ${defsStr}
</defs>
${layersStr}
`;

	return svg.replace("</svg>", `${injection}\n</svg>`);
}

function injectAdaptiveStateBadges(
	svg: string,
	states: StateBounds[],
	statesConfigArray: StateConfig[]
): string {
	let badgesStr = "";

	states.forEach((state) => {
		const stateConf = statesConfigArray.find((s) => s.id === state.id);
		if (!stateConf || !stateConf.value) return;

		const { minX, minY, maxX, maxY } = state;
		const w = maxX - minX;
		const h = maxY - minY;
		const cx = minX + w / 2;
		const cy = minY + h / 2;

		const val = stateConf.value;
		const labelStr = `${val.prefix || ""}${val.number}${val.suffix || ""}`;

		const textLen = labelStr.length || 1;
		const refDimension = Math.max(w, h);
		const scaleFactor = Math.min(1.3, Math.max(0.65, (refDimension * 0.15) / textLen));
		const fontSize = Math.round(12 * scaleFactor);

		const badgeW = Math.max(50, textLen * fontSize * 0.7 + 14);
		const badgeH = Math.round(fontSize * 1.5 + 8);
		const bx = cx - badgeW / 2;
		const by = cy - badgeH / 2;

		badgesStr += `
<g class="state-badge" transform="translate(${bx}, ${by})">
  <rect width="${badgeW}" height="${badgeH}" rx="${badgeH / 2}" ry="${badgeH / 2}" fill="#FFFFFF" stroke="#000000" stroke-width="1" opacity="0.95" filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.06))"></rect>
  <text x="${badgeW / 2}" y="${badgeH / 2 + fontSize * 0.35 + 1}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#0F172A" text-anchor="middle">${labelStr}</text>
</g>
`;
	});

	if (!badgesStr) return svg;

	return svg.replace("</svg>", `${badgesStr}\n</svg>`);
}


export const StateOverlayMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [svgToRender, setSvgToRender] = useState<string | null>(null);


	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		
		const uniqueImages = Array.from(
			new Set([
				...statesConfig.map((s) => s.image),
				...steps.map((step) => step.image),
			].filter(Boolean))
		) as string[];

		const imagePromises = uniqueImages.map((imagePath) => {
			const imgUrl = imagePath.startsWith("http") || imagePath.startsWith("data:") ? imagePath : staticFile(imagePath);
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
			const imgMap: Record<string, LoadedImage> = {};
			loadedImages.forEach((img) => {
				imgMap[img.path] = { url: img.url, aspectRatio: img.aspectRatio };
			});

			let svg = rawText
				.replace(/\s+width="[^"]*"/g, "")
				.replace(/\s+height="[^"]*"/g, "");

			let vbX = 0, vbY = 0, vbW = 1000, vbH = 1000;
			const vbMatch = svg.match(/view[bB]ox="([^"]*)"/i);
			if (vbMatch) {
				const parts = vbMatch[1].trim().split(/\s+/).map(Number);
				if (parts.length === 4 && !parts.some(isNaN)) {
					vbX = parts[0];
					vbY = parts[1];
					vbW = parts[2];
					vbH = parts[3];
				}
			}

			if (highlightIds.length > 0) {
				const bounds = measureAllStatesBounds(svg, highlightIds);

				if (bounds.length > 0) {
					if (showOnlyState) {
						let minX = Infinity;
						let minY = Infinity;
						let maxX = -Infinity;
						let maxY = -Infinity;
						bounds.forEach((s) => {
							minX = Math.min(minX, s.minX);
							minY = Math.min(minY, s.minY);
							maxX = Math.max(maxX, s.maxX);
							maxY = Math.max(maxY, s.maxY);
						});
						
						const w = maxX - minX;
						const h = maxY - minY;
						const padding = 0;
						vbX = minX - padding;
						vbY = minY - padding;
						vbW = w + padding * 2;
						vbH = h + padding * 2;
						const vb = `${vbX} ${vbY} ${vbW} ${vbH}`;
						
						if (/view[bB]ox="[^"]*"/i.test(svg)) {
							svg = svg.replace(/view[bB]ox="[^"]*"/i, `viewBox="${vb}"`);
						} else {
							svg = svg.replace(/<svg/i, `<svg viewBox="${vb}"`);
						}
					}

					svg = injectStepLayers(svg, bounds, steps, imgMap, { x: vbX, y: vbY, w: vbW, h: vbH });

					// Inject adaptive layout badges in full map view
					if (!showOnlyState) {
						svg = injectAdaptiveStateBadges(svg, bounds, statesConfig);
					}
				}
			}


			setSvgToRender(svg);
			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load map:", err);
			continueRender(handle);
		});
	}, [handle]);

	let accumulatedFrames = 0;
	let activeStepIdx = 0;
	let activeStepStartFrame = 0;

	for (let i = 0; i < steps.length; i++) {
		const stepDuration = steps[i].durationInFrames || 80;
		if (frame >= accumulatedFrames && frame < accumulatedFrames + stepDuration) {
			activeStepIdx = i;
			activeStepStartFrame = accumulatedFrames;
			break;
		}
		if (i === steps.length - 1) {
			activeStepIdx = i;
			activeStepStartFrame = accumulatedFrames;
		}
		accumulatedFrames += stepDuration;
	}

	const localFrame = frame - activeStepStartFrame;
	const isPngMode = steps[activeStepIdx]?.mode === "png";
	const shouldBlurBackground = isPngMode;

	const blurProgress = spring({
		frame: shouldBlurBackground ? localFrame : 0,
		fps,
		config: { damping: 16, stiffness: 60 },
	});
	
	const blurAmount = shouldBlurBackground ? interpolate(blurProgress, [0, 1], [0, 24], { extrapolateRight: "clamp" }) : 0;
	const slideProgress = shouldBlurBackground ? interpolate(blurProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" }) : 0;

	const blurredBackgroundStepIdx = (() => {
		if (isPngMode) {
			for (let i = activeStepIdx - 1; i >= 0; i--) {
				if (steps[i].mode === "image") {
					return i;
				}
			}
		}
		return -1;
	})();

	const highlightStyles = statesConfig
		.map((state) => {
			const color = state.theme?.highlightColor || config.theme.highlightColor;
			return `
				.overlay-map-container svg #${state.id},
				.overlay-map-container svg #${state.id} path {
					${showOnlyState ? "display: block !important;" : ""}
					fill: ${color} !important;
					stroke-width: ${showOnlyState ? "0.5px" : "1.8px"} !important;
				}
			`;
		})
		.join("\n");

	const stepLayersStyles = steps
		.map((step, idx) => {
			const isActive = activeStepIdx === idx;
			const isBlurredBackground = shouldBlurBackground && blurredBackgroundStepIdx === idx;
			const isActivePng = isActive && step.mode === "png";
			const transformStr = isActivePng ? `transform: translateY(calc(var(--png-slide-dist, 500px) * ${slideProgress}));` : "";
			return `
				.overlay-map-container svg .step-layer-${idx} {
					display: ${isActive || isBlurredBackground ? "block !important" : "none !important"};
					opacity: ${isActive ? 1 : (isBlurredBackground ? 1 : 0)};
					filter: blur(${isBlurredBackground ? blurAmount : 0}px);
					pointer-events: none;
					${transformStr}
				}
			`;
		})
		.join("\n");

    // Fade-in animation for the map overlay itself
    const overlayOpacity = interpolate(frame, [0, 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
    });
    
    const overlayScale = interpolate(frame, [0, 30], [0.9, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
                opacity: overlayOpacity,
                transform: `scale(${overlayScale})`
			}}
		>
			<style>{`
				.overlay-map-container svg path {
					fill: ${config.theme.mapColor};
					stroke: #ffffff;
					stroke-width: 0.5px;
					${showOnlyState ? "display: none;" : ""}
				}
				.overlay-map-container svg clipPath path {
					display: block !important;
				}
				${highlightStyles}
				${stepLayersStyles}
				.overlay-map-container svg {
					filter: drop-shadow(0px 15px 25px rgba(0,0,0, 0.15));
					overflow: visible !important;
				}
				.overlay-map-container svg .state-badge {
					animation: badgeScaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
					transform-origin: center;
				}
				@keyframes badgeScaleIn {
					from { opacity: 0; transform: scale(0.7) translateY(5px); }
					to { opacity: 0.95; transform: scale(1) translateY(0); }
				}
			`}</style>

			{/* Map Container - Clean transparent overlay */}
			<div
				className="overlay-map-container"
				style={{
					width: showOnlyState ? 900 : 1000,
					height: showOnlyState ? 900 : 1000,
					position: "relative",
					opacity: svgToRender ? 1 : 0,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					marginTop: showOnlyState ? "-80px" : "0",
				}}
			>
				{svgToRender && (
					<div
						style={{ width: "100%", height: "100%" }}
						dangerouslySetInnerHTML={{ __html: svgToRender }}
					/>
				)}
			</div>
		</div>
	);
};
