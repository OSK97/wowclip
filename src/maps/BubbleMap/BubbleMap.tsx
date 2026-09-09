import React, { useEffect, useState, useMemo } from "react";
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	staticFile,
	delayRender,
	continueRender,
	spring,
} from "remotion";
import configJson from "./config.json";
import { loadMontserrat } from "../../utils/localFonts";

interface BubbleConfig {
	stateId: string;
	value: number;
	displayValue: string;
	label: string;
}

interface RawConfig {
	country?: string;
	bubbles?: BubbleConfig[];
	theme?: {
		mapColor?: string;
		bubbleColor?: string;
		bubbleStrokeColor?: string;
		backgroundColor?: string;
		gridColor?: string;
		textColor?: string;
	};
}

const rawConfig = configJson as RawConfig;

const config = {
	country: rawConfig.country || "india",
	bubbles: rawConfig.bubbles || [],
	theme: rawConfig.theme || {
		mapColor: "#D8D8D8",
		bubbleColor: "rgba(235, 111, 45, 0.4)",
		bubbleStrokeColor: "#EB6F2D",
		backgroundColor: "#FAF9F6",
		gridColor: "rgba(30, 27, 24, 0.18)",
		textColor: "#0F172A"
	}
};

const highlightIds = config.bubbles.map((b) => b.stateId);

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

export const BubbleMap: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const { fontFamily: montserratFontFamily } = loadMontserrat();

	const [handle] = useState(() => delayRender("Loading map SVG"));
	const [rawSvgText, setRawSvgText] = useState<string | null>(null);
	const [statesBounds, setStatesBounds] = useState<StateBounds[]>([]);

	useEffect(() => {
		const svgUrl = staticFile(`maps/countries/${config.country}.svg`);
		fetch(svgUrl)
			.then((res) => res.text())
			.then((rawText) => {
				setRawSvgText(rawText);
				const bounds = measureAllStatesBounds(rawText, highlightIds);
				setStatesBounds(bounds);
				continueRender(handle);
			})
			.catch((err) => {
				console.error("Failed to load map:", err);
				continueRender(handle);
			});
	}, [handle]);

	// Injects bubble elements and badges dynamically into the SVG viewport
	const finalSvg = useMemo(() => {
		if (!rawSvgText || statesBounds.length === 0) return null;

		let svg = rawSvgText
			.replace(/\s+width="[^"]*"/g, "")
			.replace(/\s+height="[^"]*"/g, "");

		let injectStr = "";

		statesBounds.forEach((bound) => {
			const bubbleConf = config.bubbles.find((b) => b.stateId === bound.id);
			if (!bubbleConf) return;

			const cx = bound.minX + (bound.maxX - bound.minX) / 2;
			const cy = bound.minY + (bound.maxY - bound.minY) / 2;

			injectStr += `
<!-- Bubble Circle for ${bound.id} -->
<circle id="bubble-circle-${bound.id}" cx="${cx}" cy="${cy}" r="0" fill="${config.theme.bubbleColor}" stroke="${config.theme.bubbleStrokeColor}" stroke-width="2.5" class="bubble-element" />

<!-- Floating Value Badge -->
<g id="bubble-badge-${bound.id}" class="bubble-badge" opacity="0">
  <rect rx="6" ry="6" fill="#0F172A" opacity="0.9" width="60" height="24" class="badge-bg"></rect>
  <text font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle" x="30" y="15">${bubbleConf.displayValue}</text>
</g>
`;
		});

		if (injectStr) {
			svg = svg.replace("</svg>", `${injectStr}\n</svg>`);
		}

		return svg;
	}, [rawSvgText, statesBounds]);

	// Dynamic bubble scaling + breathing pulse + badge placement calculations
	const bubbleStyles = config.bubbles.map((bubble, i) => {
		const startFrame = 15 + i * 12;
		const popProgress = spring({
			frame: Math.max(0, frame - startFrame),
			fps,
			config: { damping: 15, stiffness: 80 }
		});

		// Calculate size: Radius scales with square root of data value
		const baseRadius = Math.sqrt(bubble.value) * 3.5;
		// Subtle sinus pulse to look premium
		const pulse = Math.sin(frame * 0.08 + i * 0.5) * 2;
		const currentRadius = Math.max(0, baseRadius * popProgress + pulse);

		// Badge placement offsets
		const bound = statesBounds.find((b) => b.id === bubble.stateId);
		if (!bound) return "";

		const cx = bound.minX + (bound.maxX - bound.minX) / 2;
		const cy = bound.minY + (bound.maxY - bound.minY) / 2;

		const badgeW = 60;
		const badgeH = 24;
		// Position badge exactly in the center
		const bx = cx - badgeW / 2;
		const by = cy - badgeH / 2;

		return `
			#bubble-circle-${bubble.stateId} {
				r: ${currentRadius}px !important;
			}
			#bubble-badge-${bubble.stateId} {
				transform: translate(${bx}px, ${by}px);
				opacity: ${popProgress};
			}
		`;
	}).join("\n");

	const gridOpacity = 0.85;

	// State highlight styling
	const highlightStyles = config.bubbles.map((bubble) => {
		return `
			.map-container svg #${bubble.stateId},
			.map-container svg #${bubble.stateId} path {
				fill: #E5E7EB !important;
				stroke-width: 0.6px !important;
			}
		`;
	}).join("\n");

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
				${highlightStyles}
				${bubbleStyles}
				.map-container svg {
					filter: drop-shadow(0px 15px 25px rgba(0,0,0,0.1));
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
				}}
			>
				{finalSvg && (
					<div
						style={{ width: "100%", height: "100%" }}
						dangerouslySetInnerHTML={{ __html: finalSvg }}
					/>
				)}
			</div>

			{/* Bottom Legend Card */}
			<div
				style={{
					position: "absolute",
					bottom: "80px",
					left: "50%",
					transform: "translateX(-50%)",
					width: "480px",
					backgroundColor: "rgba(255, 255, 255, 0.85)",
					backdropFilter: "blur(16px)",
					borderRadius: "24px",
					padding: "20px 30px",
					boxShadow: "0 20px 45px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.02)",
					border: "1px solid rgba(255, 255, 255, 0.6)",
					display: "flex",
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					zIndex: 30,
				}}
			>
				<span
					style={{
						fontFamily: `"${montserratFontFamily}", sans-serif`,
						fontSize: "14px",
						fontWeight: 700,
						textTransform: "uppercase",
						color: config.theme.textColor,
						letterSpacing: "1.5px",
					}}
				>
					GDP Comparison Map
				</span>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<div style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: config.theme.bubbleColor, border: `1px solid ${config.theme.bubbleStrokeColor}` }}></div>
					<span style={{ fontSize: "12px", fontWeight: 600, color: config.theme.textColor, opacity: 0.6 }}>GDP Scale (USD)</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default BubbleMap;
