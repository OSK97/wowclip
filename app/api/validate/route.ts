import { validateYouTubeUrl } from "@/app/lib/youtube";

/**
 * POST /api/validate
 *
 * Body:     { url: string }
 * Success:  200 { ok: true, video: {...} }
 * Rejected: 400 { ok: false, error }
 *
 * Three layers:
 *   1. Format   — is this shaped like a real YouTube video link?
 *   2. Reality  — does the video exist and is it playable?
 *   3. State    — is it a finished video, not a live stream or upcoming premiere?
 *
 * Layers 2 and 3 run server-side because they need YOUTUBE_API_KEY,
 * which must never reach the browser.
 */

const API = "https://www.googleapis.com/youtube/v3/videos";

type YouTubeItem = {
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    categoryId?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  status?: { privacyStatus?: string; uploadStatus?: string };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
  };
};

export async function POST(request: Request) {
  let url: unknown;

  try {
    const body = await request.json();
    url = body?.url;
  } catch {
    return reject("Request body must be JSON.");
  }

  if (typeof url !== "string") {
    return reject("Enter a YouTube video link.");
  }

  // -- Layer 1: format --
  const parsed = validateYouTubeUrl(url);
  if (!parsed.ok) {
    return reject(parsed.error);
  }
  const { videoId } = parsed;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("YOUTUBE_API_KEY is not set");
    return Response.json(
      { ok: false, error: "Server is not configured. Check the logs." },
      { status: 500 },
    );
  }

  const query = new URLSearchParams({
    part: "snippet,contentDetails,statistics,status,liveStreamingDetails",
    id: videoId,
    key: apiKey,
  });

  let payload: { items?: YouTubeItem[] };

  try {
    const res = await fetch(`${API}?${query}`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`YouTube API ${res.status}: ${await res.text()}`);
      return Response.json(
        { ok: false, error: "Could not reach YouTube. Try again." },
        { status: 502 },
      );
    }
    payload = await res.json();
  } catch (err) {
    console.error("YouTube API request failed:", err);
    return Response.json(
      { ok: false, error: "Could not reach YouTube. Try again." },
      { status: 502 },
    );
  }

  // -- Layer 2: does it exist? --
  const video = payload.items?.[0];
  if (!video) {
    return reject("This video does not exist, or it is private or deleted.");
  }

  // -- Layer 3: is it a finished video? --
  const broadcast = video.snippet?.liveBroadcastContent ?? "none";
  const live = video.liveStreamingDetails;

  if (broadcast === "upcoming") {
    // Scheduled stream or an unreleased Premiere.
    const when = live?.scheduledStartTime
      ? ` It is scheduled for ${formatWhen(live.scheduledStartTime)}.`
      : "";
    return reject(
      `This video has not premiered yet, so it has no transcript.${when} Come back once it has finished.`,
    );
  }

  if (broadcast === "live") {
    return reject(
      "This video is live right now. Captions are only generated after the stream ends, so wait until it finishes.",
    );
  }

  // A stream that just ended still needs time before YouTube generates captions.
  if (live?.actualEndTime) {
    const endedMinutesAgo =
      (Date.now() - new Date(live.actualEndTime).getTime()) / 60000;
    if (endedMinutesAgo < 30) {
      return reject(
        "This stream ended a few minutes ago. YouTube has not generated captions yet — try again in about half an hour.",
      );
    }
  }

  const durationSeconds = parseIsoDuration(video.contentDetails?.duration);

  // Live videos report P0D. A zero duration on a non-live video means
  // YouTube has not finished processing it.
  if (durationSeconds === 0) {
    return reject(
      "YouTube is still processing this video, so it has no duration or transcript yet.",
    );
  }

  return Response.json({
    ok: true,
    video: {
      videoId,
      title: video.snippet?.title ?? "",
      channel: video.snippet?.channelTitle ?? "",
      publishedAt: video.snippet?.publishedAt ?? null,
      // Declared spoken language. Used downstream to tell YouTube's real ASR
      // track apart from its machine-translated variants.
      audioLanguage:
        video.snippet?.defaultAudioLanguage ??
        video.snippet?.defaultLanguage ??
        null,
      durationSeconds,
      viewCount: toNumber(video.statistics?.viewCount),
      likeCount: toNumber(video.statistics?.likeCount),
      commentCount: toNumber(video.statistics?.commentCount),
      thumbnail: pickThumbnail(video.snippet?.thumbnails),
    },
  });
}

function reject(error: string) {
  return Response.json({ ok: false, error }, { status: 400 });
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickThumbnail(
  thumbs: Record<string, { url?: string } | undefined> | undefined,
): string | null {
  if (!thumbs) return null;
  for (const size of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbs[size]?.url;
    if (url) return url;
  }
  return null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** ISO 8601 duration (PT1H23M45S) to seconds. Live streams return 0. */
function parseIsoDuration(value: string | undefined): number {
  if (!value) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0)
  );
}
