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
import { SmartTextView, Segment, ThemeConfig as SmartTextThemeConfig } from "../../component/SmartTextView/SmartTextView";

interface PngOverlay {
	id?: string;
	image: string;
	scale?: number;
	offsetX?: number;
	offsetY?: number;
}

interface StepConfig {
	mode: "color" | "png" | "image" | "smart_text";
	color?: string;
	image?: string;
	pngs?: PngOverlay[];
	startFrame?: number;
	durationInFrames?: number;
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
}

interface ThemeConfig {
	countryColor?: string;
	backgroundColor?: string;
	gridColor?: string;
	textColor?: string;
}

interface RawConfig {
	durationInSeconds?: number;
	durationInFrames?: number;
	country?: string;
	displayName?: string;
	steps?: StepConfig[];
	theme?: ThemeConfig;
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	displayName: rawConfig.displayName || "India",
	theme: rawConfig.theme || {
		countryColor: "#EF4444",
		backgroundColor: "#FAF9F6",
		gridColor: "",
		textColor: "#0F172A",
	},
	smartTextSegments: rawConfig.smartTextSegments || [],
	smartTextTheme: rawConfig.smartTextTheme || {},
};

const steps: StepConfig[] = (() => {
	if (rawConfig.steps && rawConfig.steps.length > 0) {
		return rawConfig.steps;
	}
	return [
		{
			startFrame: 0,
			mode: "color",
			color: config.theme.countryColor,
		},
	];
})();

const GRID_W = 1080;
const GRID_H = 1920;

interface CountryBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	pathDatas: string[];
}

function parseCountrySvgFast(svgText: string): { bounds: CountryBounds; viewBox: { x: number; y: number; w: number; h: number } } {
	let vbX = 0, vbY = 0, vbW = 1000, vbH = 1000;
	const vbMatch = svgText.match(/view[bB]ox="([^"]*)"/i);
	if (vbMatch) {
		const parts = vbMatch[1].trim().split(/\s+/).map(Number);
		if (parts.length === 4 && !parts.some(isNaN)) {
			vbX = parts[0];
			vbY = parts[1];
			vbW = parts[2];
			vbH = parts[3];
		}
	}

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
	const pathDatas: string[] = [];
	let minX = vbX, minY = vbY, maxX = vbX + vbW, maxY = vbY + vbH;

	if (svgEl) {
		svgEl.setAttribute("width", "1000");
		svgEl.setAttribute("height", "1000");
		
		const allPaths = svgEl.querySelectorAll("path");
		allPaths.forEach((cp) => {
			const d = cp.getAttribute("d");
			if (d) pathDatas.push(d);
		});

		const features = svgEl.querySelector("#features") || svgEl.querySelector("g") || svgEl;
		if (features && (features as any).getBBox) {
			try {
				const bbox = (features as any).getBBox();
				if (bbox && bbox.width > 0 && bbox.height > 0) {
					minX = bbox.x;
					minY = bbox.y;
					maxX = bbox.x + bbox.width;
					maxY = bbox.y + bbox.height;
				}
			} catch (e) {
				console.error("getBBox failed, using viewBox", e);
			}
		}
	}

	if (container.parentNode) {
		document.body.removeChild(container);
	}

	const bounds: CountryBounds = {
		minX,
		minY,
		maxX,
		maxY,
		pathDatas,
	};

	return { bounds, viewBox: { x: vbX, y: vbY, w: vbW, h: vbH } };
}

interface LoadedImage {
	url: string;
	aspectRatio: number;
}

interface LoadedImageWithMap extends LoadedImage {
	path: string;
}

function injectCountryImageLayersFast(
	svg: string,
	bounds: CountryBounds,
	stepsArray: StepConfig[],
	imageMap: Record<string, LoadedImage>
): string {
	const { minX, minY, maxX, maxY, pathDatas } = bounds;
	const w = maxX - minX;
	const h = maxY - minY;

	// Exact individual path elements inside clipPath to prevent SVG fill-rule conflicts
	const pathsStr = pathDatas.map((d) => `<path d="${d}"/>`).join("");
	const defsStr = `<clipPath id="full-country-silhouette-clip">${pathsStr}</clipPath>`;

	let layersStr = "";

	stepsArray.forEach((step, idx) => {
		const layerClass = `country-step-layer-${idx}`;

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

			layersStr += `<image class="full-country-mask-image ${layerClass}" href="${img.url}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" clip-path="url(#full-country-silhouette-clip)" preserveAspectRatio="none"></image>`;
		}
	});

	const injection = `<defs>${defsStr}</defs>${layersStr}`;
	return svg.replace("</svg>", `${injection}</svg>`);
}

export const FullCountryMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [svgToRender, setSvgToRender] = useState<string | null>(null);
	const [imageMap, setImageMap] = useState<Record<string, LoadedImage>>({});
	const [countryBounds, setCountryBounds] = useState<CountryBounds | null>(null);
	const [viewBoxObj, setViewBoxObj] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

	useEffect(() => {
		const countryFile = config.country === "india" ? "india_full" : config.country;
		const svgUrl = staticFile(`maps/countries/${countryFile}.svg`);

		const uniqueImages = Array.from(
			new Set([
				...steps.map((step) => step.image),
				...steps.flatMap((step) => step.pngs?.map((p) => p.image) || []),
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
			Promise.all(imagePromises),
		]).then(([rawSvg, loadedImages]) => {
			const imgMap: Record<string, LoadedImage> = {};
			loadedImages.forEach((img) => {
				imgMap[img.path] = { url: img.url, aspectRatio: img.aspectRatio };
			});
			setImageMap(imgMap);

			// Strip all inner state stroke attributes completely from SVG source
			const rawText = rawSvg
				.replace(/stroke="[^"]*"/gi, 'stroke="none"')
				.replace(/stroke-width="[^"]*"/gi, 'stroke-width="0"');

			const { bounds, viewBox } = parseCountrySvgFast(rawText);
			setCountryBounds(bounds);

			const vbX = bounds.minX - 25;
			const vbY = bounds.minY - 25;
			const vbW = (bounds.maxX - bounds.minX) + 50;
			const vbH = (bounds.maxY - bounds.minY) + 50;

			setViewBoxObj({ x: vbX, y: vbY, w: vbW, h: vbH });

			let svg = injectCountryImageLayersFast(rawText, bounds, steps, imgMap);

			if (/view[bB]ox="[^"]*"/i.test(svg)) {
				svg = svg.replace(/view[bB]ox="[^"]*"/i, `viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
			} else {
				svg = svg.replace(/<svg/i, `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
			}

			setSvgToRender(svg);
			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load full country map:", err);
			continueRender(handle);
		});
	}, [handle]);

	// --- Step Timeline Processing ---
	let activeStepIdx = 0;
	let activeStepStartFrame = 0;

	for (let i = 0; i < steps.length; i++) {
		const startF = steps[i].startFrame ?? 0;
		if (frame >= startF) {
			activeStepIdx = i;
			activeStepStartFrame = startF;
		}
	}

	const activeStep = steps[activeStepIdx];
	const localFrame = frame - activeStepStartFrame;

	const activeSegments = activeStep?.smartTextSegments !== undefined
		? activeStep.smartTextSegments
		: config.smartTextSegments;

	const activeSmartTextTheme = activeStep?.smartTextTheme !== undefined
		? activeStep.smartTextTheme
		: config.smartTextTheme;

	// Smooth Spring Camera Motion
	const cameraSpring = spring({
		frame,
		fps,
		config: { damping: 24, stiffness: 70, mass: 1.0 },
	});

	const cameraScale = interpolate(cameraSpring, [0, 1], [0.88, 1.0]);
	const cameraTranslateY = interpolate(cameraSpring, [0, 1], [60, 0]);
	const gridOpacity = config.theme.gridColor ? interpolate(frame, [5, 25], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

	const activeColor =
		activeStep?.color ||
		activeStep?.theme?.highlightColor ||
		config.theme.countryColor ||
		"#EF4444";

	const stepLayersStyles = steps
		.map((step, idx) => {
			if (step.mode !== "image") return "";
			const startF = step.startFrame ?? 0;
			const isTriggered = frame >= startF;
			const opacity = isTriggered
				? interpolate(frame - startF, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
				: 0;

			return `
				.map-container svg .country-step-layer-${idx} {
					display: ${opacity > 0 ? "block !important" : "none !important"};
					opacity: ${opacity};
					transition: opacity 0.4s ease-out;
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
			{/* Parchment Background */}
			<div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #FFFFFF 20%, #FFFDF0 70%, #EAE7DC 100%)" }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

			{/* Studio Grid */}
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

			{/* Full Country Silhouette Style (NO inner state borders!) */}
			<style>{`
				.map-container svg path {
					fill: ${activeColor} !important;
					stroke: transparent !important;
					stroke-width: 0px !important;
					stroke-opacity: 0 !important;
					transition: fill 0.4s ease-out;
				}
				.map-container svg clipPath path {
					display: block !important;
				}
				${stepLayersStyles}
				.map-container svg {
					overflow: visible !important;
				}
			`}</style>

			{/* Map Stage Container */}
			<div
				className="map-container"
				style={{
					width: 880,
					height: 880,
					position: "relative",
					transform: `scale(${cameraScale}) translateY(${cameraTranslateY}px)`,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{/* Floor Shadow */}
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

				{svgToRender && viewBoxObj && countryBounds && (
					<AnimatedPngOverlay
						steps={steps}
						activeStepIdx={activeStepIdx}
						frame={frame}
						fps={fps}
						countryBounds={countryBounds}
						imageMap={imageMap}
						viewBox={viewBoxObj}
					/>
				)}
			</div>

			{/* Smart Text View Overlay */}
			{activeStep?.mode === "smart_text" && activeSegments.length > 0 && (
				<SmartTextView
					segments={activeSegments}
					theme={activeSmartTextTheme}
					localFrame={localFrame}
					fps={fps}
				/>
			)}
		</AbsoluteFill>
	);
};

export default FullCountryMap;
