import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { SocialConfig } from './types';
import { TwitterPost } from './TwitterPost';
import { InstagramPost } from './InstagramPost';
import { RedditPost } from './RedditPost';

export const SocialMediaCard: React.FC<{ config?: SocialConfig; style?: React.CSSProperties }> = ({ config: propConfig, style }) => {
  const frame = useCurrentFrame();

  const config = propConfig || require('./social-embed.json');
  const { theme, platform, animation } = config;

  const delay = animation?.entranceDelay || 0;
  
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

  return (
    <div style={{
      opacity,
      transform: `translateY(${translateY}px)`,
      width: '100%',
      maxWidth: 800,
      boxShadow: theme?.darkMode ? '0 20px 50px rgba(0,0,0,0.6)' : '0 20px 50px rgba(0,0,0,0.1)',
      borderRadius: platform === 'instagram' ? 4 : (platform === 'reddit' ? 6 : 16),
      zIndex: 10,
      ...style
    }}>
      {renderPlatform()}
    </div>
  );
};
