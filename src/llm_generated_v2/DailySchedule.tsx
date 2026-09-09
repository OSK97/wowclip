import React from "react";
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

interface ScheduleItem {
	time: string;
	title: string;
	duration: string;
	category: string;
	isActive?: boolean;
}

const SCHEDULE_DATA: ScheduleItem[] = [
	{
		time: "08:30 AM",
		title: "Align & Focus",
		duration: "30 min",
		category: "Mindset",
	},
	{
		time: "09:00 AM",
		title: "Deep Work: Core Architecture",
		duration: "120 min",
		category: "Engineering",
	},
	{
		time: "11:30 AM",
		title: "Design Review: Motion System",
		duration: "60 min",
		category: "Creative",
		isActive: true, // Highlighted current hour
	},
	{
		time: "01:30 PM",
		title: "Product Strategy Sync",
		duration: "45 min",
		category: "Management",
	},
	{
		time: "03:00 PM",
		title: "Creative Exploration",
		duration: "90 min",
		category: "Design",
	},
];

export const DailySchedule: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Slow cinematic breathing effect for the entire canvas
	const scale = interpolate(frame, [0, 180], [1, 1.03], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Background gradient shift
	const bgGradientShift = interpolate(frame, [0, 180], [0, 10], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#030712",
				fontFamily,
				color: "#f3f4f6",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				padding: "80px 60px",
			}}
		>
			{/* Cinematic Background Orbs */}
			<div
				style={{
					position: "absolute",
					width: 800,
					height: 800,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
					top: "-10%",
					left: "-10%",
					transform: `scale(${scale}) translate(${bgGradientShift}px, ${bgGradientShift}px)`,
					filter: "blur(80px)",
					pointerEvents: "none",
				}}
			/>
			<div
				style={{
					position: "absolute",
					width: 900,
					height: 900,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(0,0,0,0) 70%)",
					bottom: "-10%",
					right: "-10%",
					transform: `scale(${scale}) translate(${-bgGradientShift}px, ${-bgGradientShift}px)`,
					filter: "blur(100px)",
					pointerEvents: "none",
				}}
			/>

			{/* Subtle Grid Overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
					backgroundSize: "40px 40px",
					pointerEvents: "none",
				}}
			/>

			{/* Main Container with Breathing Scale */}
			<div
				style={{
					width: "100%",
					maxWidth: 900,
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					transform: `scale(${scale})`,
					zIndex: 10,
				}}
			>
				{/* Header Section */}
				<header style={{ marginBottom: 40 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							marginBottom: 12,
						}}
					>
						<span
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								backgroundColor: "#10b981",
								boxShadow: "0 0 12px #10b981",
							}}
						/>
						<span
							style={{
								fontSize: 20,
								fontWeight: 600,
								letterSpacing: "0.25em",
								color: "#10b981",
								textTransform: "uppercase",
							}}
						>
							Live Schedule
						</span>
					</div>
					<h1
						style={{
							fontSize: 72,
							fontWeight: 800,
							letterSpacing: "-0.03em",
							margin: 0,
							background: "linear-gradient(to right, #ffffff, #9ca3af)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
						}}
					>
						Today's Focus
					</h1>
				</header>

				{/* Timeline Container */}
				<div
					style={{
						position: "relative",
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						paddingLeft: 40,
					}}
				>
					{/* Vertical Timeline Track */}
					<div
						style={{
							position: "absolute",
							left: 8,
							top: 20,
							bottom: 20,
							width: 2,
							background:
								"linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0.05))",
						}}
					/>

					{/* Active Track Highlight */}
					<div
						style={{
							position: "absolute",
							left: 7,
							top: "38%",
							height: "22%",
							width: 4,
							background: "linear-gradient(to bottom, #10b981, #3b82f6)",
							boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)",
							borderRadius: 2,
						}}
					/>

					{/* Schedule Items */}
					{SCHEDULE_DATA.map((item, index) => {
						// Staggered entrance animation for each card
						const delay = index * 6;
						const entrance = spring({
							frame: frame - delay,
							fps,
							config: { damping: 16, stiffness: 90 },
						});

						const opacity = interpolate(entrance, [0, 1], [0, 1]);
						const translateX = interpolate(entrance, [0, 1], [-30, 0]);

						// Active item pulsing effect
						const activePulse = item.isActive
							? Math.sin(frame / 10) * 0.015 + 1
							: 1;

						return (
							<div
								key={item.time}
								style={{
									position: "relative",
									opacity,
									transform: `translateX(${translateX}px) scale(${
										item.isActive ? activePulse : 1
									})`,
									display: "flex",
									alignItems: "center",
									width: "100%",
								}}
							>
								{/* Timeline Node Dot */}
								<div
									style={{
										position: "absolute",
										left: -40,
										width: 18,
										height: 18,
										borderRadius: "50%",
										backgroundColor: item.isActive ? "#10b981" : "#1f2937",
										border: `4px solid ${
											item.isActive ? "rgba(16, 185, 129, 0.3)" : "#030712"
										}`,
										boxShadow: item.isActive
											? "0 0 15px rgba(16, 185, 129, 0.6)"
											: "none",
										zIndex: 2,
										transition: "all 0.3s ease",
									}}
								/>

								{/* Card */}
								<div
									style={{
										flex: 1,
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "32px 40px",
										borderRadius: 24,
										background: item.isActive
											? "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)"
											: "rgba(255, 255, 255, 0.015)",
										border: `1px solid ${
											item.isActive
												? "rgba(16, 185, 129, 0.3)"
												: "rgba(255, 255, 255, 0.04)"
										}`,
										backdropFilter: "blur(20px)",
										WebkitBackdropFilter: "blur(20px)",
										boxShadow: item.isActive
											? "0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
											: "0 10px 30px rgba(0, 0, 0, 0.2)",
									}}
								>
									{/* Left Details */}
									<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 12,
											}}
										>
											<span
												style={{
													fontSize: 22,
													fontWeight: 700,
													color: item.isActive ? "#10b981" : "#9ca3af",
													fontVariantNumeric: "tabular-nums",
												}}
											>
												{item.time}
											</span>
											<span
												style={{
													fontSize: 14,
													fontWeight: 600,
													textTransform: "uppercase",
													letterSpacing: "0.1em",
													padding: "4px 10px",
													borderRadius: 8,
													backgroundColor: item.isActive
														? "rgba(16, 185, 129, 0.15)"
														: "rgba(255, 255, 255, 0.05)",
													color: item.isActive ? "#34d399" : "#9ca3af",
												}}
											>
												{item.category}
											</span>
										</div>
										<h2
											style={{
												fontSize: 34,
												fontWeight: 700,
												margin: 0,
												color: item.isActive ? "#ffffff" : "#e5e7eb",
												letterSpacing: "-0.01em",
											}}
										>
											{item.title}
										</h2>
									</div>

									{/* Right Details (Duration / Status) */}
									<div style={{ textAlign: "right" }}>
										{item.isActive ? (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 8,
													backgroundColor: "rgba(16, 185, 129, 0.1)",
													padding: "8px 16px",
													borderRadius: 12,
													border: "1px solid rgba(16, 185, 129, 0.2)",
												}}
											>
												<span
													style={{
														width: 8,
														height: 8,
														borderRadius: "50%",
														backgroundColor: "#10b981",
														display: "inline-block",
													}}
												/>
												<span
													style={{
														fontSize: 18,
														fontWeight: 700,
														color: "#10b981",
														textTransform: "uppercase",
														letterSpacing: "0.05em",
													}}
												>
													Active
												</span>
											</div>
										) : (
											<span
												style={{
													fontSize: 20,
													fontWeight: 500,
													color: "#6b7280",
													fontVariantNumeric: "tabular-nums",
												}}
											>
												{item.duration}
											</span>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer Branding */}
				<footer
					style={{
						marginTop: 40,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						borderTop: "1px solid rgba(255, 255, 255, 0.05)",
						paddingTop: 24,
					}}
				>
					<span
						style={{
							fontSize: 18,
							color: "#4b5563",
							fontWeight: 500,
							letterSpacing: "0.05em",
						}}
					>
						Designed for High Performance
					</span>
					<span
						style={{
							fontSize: 18,
							color: "#9ca3af",
							fontWeight: 600,
							fontVariantNumeric: "tabular-nums",
						}}
					>
						11:45 AM GMT
					</span>
				</footer>
			</div>
		</AbsoluteFill>
	);
};

// Composition Registration Snippet:
// <Composition
//   id="DailySchedule"
//   component={DailySchedule}
//   durationInFrames={180}
//   fps={30}
//   width={1080}
//   height={1920}
// />