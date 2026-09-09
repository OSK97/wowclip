import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { loadInter, loadOutfit } from "../utils/localFonts";

const { fontFamily } = loadInter();

interface Token {
  text: string;
  color: string;
}

interface CodeLine {
  number: string;
  tokens: Token[];
}

const codeLines: CodeLine[] = [
  {
    number: "1",
    tokens: [
      { text: "export ", color: "#ff79c6" },
      { text: "async ", color: "#ff79c6" },
      { text: "function ", color: "#ff79c6" },
      { text: "updateProfile", color: "#50fa7b" },
      { text: "(", color: "#f8f8f2" },
      { text: "data", color: "#ffb86c" },
      { text: ") {", color: "#f8f8f2" }
    ]
  },
  {
    number: "2",
    tokens: [
      { text: "  const ", color: "#ff79c6" },
      { text: "session ", color: "#f8f8f2" },
      { text: "= ", color: "#ff79c6" },
      { text: "await ", color: "#ff79c6" },
      { text: "auth", color: "#8be9fd" },
      { text: "();", color: "#f8f8f2" }
    ]
  },
  {
    number: "3",
    tokens: [
      { text: "  if ", color: "#ff79c6" },
      { text: "(!session) ", color: "#f8f8f2" },
      { text: "throw ", color: "#ff79c6" },
      { text: "new ", color: "#ff79c6" },
      { text: "Error", color: "#8be9fd" },
      { text: "(", color: "#f8f8f2" },
      { text: '"Unauthorized"', color: "#f1fa8c" },
      { text: ");", color: "#f8f8f2" }
    ]
  },
  {
    number: "4",
    tokens: [
      { text: "  return ", color: "#ff79c6" },
      { text: "db.", color: "#f8f8f2" },
      { text: "user", color: "#50fa7b" },
      { text: ".", color: "#f8f8f2" },
      { text: "update", color: "#8be9fd" },
      { text: "({", color: "#f8f8f2" }
    ]
  },
  {
    number: "5",
    tokens: [
      { text: "    where", color: "#ffb86c" },
      { text: ": { ", color: "#f8f8f2" },
      { text: "id", color: "#ffb86c" },
      { text: ": session.", color: "#f8f8f2" },
      { text: "user", color: "#50fa7b" },
      { text: ".", color: "#f8f8f2" },
      { text: "id ", color: "#f8f8f2" },
      { text: "},", color: "#f8f8f2" }
    ]
  },
  {
    number: "6",
    tokens: [
      { text: "    data", color: "#ffb86c" },
      { text: ": { ...data, ", color: "#f8f8f2" },
      { text: "updatedAt", color: "#ffb86c" },
      { text: ": ", color: "#f8f8f2" },
      { text: "new ", color: "#ff79c6" },
      { text: "Date", color: "#8be9fd" },
      { text: "() }", color: "#f8f8f2" }
    ]
  },
  {
    number: "7",
    tokens: [
      { text: "  });", color: "#f8f8f2" }
    ]
  },
  {
    number: "8",
    tokens: [
      { text: "}", color: "#f8f8f2" }
    ]
  }
];

export const CodeSnippet: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow breathing camera effect
  const cameraScale = 1 + Math.sin(frame / 80) * 0.012;

  // Spring animation for the main window entrance
  const windowEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const windowScale = interpolate(windowEntrance, [0, 1], [0.88, 1]);
  const windowOpacity = interpolate(windowEntrance, [0, 1], [0, 1]);
  const windowTranslateY = interpolate(windowEntrance, [0, 1], [60, 0]);

  // Smoothly sliding active line highlight
  const activeLineProgress = interpolate(
    frame,
    [20, 20 + codeLines.length * 10],
    [0, codeLines.length - 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const lineHeight = 68; // px
  const highlightTop = 60 + activeLineProgress * lineHeight; // 60px is top padding of code container

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#080B11",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Cinematic Background Orbs */}
      <div
        style={{
          position: "absolute",
          width: "1200px",
          height: "1200px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)",
          top: "-200px",
          left: "-200px",
          transform: `scale(${cameraScale})`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "1300px",
          height: "1300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, rgba(0,0,0,0) 70%)",
          bottom: "-300px",
          right: "-200px",
          transform: `scale(${cameraScale * 1.05})`,
          filter: "blur(100px)",
        }}
      />

      {/* Subtle Grid Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.03) 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
          opacity: 0.8,
        }}
      />

      {/* Main Code Window Container */}
      <div
        style={{
          width: "920px",
          height: "1100px",
          display: "flex",
          flexDirection: "column",
          borderRadius: "32px",
          background: "rgba(13, 17, 28, 0.75)",
          backdropFilter: "blur(40px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 80px 120px -30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          transform: `scale(${windowScale}) translateY(${windowTranslateY}px)`,
          opacity: windowOpacity,
          overflow: "hidden",
        }}
      >
        {/* Window Header */}
        <div
          style={{
            height: "90px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(255, 255, 255, 0.01)",
          }}
        >
          {/* Mac Window Controls */}
          <div style={{ display: "flex", gap: "14px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#FF5F56", border: "1px solid rgba(0,0,0,0.1)" }} />
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#FFBD2E", border: "1px solid rgba(0,0,0,0.1)" }} />
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#27C93F", border: "1px solid rgba(0,0,0,0.1)" }} />
          </div>

          {/* File Name Tab */}
          <div
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "#94A3B8",
              letterSpacing: "-0.5px",
            }}
          >
            profile.ts
          </div>

          {/* Dummy End Spacer to balance flexbox */}
          <div style={{ width: "82px" }} />
        </div>

        {/* Code Content Area */}
        <div
          style={{
            flex: 1,
            padding: "60px 50px",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sliding Active Line Highlight */}
          <div
            style={{
              position: "absolute",
              left: "30px",
              right: "30px",
              top: `${highlightTop}px`,
              height: `${lineHeight}px`,
              background: "linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.01) 100%)",
              borderLeft: "4px solid #6366F1",
              borderRadius: "0 12px 12px 0",
              transition: "top 0.15s cubic-bezier(0.25, 1, 0.5, 1)",
              pointerEvents: "none",
            }}
          />

          {/* Render Code Lines */}
          {codeLines.map((line, index) => {
            const lineDelay = 20 + index * 10;
            const lineEntrance = spring({
              frame: frame - lineDelay,
              fps,
              config: { damping: 15, stiffness: 100 },
            });

            const lineOpacity = interpolate(lineEntrance, [0, 1], [0, 1]);
            const lineTranslateX = interpolate(lineEntrance, [0, 1], [-20, 0]);

            return (
              <div
                key={line.number}
                style={{
                  height: `${lineHeight}px`,
                  display: "flex",
                  alignItems: "center",
                  opacity: lineOpacity,
                  transform: `translateX(${lineTranslateX}px)`,
                }}
              >
                {/* Line Number */}
                <div
                  style={{
                    width: "60px",
                    fontSize: "28px",
                    fontFamily: "monospace",
                    color: "#475569",
                    textAlign: "right",
                    marginRight: "40px",
                    userSelect: "none",
                  }}
                >
                  {line.number}
                </div>

                {/* Code Tokens */}
                <div
                  style={{
                    fontSize: "34px",
                    fontFamily: "JetBrains Mono, Fira Code, Menlo, Monaco, Courier New, monospace",
                    fontWeight: 500,
                    letterSpacing: "-0.5px",
                    whiteSpace: "pre",
                  }}
                >
                  {line.tokens.map((token, tIdx) => (
                    <span key={tIdx} style={{ color: token.color }}>
                      {token.text}
                    </span>
                  ))}
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
// Composition configuration for Root.tsx
import { Composition } from "remotion";
import { CodeSnippet } from "./CodeSnippet";

export const Root: React.FC = () => {
  return (
    <Composition
      id="CodeSnippet"
      component={CodeSnippet}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
*/