import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const DefinitionCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic background breathing
  const breatheScale = 1 + Math.sin(frame / 60) * 0.01;

  // Spring animations for elements
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
    delay: 5,
  });

  const wordEntrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 90 },
    delay: 15,
  });

  const phoneticEntrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 90 },
    delay: 25,
  });

  const dividerEntrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
    delay: 35,
  });

  const definitionEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 70 },
    delay: 45,
  });

  const exampleEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 60 },
    delay: 60,
  });

  // Interpolated values for smooth transitions
  const cardScale = interpolate(cardEntrance, [0, 1], [0.92, 1]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);
  const cardBlur = interpolate(cardEntrance, [0, 1], [10, 0]);

  const wordY = interpolate(wordEntrance, [0, 1], [40, 0]);
  const wordOpacity = interpolate(wordEntrance, [0, 1], [0, 1]);

  const phoneticY = interpolate(phoneticEntrance, [0, 1], [20, 0]);
  const phoneticOpacity = interpolate(phoneticEntrance, [0, 1], [0, 1]);

  const dividerWidth = interpolate(dividerEntrance, [0, 1], [0, 100]);

  const definitionY = interpolate(definitionEntrance, [0, 1], [30, 0]);
  const definitionOpacity = interpolate(definitionEntrance, [0, 1], [0, 1]);

  const exampleY = interpolate(exampleEntrance, [0, 1], [30, 0]);
  const exampleOpacity = interpolate(exampleEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#08090c",
        fontFamily,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Cinematic Orbs & Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${breatheScale})`,
          transition: "transform 0.1s linear",
        }}
      >
        {/* Radial Grid Dots */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Top Right Glowing Orb */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 70%)",
            filter: "blur(80px)",
          }}
        />

        {/* Bottom Left Glowing Orb */}
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            left: "-15%",
            width: "900px",
            height: "900px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0) 70%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      {/* Main Definition Card Container */}
      <div
        style={{
          width: "880px",
          height: "1280px",
          padding: "90px 80px",
          boxSizing: "border-box",
          borderRadius: "64px",
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          boxShadow: "0 60px 100px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
          filter: `blur(${cardBlur}px)`,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Top Section: Word & Phonetic */}
        <div>
          {/* Category Tag */}
          <div
            style={{
              display: "inline-block",
              padding: "10px 24px",
              borderRadius: "100px",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: "48px",
              transform: `translateY(${wordY}px)`,
              opacity: wordOpacity,
            }}
          >
            Word of the day
          </div>

          {/* Word Title */}
          <h1
            style={{
              fontSize: "120px",
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
              letterSpacing: "-3px",
              lineHeight: 1.05,
              transform: `translateY(${wordY}px)`,
              opacity: wordOpacity,
            }}
          >
            sonder
          </h1>

          {/* Phonetic & Part of Speech */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              marginTop: "24px",
              transform: `translateY(${phoneticY}px)`,
              opacity: phoneticOpacity,
            }}
          >
            <span
              style={{
                fontSize: "42px",
                color: "#E2B875", // Premium warm gold accent
                fontWeight: 500,
                letterSpacing: "-0.5px",
              }}
            >
              /ˈsɒn.dər/
            </span>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
              }}
            />
            <span
              style={{
                fontSize: "36px",
                color: "rgba(255, 255, 255, 0.5)",
                fontStyle: "italic",
              }}
            >
              noun
            </span>
          </div>
        </div>

        {/* Middle Section: Elegant Divider */}
        <div style={{ margin: "60px 0" }}>
          <div
            style={{
              height: "2px",
              width: `${dividerWidth}%`,
              background: "linear-gradient(90deg, rgba(226, 184, 117, 0.8) 0%, rgba(255, 255, 255, 0.1) 100%)",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Bottom Section: Definition & Example */}
        <div
          style={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Definition Text */}
          <p
            style={{
              fontSize: "52px",
              lineHeight: "1.45",
              color: "rgba(255, 255, 255, 0.9)",
              fontWeight: 400,
              margin: 0,
              letterSpacing: "-0.5px",
              transform: `translateY(${definitionY}px)`,
              opacity: definitionOpacity,
            }}
          >
            The profound, feeling realization that everyone you pass has a life
            as vivid and complex as your own.
          </p>

          {/* Example Sentence Card */}
          <div
            style={{
              marginTop: "auto",
              padding: "48px",
              borderRadius: "32px",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderLeft: "6px solid #E2B875",
              transform: `translateY(${exampleY}px)`,
              opacity: exampleOpacity,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "24px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#E2B875",
                fontWeight: 700,
                marginBottom: "16px",
              }}
            >
              Example
            </span>
            <p
              style={{
                fontSize: "38px",
                lineHeight: "1.5",
                color: "rgba(255, 255, 255, 0.6)",
                fontStyle: "italic",
                margin: 0,
              }}
            >
              "Sitting on the crowded subway, she was overcome by a sudden wave
              of sonder."
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
Composition Setup for Root.tsx:

import { Composition } from "remotion";
import { DefinitionCard } from "./DefinitionCard";

export const Root = () => {
  return (
    <Composition
      id="DefinitionCard"
      component={DefinitionCard}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/