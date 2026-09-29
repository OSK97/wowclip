/**
 * YouTube link validation — format layer (no network).
 *
 * Mirrors the rules in Youtube_Link/caption_status.py:
 *   accepted  : watch?v=, youtu.be/, /live/, /embed/
 *   rejected  : channels, Shorts, playlists, anything not YouTube
 *
 * Shorts are rejected because the pipeline expects landscape source video
 * to crop into vertical. Channels and playlists aren't single videos.
 */

/** YouTube IDs are always 11 chars of [A-Za-z0-9_-]. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Path prefixes that carry the video ID in the next segment. */
const VIDEO_PATH_PREFIXES = new Set(["live", "embed", "v", "e"]);

export type ValidationResult =
  | { ok: true; videoId: string }
  | { ok: false; error: string };

export function validateYouTubeUrl(raw: string): ValidationResult {
  const input = raw.trim();

  if (!input) {
    return { ok: false, error: "Enter a YouTube video link." };
  }

  // Accept links pasted without a protocol (youtube.com/watch?v=...).
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "This is not a valid link." };
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return {
      ok: false,
      error: `This is not a YouTube link. It points to ${host}.`,
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase() ?? "";

  // Channel pages carry no single video.
  if (
    first.startsWith("@") ||
    first === "channel" ||
    first === "c" ||
    first === "user"
  ) {
    return {
      ok: false,
      error: "This is a channel link. Enter a link to a single video.",
    };
  }

  // Shorts are already vertical — the pipeline needs landscape source video.
  if (first === "shorts") {
    return {
      ok: false,
      error: "This is a Shorts link. Only regular videos and live streams work.",
    };
  }

  // A playlist page with no ?v= is not a single video.
  if (first === "playlist") {
    return {
      ok: false,
      error: "This is a playlist link. Enter a link to a single video.",
    };
  }

  // youtu.be/VIDEO_ID
  if (host.endsWith("youtu.be")) {
    return readId(segments[0], "This short link has no video ID in it.");
  }

  // youtube.com/watch?v=VIDEO_ID
  if (first === "watch") {
    const v = url.searchParams.get("v");
    if (!v) {
      return { ok: false, error: "This link is missing its video ID." };
    }
    return readId(v, "The video ID in this link is not valid.");
  }

  // youtube.com/live/ID, /embed/ID
  if (VIDEO_PATH_PREFIXES.has(first)) {
    return readId(segments[1], "This link has no video ID in it.");
  }

  return {
    ok: false,
    error: "This is not a YouTube video link.",
  };
}

function readId(
  candidate: string | undefined,
  missingMessage: string,
): ValidationResult {
  if (!candidate) {
    return { ok: false, error: missingMessage };
  }
  if (!VIDEO_ID.test(candidate)) {
    return {
      ok: false,
      error: "The video ID in this link is not valid.",
    };
  }
  return { ok: true, videoId: candidate };
}
