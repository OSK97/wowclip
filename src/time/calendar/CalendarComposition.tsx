import React from "react";
import {
	AbsoluteFill,
	spring,
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	Easing,
	staticFile,
} from "remotion";
import { Video } from "@remotion/media";
import { loadInter as loadFont } from "../../utils/localFonts";

const { fontFamily } = loadFont("normal", {
	weights: ["300", "400", "500", "600", "700"],
	subsets: ["latin"],
});

const DEFAULT_VIDEO = "time_assets/calendar-video.mp4";

export const CalendarComposition: React.FC<{ config?: any }> = ({ config: propConfig }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	let jsonConfig: any = {};
	try {
		jsonConfig = require("./calendar.config.json");
	} catch {
		jsonConfig = {};
	}

	const c = propConfig || jsonConfig || {};
	const theme = c.theme || {};
	const timings = c.timings || {};
	const days = c.days || [];
	const month = c.month || "OCTOBER";
	const year = c.year || 2024;
	const highlightedDate = c.highlightedDate ?? 15;
	const videoFile = c.videoFile || DEFAULT_VIDEO;

	// Custom Theme Colors
	const bgColor = theme.backgroundColor || "#121316";
	const cardBg = theme.cardBg || "linear-gradient(180deg, #1e1e21 0%, #121214 100%)";
	const accentColor = theme.accentColor || "#8B5CF6";
	const accentBarGradient = theme.accentBarGradient || "linear-gradient(90deg, #7C3AED, #8B5CF6 40%, #A78BFA 70%, #7C3AED)";
	const textColor = theme.textColor || "#ffffff";
	const weekdayColor = theme.weekdayColor || "rgba(255, 255, 255, 0.35)";
	const strokeColor = theme.strokeColor || "#8B5CF6";

	const targetIndex = days.findIndex(
		(d: any) => d.isCurrentMonth && d.value === highlightedDate
	);
	const validTargetIndex = targetIndex !== -1 ? targetIndex : 14;
	const targetRow = Math.floor(validTargetIndex / 7);
	const targetCol = validTargetIndex % 7;

	const CELL_WIDTH = 624 / 7;
	const CELL_HEIGHT = 66;
	const ROW_GAP = 20;
	const GRID_START_Y = 248;
	const PADDING_LEFT = 48;

	const targetCenterX = PADDING_LEFT + targetCol * CELL_WIDTH + CELL_WIDTH / 2;
	const targetCenterY = GRID_START_Y + targetRow * (CELL_HEIGHT + ROW_GAP) + CELL_HEIGHT / 2;

	const CONTAINER_CENTER_X = 360;
	const CONTAINER_CENTER_Y = 355;

	const targetTranslateX = CONTAINER_CENTER_X - targetCenterX;
	const targetTranslateY = CONTAINER_CENTER_Y - targetCenterY;

	const zoomStartFrame = timings.zoomStartFrame ?? 96;
	const diveStartFrame = timings.diveStartFrame ?? 160;

	const zoomDuration = timings.zoomDuration ?? 36;
	const diveDuration = timings.diveDuration ?? 48;

	// ─── 1. Card Entry Animation ───
	const rawEntrySpring = spring({
		frame: frame - 10,
		fps,
		config: { damping: 28, stiffness: 75, mass: 1.3 },
	});

	const entrySpring = rawEntrySpring > 0.995 ? 1 : rawEntrySpring;

	const entryTranslateY = interpolate(entrySpring, [0, 1], [1300, 0], {
		extrapolateRight: "clamp",
	});
	const entryScale = interpolate(entrySpring, [0, 1], [0.8, 1], {
		extrapolateRight: "clamp",
	});
	const entryRotateX = interpolate(entrySpring, [0, 1], [30, 0], {
		extrapolateRight: "clamp",
	});
	const entryRotateY = interpolate(entrySpring, [0, 1], [-12, 0], {
		extrapolateRight: "clamp",
	});
	const entryRotateZ = interpolate(entrySpring, [0, 1], [-6, 0], {
		extrapolateRight: "clamp",
	});
	const entryOpacity = interpolate(entrySpring, [0, 0.45], [0, 1], {
		extrapolateRight: "clamp",
	});

	// ─── 2. Zoom into Date ───
	const zoomProgress = interpolate(
		frame,
		[zoomStartFrame, zoomStartFrame + zoomDuration],
		[0, 1],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: Easing.bezier(0.85, 0, 0.15, 1),
		}
	);

	// ─── Cinematic Portal Dive ───
	const diveProgress = interpolate(
		frame,
		[diveStartFrame, diveStartFrame + diveDuration],
		[0, 1],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: Easing.bezier(0.8, 0, 0.5, 0.1),
		}
	);

	const zoomScale =
		frame < diveStartFrame
			? interpolate(zoomProgress, [0, 1], [1, 3.2])
			: interpolate(diveProgress, [0, 1], [3.2, 35]);

	const translateX = interpolate(zoomProgress, [0, 1], [0, targetTranslateX]);
	const translateY = interpolate(zoomProgress, [0, 1], [0, targetTranslateY]);

	// ─── 3. Hand-Drawn Circle Stroke ───
	const strokeDashoffset = interpolate(zoomProgress, [0.3, 0.95], [200, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// ─── 4. Transparent Hole Window ───
	const showWindow = frame >= diveStartFrame;
	const currentMaskRadius = showWindow ? 130 * (zoomScale / 3.2) : 130;

	const videoOpacity = interpolate(
		frame,
		[diveStartFrame, diveStartFrame + 24],
		[0, 1],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}
	);

	const maskStyle: React.CSSProperties = showWindow
		? {
				WebkitMaskImage: `radial-gradient(circle at 50% 50%, rgba(0, 0, 0, ${1 - videoOpacity}) ${currentMaskRadius}px, black ${currentMaskRadius + 2}px)`,
				maskImage: `radial-gradient(circle at 50% 50%, rgba(0, 0, 0, ${1 - videoOpacity}) ${currentMaskRadius}px, black ${currentMaskRadius + 2}px)`,
			}
		: {};

	const calendarBlur = interpolate(diveProgress, [0, 0.7], [0, 25], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const calendarOpacity = interpolate(diveProgress, [0.5, 0.95], [1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const circleBlur = interpolate(diveProgress, [0.1, 0.8], [0, 15], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const circleOpacity = interpolate(diveProgress, [0.3, 0.95], [1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

	return (
		<AbsoluteFill
			style={{
				backgroundColor: bgColor,
				fontFamily,
				overflow: "hidden",
			}}
		>
			{/* Full-screen video behind portal */}
			<AbsoluteFill style={{ zIndex: 0 }}>
				<Video
					src={staticFile(videoFile)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
					muted
					loop
				/>
			</AbsoluteFill>

			{/* Background Overlay & Calendar on top */}
			<AbsoluteFill
				style={{
					zIndex: 1,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					filter: calendarBlur > 0 ? `blur(${calendarBlur}px)` : undefined,
					opacity: calendarOpacity,
					...maskStyle,
				}}
			>
				<AbsoluteFill style={{ backgroundColor: bgColor }} />

				<div
					style={{
						perspective: 1200,
						width: "100%",
						height: "100%",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						pointerEvents: "none",
						transform: `scale(${zoomScale}) translateX(${translateX}px) translateY(${translateY}px)`,
					}}
				>
					<div
						style={{
							width: 720,
							height: 710,
							borderRadius: 90,
							background: cardBg,
							border: "1.5px solid rgba(255, 255, 255, 0.08)",
							boxShadow:
								"0 40px 90px rgba(0, 0, 0, 0.45), 0 16px 36px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
							position: "relative",
							padding: "76px 48px 52px 48px",
							boxSizing: "border-box" as const,
							display: "flex",
							flexDirection: "column" as const,
							overflow: "hidden",
							opacity: entryOpacity,
							transform: `translateY(${entryTranslateY}px) scale(${entryScale}) rotateX(${entryRotateX}deg) rotateY(${entryRotateY}deg) rotateZ(${entryRotateZ}deg)`,
							transformOrigin: "center bottom",
						}}
					>
						{/* Accent top stripe */}
						<div
							style={{
								position: "absolute",
								top: 0,
								left: "50%",
								transform: "translateX(-50%)",
								width: 320,
								height: 6,
								background: accentBarGradient,
								borderBottomLeftRadius: 8,
								borderBottomRightRadius: 8,
								zIndex: 5,
							}}
						/>

						{/* Month & Year Title */}
						<div
							style={{
								textAlign: "center" as const,
								fontSize: 48,
								fontWeight: 600,
								color: textColor,
								letterSpacing: -0.5,
								marginTop: 6,
								marginBottom: 48,
								height: 58,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								zIndex: 6,
							}}
						>
							{month} {year}
						</div>

						{/* Weekday headers */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(7, 1fr)",
								textAlign: "center" as const,
								marginBottom: 28,
								height: 32,
								alignItems: "center",
								zIndex: 6,
							}}
						>
							{weekdays.map((day) => (
								<div
									key={day}
									style={{
										fontSize: 26,
										fontWeight: 600,
										color: weekdayColor,
										letterSpacing: 2,
									}}
								>
									{day}
								</div>
							))}
						</div>

						{/* Days grid */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(7, 1fr)",
								rowGap: 20,
								textAlign: "center" as const,
								height: 410,
								zIndex: 6,
							}}
						>
							{days.map((day: any, index: number) => (
								<div
									key={index}
									style={{
										fontSize: 38,
										fontWeight: 300,
										color: day.isCurrentMonth
											? "rgba(255, 255, 255, 0.92)"
											: "rgba(255, 255, 255, 0.12)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										height: 66,
										position: "relative",
									}}
								>
									{day.value}
								</div>
							))}
						</div>
					</div>
				</div>
			</AbsoluteFill>

			{/* Animated Stroke Circle on top */}
			<AbsoluteFill
				style={{
					zIndex: 2,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					pointerEvents: "none",
					filter: circleBlur > 0 ? `blur(${circleBlur}px)` : undefined,
					opacity: circleOpacity,
				}}
			>
				<div
					style={{
						perspective: 1200,
						width: "100%",
						height: "100%",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						pointerEvents: "none",
						transform: `scale(${zoomScale}) translateX(${translateX}px) translateY(${translateY}px)`,
					}}
				>
					<div
						style={{
							width: 720,
							height: 710,
							position: "relative",
							pointerEvents: "none",
							opacity: entryOpacity,
							transform: `translateY(${entryTranslateY}px) scale(${entryScale}) rotateX(${entryRotateX}deg) rotateY(${entryRotateY}deg) rotateZ(${entryRotateZ}deg)`,
							transformOrigin: "center bottom",
						}}
					>
						<svg
							style={{
								position: "absolute",
								top: targetCenterY,
								left: targetCenterX,
								transform: "translate(-50%, -50%) scale(1.5)",
								width: 80,
								height: 80,
								overflow: "visible",
								pointerEvents: "none",
								filter: `drop-shadow(0 0 10px ${accentColor}80)`,
							}}
							viewBox="0 0 80 80"
						>
							<path
								d="M 40,12 C 56,12 68,24 68,40 C 68,56 56,68 40,68 C 24,68 12,56 12,40 C 12,24 24,12 40,12 C 45,12 55,15 58,22"
								fill="none"
								stroke={strokeColor}
								strokeWidth={3.5}
								strokeLinecap="round"
								strokeDasharray={200}
								strokeDashoffset={strokeDashoffset}
							/>
						</svg>
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export default CalendarComposition;
