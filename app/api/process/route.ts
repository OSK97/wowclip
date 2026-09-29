import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";

import { validateYouTubeUrl } from "@/app/lib/youtube";

/**
 * POST /api/process  ->  text/event-stream
 *
 * Spawns the Python pipeline and relays its NDJSON progress events to the
 * browser as Server-Sent Events.
 *
 * Why spawn Python instead of porting the pipeline to TypeScript: the work
 * depends on yt-dlp, which has no real JS equivalent. Keeping it in Python
 * means this website reuses the code that already works rather than
 * reimplementing YouTube extraction.
 *
 * Why SSE instead of one long request: the pipeline takes tens of seconds and
 * the UI needs to show each step as it happens. SSE is one-way server-to-client,
 * which is exactly the shape of a progress feed, and it needs no extra library.
 */

// Streaming responses must not be cached or statically prerendered.
export const dynamic = "force-dynamic";

const PIPELINE_DIR = path.join(process.cwd(), "pipeline");
const PYTHON = process.env.PYTHON_BIN || "python";

// Hard ceiling so a hung yt-dlp call can't keep a process alive forever.
const TIMEOUT_MS = 5 * 60 * 1000;

type Body = {
  url?: string;
  video?: {
    title?: string;
    channel?: string;
    durationSeconds?: number;
    viewCount?: number | null;
    likeCount?: number | null;
    commentCount?: number | null;
    audioLanguage?: string | null;
  };
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  // Re-validate here. The client already called /api/validate, but this
  // endpoint spawns a process, so it must not trust the browser.
  const parsed = validateYouTubeUrl(body.url ?? "");
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const { videoId } = parsed;
  const video = body.video ?? {};

  const args = [
    "run.py",
    videoId,
    "--title",
    video.title ?? "",
    "--channel",
    video.channel ?? "",
    "--duration",
    String(video.durationSeconds ?? 0),
    "--views",
    String(video.viewCount ?? ""),
    "--likes",
    String(video.likeCount ?? ""),
    "--comments",
    String(video.commentCount ?? ""),
    "--audio-lang",
    video.audioLanguage ?? "",
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Client already went away.
        }
      };

      // turbopackIgnore: the bundler cannot tell that this spawn only ever
      // runs a script inside ./pipeline, so it traces the entire project into
      // the server bundle — every source file and the whole public folder.
      const child = spawn(/* turbopackIgnore: true */ PYTHON, args, {
        cwd: PIPELINE_DIR,
        env: {
          ...process.env,
          // Unbuffered, so each event reaches us the moment it is printed
          // instead of sitting in Python's stdout buffer.
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

      const timer = setTimeout(() => {
        send({
          type: "fatal",
          message: "The pipeline took too long and was stopped.",
        });
        child.kill();
        finish();
      }, TIMEOUT_MS);

      // One NDJSON object per line.
      const lines = createInterface({ input: child.stdout });

      lines.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          send(JSON.parse(trimmed));
        } catch {
          // Not an event line; surface it as a note rather than dropping it.
          send({ type: "note", message: trimmed });
        }
      });

      // Python diagnostics go to the server log, not the browser.
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) console.error(`[pipeline] ${text}`);
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        console.error("Failed to start the pipeline:", err);
        send({
          type: "fatal",
          message:
            "Could not start the Python pipeline. Is python on your PATH?",
        });
        finish();
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          send({ type: "exit", code });
        }
        finish();
      });

      // Stop the child if the user closes the tab or hits stop.
      request.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        child.kill();
        finish();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so events aren't held back.
      "X-Accel-Buffering": "no",
    },
  });
}
