import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { SocialConfig } from './types';
import { TwitterPost } from './TwitterPost';
import { InstagramPost } from './InstagramPost';
import { RedditPost } from './RedditPost';

export const SocialMediaEmbed: React.FC<{ config?: SocialConfig }> = ({ config: propConfig }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // If no config provided, use some fallback data so it doesn't crash in studio
  const config = propConfig || require('./social-embed.json');
  
  const { theme, platform, animation } = config;

  // Global Entrance Animation (Slide up & Fade In) - matches TweetCard
  const delay = animation.entranceFrame ?? animation.entranceDelay ?? 0;
  
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateRight: 'clamp'
  });

  const translateY = interpolate(frame, [delay, delay + 15], [50, 0], {
    extrapolateRight: 'clamp'
  });

  const renderPlatform = () => {
    switch (platform) {
      case 'instagram':
        return <InstagramPost config={config} />;
      case 'reddit':
        return <RedditPost config={config} />;
      case 'twitter':
      default:
        return <TwitterPost config={config} />;
    }
  };

  const GRID_W = width || 1080;
  const GRID_H = height || 1920;
  const LINE_SPACING = 80;
  const vLinesCount = Math.ceil(GRID_W / LINE_SPACING) + 1;
  const hLinesCount = Math.ceil(GRID_H / LINE_SPACING) + 1;

  const gridOpacity = interpolate(frame, [0, 20], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ 
      backgroundColor: theme.backgroundColor || '#f5f0e8', 
      overflow: 'hidden',
      justifyContent: 'center', 
      alignItems: 'center',
    }}>
      {/* Background Gradients */}
      {theme.backgroundGradient && (
        <div style={{ position: "absolute", inset: 0, background: theme.backgroundGradient }} />
      )}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.06) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none", backgroundImage: "repeating-radial-gradient(circle at 50% 50%, #000 0 1px, transparent 1.5px 3px)", mixBlendMode: "overlay" }} />

      {/* Grid Background */}
      {theme.showGrid !== false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: gridOpacity,
            WebkitMaskImage: 'radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)',
            maskImage: 'radial-gradient(ellipse 65% 75% at 50% 50%, black 30%, transparent 95%)',
            pointerEvents: 'none',
          }}
        >
          <svg width="100%" height="100%">
            {Array.from({ length: vLinesCount }).map((_, i) => (
              <line key={`v-${i}`} x1={i * LINE_SPACING} y1={0} x2={i * LINE_SPACING} y2={GRID_H} stroke={theme.gridColor || 'rgba(0,0,0,0.05)'} strokeWidth={1.5} />
            ))}
            {Array.from({ length: hLinesCount }).map((_, i) => (
              <line key={`h-${i}`} x1={0} y1={i * LINE_SPACING} x2={GRID_W} y2={i * LINE_SPACING} stroke={theme.gridColor || 'rgba(0,0,0,0.05)'} strokeWidth={1.5} />
            ))}
          </svg>
        </div>
      )}

      {/* Content */}
      <div style={{
        opacity,
        transform: `translateY(${translateY}px) scale(1.05)`,
        width: '90%',
        maxWidth: 920,
        boxShadow: theme.darkMode ? '0 30px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.5)' : '0 30px 70px rgba(0,0,0,0.18)',
        borderRadius: platform === 'instagram' ? 16 : (platform === 'reddit' ? 16 : 24),
        zIndex: 10,
        overflow: 'hidden',
      }}>
        {renderPlatform()}
      </div>
    </AbsoluteFill>
  );
};
