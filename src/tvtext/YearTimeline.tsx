import React from 'react';
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Easing,
  staticFile,
} from 'remotion';
import { Video } from '@remotion/media';
import { loadInter } from '../utils/localFonts';

// ─── Font ────────────────────────────────────────────────────────────────────
const { fontFamily: interFamily } = loadInter('normal', {
  weights: ['400', '700', '900'],
  subsets: ['latin'],
});

// ─── Types ───────────────────────────────────────────────────────────────────
export interface YearTimelineTheme {
  backgroundColor?: string;
  gridColor?: string;
  textColor?: string;
  highlightColor?: string;
  pinColor?: string;
}

export interface YearTimelineProps {
  startYear?: number;
  targetYear?: number;
  scrollDelay?: number;
  scrollDuration?: number;
  theme?: YearTimelineTheme;
}

const DEFAULT_THEME: Required<YearTimelineTheme> = {
  backgroundColor: 'transparent',
  gridColor: 'rgba(255, 255, 255, 0.06)',
  textColor: 'rgba(255, 255, 255, 0.35)',
  highlightColor: '#ffffff',
  pinColor: '#38bdf8',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const YearTimeline: React.FC<YearTimelineProps> = ({
  startYear = 2026,
  targetYear = 2008,
  scrollDelay = 30,
  scrollDuration = 90,
  theme: customTheme,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = { ...DEFAULT_THEME, ...customTheme };

  // ─── Grid config ─────────────────────────────────────────────────────────
  const LINE_SPACING = 80;
  const vLinesCount = Math.ceil(width / LINE_SPACING) + 1;
  const hLinesCount = Math.ceil(height / LINE_SPACING) + 1;

  const gridOpacity = interpolate(frame, [0, 25], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── Scroll easing ───────────────────────────────────────────────────────
  const currentYearVal = interpolate(
    frame,
    [scrollDelay, scrollDelay + scrollDuration],
    [startYear, targetYear],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
    }
  );

  // ─── Year items generation ───────────────────────────────────────────────
  const minYear = Math.min(startYear, targetYear);
  const maxYear = Math.max(startYear, targetYear);
  const extraPadding = 12;
  const allYears: number[] = [];
  for (let y = minYear - extraPadding; y <= maxYear + extraPadding; y++) {
    allYears.push(y);
  }

  // ─── 3D Cylindrical Wheel Geometry ───────────────────────────────────────
  // The wheel is like an iOS picker: items are placed on a cylinder surface.
  // The camera looks at the front of the cylinder. Items above/below curve away.
  // Tuned so the wheel fills full screen with ~15% margin top & bottom.
  const WHEEL_RADIUS = 1400;        // Radius of the virtual cylinder (px) — large = spread out
  const ITEM_ARC_SPACING = 0.18;    // Radians between each year on the cylinder
  const CENTER_Y = height / 2;      // Center of wheel on screen

  // Entrance fade
  const entranceOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── Labels ──────────────────────────────────────────────────────────────
  const labelOpacity = interpolate(frame, [5, 22], [0, 0.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.backgroundColor,
        overflow: 'hidden',
        fontFamily: `"${interFamily}", sans-serif`,
        opacity: entranceOpacity,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
        <Video src={staticFile('tvtext_assets/final_result.mp4')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* Dark overlay to make text readable */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </div>

      {/* Background gradient layers (like LargeNumber/PieChart) */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.08) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, #fff 0 1px, transparent 1.5px 3px)', mixBlendMode: 'overlay', pointerEvents: 'none' }} />

      {/* SVG Grid Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: gridOpacity,
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)',
          pointerEvents: 'none',
        }}
      >
        <svg width="100%" height="100%">
          {Array.from({ length: vLinesCount }).map((_, i) => (
            <line key={`v-${i}`} x1={i * LINE_SPACING} y1={0} x2={i * LINE_SPACING} y2={height} stroke={theme.gridColor} strokeWidth={1.5} />
          ))}
          {Array.from({ length: hLinesCount }).map((_, i) => (
            <line key={`h-${i}`} x1={0} y1={i * LINE_SPACING} x2={width} y2={i * LINE_SPACING} stroke={theme.gridColor} strokeWidth={1.5} />
          ))}
        </svg>
      </div>



      {/* ─── 3D Cylindrical Year Wheel ─── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1200,
          zIndex: 10,
        }}
      >
        {allYears.map((year) => {
          // Position on the cylinder: offset from center in "slots"
          const offset = year - currentYearVal; // can be fractional
          const angle = offset * ITEM_ARC_SPACING; // radians on the cylinder

          // 3D projection: Y position on screen and Z depth
          const y = Math.sin(angle) * WHEEL_RADIUS;
          const z = Math.cos(angle) * WHEEL_RADIUS - WHEEL_RADIUS; // z=0 at front

          // Perspective-correct scale: items further back are smaller
          const perspectiveDist = 1200; // matches CSS perspective
          const scale = perspectiveDist / (perspectiveDist - z);

          // Opacity falloff: wider range so items fill the screen before fading
          const normalizedAngle = Math.abs(angle);
          const opacity = interpolate(normalizedAngle, [0, 0.6, 1.6], [1, 0.55, 0], {
            extrapolateRight: 'clamp',
          });

          // Color: center item is white, others are grey
          const isCentered = Math.abs(offset) < 0.5;
          const color = isCentered ? theme.highlightColor : theme.textColor;

          // Font size: center is large, edges get smaller — wider range
          const fontSize = interpolate(normalizedAngle, [0, 1.4], [130, 48], {
            extrapolateRight: 'clamp',
          });

          // Subtle rotation to follow the wheel curvature
          const rotateX = -(angle * 180) / Math.PI;

          if (opacity < 0.01) return null;

          return (
            <div
              key={year}
              style={{
                position: 'absolute',
                left: '50%',
                top: CENTER_Y,
                transform: `translate(-50%, -50%) translateY(${y * scale}px) scale(${scale}) rotateX(${rotateX}deg)`,
                transformOrigin: 'center center',
                opacity,
                zIndex: Math.round(100 + z),
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            >
              <span
                style={{
                  fontFamily: `"${interFamily}", sans-serif`,
                  fontWeight: 900,
                  fontSize,
                  color,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: isCentered
                    ? `0 0 30px ${theme.pinColor}30, 0 4px 20px rgba(0,0,0,0.5)`
                    : '0 4px 15px rgba(0,0,0,0.4)',
                }}
              >
                {year}
              </span>
            </div>
          );
        })}
      </div>


      {/* Left pin triangle */}
      <div
        style={{
          position: 'absolute',
          left: 300, // Touches the current year with safe margin
          top: CENTER_Y - 12,
          width: 0,
          height: 0,
          borderTop: '12px solid transparent',
          borderBottom: '12px solid transparent',
          borderLeft: `20px solid ${theme.pinColor}`,
          zIndex: 20,
          filter: `drop-shadow(0 0 8px ${theme.pinColor})`,
        }}
      />

      {/* ─── Top Fade (gradient mask — 15% margin) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.18,
          background: `linear-gradient(to bottom, ${theme.backgroundColor} 0%, ${theme.backgroundColor}cc 50%, transparent 100%)`,
          zIndex: 15,
          pointerEvents: 'none',
        }}
      />

      {/* ─── Bottom Fade (gradient mask — 15% margin) ─── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.18,
          background: `linear-gradient(to top, ${theme.backgroundColor} 0%, ${theme.backgroundColor}cc 50%, transparent 100%)`,
          zIndex: 15,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export const getYearTimelineDuration = () => {
  let config: any;
  try {
    config = require("./year-timeline.json");
  } catch {
    config = {};
  }
  
  const comp = config?.composition;
  const fps = comp?.fps ?? 24;
  if (comp?.durationSeconds) return Math.round(comp.durationSeconds * fps);
  if (comp?.durationInFrames) return comp.durationInFrames;

  const scrollDelay = config?.scrollDelay ?? 30;
  const scrollDuration = config?.scrollDurationFrames ?? 120;
  
  return scrollDelay + scrollDuration + 48;
};
