import React from "react";
import { Img, useCurrentFrame, interpolate } from "remotion";
import { SocialConfig } from "./types";
import { MediaGrid } from "./MediaGrid";
import { ElementHighlight, TextWithHighlights } from "./EvolutionHighlight";
import { loadInter } from "../utils/localFonts";
import { resolveAsset } from "./resolveAsset";

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "700"],
});

const formatNumber = (num: number) => {
  if (num === 0) return "0";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
};

export const TwitterPost: React.FC<{ config: SocialConfig }> = ({ config }) => {
  const frame = useCurrentFrame();

  const { theme, profile, post, stats, animation, highlights } = config;
  const isDark = theme.darkMode;
  const bgColor = isDark ? "#000000" : "#ffffff";
  const textColor = isDark ? "#e7e9ea" : "#0f1419";
  const subTextColor = isDark ? "#71767b" : "#536471";
  const borderColor = isDark ? "#2f3336" : "#eff3f4";

  // Animation timeline synchronized like TweetCard:
  const delay = animation.entranceFrame ?? animation.entranceDelay ?? 0;

  // 1. Text typing starts
  const textEntranceDelay = animation.textStartFrame ?? delay + 15;

  // 2. Media fade-in starts
  const mediaEntranceDelay = animation.mediaStartFrame ?? delay + 90;

  // 3. Stats count up starts
  const statsStart = animation.statsStartFrame ?? delay + 105;
  const statsDuration = animation.statsDuration ?? 30;
  const statsEnd = statsStart + statsDuration;
  const statProgress = interpolate(frame, [statsStart, statsEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const currentReplies = Math.floor(statProgress * stats.replies);
  const currentReposts = Math.floor(statProgress * stats.reposts);
  const currentLikes = Math.floor(statProgress * stats.likes);
  const currentViews = Math.floor(statProgress * stats.views);

  // 4. Highlight actions default start
  const highlightDelay = animation.highlightDelay ?? delay + 135;

  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 24,
        padding: "48px 48px", // More spacious card padding
        width: "100%",
        fontFamily: interFamily,
        color: textColor,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 35 }}>
        <div style={{ marginRight: 20 }}>
          {profile.avatar ? (
            <Img
              src={resolveAsset(profile.avatar)}
              style={{
                width: 85,
                height: 85,
                borderRadius: "50%",
                objectFit: "cover",
              }}
              from={-71}
            />
          ) : (
            <div
              style={{
                width: 85,
                height: 85,
                borderRadius: "50%",
                backgroundColor: isDark ? "#333" : "#eee",
              }}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ElementHighlight
            id="profileName"
            highlights={highlights}
            delay={highlightDelay}
            defaultColor={theme.highlightColor}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 32 }}>
                {profile.name}
              </span>
              {profile.verified && (
                <svg
                  viewBox="0 0 24 24"
                  aria-label="Verified account"
                  role="img"
                  style={{
                    height: 32,
                    width: 32,
                    fill: isDark ? "#1d9bf0" : "#1d9bf0",
                  }}
                >
                  <g>
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.792-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.74 2.746 1.865 3.45-.067.31-.104.63-.104.95 0 2.223 1.79 4 4 4 .46 0 .9-.09 1.31-.264.536 1.34 1.848 2.264 3.398 2.264 1.55 0 2.862-.924 3.398-2.264.41.174.85.264 1.31.264 2.21 0 4-1.777 4-4 0-.32-.037-.64-.104-.95 1.125-.704 1.865-1.99 1.865-3.45zm-10.057 6.456l-4.5-4.5 1.414-1.414 3.086 3.086 6.086-6.086 1.414 1.414-7.5 7.5z"></path>
                  </g>
                </svg>
              )}
            </div>
          </ElementHighlight>
          <span style={{ color: subTextColor, fontSize: 28, marginTop: 4 }}>
            {profile.handle}
          </span>
        </div>
      </div>
      {/* Text Body */}
      <div style={{ marginBottom: 35 }}>
        <TextWithHighlights
          text={post.text}
          highlights={highlights}
          highlightDelay={highlightDelay}
          highlightSpeed={animation.highlightSpeed || 4}
          defaultColor={theme.highlightColor}
          textColor={textColor}
          fontSize={36}
          wordStagger={3}
          entranceDelay={textEntranceDelay}
        />
      </div>
      {/* Media */}
      <MediaGrid
        images={post.images || []}
        video={post.video}
        videoWidth={post.videoWidth}
        videoHeight={post.videoHeight}
        entranceDelay={mediaEntranceDelay}
        platform="twitter"
      />
      {/* Timestamp */}
      <div
        style={{
          color: subTextColor,
          fontSize: 26,
          margin: "35px 0 25px 0",
          paddingBottom: 25,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {post.timestamp}
      </div>
      {/* Stats Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: subTextColor,
          fill: subTextColor,
          fontSize: 28,
          padding: "20px 0 10px 0",
        }}
      >
        <ElementHighlight
          id="replies"
          highlights={highlights}
          delay={highlightDelay}
          defaultColor={theme.highlightColor}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }}>
              <g>
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z"></path>
              </g>
            </svg>
            <span>{formatNumber(currentReplies)}</span>
          </div>
        </ElementHighlight>

        <ElementHighlight
          id="reposts"
          highlights={highlights}
          delay={highlightDelay}
          defaultColor={theme.highlightColor}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }}>
              <g>
                <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path>
              </g>
            </svg>
            <span>{formatNumber(currentReposts)}</span>
          </div>
        </ElementHighlight>

        <ElementHighlight
          id="likes"
          highlights={highlights}
          delay={highlightDelay}
          defaultColor={theme.highlightColor}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }}>
              <g>
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"></path>
              </g>
            </svg>
            <span>{formatNumber(currentLikes)}</span>
          </div>
        </ElementHighlight>

        <ElementHighlight
          id="views"
          highlights={highlights}
          delay={highlightDelay}
          defaultColor={theme.highlightColor}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }}>
              <g>
                <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path>
              </g>
            </svg>
            <span>{formatNumber(currentViews)}</span>
          </div>
        </ElementHighlight>
      </div>
    </div>
  );
};
