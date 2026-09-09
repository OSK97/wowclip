import React from "react";
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadOutfit();

// Helper for generating deterministic particle properties
const createParticles = (count: number) => {
	return Array.from({ length: count }).map((_, i) => {
		const random = (min: number, max: number) =>
			min + Math.sin(i * 999) * (max - min);
		return {
			id: i,
			x: random(100, 980),
			yStart: random(1200, 1600),
			size: random(6, 16),
			speed: random(3, 7),
			delay: random(0, 30),
			opacity: random(0.4, 0.8),
		};
	});
};

const PARTICLES = createParticles(40);

export const AchievementUnlocked: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Cinematic camera breathing effect
	const cameraScale = 1 + Math.sin(frame / 80) * 0.015;

	// Spring animations for elements
	const badgeSpring = spring({
		frame: frame - 10,
		fps,
		config: { damping: 14, stiffness: 75, mass: 1.2 },
	});

	const iconSpring = spring({
		frame: frame - 25,
		fps,
		config: { damping: 12, stiffness: 90 },
	});

	const textHeaderSpring = spring({
		frame: frame - 35,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	const textTitleSpring = spring({
		frame: frame - 42,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	const xpSpring = spring({
		frame: frame - 55,
		fps,
		config: { damping: 12, stiffness: 110 },
	});

	// Background glows and ambient animations
	const bgGlowOpacity = interpolate(frame, [0, 45], [0, 0.85], {
		extrapolateRight: "clamp",
	});

	const borderDraw = interpolate(frame, [10, 50], [0, 100], {
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#060608",
				fontFamily,
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* Ambient Background Orbs */}
			<div
				style={{
					position: "absolute",
					width: "1200px",
					height: "1200px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(212, 163, 89, 0.12) 0%, rgba(0,0,0,0) 70%)",
					top: "10%",
					left: "-10%",
					filter: "blur(80px)",
					opacity: bgGlowOpacity,
					transform: `scale(${1 + Math.sin(frame / 100) * 0.05})`,
				}}
			/>
			<div
				style={{
					position: "absolute",
					width: "1000px",
					height: "1000px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(147, 51, 234, 0.08) 0%, rgba(0,0,0,0) 70%)",
					bottom: "15%",
					right: "-10%",
					filter: "blur(100px)",
					opacity: bgGlowOpacity,
					transform: `scale(${1 + Math.cos(frame / 120) * 0.05})`,
				}}
			/>

			{/* Subtle Grid Overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
					backgroundSize: "48px 48px",
					opacity: interpolate(frame, [0, 30], [0, 1], {
						extrapolateRight: "clamp",
					}),
				}}
			/>

			{/* Rising Golden Dust Particles */}
			{PARTICLES.map((p) => {
				const progress = ((frame - p.delay) / (120 - p.speed)) % 1;
				const yPos = p.yStart - progress * 800;
				const opacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, p.opacity, p.opacity, 0]);
				const scale = interpolate(progress, [0, 1], [0.5, 1.2]);

				return (
					<div
						key={p.id}
						style={{
							position: "absolute",
							left: p.x,
							top: yPos,
							width: p.size,
							height: p.size,
							borderRadius: "50%",
							backgroundColor: "#d4a359",
							boxShadow: "0 0 12px #d4a359",
							opacity: frame > p.delay ? opacity : 0,
							transform: `scale(${scale})`,
							pointerEvents: "none",
						}}
					/>
				);
			})}

			{/* Main Cinematic Wrapper with Camera Breathing */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					transform: `scale(${cameraScale})`,
					width: "100%",
					height: "100%",
				}}
			>
				{/* The Massive Badge Card */}
				<div
					style={{
						position: "relative",
						width: "820px",
						height: "960px",
						borderRadius: "64px",
						background:
							"linear-gradient(135deg, rgba(25, 25, 35, 0.65) 0%, rgba(12, 12, 16, 0.85) 100%)",
						border: "1px solid rgba(255, 255, 255, 0.08)",
						boxShadow:
							"0 80px 120px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.1)",
						backdropFilter: "blur(40px)",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "90px 60px",
						boxSizing: "border-box",
						transform: `scale(${badgeSpring}) translateY(${interpolate(
							badgeSpring,
							[0, 1],
							[100, 0]
						)}px)`,
						opacity: badgeSpring,
					}}
				>
					{/* Glowing Animated Border Accent */}
					<div
						style={{
							position: "absolute",
							inset: "-2px",
							borderRadius: "66px",
							padding: "2px",
							background: `conic-gradient(from 180deg at 50% 50%, #d4a359 0deg, transparent ${borderDraw}deg, transparent 360deg)`,
							WebkitMask:
								"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
							WebkitMaskComposite: "xor",
							maskComposite: "exclude",
							pointerEvents: "none",
							opacity: interpolate(frame, [10, 40], [0, 1], {
								extrapolateRight: "clamp",
							}),
						}}
					/>

					{/* Top Section: Glowing Icon Container */}
					<div
						style={{
							position: "relative",
							width: "240px",
							height: "240px",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							transform: `scale(${iconSpring}) rotate(${interpolate(
								iconSpring,
								[0, 1],
								[-15, 0]
							)}deg)`,
						}}
					>
						{/* Outer Ring Glow */}
						<div
							style={{
								position: "absolute",
								inset: 0,
								borderRadius: "50%",
								border: "2px solid rgba(212, 163, 89, 0.3)",
								boxShadow: "0 0 40px rgba(212, 163, 89, 0.2)",
								transform: `scale(${1 + Math.sin(frame / 30) * 0.05})`,
							}}
						/>
						{/* Inner Solid Badge Circle */}
						<div
							style={{
								position: "absolute",
								inset: "15px",
								borderRadius: "50%",
								background:
									"linear-gradient(135deg, #1e1b15 0%, #0c0a07 100%)",
								border: "2px solid #d4a359",
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								boxShadow: "0 15px 35px rgba(0, 0, 0, 0.5)",
							}}
						>
							{/* Majestic Trophy SVG */}
							<svg
								width="100"
								height="100"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#d4a359"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								style={{
									filter: "drop-shadow(0 0 15px rgba(212, 163, 89, 0.6))",
								}}
							>
								<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
								<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
								<path d="M4 22h16" />
								<path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
								<path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" />
							</svg>
						</div>
					</div>

					{/* Middle Section: Typography */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							textAlign: "center",
							gap: "24px",
							width: "100%",
						}}
					>
						{/* "ACHIEVEMENT UNLOCKED" Label */}
						<div
							style={{
								fontSize: "32px",
								fontWeight: 800,
								letterSpacing: "12px",
								color: "#d4a359",
								textTransform: "uppercase",
								textShadow: "0 0 20px rgba(212, 163, 89, 0.4)",
								transform: `translateY(${interpolate(
									textHeaderSpring,
									[0, 1],
									[30, 0]
								)}px)`,
								opacity: textHeaderSpring,
							}}
						>
							Achievement Unlocked
						</div>

						{/* Massive Title */}
						<div
							style={{
								fontSize: "76px",
								fontWeight: 900,
								letterSpacing: "-1px",
								color: "#ffffff",
								lineHeight: 1.1,
								textShadow: "0 10px 30px rgba(0,0,0,0.5)",
								transform: `translateY(${interpolate(
									textTitleSpring,
									[0, 1],
									[40, 0]
								)}px)`,
								opacity: textTitleSpring,
							}}
						>
							LEGENDARY STATUS
						</div>

						{/* Description */}
						<div
							style={{
								fontSize: "36px",
								fontWeight: 400,
								color: "rgba(255, 255, 255, 0.6)",
								maxWidth: "600px",
								lineHeight: 1.4,
								transform: `translateY(${interpolate(
									textTitleSpring,
									[0, 1],
									[40, 0]
								)}px)`,
								opacity: textTitleSpring,
							}}
						>
							Mastered the art of cinematic motion design.
						</div>
					</div>

					{/* Bottom Section: XP Pill */}
					<div
						style={{
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							transform: `scale(${xpSpring})`,
							opacity: xpSpring,
						}}
					>
						<div
							style={{
								padding: "20px 50px",
								borderRadius: "100px",
								background:
									"linear-gradient(90deg, rgba(212, 163, 89, 0.15) 0%, rgba(212, 163, 89, 0.05) 100%)",
								border: "1.5px solid rgba(212, 163, 89, 0.4)",
								boxShadow: "0 10px 30px rgba(212, 163, 89, 0.1)",
								display: "flex",
								alignItems: "center",
								gap: "16px",
							}}
						>
							<span
								style={{
									fontSize: "36px",
									fontWeight: 800,
									color: "#ffffff",
									letterSpacing: "1px",
								}}
							>
								XP
							</span>
							<span
								style={{
									fontSize: "40px",
									fontWeight: 900,
									color: "#d4a359",
									fontVariantNumeric: "tabular-nums",
									textShadow: "0 0 10px rgba(212, 163, 89, 0.3)",
								}}
							>
								+1,000
							</span>
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

/*
// Composition Registration Snippet for Root.tsx:
// Add this inside your <registerRoot> or <Folder> in Root.tsx:

import { Composition } from "remotion";
import { AchievementUnlocked } from "./components/AchievementUnlocked";

export const Root: React.FC = () => {
	return (
		<Composition
			id="AchievementUnlocked"
			component={AchievementUnlocked}
			durationInFrames={150}
			fps={30}
			width={1080}
			height={1920}
		/>
	);
};
*/