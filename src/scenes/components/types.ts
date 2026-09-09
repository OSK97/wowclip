export interface SocialProfile {
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  subreddit?: string;
}

export interface SocialPostData {
  title?: string;
  text: string;
  images?: string[];
  video?: string;
  videoWidth?: number;
  videoHeight?: number;
  timestamp: string;
}

export interface SocialStats {
  likes: number;
  reposts: number;
  replies: number;
  views: number;
}

/**
 * A highlight target. The LLM can highlight specific words in the post text,
 * or target UI elements like stats, profile name, etc.
 *
 * - type "text": highlights specific words in the post body text using a marker wipe effect
 *   (like AestheticNewsLayout). Specify fromWord/toWord (0-indexed word positions).
 * - type "element": highlights a UI element (e.g. "likes", "reposts", "profileName", "replies", "views")
 *   with a glow box around it.
 */
export interface HighlightTarget {
  type: 'text' | 'element';
  /** For type "text": 0-based index of the first word to highlight */
  fromWord?: number;
  /** For type "text": 0-based index of the last word to highlight (inclusive) */
  toWord?: number;
  /** For type "element": the element id to highlight (e.g. "likes", "profileName") */
  elementId?: string;
  /** Custom color for this specific highlight (optional, falls back to theme.highlightColor) */
  color?: string;
  /** Frame when this highlight begins. Overrides animation.highlightDelay */
  startFrame?: number;
}

export interface SocialConfig {
  platform: 'twitter' | 'instagram' | 'reddit';
  theme: {
    darkMode: boolean;
    backgroundColor: string;
    backgroundGradient?: string;
    highlightColor: string;
    gridColor?: string;
    showGrid?: boolean;
  };
  profile: SocialProfile;
  post: SocialPostData;
  stats: SocialStats;
  highlights?: HighlightTarget[];
  animation: {
    entranceFrame?: number; // overall card enter frame
    textStartFrame?: number; // text typing start frame
    mediaStartFrame?: number; // media fade-in start frame
    statsStartFrame?: number; // stats counting start frame
    statsDuration?: number; // frames for stats to count up
    highlightSpeed?: number;
    // Fallbacks
    entranceDelay?: number;
    highlightDelay?: number;
  };
}
