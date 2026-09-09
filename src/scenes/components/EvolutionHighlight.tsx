import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { HighlightTarget } from './types';

// ─── Element Highlight ───────────────────────────────────────────────────────
// Wraps a UI element (likes, profileName, etc.) with a glowing box when targeted.

interface ElementHighlightProps {
  children: React.ReactNode;
  id: string;
  highlights?: HighlightTarget[];
  delay?: number;
  defaultColor?: string;
}

export const ElementHighlight: React.FC<ElementHighlightProps> = ({
  children,
  id,
  highlights = [],
  delay = 70,
  defaultColor = '#38bdf8',
}) => {
  const frame = useCurrentFrame();

  // Find if this element is targeted
  const target = highlights.find(
    (h) => h.type === 'element' && h.elementId === id
  );

  if (!target) return <>{children}</>;

  const color = target.color || defaultColor;

  const startFrame = target.startFrame ?? delay;

  const progress = interpolate(frame, [startFrame, startFrame + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const scale = interpolate(progress, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Glow box behind */}
      <div
        style={{
          position: 'absolute',
          left: -10,
          right: -10,
          top: -6,
          bottom: -6,
          borderRadius: 8,
          border: `2px solid ${color}`,
          backgroundColor: `${color}15`,
          opacity: progress,
          transform: `scale(${scale})`,
          boxShadow: `0 0 12px ${color}40, inset 0 0 6px ${color}15`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          color: progress > 0.5 ? color : 'inherit',
          textShadow: `0 0 ${progress * 8}px ${color}60`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Text Highlight (Word-Level Marker Wipe) ─────────────────────────────────
// Renders post text with word-by-word marker wipe highlighting (like AestheticNewsLayout).

interface TextWithHighlightsProps {
  text: string;
  highlights?: HighlightTarget[];
  highlightDelay?: number;
  highlightSpeed?: number;
  defaultColor?: string;
  textColor: string;
  fontSize: number;
  wordStagger?: number;
  entranceDelay?: number;
  hashtagColor?: string;
}

export const TextWithHighlights: React.FC<TextWithHighlightsProps> = ({
  text,
  highlights = [],
  highlightDelay = 70,
  highlightSpeed = 4,
  defaultColor = '#38bdf8',
  textColor,
  fontSize,
  wordStagger = 3,
  entranceDelay = 15,
  hashtagColor = '#1d9bf0',
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');

  // Calculate character ranges for each word to enable character-by-character typing
  let cumCharIndex = 0;
  const wordRanges = words.map((word) => {
    const start = cumCharIndex;
    const end = cumCharIndex + word.length;
    cumCharIndex = end + 1; // +1 for the space separator
    return { start, end };
  });

  // Calculate typing progress (character index typed so far)
  // Let it type over 75 frames starting at entranceDelay
  const typingProgress = interpolate(
    frame,
    [entranceDelay, entranceDelay + 75],
    [0, text.length],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Build a set of word indices that should be highlighted
  const textHighlights = highlights.filter((h) => h.type === 'text');
  const highlightSet = new Set<number>();
  for (const h of textHighlights) {
    if (h.fromWord !== undefined && h.toWord !== undefined) {
      for (let i = h.fromWord; i <= h.toWord; i++) {
        highlightSet.add(i);
      }
    }
  }

  // Build a map for highlight configurations per word
  const highlightConfigMap = new Map<number, { color: string; startFrame?: number }>();
  for (const h of textHighlights) {
    if (h.fromWord !== undefined && h.toWord !== undefined) {
      const c = h.color || defaultColor;
      for (let i = h.fromWord; i <= h.toWord; i++) {
        highlightConfigMap.set(i, { color: c, startFrame: h.startFrame });
      }
    }
  }

  // Sorted highlight indices for sequential wipe timing
  const sortedIndices = Array.from(highlightSet).sort((a, b) => a - b);

  return (
    <div
      style={{
        position: 'relative',
        fontSize,
        lineHeight: 1.5,
        fontFamily: 'inherit',
      }}
    >
      {/* 1. Invisible Placeholder to prevent card jumping during typing animation */}
      <div
        style={{
          opacity: 0,
          pointerEvents: 'none',
          userSelect: 'none',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {words.map((word, i) => {
          const isHashtag = word.startsWith('#') || word.startsWith('@');
          return (
            <span key={`p-${i}`} style={{ color: isHashtag ? hashtagColor : textColor }}>
              {word}{' '}
            </span>
          );
        })}
      </div>

      {/* 2. Absolutely Positioned Typing Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {words.map((word, i) => {
          const { start, end } = wordRanges[i];

          // If the typing progress hasn't reached this word, do not render it
          if (typingProgress < start) return null;

          // If typing progress is currently typing this word, slice it
          const displayedWord =
            typingProgress >= end
              ? word
              : word.slice(0, Math.floor(typingProgress - start));

          const isHashtag = word.startsWith('#') || word.startsWith('@');

          const hConfig = highlightConfigMap.get(i);
          const isHighlighted = !!hConfig;

          // Highlight wipe logic (marker style, like AestheticNews)
          const highlightOrderIndex = sortedIndices.indexOf(i);
          let fillPct = 0;
          if (isHighlighted && typingProgress >= end) {
            // Only begin highlighting after the word has been fully typed out
            
            // If the chunk specified a startFrame, we still want to stagger the words inside that chunk.
            // We use the word's position in the overall highlighted sequence to stagger them cleanly.
            const baseStart = hConfig.startFrame !== undefined ? hConfig.startFrame : highlightDelay;
            const wipeStart = baseStart + highlightOrderIndex * highlightSpeed;
            
            const wipeEnd = wipeStart + highlightSpeed * 2;
            fillPct = interpolate(frame, [wipeStart, wipeEnd], [0, 100], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
          }

          const highlightColor = hConfig?.color || defaultColor;

          return (
            <span
              key={`v-${i}`}
              style={{
                display: 'inline',
                color: isHashtag ? hashtagColor : textColor,
                backgroundImage:
                  fillPct > 0
                    ? `linear-gradient(to right, ${highlightColor}40 0%, ${highlightColor}40 100%)`
                    : 'none',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'left center',
                backgroundSize: `${fillPct}% 85%`,
                borderRadius: 3,
                padding: '1px 0',
              }}
            >
              {displayedWord}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
};
