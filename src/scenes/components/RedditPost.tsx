import React from 'react';
import { Img, useCurrentFrame, interpolate } from 'remotion';
import { SocialConfig } from './types';
import { MediaGrid } from './MediaGrid';
import { ElementHighlight, TextWithHighlights } from './EvolutionHighlight';
import { loadInter } from '../../utils/localFonts';
import { resolveAsset } from './resolveAsset';

const { fontFamily: interFamily } = loadInter('normal', { weights: ['400', '500', '600', '700'] });

const formatNumber = (num: number) => {
  if (num === 0) return "0";
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
};

export const RedditPost: React.FC<{ config: SocialConfig }> = ({ config }) => {
  const frame = useCurrentFrame();

  const { theme, profile, post, stats, animation, highlights } = config;
  const isDark = theme.darkMode;
  const bgColor = isDark ? '#1a1a1b' : '#ffffff';
  const textColor = isDark ? '#d7dadc' : '#1a1a1b';
  const subTextColor = isDark ? '#818384' : '#787c7e';
  const borderColor = isDark ? '#343536' : '#ccc';

  const delay = animation.entranceFrame ?? animation.entranceDelay ?? 0;
  const textEntranceDelay = animation.textStartFrame ?? (delay + 10);
  const mediaEntranceDelay = animation.mediaStartFrame ?? (delay + 20);
  const highlightDelay = animation.highlightDelay ?? (delay + 135);
  const statsStart = animation.statsStartFrame ?? (delay + 90);
  const statsDuration = animation.statsDuration ?? 30;
  
  const statsEnd = statsStart + statsDuration;
  const statProgress = interpolate(frame, [statsStart, statsEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentLikes = Math.floor(statProgress * stats.likes);
  const currentReplies = Math.floor(statProgress * stats.replies);

  return (
    <div style={{
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      width: '100%',
      fontFamily: interFamily,
      color: textColor,
      display: 'flex',
      flexDirection: 'row',
    }}>
      {/* Upvote Column (Left) */}
      <div style={{ width: 60, backgroundColor: isDark ? '#121212' : '#f8f9fa', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderTopLeftRadius: 10, borderBottomLeftRadius: 10, borderRight: `1px solid ${borderColor}` }}>
        <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: subTextColor, marginBottom: 8 }}><path d="M12 4l-8 8h5v8h6v-8h5z"></path></svg>
        <ElementHighlight id="likes" highlights={highlights} delay={highlightDelay} defaultColor={theme.highlightColor}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(currentLikes)}</span>
        </ElementHighlight>
        <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: subTextColor, marginTop: 8 }}><path d="M12 20l8-8h-5V4H9v8H4z"></path></svg>
      </div>

      {/* Content Column (Right) */}
      <div style={{ flex: 1, padding: '24px 24px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          {profile.avatar ? (
            <Img src={resolveAsset(profile.avatar)} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginRight: 12 }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: isDark ? '#333' : '#eee', marginRight: 12 }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 24, marginRight: 8 }}>{profile.subreddit || `r/${profile.handle}`}</span>
            <span style={{ color: subTextColor, fontSize: 20 }}>• Posted by u/{profile.handle} • {post.timestamp}</span>
          </div>
        </div>

        {/* Title */}
        {post.title && (
          <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.3, marginBottom: 16 }}>
            {post.title}
          </div>
        )}

        {/* Text Body */}
        {post.text && (
          <div style={{ marginBottom: 20 }}>
            <TextWithHighlights
              text={post.text}
              highlights={highlights}
              highlightDelay={highlightDelay}
              highlightSpeed={animation.highlightSpeed || 4}
              defaultColor={theme.highlightColor}
              textColor={isDark ? '#d7dadc' : '#1c1c1c'}
              fontSize={24}
              wordStagger={3}
              entranceDelay={textEntranceDelay}
            />
          </div>
        )}

        {/* Media */}
        <div style={{ marginBottom: 16 }}>
          <MediaGrid images={post.images || []} video={post.video} entranceDelay={mediaEntranceDelay} platform="reddit" />
        </div>

        {/* Action Row */}
        <div style={{ display: 'flex', gap: 16, fontSize: 20, fontWeight: 700, color: subTextColor, fill: subTextColor, marginTop: 'auto' }}>
          <ElementHighlight id="replies" highlights={highlights} delay={highlightDelay} defaultColor={theme.highlightColor}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: isDark ? '#272729' : '#f0f2f5' }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24 }}><path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.8 1.62 5.3 4.14 6.88L5 22l4.47-2.31c.8.21 1.64.31 2.53.31 5.52 0 10-3.92 10-8.75S17.52 2 12 2zm0 16c-.73 0-1.44-.1-2.12-.27l-3.04 1.58.6-2.58C5.46 15.41 4 13.23 4 10.75 4 6.9 7.59 3.75 12 3.75s8 3.15 8 7-3.59 7-8 7z"></path></svg>
              <span>{formatNumber(currentReplies)} Comments</span>
            </div>
          </ElementHighlight>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: isDark ? '#272729' : '#f0f2f5' }}>
            <svg viewBox="0 0 24 24" style={{ width: 24, height: 24 }}><path d="M14 10V4.5l5.5 5.5H14zm-4 4H4.5L10 19.5V14zM4.5 10H10V4.5L4.5 10zm15 4h-5.5v5.5l5.5-5.5z"></path></svg>
            <span>Share</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: isDark ? '#272729' : '#f0f2f5' }}>
            <svg viewBox="0 0 24 24" style={{ width: 24, height: 24 }}><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"></path></svg>
            <span>Save</span>
          </div>
        </div>
      </div>
    </div>
  );
};
