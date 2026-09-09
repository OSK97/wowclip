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

interface Exercise {
  id: string;
  name: string;
  sets: string;
  weight: string;
  tag: string;
  active: boolean;
}

const ROUTINE_DATA: Exercise[] = [
  {
    id: "01",
    name: "Barbell Bench Press",
    sets: "4 Sets × 8 Reps",
    weight: "225 LBS",
    tag: "Chest / Push",
    active: true,
  },
  {
    id: "02",
    name: "Incline Dumbbell Fly",
    sets: "3 Sets × 12 Reps",
    weight: "70 LBS",
    tag: "Chest / Isolation",
    active: false,
  },
  {
    id: "03",
    name: "Weighted Pull-Ups",
    sets: "4 Sets × 6 Reps",
    weight: "+45 LBS",
    tag: "Back / Pull",
    active: false,
  },
  {
    id: "04",
    name: "Overhead Press",
    sets: "3 Sets × 8 Reps",
    weight: "145 LBS",
    tag: "Shoulders / Push",
    active: false,
  },
];

export const WorkoutRoutine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow breathing camera effect
  const cameraScale = 1 + Math.sin(frame / 80) * 0.015;

  // Header animations
  const headerSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const headerY = interpolate(headerSpring, [0, 1], [80, 0]);
  const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#080A10",
        fontFamily,
        color: "#FFFFFF",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        padding: "120px 80px",
      }}
    >
      {/* Background Cinematic Orbs */}
      <div
        style={{
          position: "absolute",
          width: "1000px",
          height: "1000px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)",
          top: "-200px",
          right: "-200px",
          filter: "blur(80px)",
          transform: `scale(${cameraScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "1200px",
          height: "1200px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-300px",
          left: "-300px",
          filter: "blur(100px)",
          transform: `scale(${cameraScale})`,
        }}
      />

      {/* Grid Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
          opacity: 0.8,
        }}
      />

      {/* Main Content Container with camera breathing */}
      <div
        style={{
          transform: `scale(${cameraScale})`,
          transformOrigin: "center center",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          zIndex: 10,
        }}
      >
        {/* Header Section */}
        <div
          style={{
            opacity: headerOpacity,
            transform: `translateY(${headerY}px)`,
            marginBottom: "80px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#10B981",
                padding: "8px 20px",
                borderRadius: "100px",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              Day 01
            </span>
            <span
              style={{
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "1px",
              }}
            >
              • 45 MINS
            </span>
          </div>

          <h1
            style={{
              fontSize: "90px",
              fontWeight: 800,
              lineHeight: 1.1,
              margin: 0,
              background: "linear-gradient(180deg, #FFFFFF 0%, #A5B4FC 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-2px",
            }}
          >
            Hypertrophy
            <br />
            Upper Body
          </h1>
        </div>

        {/* Workout List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {ROUTINE_DATA.map((exercise, index) => {
            // Staggered entrance spring
            const cardDelay = index * 10;
            const cardSpring = spring({
              frame: frame - cardDelay,
              fps,
              config: { damping: 16, stiffness: 90 },
            });

            const cardY = interpolate(cardSpring, [0, 1], [120, 0]);
            const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
            const cardScale = interpolate(cardSpring, [0, 1], [0.95, 1]);

            // Active card pulsing border / glow
            const glowIntensity = exercise.active
              ? interpolate(
                  Math.sin(frame / 15),
                  [-1, 1],
                  [0.15, 0.35]
                )
              : 0;

            // Active card progress bar animation
            const progressWidth = exercise.active
              ? interpolate(frame, [40, 140], [0, 100], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;

            return (
              <div
                key={exercise.id}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px) scale(${cardScale})`,
                  backgroundColor: exercise.active
                    ? "rgba(255, 255, 255, 0.07)"
                    : "rgba(255, 255, 255, 0.02)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: "32px",
                  padding: "48px",
                  border: exercise.active
                    ? `2px solid rgba(16, 185, 129, ${glowIntensity + 0.2})`
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  boxShadow: exercise.active
                    ? `0 30px 60px rgba(16, 185, 129, ${glowIntensity * 0.15})`
                    : "0 20px 40px rgba(0, 0, 0, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                  transition: "border 0.1s ease-out",
                }}
              >
                {/* Active Progress Bar Background Track */}
                {exercise.active && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "6px",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                    }}
                  />
                )}

                {/* Active Progress Bar Fill */}
                {exercise.active && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: `${progressWidth}%`,
                      height: "6px",
                      background: "linear-gradient(90deg, #10B981, #34D399)",
                      boxShadow: "0 0 12px #10B981",
                    }}
                  />
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {/* Tag & ID */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "16px",
                      }}
                    >
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "24px",
                          fontWeight: 800,
                          color: exercise.active ? "#10B981" : "rgba(255, 255, 255, 0.3)",
                        }}
                      >
                        {exercise.id}
                      </span>
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                        }}
                      >
                        {exercise.tag}
                      </span>
                    </div>

                    {/* Exercise Name */}
                    <h2
                      style={{
                        fontSize: "44px",
                        fontWeight: 700,
                        margin: "0 0 16px 0",
                        color: "#FFFFFF",
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {exercise.name}
                    </h2>

                    {/* Sets & Reps */}
                    <p
                      style={{
                        fontSize: "28px",
                        color: "rgba(255, 255, 255, 0.6)",
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      {exercise.sets}
                    </p>
                  </div>

                  {/* Weight Badge */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: exercise.active
                          ? "rgba(16, 185, 129, 0.1)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: exercise.active
                          ? "1px solid rgba(16, 185, 129, 0.3)"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                        padding: "16px 28px",
                        borderRadius: "20px",
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.4)",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                          marginBottom: "4px",
                        }}
                      >
                        Target
                      </span>
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "32px",
                          fontWeight: 800,
                          color: exercise.active ? "#10B981" : "#FFFFFF",
                        }}
                      >
                        {exercise.weight}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Composition Registration Snippet
// Add this to your Root.tsx to render the component:

import { Composition } from "remotion";
import { WorkoutRoutine } from "./WorkoutRoutine";

export const Root: React.FC = () => {
  return (
    <Composition
      id="WorkoutRoutine"
      component={WorkoutRoutine}
      durationInFrames={180}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/