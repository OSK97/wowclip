import React from 'react';
import { Img, useCurrentFrame, interpolate } from 'remotion';
import { SocialConfig } from './types';
import { MediaGrid } from './MediaGrid';
import { ElementHighlight, TextWithHighlights } from './EvolutionHighlight';
import { loadInter } from '../../utils/localFonts';
import { resolveAsset } from './resolveAsset';

const { fontFamily: interFamily } = loadInter('normal', { weights: ['400', '600', '700'] });

const formatNumber = (num: number) => {
  if (num === 0) return "0";
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
};

export const InstagramPost: React.FC<{ config: SocialConfig }> = ({ config }) => {
  const frame = useCurrentFrame();

  const { theme, profile, post, stats, animation, highlights } = config;
  const isDark = theme.darkMode;
  const bgColor = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const subTextColor = isDark ? '#a8a8a8' : '#8e8e8e';
  const borderColor = isDark ? '#262626' : '#dbdbdb';

  const delay = animation.entranceFrame ?? animation.entranceDelay ?? 0;
  const textEntranceDelay = animation.textStartFrame ?? (delay + 25);
  const mediaEntranceDelay = animation.mediaStartFrame ?? (delay + 10);
  const highlightDelay = animation.highlightDelay ?? (delay + 135);
  const statsStart = animation.statsStartFrame ?? (delay + 90);
  const statsDuration = animation.statsDuration ?? 30;
  
  const statsEnd = statsStart + statsDuration;
  const statProgress = interpolate(frame, [statsStart, statsEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentLikes = Math.floor(statProgress * stats.likes);

  return (
    <div style={{
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      padding: '0',
      width: '100%',
      fontFamily: interFamily,
      color: textColor,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '28px 36px' }}>
        <div style={{ marginRight: 20 }}>
          {profile.avatar ? (
            <Img src={resolveAsset(profile.avatar)} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', backgroundColor: isDark ? '#333' : '#eee' }} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ElementHighlight id="profileName" highlights={highlights} delay={highlightDelay} defaultColor={theme.highlightColor}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 32 }}>{profile.handle.replace('@', '')}</span>
              {profile.verified && (
                <svg viewBox="0 0 24 24" style={{ height: 28, width: 28, fill: '#0095f6' }}><g><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L5.6 12.2l1.4-1.4 3.1 3.1 6.9-6.9 1.4 1.4-8.3 8.3z"></path></g></svg>
              )}
            </div>
          </ElementHighlight>
          {profile.subreddit && (
             <span style={{ color: subTextColor, fontSize: 22, marginTop: 4 }}>{profile.subreddit}</span>
          )}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <svg viewBox="0 0 24 24" style={{ height: 28, width: 28, fill: textColor }}><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
        </div>
      </div>

      {/* Media */}
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <MediaGrid images={post.images || []} video={post.video} entranceDelay={mediaEntranceDelay} platform="instagram" />
      </div>

      {/* Action Icons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '28px 36px 18px', fill: textColor }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <svg viewBox="0 0 24 24" style={{ width: 36, height: 36 }}><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
          <svg viewBox="0 0 24 24" style={{ width: 36, height: 36 }}><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" d="M20.656 17.008a9.993 9.993 0 10-3.59 3.615L22 22l-1.344-4.992z"></path></svg>
          <svg viewBox="0 0 24 24" style={{ width: 36, height: 36 }}><line fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"></polygon></svg>
        </div>
        <div>
          <svg viewBox="0 0 24 24" style={{ width: 36, height: 36 }}><polygon fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" points="20 21 12 13.44 4 21 4 3 20 3 20 21"></polygon></svg>
        </div>
      </div>

      {/* Likes */}
      <div style={{ padding: '0 36px', marginBottom: 20 }}>
        <ElementHighlight id="likes" highlights={highlights} delay={highlightDelay} defaultColor={theme.highlightColor}>
          <span style={{ fontWeight: 700, fontSize: 30 }}>{formatNumber(currentLikes)} likes</span>
        </ElementHighlight>
      </div>

      {/* Caption */}
      <div style={{ padding: '0 36px', fontSize: 28, lineHeight: 1.55, wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
        <span style={{ fontWeight: 700, marginRight: 12 }}>{profile.handle.replace('@', '')}</span>
        
        <TextWithHighlights
          text={post.text}
          highlights={highlights}
          highlightDelay={highlightDelay}
          highlightSpeed={animation.highlightSpeed || 4}
          defaultColor={theme.highlightColor}
          textColor={textColor}
          fontSize={28}
          wordStagger={3}
          entranceDelay={textEntranceDelay}
          hashtagColor="#00376b"
        />
      </div>

      {/* Timestamp */}
      <div style={{ color: subTextColor, fontSize: 24, marginTop: 24, padding: '0 36px 44px' }}>
        {post.timestamp}
      </div>
    </div>
  );
};
