"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ClipResults } from "./components/ClipResults";
import { DecisionCard } from "./components/DecisionCard";
import { ReportCard } from "./components/ReportCard";
import { StepList } from "./components/StepList";
import { VerdictCard } from "./components/VerdictCard";
import { VideoCard } from "./components/VideoCard";
import { validateYouTubeUrl } from "./lib/youtube";
import {
  FINDERS,
  type ClipsPayload,
  type FinderId,
  type PipelineEvent,
  type Report,
  type Step,
  type Verdict,
  type Video,
} from "./lib/types";

/**
 * Phases, in the order they happen:
 *
 *   idle       nothing typed yet, or what is typed is not a video link
 *   checking   a well-formed link is being looked up
 *   gate       stage 1 is running
 *   decide     stage 1 finished, waiting on the person
 *   finding    stage 2 is running
 *   clips      stage 2 finished
 *
 * `decide` is a phase of its own rather than "gate that happens to be
 * finished". Without it the controls on the decision card read as busy — they
 * are derived from the phase — so the card appeared with everything greyed out
 * and nothing on it could be clicked.
 */
type Phase = "idle" | "checking" | "gate" | "decide" | "finding" | "clips";

/**
 * How long to wait after the last keystroke before looking a link up.
 *
 * There is no send button, so this delay is the only thing standing between a
 * paste and a network call. Long enough that typing a link by hand does not
 * fire a request per character; short enough that a paste feels immediate.
 */
const SETTLE_MS = 450;

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [clipsReady, setClipsReady] = useState(false);
  const [decided, setDecided] = useState(false);

  const [clipSteps, setClipSteps] = useState<Step[]>([]);
  const [clipNotes, setClipNotes] = useState<string[]>([]);
  const [clipReport, setClipReport] = useState<Report | null>(null);
  const [clips, setClips] = useState<ClipsPayload | null>(null);

  const [selected, setSelected] = useState<FinderId[]>(["motivational"]);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Which link a request belongs to, so a slow response for an old link
  // cannot overwrite the state of the current one.
  const tokenRef = useRef(0);
  // The last id actually looked up, so editing the surrounding text of a link
  // that resolves to the same video does not start the run again.
  const lookedUpRef = useRef<string | null>(null);
  // Stage 2 must fire exactly once per decision. A second click on the button,
  // or any re-render that reaches the same handler, has to be a no-op.
  const findingRef = useRef(false);

  const started = phase !== "idle" || Boolean(error);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps, notes, verdict, clipSteps, clipNotes, clips]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    tokenRef.current += 1;
    lookedUpRef.current = null;
    findingRef.current = false;
    setPhase("idle");
    setError(null);
    setVideo(null);
    setSteps([]);
    setNotes([]);
    setVerdict(null);
    setReport(null);
    setElapsed(null);
    setClipsReady(false);
    setDecided(false);
    setClipSteps([]);
    setClipNotes([]);
    setClipReport(null);
    setClips(null);
  }, []);

  const upsert = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Step[]>>, next: Step) => {
      setter((current) => {
        const index = current.findIndex((s) => s.id === next.id);
        if (index === -1) return [...current, next];
        const copy = [...current];
        copy[index] = { ...copy[index], ...next };
        return copy;
      });
    },
    [],
  );

  /**
   * Read one SSE body to completion, routing events into the right stage's
   * state. Shared by both stages because the event shapes are identical —
   * only the destination differs.
   */
  const consume = useCallback(
    async (
      res: Response,
      stage: "gate" | "finding",
      token: number,
    ): Promise<void> => {
      if (!res.body) return;

      const setStep = stage === "gate" ? setSteps : setClipSteps;
      const setNote = stage === "gate" ? setNotes : setClipNotes;
      const setRep = stage === "gate" ? setReport : setClipReport;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (tokenRef.current !== token) return;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;

          let event: PipelineEvent;
          try {
            event = JSON.parse(line.slice(6)) as PipelineEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "step_start":
              upsert(setStep, {
                id: event.step,
                label: event.label,
                state: "running",
              });
              break;
            case "step_done":
            case "step_fail":
            case "step_skip":
              upsert(setStep, {
                id: event.step,
                label: event.label,
                state:
                  event.type === "step_done"
                    ? "done"
                    : event.type === "step_fail"
                      ? "failed"
                      : "skipped",
                detail: event.detail,
                at: event.at,
              });
              break;
            case "note":
              setNote((n) => [...n, event.message]);
              break;
            case "verdict": {
              const { type, at, ...rest } = event;
              void type;
              void at;
              setVerdict(rest as Verdict);
              break;
            }
            case "report":
              setRep({ timings: event.timings, costs: event.costs });
              break;
            case "clips": {
              const { type, at, ...rest } = event;
              void type;
              void at;
              setClips(rest as ClipsPayload);
              break;
            }
            case "fatal":
              setError(event.message);
              break;
            case "done":
              if (stage === "gate") {
                setElapsed(event.total_seconds);
                setClipsReady(Boolean(event.clips_ready));
              }
              break;
          }
        }
      }
    },
    [upsert],
  );

  /** Stage 1 — the gate. Starts on its own once a link resolves. */
  const runGate = useCallback(
    async (validated: Video, originalUrl: string, token: number) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase("gate");

      try {
        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: originalUrl, video: validated }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setError("The check could not be started.");
          return;
        }
        await consume(res, "gate", token);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Lost connection while checking the video.");
        }
      } finally {
        // The stream is closed, so stage 1 is over either way. Hand control
        // back to the person before they are asked to make a choice.
        if (tokenRef.current === token) setPhase("decide");
      }
    },
    [consume],
  );

  /**
   * Stage 2 — clip finding.
   *
   * Reachable from exactly one place: the button on the decision card. Nothing
   * about choosing which readings to run touches this — selecting a finder only
   * changes which names would be sent if the button were pressed. The ref guard
   * makes a second press, or a double click, a no-op rather than a second run
   * against the same video.
   */
  const runFinding = useCallback(async () => {
    if (!video || findingRef.current) return;
    findingRef.current = true;

    const token = tokenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setDecided(true);
    setPhase("finding");
    setError(null);
    setClipSteps([]);
    setClipNotes([]);
    setClips(null);

    try {
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.videoId, categories: selected }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setError("Clip finding could not be started.");
        return;
      }
      await consume(res, "finding", token);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Lost connection while finding clips.");
      }
    } finally {
      findingRef.current = false;
      if (tokenRef.current === token) setPhase("clips");
    }
  }, [consume, selected, video]);

  /**
   * The gate stage, held in a ref.
   *
   * The lookup effect below must depend on the link and nothing else. Listing a
   * callback in its dependencies makes the effect re-run whenever anything in
   * that callback's own dependency chain changes — and re-running this effect
   * means starting stage 1 over. Reading it from a ref removes that whole class
   * of accident: the only thing that can trigger a run is a new video id.
   */
  const runGateRef = useRef(runGate);
  useEffect(() => {
    runGateRef.current = runGate;
  }, [runGate]);

  /**
   * Whether what is typed is a YouTube video link, worked out from the text
   * itself rather than held in state.
   *
   * This is the half of validation that needs no server. "This is a channel
   * link" and "this is a Shorts link" are facts about the string, so they are
   * reported the instant the character lands — making somebody wait for a round
   * trip to be told they pasted the wrong thing is exactly the friction this
   * design removes. Only a well-formed link ever costs a request.
   */
  const trimmed = url.trim();
  const shape = trimmed ? validateYouTubeUrl(trimmed) : null;

  // While a link is still being typed by hand, "not a valid link" is true and
  // useless. Hold the complaint until there is enough text to judge.
  const worthJudging = trimmed.length >= 11 || /[./]/.test(trimmed);
  const shapeError = shape && !shape.ok && worthJudging ? shape.error : null;
  const pendingId = shape?.ok ? shape.videoId : null;

  /**
   * Look the video up once the typing settles, then start the check.
   *
   * Every state change lives inside the timeout callback rather than the effect
   * body, so this stays a subscription to "the text stopped changing" instead
   * of a chain of renders.
   */
  useEffect(() => {
    if (!pendingId || pendingId === lookedUpRef.current) return;

    const token = ++tokenRef.current;

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      lookedUpRef.current = pendingId;

      setPhase("checking");
      setError(null);
      setVideo(null);
      setSteps([]);
      setNotes([]);
      setVerdict(null);
      setReport(null);
      setElapsed(null);
      setClipsReady(false);
      setDecided(false);
      setClipSteps([]);
      setClipNotes([]);
      setClipReport(null);
      setClips(null);

      try {
        const res = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${pendingId}` }),
        });
        const data = await res.json();
        if (tokenRef.current !== token) return;

        if (!data.ok) {
          setError(data.error);
          setPhase("idle");
          return;
        }

        setVideo(data.video as Video);
        await runGateRef.current(
          data.video as Video,
          `https://www.youtube.com/watch?v=${pendingId}`,
          token,
        );
      } catch {
        if (tokenRef.current !== token) return;
        setError("Could not reach the server. Is it running?");
        setPhase("idle");
      }
    }, SETTLE_MS);

    return () => clearTimeout(timer);
    // The link is the only trigger. See runGateRef above for why no callback
    // appears here.
  }, [pendingId]);

  const busy = phase === "checking" || phase === "gate" || phase === "finding";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {started && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-10 pb-8">
            {video && <VideoCard video={video} />}

            {phase === "checking" && (
              <p className="text-[13px] text-[#8a8a8a]">Looking it up…</p>
            )}

            {steps.length > 0 && (
              <Feed steps={steps} notes={notes} />
            )}

            {verdict && <VerdictCard verdict={verdict} />}

            {report && <ReportCard report={report} totalSeconds={elapsed} />}

            {/* The gate. Shown once stage 1 has an answer and before a choice. */}
            {phase === "decide" && !decided && !error && (
              <DecisionCard
                verdict={verdict}
                ready={clipsReady}
                selected={selected}
                onToggle={(id) =>
                  setSelected((s) =>
                    s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                  )
                }
                onSelectAll={() =>
                  setSelected((s) =>
                    s.length === FINDERS.length
                      ? []
                      : FINDERS.map((f) => f.id),
                  )
                }
                onGo={runFinding}
                onReject={() => {
                  setUrl("");
                  reset();
                }}
                busy={busy}
              />
            )}

            {clipSteps.length > 0 && (
              <Feed steps={clipSteps} notes={clipNotes} />
            )}

            {clipReport && <ClipReport report={clipReport} />}

            {clips && <ClipResults payload={clips} />}

            {clips && (
              <button
                type="button"
                onClick={() => {
                  setUrl("");
                  reset();
                }}
                className="w-full border border-[#333333] py-3 text-[13px] text-[#a8a8a8] transition-colors hover:border-[#4a4a4a] hover:text-[#ededed]"
              >
                Start over with another video
              </button>
            )}

            {error && (
              <div
                role="alert"
                className="border border-[#6b4a4a] bg-[#2a2020] p-4 text-[13px] leading-relaxed text-[#d88a8a]"
              >
                {error}
              </div>
            )}

            <div ref={feedEndRef} />
          </div>
        </div>
      )}

      {/* Composer. No send button: a valid link starts the check by itself. */}
      <div
        className={
          started
            ? "shrink-0 border-t border-[#2a2a2a] bg-[#1c1c1c] px-6 py-5"
            : "flex flex-1 items-center justify-center px-6"
        }
      >
        <div className="mx-auto w-full max-w-2xl">
          <label htmlFor="youtube-url" className="sr-only">
            YouTube video URL
          </label>

          <div
            className={`relative border bg-[#262626] ${
              shapeError
                ? "border-[#6b4a4a]"
                : "border-[#333333] focus-within:border-[#4a4a4a]"
            }`}
          >
            <input
              id="youtube-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={url}
              onChange={(e) => {
                const next = e.target.value;
                setUrl(next);
                // Clearing the box clears the run with it.
                if (!next.trim()) reset();
              }}
              placeholder="Paste a YouTube link"
              aria-invalid={shapeError ? true : undefined}
              aria-describedby={shapeError ? "url-error" : undefined}
              className="w-full bg-transparent py-5 pr-12 pl-5 text-[15px] text-[#ededed] placeholder:text-[#6b6b6b] outline-none"
            />

            {busy && (
              <span
                className="absolute top-1/2 right-4 h-3.5 w-3.5 -translate-y-1/2 animate-spin border border-[#777777] border-t-transparent"
                aria-hidden="true"
              />
            )}
          </div>

          {shapeError ? (
            <p id="url-error" role="alert" className="mt-2 text-[12px] text-[#d88a8a]">
              {shapeError}
            </p>
          ) : (
            !started && (
              <p className="mt-2 text-[12px] text-[#6b6b6b]">
                The check starts on its own. Nothing to press.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Feed({ steps, notes }: { steps: Step[]; notes: string[] }) {
  return (
    <div className="border border-[#333333] bg-[#222222] p-4 text-[13px]">
      <StepList steps={steps} />
      {notes.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-[#333333] pt-3">
          {notes.map((note, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-[#6b6b6b]">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stage 2's cost line. Smaller than stage 1's — it has no proxy bytes. */
function ClipReport({ report }: { report: Report }) {
  const entries = Object.entries(report.timings);
  return (
    <div className="border border-[#333333] bg-[#222222] p-4">
      <p className="text-[11px] tracking-wider text-[#6b6b6b] uppercase">
        Clip finding
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        {entries.map(([name, seconds]) => (
          <div key={name} className="flex gap-1.5">
            <dt className="text-[#6b6b6b]">{name}</dt>
            <dd className="font-mono text-[#a8a8a8]">{seconds.toFixed(1)}s</dd>
          </div>
        ))}
        <div className="flex gap-1.5">
          <dt className="text-[#6b6b6b]">cost</dt>
          <dd className="font-mono text-[#a8a8a8]">
            ₹{report.costs.total_inr.toFixed(2)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
