export type Video = {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string | null;
  audioLanguage: string | null;
  durationSeconds: number;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  thumbnail: string | null;
  categoryId?: string;
};

export type StepState = "running" | "done" | "failed" | "skipped";

export type Step = {
  id: string;
  label: string;
  state: StepState;
  detail?: string;
  at?: number;
};

export type Evidence = { at: number; quote: string };

export type Verdict = {
  status: "PASS" | "FAIL";
  score: number;
  confidence: number;
  face_feasibility: string;
  transcript_quality: string;
  content_type: string;
  reason: string;
  evidence: Evidence[];
  clip_potential: string;
  decided_by: "precheck" | "llm";
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  cost_inr?: number;
  cost_source?: string;
  llm_seconds?: number;
};

export type Report = {
  timings: Record<string, number>;
  costs: {
    youtube_api_units: number;
    proxy_bytes_measured: number;
    proxy_bytes_estimated: number;
    proxy_inr: number;
    llm_inr: number;
    total_inr: number;
    llm_tokens?: number;
    llm_cost_source?: string;
    model?: string;
  };
};

export const FINDERS = [
  {
    id: "motivational",
    label: "Motivational",
    hint: "moments that change how a viewer sees themselves",
  },
  {
    id: "emotional",
    label: "Emotional",
    hint: "moments built to make a viewer feel something",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    hint: "comebacks, punchlines, the unexpected answer",
  },
  {
    id: "general",
    label: "General",
    hint: "anything strong that the others would not claim",
  },
  {
    id: "audience",
    label: "Audience",
    hint: "moments real viewers commented on or rewound to",
  },
] as const;

export type FinderId = (typeof FINDERS)[number]["id"];

/** One measured fact behind a clip, or the model's reading of the words. */
export type ClipEvidence = {
  kind: "comments" | "replayed" | "pause" | "reaction" | "delivery";
  text: string;
  quote?: string | null;
  likes?: number | null;
};

export type WhyChosen = {
  /** Facts from YouTube or arithmetic on the timings. Not opinions. */
  measured: ClipEvidence[];
  /** The model's reading of what the words do to a viewer. */
  reading: string;
  found_by: string[];
  agreement: number;
  boundary: string;
  has_audience: boolean;
};

export type ClipSegment = {
  start_s: number;
  end_s: number;
  duration_s: number;
  source_start_s: number;
  source_end_s: number;
  start_words: string | null;
  end_words: string | null;
  match: { start: number; end: number };
  text?: string;
};

export type Clip = {
  id: string;
  rank: number;
  title: string;
  description: string;
  category: string;
  confidence: string;
  is_one_liner: boolean;
  boundary_note: string | null;
  duration_s: number;
  source_start_s: number;
  source_end_s: number;
  segments: ClipSegment[];
  transcript: string;
  nominated_by: string[];
  flags: string[];
  evidence: { kind: string; text: string }[];
  why_chosen: WhyChosen;
  youtube_url?: string;
  embed_url?: string;
};

export type ClipsPayload = {
  video_id: string;
  clips: Clip[];
  readings: Record<
    string,
    {
      video_read: string;
      coverage: number;
      near_misses: { start_line?: string; end_line?: string; why_not?: string }[];
      skipped: { from_line?: string; to_line?: string; what?: string }[];
    }
  >;
  dropped: string[];
};

/** Events streamed from /api/process and /api/clips (mirrors pipeline/events.py). */
export type PipelineEvent =
  | { type: "step_start"; step: string; label: string; at: number }
  | {
      type: "step_done";
      step: string;
      label: string;
      detail?: string;
      at: number;
    }
  | {
      type: "step_fail";
      step: string;
      label: string;
      detail?: string;
      at: number;
    }
  | {
      type: "step_skip";
      step: string;
      label: string;
      detail?: string;
      at: number;
    }
  | { type: "note"; message: string; at: number }
  | ({ type: "verdict"; at: number } & Verdict)
  | ({ type: "report"; at: number } & Report)
  | { type: "fatal"; message: string; at: number }
  | { type: "exit"; code: number }
  | ({ type: "clips"; at: number } & ClipsPayload)
  | {
      type: "done";
      video_id: string;
      status?: string;
      score?: number;
      cost_inr?: number;
      /** Stage 1 only: whether stage 2 can run without fetching again. */
      clips_ready?: boolean;
      /** Stage 2 only. */
      clip_count?: number;
      total_seconds: number;
      at: number;
    };

export function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Indian-style short counts: 1.2K, 3.4L, 2.1Cr */
export function formatCount(n: number | null): string {
  if (n === null) return "—";
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
