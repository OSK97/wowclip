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

const INGREDIENTS = [
  { name: "Fresh Basil Leaves", amount: "2 cups" },
  { name: "Parmigiano-Reggiano", amount: "1/2 cup" },
  { name: "Extra Virgin Olive Oil", amount: "1/2 cup" },
  { name: "Toasted Pine Nuts", amount: "1/3 cup" },
  { name: "Garlic Cloves", amount: "2 cloves" },
];

export const RecipeCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle cinematic breathing scale for the entire scene
  const sceneScale = 1 + Math.sin(frame / 80) * 0.01;

  // Card entrance spring
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const cardY = interpolate(cardEntrance, [0, 1], [150, 0]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F9F9F6",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Decorative Elements */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `scale(${sceneScale})`,
          pointerEvents: "none",
        }}
      >
        {/* Soft organic blurred gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,235,211,0.7) 0%, rgba(255,255,255,0) 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-5%",
            left: "-10%",
            width: "900px",
            height: "900px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(243,235,215,0.6) 0%, rgba(255,255,255,0) 70%)",
            filter: "blur(80px)",
          }}
        />
        {/* Minimalist Grid Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(#E5E5E0 1.5px, transparent 1.5px)",
            backgroundSize: "40px 40px",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Main Recipe Card Container */}
      <div
        style={{
          width: "880px",
          height: "1400px",
          backgroundColor: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderRadius: "60px",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: "0 50px 100px rgba(44, 52, 39, 0.06), 0 16px 32px rgba(44, 52, 39, 0.02)",
          padding: "90px 80px",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          transform: `translateY(${cardY}px) scale(${cardEntrance})`,
          opacity: cardOpacity,
          zIndex: 10,
        }}
      >
        {/* Header Section */}
        <div style={{ marginBottom: "70px" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#E2ECE0",
              color: "#3E5E32",
              fontSize: "24px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "4px",
              padding: "12px 28px",
              borderRadius: "100px",
              marginBottom: "30px",
            }}
          >
            Ingredients
          </div>
          <h1
            style={{
              color: "#1C2418",
              fontSize: "84px",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-2px",
              lineHeight: 1.1,
            }}
          >
            Classic Basil Pesto
          </h1>
          <p
            style={{
              color: "#707A6B",
              fontSize: "32px",
              margin: "20px 0 0 0",
              fontWeight: 500,
            }}
          >
            Yield: 1 Cup • Prep Time: 10 Mins
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "2px",
            backgroundColor: "rgba(0, 0, 0, 0.06)",
            width: "100%",
            marginBottom: "60px",
          }}
        />

        {/* Ingredients List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "40px",
            flex: 1,
          }}
        >
          {INGREDIENTS.map((item, index) => {
            // Staggered entrance for each list item row
            const rowEntrance = spring({
              frame: frame - 15 - index * 8,
              fps,
              config: { damping: 16, stiffness: 100 },
            });

            const rowY = interpolate(rowEntrance, [0, 1], [40, 0]);
            const rowOpacity = interpolate(rowEntrance, [0, 1], [0, 1]);

            // Staggered trigger for checkmark pop
            const checkmarkTrigger = spring({
              frame: frame - 60 - index * 14,
              fps,
              config: { damping: 12, stiffness: 150 },
            });

            // Text styling interpolation based on checkmark state
            const textOpacity = interpolate(checkmarkTrigger, [0, 1], [1, 0.6]);
            const textWeight = interpolate(checkmarkTrigger, [0, 1], [600, 500]);

            return (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transform: `translateY(${rowY}px)`,
                  opacity: rowOpacity,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "35px" }}>
                  {/* Checkbox Wrapper */}
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "20px",
                      border: "3px solid",
                      borderColor: interpolate(
                        checkmarkTrigger,
                        [0, 1],
                        ["#D1DCD0", "#4E723F"]
                      ) as any,
                      backgroundColor: interpolate(
                        checkmarkTrigger,
                        [0, 1],
                        ["rgba(255,255,255,0)", "#4E723F"]
                      ) as any,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${interpolate(
                        checkmarkTrigger,
                        [0, 0.5, 1],
                        [1, 1.15, 1]
                      )})`,
                      transition: "border-color 0.2s, background-color 0.2s",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Checkmark Icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        width: "32px",
                        height: "32px",
                        transform: `scale(${checkmarkTrigger})`,
                        opacity: checkmarkTrigger,
                      }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  {/* Ingredient Name */}
                  <span
                    style={{
                      fontSize: "42px",
                      fontWeight: textWeight,
                      color: "#1C2418",
                      opacity: textOpacity,
                      transition: "opacity 0.3s",
                    }}
                  >
                    {item.name}
                  </span>
                </div>

                {/* Ingredient Amount */}
                <span
                  style={{
                    fontSize: "38px",
                    fontWeight: 600,
                    color: "#5E6859",
                    fontVariantNumeric: "tabular-nums",
                    opacity: textOpacity,
                    transition: "opacity 0.3s",
                  }}
                >
                  {item.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
import { Composition } from "remotion";
import { RecipeCard } from "./RecipeCard";

export const Root: React.FC = () => {
  return (
    <Composition
      id="RecipeCard"
      component={RecipeCard}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/