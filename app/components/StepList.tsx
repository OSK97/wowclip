import { formatProcessTime, type Step } from "@/app/lib/types";

/**
 * Progress feed, used by both stages.
 *
 * Steps that genuinely run at the same time are grouped under one heading, so
 * it is visible that they overlap rather than queue. Everything else renders in
 * the order it arrived. Stage 2's steps are all sequential, so they simply fall
 * through in order without a grouping heading.
 */

/** Stage 1 runs these two lanes at once. */
const PARALLEL = new Set(["fetch", "comments"]);

export function StepList({ steps }: { steps: Step[] }) {
  const parallel = steps.filter((s) => PARALLEL.has(s.id));

  // One lane on its own is not concurrency, so it gets no heading. When that
  // happens the lane has to fall back into the normal list — filtering it out
  // of both places is how a step disappears from the feed entirely, which is
  // exactly what happens on a video with comments turned off.
  const grouped = parallel.length > 1;
  const rest = steps.filter((s) => !grouped || !PARALLEL.has(s.id));

  return (
    <div className="space-y-4">
      {grouped && (
        <div className="border-l border-[#333333] pl-4">
          <p className="mb-2.5 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
            Running together
          </p>
          <div className="space-y-2.5">
            {parallel.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        </div>
      )}

      {rest.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex gap-3">
      <Marker state={step.state} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={
              step.state === "running" ? "text-[#ededed]" : "text-[#a8a8a8]"
            }
          >
            {step.label}
          </span>
          {step.durationSeconds !== undefined && step.state !== "running" && (
            <span className="shrink-0 font-mono text-[11px] text-[#5a5a5a]">
              {formatProcessTime(step.durationSeconds)}
            </span>
          )}
        </div>
        {step.detail && (
          <p className="mt-1 text-[12px] leading-relaxed text-[#6b6b6b]">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function Marker({ state }: { state: Step["state"] }) {
  const base = "mt-1.5 h-2.5 w-2.5 shrink-0";

  if (state === "running") {
    return (
      <span className={`${base} relative`} aria-hidden="true">
        <span className="absolute inset-0 animate-ping bg-[#ededed] opacity-60" />
        <span className="absolute inset-0 bg-[#ededed]" />
      </span>
    );
  }
  if (state === "done") {
    return <span className={`${base} bg-[#5f8f5f]`} aria-hidden="true" />;
  }
  if (state === "failed") {
    return <span className={`${base} bg-[#c96a6a]`} aria-hidden="true" />;
  }
  // skipped
  return (
    <span
      className={`${base} border border-[#555555] bg-transparent`}
      aria-hidden="true"
    />
  );
}
