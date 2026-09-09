import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

export const PodcastAudioWave: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow breathing scale for the entire scene
  const breathingScale = 1 + Math.sin(frame / 80) * 0.015;

  // Entrance animations
  const coverSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const textSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 90 },
  });

  const waveEntranceSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  // Waveform configuration
  const barCount = 28;
  const barWidth = 16;
  const barGap = 10;

  // Generate dynamic, organic waveform heights using combined sine waves
  const getBarHeight = (index: number, currentFrame: number) => {
    // Base moving waves
    const w1 = Math.sin(currentFrame * 0.12 + index * 0.4) * 45;
    const w2 = Math.cos(currentFrame * 0.07 - index * 0.2) * 30;
    const w3 = Math.sin(currentFrame * 0.25 + index * 0.7) * 15;
    
    // Combine and absolute to keep it positive
    let height = Math.abs(w1 + w2 + w3) + 15;

    // Apply a beautiful bell-curve envelope so the center is taller and edges are shorter
    const centerDist = Math.abs(index - barCount / 2) / (barCount / 2);
    const envelope = Math.max(0.15, 1 - centerDist * 0.75);
    
    return height * envelope * 2.2;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#05070F",
        fontFamily,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Cinematic Background Orbs */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
          top: "-200px",
          left: "-100px",
          transform: `scale(${1 + Math.sin(frame / 120) * 0.1})`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-100px",
          right: "-100px",
          transform: `scale(${1 + Math.cos(frame / 100) * 0.08})`,
          filter: "blur(90px)",
        }}
      />

      {/* Subtle Grid Texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
          opacity: 0.8,
        }}
      />

      {/* Main Content Wrapper (Breathing) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${breathingScale})`,
          width: "100%",
          zIndex: 10,
        }}
      >
        {/* Podcast Cover Art Card */}
        <div
          style={{
            transform: `scale(${coverSpring}) translateY(${interpolate(
              coverSpring,
              [0, 1],
              [100, 0]
            )}px)`,
            opacity: coverSpring,
            width: 640,
            height: 640,
            borderRadius: 56,
            padding: 6,
            background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)",
            boxShadow: "0 50px 100px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)",
            backdropFilter: "blur(30px)",
            marginBottom: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Abstract Premium Cover Art Design */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 50,
              overflow: "hidden",
              position: "relative",
              background: "linear-gradient(210deg, #1e1b4b 0%, #030712 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Glowing inner core */}
            <div
              style={{
                position: "absolute",
                width: 320,
                height: 320,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
                filter: "blur(40px)",
                opacity: 0.6 + Math.sin(frame / 30) * 0.15,
                transform: `rotate(${frame * 0.5}deg) scale(${1 + Math.sin(frame / 45) * 0.1})`,
              }}
            />
            {/* Glassmorphic overlay ring */}
            <div
              style={{
                position: "absolute",
                width: 380,
                height: 380,
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.01)",
                backdropFilter: "blur(5px)",
                transform: `rotate(${-frame * 0.2}deg)`,
              }}
            />
            {/* Minimalist Micro-details inside cover */}
            <div
              style={{
                color: "#FFFFFF",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 8,
                textTransform: "uppercase",
                opacity: 0.9,
                zIndex: 2,
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "16px 32px",
                borderRadius: 100,
                backgroundColor: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(10px)",
              }}
            >
              SYNAPSE
            </div>
          </div>
        </div>

        {/* Title & Metadata */}
        <div
          style={{
            transform: `translateY(${interpolate(
              textSpring,
              [0, 1],
              [40, 0]
            )}px)`,
            opacity: textSpring,
            textAlign: "center",
            marginBottom: 90,
            padding: "0 80px",
          }}
        >
          <div
            style={{
              color: "#6366F1",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Episode 48
          </div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.15,
              marginBottom: 24,
            }}
          >
            The Future of Creative AI
          </div>
          <div
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: 36,
              fontWeight: 500,
            }}
          >
            with Dr. Aris Thorne
          </div>
        </div>

        {/* Waveform Visualizer */}
        <div
          style={{
            transform: `scale(${waveEntranceSpring})`,
            opacity: waveEntranceSpring,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: barGap,
            height: 320,
            width: "100%",
            padding: "0 60px",
            marginBottom: 60,
          }}
        >
          {Array.from({ length: barCount }).map((_, i) => {
            const barHeight = getBarHeight(i, frame);
            
            // Staggered entrance scale for each individual bar
            const barEntrance = spring({
              frame: frame - 25 - i * 1.5,
              fps,
              config: { damping: 12, stiffness: 120 },
            });

            return (
              <div
                key={i}
                style={{
                  width: barWidth,
                  height: barHeight * barEntrance,
                  borderRadius: barWidth / 2,
                  background: "linear-gradient(to top, #6366F1 0%, #EC4899 100%)",
                  boxShadow: "0 10px 30px rgba(99, 102, 241, 0.3)",
                  opacity: interpolate(barEntrance, [0, 1], [0, 0.95]),
                  transform: "translateZ(0)",
                }}
              />
            );
          })}
        </div>

        {/* Audio Progress / Time Indicator */}
        <div
          style={{
            transform: `translateY(${interpolate(
              waveEntranceSpring,
              [0, 1],
              [30, 0]
            )}px)`,
            opacity: interpolate(waveEntranceSpring, [0, 1], [0, 0.6]),
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <span style={{ color: "#FFFFFF", fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            04:18
          </span>
          <div
            style={{
              width: 120,
              height: 4,
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              borderRadius: 2,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "45%",
                background: "linear-gradient(90deg, #6366F1, #EC4899)",
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 32, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            42:10
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/*
// Composition Registration Snippet (Root.tsx)
import { Composition } from "remotion";
import { PodcastAudioWave } from "./PodcastAudioWave";

export const Root: React.FC = () => {
  return (
    <Composition
      id="PodcastAudioWave"
      component={PodcastAudioWave}
      durationInFrames={300}
      fps={60}
      width={1080}
      height={1920}
    />
  );
};
*/