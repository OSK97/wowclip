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
} from "remotion";
import configJson from "./config.json";
import { SmartTextView, Segment, ThemeConfig as SmartTextThemeConfig } from "./SmartTextView";
import { AnimatedPngOverlay } from "./AnimatedPngOverlay";

interface StepConfig {
	mode: "png" | "image" | "smart_text";
	image?: string;
	durationInFrames?: number;
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
}

interface TimelineEvent {
	stateId: string;
	year: string;
	title: string;
	description: string;
	image?: string;
	steps?: StepConfig[];
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
}

interface RawConfig {
	country?: string;
	timeline?: TimelineEvent[];
	smartTextSegments?: Segment[];
	smartTextTheme?: SmartTextThemeConfig;
	theme?: {
		mapColor?: string;
		highlightColor?: string;
		pathColor?: string;
		backgroundColor?: string;
		gridColor?: string;
		textColor?: string;
	};
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	timeline: rawConfig.timeline || [],
	smartTextSegments: rawConfig.smartTextSegments || [],
	smartTextTheme: rawConfig.smartTextTheme || {},
	theme: rawConfig.theme || {
		mapColor: "#D8D8D8",
		highlightColor: "#EB6F2D",
		pathColor: "#EB6F2D",
		backgroundColor: "#FAF9F6",
		gridColor: "",
		textColor: "#0F172A"
	}
};

const highlightIds = config.timeline.map((e) => e.stateId);

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

function injectStepLayers(
	svg: string,
	states: StateBounds[],
	timelineEvents: TimelineEvent[],
	imageMap: Record<string, LoadedImage>,
	viewBox: { x: number; y: number; w: number; h: number }
): string {
	if (states.length === 0) return svg;

	let defsStr = "";
	let layersStr = "";

	states.forEach((state) => {
		const eventIdx = timelineEvents.findIndex((e) => e.stateId === state.id);
		if (eventIdx === -1) return;
		const event = timelineEvents[eventIdx];

		const eventSteps = (event.steps && event.steps.length > 0)
			? event.steps
			: [
				{
					mode: event.image ? "png" as const : "image" as const,
					image: event.image || undefined,
					durationInFrames: 80
				}
			  ];

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

		eventSteps.forEach((step, stepIdx) => {
			if (!step.image) return;
			const img = imageMap[step.image];
			if (!img) return;

			const layerClass = `event-${eventIdx}-step-${stepIdx}`;

			if (step.mode === "image") {
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
<!-- State ${state.id} Event ${eventIdx} Step ${stepIdx} Image Layer -->
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

export const CountryMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [rawSvgText, setRawSvgText] = useState<string | null>(null);
	const [imageMap, setImageMap] = useState<Record<string, LoadedImage>>({});
	const [statesBounds, setStatesBounds] = useState<StateBounds[]>([]);
	const [viewBoxObj, setViewBoxObj] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		
		const uniqueImages = Array.from(
			new Set([
				...config.timeline.map((e) => e.image),
				...config.timeline.flatMap((e) => (e.steps || []).map((s) => s.image)),
				...config.timeline.flatMap((e) => (e.steps || []).flatMap((s) => s.pngs?.map((p) => p.image) || [])),
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
			setRawSvgText(rawText);

			const imgMap: Record<string, LoadedImage> = {};
			loadedImages.forEach((img) => {
				imgMap[img.path] = { url: img.url, aspectRatio: img.aspectRatio };
			});
			setImageMap(imgMap);

			const bounds = measureAllStatesBounds(rawText, highlightIds);
			setStatesBounds(bounds);

			let vbX = 0, vbY = 0, vbW = 1000, vbH = 1000;
			const vbMatch = rawText.match(/view[bB]ox="([^"]*)"/i);
			if (vbMatch) {
				const parts = vbMatch[1].trim().split(/\s+/).map(Number);
				if (parts.length === 4 && !parts.some(isNaN)) {
					vbX = parts[0];
					vbY = parts[1];
					vbW = parts[2];
					vbH = parts[3];
				}
			}
			setViewBoxObj({ x: vbX, y: vbY, w: vbW, h: vbH });

			continueRender(handle);
		}).catch((err) => {
			console.error("Failed to load map:", err);
			continueRender(handle);
		});
	}, [handle]);

	// --- Timeline Event Processing ---
	const timelineWithTiming = useMemo(() => {
		let currentFrameOffset = 15;
		return config.timeline.map((event) => {
			const eventSteps = (event.steps && event.steps.length > 0)
				? event.steps
				: [
					{
						mode: event.image ? "png" as const : "image" as const,
						image: event.image || undefined,
						durationInFrames: 80
					}
				  ];

			let eventDuration = 0;
			const stepsWithTiming = eventSteps.map((step) => {
				const startFrame = currentFrameOffset + eventDuration;
				const duration = step.durationInFrames || 80;
				eventDuration += duration;
				return {
					...step,
					startFrame,
					duration
				};
			});

			const startFrame = currentFrameOffset;
			const endFrame = startFrame + eventDuration;
			currentFrameOffset = endFrame;

			return {
				...event,
				steps: stepsWithTiming,
				startFrame,
				endFrame,
				duration: eventDuration
			};
		});
	}, []);

	let activeEventIdx = -1;
	let activeStepIdx = -1;
	let activeStepStartFrame = 0;

	if (timelineWithTiming.length > 0 && frame >= timelineWithTiming[0].startFrame) {
		for (let i = 0; i < timelineWithTiming.length; i++) {
			const ev = timelineWithTiming[i];
			if (frame >= ev.startFrame && frame < ev.endFrame) {
				activeEventIdx = i;
				for (let j = 0; j < ev.steps.length; j++) {
					const step = ev.steps[j];
					if (frame >= step.startFrame && frame < step.startFrame + step.duration) {
						activeStepIdx = j;
						activeStepStartFrame = step.startFrame;
						break;
					}
				}
				break;
			}
			if (frame >= ev.endFrame && i === timelineWithTiming.length - 1) {
				activeEventIdx = i;
				const lastStepIdx = ev.steps.length - 1;
				activeStepIdx = Math.max(0, lastStepIdx);
				activeStepStartFrame = ev.steps[activeStepIdx]?.startFrame || ev.startFrame;
			}
		}
	}

	const activeEvent = timelineWithTiming[activeEventIdx];
	const activeStep = activeEvent?.steps[activeStepIdx];
	const localFrame = frame - activeStepStartFrame;

	const activeSegments = activeStep?.smartTextSegments !== undefined
		? activeStep.smartTextSegments
		: activeEvent?.smartTextSegments !== undefined
		? activeEvent.smartTextSegments
		: config.smartTextSegments;

	const activeSmartTextTheme = activeStep?.smartTextTheme !== undefined
		? activeStep.smartTextTheme
		: activeEvent?.smartTextTheme !== undefined
		? activeEvent.smartTextTheme
		: config.smartTextTheme;

	// --- Transition Blur & Scale Logic for Highlight State Mode ---
	let blurIntensity = 0;
	timelineWithTiming.forEach(event => {
		for (let i = 0; i < event.steps.length; i++) {
			if (event.steps[i].mode === "png") {
				const startF = event.steps[i].startFrame ?? 0;
				const endF = event.steps[i + 1]?.startFrame ?? event.endFrame;
				// Blur ramps up over 12 frames, and stays blurred for 12 frames AFTER the step ends
				const b = interpolate(frame, [startF, startF + 12, endF, endF + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
				if (b > blurIntensity) blurIntensity = b;
			}
		}
	});

	const shouldBlurBackground = blurIntensity > 0;
	const blurAmount = blurIntensity * 3;
	const slideProgress = 1 - blurIntensity;


	// Find the most recent background image step index
	const activeImageStepIdx = (() => {
		if (activeEvent) {
			for (let i = activeStepIdx; i >= 0; i--) {
				if (activeEvent.steps[i] && activeEvent.steps[i].mode === "image") {
					return i;
				}
			}
		}
		return -1;
	})();

	// Build the route legs dynamically once bounds are measured
	const routeLegs = useMemo(() => {
		if (statesBounds.length < 2) return [];
		const legs = [];
		for (let i = 0; i < statesBounds.length - 1; i++) {
			const bStart = statesBounds.find((b) => b.id === config.timeline[i].stateId);
			const bEnd = statesBounds.find((b) => b.id === config.timeline[i + 1].stateId);
			if (bStart && bEnd) {
				const x1 = bStart.minX + (bStart.maxX - bStart.minX) / 2;
				const y1 = bStart.minY + (bStart.maxY - bStart.minY) / 2;
				const x2 = bEnd.minX + (bEnd.maxX - bEnd.minX) / 2;
				const y2 = bEnd.minY + (bEnd.maxY - bEnd.minY) / 2;
				const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
				legs.push({ x1, y1, x2, y2, length, fromId: bStart.id, toId: bEnd.id });
			}
		}
		return legs;
	}, [statesBounds]);

	// Re-construct the SVG with line drawings and popouts injected
	const finalSvg = useMemo(() => {
		if (!rawSvgText || statesBounds.length === 0) return null;

		let svg = rawSvgText
			.replace(/\s+width="[^"]*"/g, "")
			.replace(/\s+height="[^"]*"/g, "");

		if (!viewBoxObj) return svg;
		const { x: vbX, y: vbY, w: vbW, h: vbH } = viewBoxObj;

		// Inject step layers
		svg = injectStepLayers(svg, statesBounds, config.timeline, imageMap, { x: vbX, y: vbY, w: vbW, h: vbH });

		if (/view[bB]ox="[^"]*"/i.test(svg)) {
			svg = svg.replace(/view[bB]ox="[^"]*"/i, `viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
		} else {
			svg = svg.replace(/<svg/i, `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; overflow: visible;"`);
		}

		return svg;
	}, [rawSvgText, statesBounds, routeLegs, imageMap]);

	// Animating the drawing of each leg sequentially
	const legStyles = routeLegs.map((leg, i) => {
		const nextEvent = timelineWithTiming[i + 1];
		const legStart = nextEvent ? nextEvent.startFrame - 15 : 20 + i * 80;
		const legProgress = interpolate(frame, [legStart, legStart + 15], [1, 0], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: Easing.bezier(0.25, 1, 0.5, 1),
		});
		const offset = leg.length * legProgress;
		return `
			#route-leg-${i} {
				stroke-dasharray: ${leg.length};
				stroke-dashoffset: ${offset};
			}
		`;
	}).join("\n");

	// Animate state highlight sweeps
	const stateStyles = timelineWithTiming.map((event) => {
		const isHighlighted = frame >= event.startFrame;
		const highlightColor = event.highlightColor || config.theme.highlightColor || "#F97316";
		const fillColor = isHighlighted ? highlightColor : (config.theme.mapColor || "#DADADA");
		const strokeWidth = isHighlighted ? "2px" : "0.5px";

		return `
			.map-container svg #${event.stateId},
			.map-container svg #${event.stateId} path {
				fill: ${fillColor} !important;
				stroke: #FFFFFF !important;
				stroke-width: ${strokeWidth} !important;
				transition: fill 0.4s ease-out, stroke-width 0.4s ease-out;
			}
		`;
	}).join("\n");

	// Generate CSS styles for all image steps (stay preserved once triggered)
	const stepLayersStyles = timelineWithTiming
		.map((event, eventIdx) => {
			return event.steps.map((step, stepIdx) => {
				if (step.mode !== "image") return "";
				const isTriggered = frame >= step.startFrame;
				const opacity = isTriggered
					? interpolate(frame - step.startFrame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
					: 0;

				return `
					.map-container svg .event-${eventIdx}-step-${stepIdx} {
						display: ${opacity > 0 ? "block !important" : "none !important"};
						opacity: ${opacity};
						transition: opacity 0.4s ease-out;
						pointer-events: none;
					}
				`;
			}).join("\n");
		})
		.join("\n");

	const gridOpacity = config.theme.gridColor ? 0.85 : 0;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: config.theme.backgroundColor,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, #FFFFFF 20%, #FFFDF0 70%, #EAE7DC 100%)" }} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
			<div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

			{/* Grid */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: 720,
					height: 800,
					opacity: gridOpacity,
					WebkitMaskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					maskImage: "radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)",
					pointerEvents: "none",
				}}
			>
				<svg width="100%" height="100%">
					{Array.from({ length: 10 }).map((_, i) => (
						<line key={`v-${i}`} x1={i * 80} y1={0} x2={i * 80} y2={800} stroke={config.theme.gridColor} strokeWidth={1.5} />
					))}
					{Array.from({ length: 11 }).map((_, i) => (
						<line key={`h-${i}`} x1={0} y1={i * 80} x2={720} y2={i * 80} stroke={config.theme.gridColor} strokeWidth={1.5} />
					))}
				</svg>
			</div>

			<style>{`
				.map-container svg path {
					fill: ${config.theme.mapColor};
					stroke: #ffffff;
					stroke-width: 0.5px;
				}
				.map-container svg clipPath path {
					display: block !important;
				}
				${legStyles}
				${stateStyles}
				${stepLayersStyles}
				.map-container svg image.building-overlay {
					display: block !important;
					pointer-events: none;
					transform-origin: bottom center;
				}
				.map-container svg {
					filter: drop-shadow(0px 15px 25px rgba(0,0,0,0.12));
					overflow: visible !important;
				}
			`}</style>

			{/* Map SVG */}
			<div
				className="map-container"
				style={{
					width: 1000,
					height: 1000,
					position: "relative",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					marginTop: "-100px",
					transform: "scale(1.15)",
				}}
			>
				{finalSvg && (
					<>
						<div
							style={{ width: "100%", height: "100%" }}
							dangerouslySetInnerHTML={{ __html: finalSvg }}
						/>
						{viewBoxObj && (
							<AnimatedPngOverlay
								timeline={timelineWithTiming}
								activeEventIdx={activeEventIdx}
								activeStepIdx={activeStepIdx}
								frame={frame}
								fps={fps}
								statesBounds={statesBounds}
								imageMap={imageMap}
								viewBox={viewBoxObj}
							/>
						)}
					</>
				)}
			</div>

		</AbsoluteFill>
	);
};

export default CountryMap;
