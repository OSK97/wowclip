import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";

import { validateYouTubeUrl } from "@/app/lib/youtube";

/**
 * POST /api/clips  ->  text/event-stream
 *
 * Stage 2: find the clips. Runs only after the user has seen the gate's
 * verdict and chosen to go ahead with this video, which is why it is a
 * separate endpoint rather than a continuation of /api/process.
 *
 * It reads the word-level transcript and replay data that stage 1 already
 * wrote to disk, so nothing is fetched through the metered proxy again. If
 * that store is missing the Python side fails with a clear message rather than
 * silently refetching.
 *
 * This takes minutes rather than seconds — five finder calls plus one call per
 * surviving moment — so the timeout is much larger than stage 1's.
 */

export const dynamic = "force-dynamic";

const PIPELINE_DIR = path.join(process.cwd(), "pipeline");
const PYTHON = process.env.PYTHON_BIN || "python";

// Five finders reading a two-hour transcript, then one call per moment. The
// upstream model is also rate-limited from time to time, which has turned a
// 144s run into 912s, so this ceiling is generous on purpose.
const TIMEOUT_MS = 20 * 60 * 1000;

const CATEGORIES = [
  "motivational",
  "emotional",
  "entertainment",
  "general",
  "audience",
] as const;

type Body = {
  url?: string;
  videoId?: string;
  categories?: string[];
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

  // Resolve the video id from whichever the client sent, and never trust it
  // raw: it becomes a directory name and a process argument.
  let videoId = (body.videoId ?? "").trim();
  if (!videoId && body.url) {
    const parsed = validateYouTubeUrl(body.url);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    videoId = parsed.videoId;
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return Response.json(
      { ok: false, error: "A valid YouTube video id is required." },
      { status: 400 },
    );
  }

  // Only known finder names reach the command line.
  const requested = Array.isArray(body.categories) ? body.categories : [];
  const categories = requested.filter((c) =>
    (CATEGORIES as readonly string[]).includes(c),
  );
  if (requested.length > 0 && categories.length === 0) {
    return Response.json(
      { ok: false, error: "None of those finders exist." },
      { status: 400 },
    );
  }

  const args = ["clips.py", videoId];
  if (categories.length > 0) {
    args.push("--categories", categories.join(","));
  }

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

      // turbopackIgnore: see the note in /api/process — without this the
      // bundler traces the whole project into the server output.
      const child = spawn(/* turbopackIgnore: true */ PYTHON, args, {
        cwd: PIPELINE_DIR,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

      const timer = setTimeout(() => {
        send({
          type: "fatal",
          message:
            "Clip finding took too long and was stopped. The model provider " +
            "may be rate-limiting; the candidates found so far are on disk.",
        });
        child.kill();
        finish();
      }, TIMEOUT_MS);

      const lines = createInterface({ input: child.stdout });

      lines.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          send(JSON.parse(trimmed));
        } catch {
          send({ type: "note", message: trimmed });
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) console.error(`[clips] ${text}`);
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        console.error("Failed to start clip finding:", err);
        send({
          type: "fatal",
          message: "Could not start clip finding. Is python on your PATH?",
        });
        finish();
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) send({ type: "exit", code });
        finish();
      });

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
      "X-Accel-Buffering": "no",
    },
  });
}
