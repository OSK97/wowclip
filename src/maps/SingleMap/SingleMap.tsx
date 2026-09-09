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
} from "remotion";
import { AnimatedPngOverlay } from "./AnimatedPngOverlay";
import configJson from "./config.json";
import { SmartTextView, Segment, ThemeConfig as SmartTextThemeConfig } from "./SmartTextView";

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

interface PngOverlay {
	image: string;
	scale?: number;
	offsetX?: number;
	offsetY?: number;
}

interface StepConfig {
	mode: "png" | "image" | "number" | "smart_text";
	image?: string;
	pngs?: PngOverlay[];
	startFrame?: number;
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
		highlightColor: "#10B981",
		backgroundColor: "#FAF9F6",
		gridColor: "",
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

const GRID_W = 1080;
const GRID_H = 1920;

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
	return [];
})();

function injectStepLayers(
	svg: string,
	states: StateBounds[],
	stepsArray: StepConfig[],
	imageMap: Record<string, LoadedImage>
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
			const layerClass = `step-layer-${idx}`;

			if (step.mode === "image" && step.image) {
				const img = imageMap[step.image];
				if (!img) return;
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
<!-- State ${state.id} Step ${idx} Image Layer -->
<image class="full-mask-image ${layerClass}" href="${img.url}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}"
  clip-path="url(#${stateClipId})" preserveAspectRatio="none"></image>
`;
			}
		});
	});

	if (!defsStr && !layersStr) return svg;

	const injection = `
<!-- STEP-BASED LAYERS DEFINITIONS -->
<defs>
  ${defsStr}
</defs>
${layersStr}
`;

	return svg.replace("</svg>", `${injection}\n</svg>`);
}

export const SingleMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [svgToRender, setSvgToRender] = useState<string | null>(null);
	const [imageMap, setImageMap] = useState<Record<string, LoadedImage>>({});
	const [statesBounds, setStatesBounds] = useState<StateBounds[]>([]);
	const [viewBoxObj, setViewBoxObj] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		
		const uniqueImages = Array.from(
			new Set([
				...statesConfig.map((s) => s.image),
				...steps.map((step) => step.image),
				...steps.flatMap((step) => step.pngs?.map(p => p.image) || []),
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
			setImageMap(imgMap);

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
				setStatesBounds(bounds);

				if (bounds.length > 0 && showOnlyState) {
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
					vbX = minX - 15;
					vbY = minY - 15;
					vbW = w + 30;
					vbH = h + 30;

					svg = injectStepLayers(svg, bounds, steps, imgMap);
				}
			}

			setViewBoxObj({ x: vbX, y: vbY, w: vbW, h: vbH });
			
			if (/view[bB]ox="[^"]*"/i.test(svg)) {
				svg = svg.replace(/view[bB]ox="[^"]*"/i, `viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
			} else {
				svg = svg.replace(/<svg/i, `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
			}
			
			setSvgToRender(svg);
			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load map:", err);
			continueRender(handle);
		});
	}, [handle]);

	// --- Step Timeline Processing ---
	let activeStepIdx = 0;
	for (let i = 0; i < steps.length; i++) {
		const startF = steps[i].startFrame ?? 0;
		if (frame >= startF) {
			activeStepIdx = i;
		}
	}

	const activeStep = steps[activeStepIdx];
	const primaryState = statesConfig[0];

	// ─── Smooth Minimalist Spring Camera Motion ───
	const cameraSpring = spring({
		frame,
		fps,
		config: { damping: 24, stiffness: 70, mass: 1.0 },
	});

	const cameraScale = interpolate(cameraSpring, [0, 1], [0.88, 1.0]);
	const cameraTranslateY = interpolate(cameraSpring, [0, 1], [60, 0]);

	const gridOpacity = config.theme.gridColor ? interpolate(frame, [5, 25], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

	const activeHighlightColor =
		activeStep?.theme?.highlightColor ||
		activeStep?.highlightColor ||
		primaryState?.theme?.highlightColor ||
		config.theme.highlightColor;

	const highlightStyles = statesConfig
		.map((state) => {
			const color = activeHighlightColor;
			return `
				.map-container svg #${state.id},
				.map-container svg #${state.id} path {
					${showOnlyState ? "display: block !important;" : ""}
					fill: ${color} !important;
					stroke: #FFFFFF !important;
					stroke-width: 1px !important;
					transition: fill 0.35s ease-out;
				}
			`;
		})
		.join("\n");

	const stepLayersStyles = steps
		.map((step, idx) => {
			if (step.mode !== "image") return "";
			const startF = step.startFrame ?? 0;
			const isTriggered = frame >= startF;
			const currentOpacity = isTriggered
				? interpolate(frame - startF, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
				: 0;

			return `
				.map-container svg .step-layer-${idx} {
					display: ${currentOpacity > 0 ? "block !important" : "none !important"};
					opacity: ${currentOpacity};
					pointer-events: none;
				}
			`;
		})
		.join("\n");

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor || "#FAF9F6",
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* Original Clean Parchment Background */}
			<div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #FFFFFF 20%, #FFFDF0 70%, #EAE7DC 100%)" }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

			{/* Minimalist Grid */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: GRID_W,
					height: GRID_H,
					opacity: gridOpacity,
					WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					pointerEvents: "none",
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: Math.round(GRID_W / 80) + 1 }).map((_, i) => (
						<line key={`v-${i}`} x1={i * 80} y1={0} x2={i * 80} y2={GRID_H} stroke={config.theme.gridColor || "rgba(30, 27, 24, 0.12)"} strokeWidth={1.5} />
					))}
					{Array.from({ length: Math.round(GRID_H / 80) + 1 }).map((_, i) => (
						<line key={`h-${i}`} x1={0} y1={i * 80} x2={GRID_W} y2={i * 80} stroke={config.theme.gridColor || "rgba(30, 27, 24, 0.12)"} strokeWidth={1.5} />
					))}
				</svg>
			</div>

			<style>{`
				.map-container svg path {
					fill: ${config.theme.mapColor};
					stroke: #ffffff;
					stroke-width: 0.5px;
					${showOnlyState ? "display: none;" : ""}
				}
				.map-container svg clipPath path {
					display: block !important;
				}
				${highlightStyles}
				${stepLayersStyles}
				.map-container svg {
					overflow: visible !important;
				}
			`}</style>

			{/* Map Stage Container */}
			<div
				className="map-container"
				style={{
					width: showOnlyState ? 860 : 960,
					height: showOnlyState ? 860 : 960,
					position: "relative",
					transform: `scale(${cameraScale}) translateY(${cameraTranslateY}px)`,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{/* Ambient Floor Shadow */}
				<div
					style={{
						position: "absolute",
						bottom: -30,
						width: "70%",
						height: 35,
						borderRadius: "50%",
						background: "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.22) 0%, transparent 70%)",
						filter: "blur(12px)",
						pointerEvents: "none",
					}}
				/>

				{svgToRender && (
					<div
						style={{ width: "100%", height: "100%" }}
						dangerouslySetInnerHTML={{ __html: svgToRender }}
					/>
				)}
				{svgToRender && viewBoxObj && (
					<AnimatedPngOverlay
						steps={steps}
						activeStepIdx={activeStepIdx}
						frame={frame}
						fps={fps}
						statesBounds={statesBounds}
						stateId={statesConfig[0]?.id}
						imageMap={imageMap}
						viewBox={viewBoxObj}
					/>
				)}
			</div>
		</AbsoluteFill>
	);
};

export default SingleMap;
