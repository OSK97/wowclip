"use client";

import { FINDERS, type FinderId, type Verdict } from "@/app/lib/types";

/**
 * The gate between the two stages.
 *
 * Stage 1 has finished and has an opinion. Stage 2 costs real money and several
 * minutes, so it does not start on its own — the person decides. This card asks
 * the one question that matters and gets out of the way.
 *
 * The finder selection lives here rather than in a settings panel because the
 * choice only means anything at this exact moment, and because seeing the five
 * readings listed is itself the clearest explanation of what happens next.
 */
export function DecisionCard({
  verdict,
  ready,
  selected,
  onToggle,
  onSelectAll,
  onGo,
  onReject,
  busy,
}: {
  verdict: Verdict | null;
  ready: boolean;
  selected: FinderId[];
  onToggle: (id: FinderId) => void;
  onSelectAll: () => void;
  onGo: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const failed = verdict?.status === "FAIL";
  const all = selected.length === FINDERS.length;
  const none = selected.length === 0;

  // Not being able to continue is a fact about the video, so say which fact.
  if (!ready) {
    return (
      <div className="border border-[#6b4a4a] bg-[#2a2020] p-4">
        <p className="text-[13px] leading-relaxed text-[#d88a8a]">
          Clip finding needs per-word timings to cut on, and this video&rsquo;s
          captions do not carry them. Try a video with auto-generated captions.
        </p>
        <button
          type="button"
          onClick={onReject}
          className="mt-3 border border-[#4a4a4a] px-4 py-2 text-[13px] text-[#c8c8c8] transition-colors hover:border-[#5a5a5a] hover:text-[#ededed]"
        >
          Try another video
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[#333333] bg-[#262626]">
      <div className="border-b border-[#333333] p-4">
        <p className="text-[11px] tracking-wider text-[#6b6b6b] uppercase">
          Your call
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#ededed]">
          {failed
            ? "The check does not rate this video highly. You can still look for clips in it."
            : "The transcript is on disk and ready. Search it for clips?"}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b6b6b]">
          Nothing gets downloaded again — this reads what the check already
          fetched. It takes a few minutes and costs a rupee or two per reading.
        </p>
      </div>

      <fieldset className="border-b border-[#333333] p-4">
        <div className="mb-3 flex items-center justify-between">
          <legend className="text-[11px] tracking-wider text-[#6b6b6b] uppercase">
            Which readings to run
          </legend>
          <button
            type="button"
            onClick={onSelectAll}
            disabled={busy}
            className="text-[12px] text-[#8a8a8a] underline decoration-[#4a4a4a] underline-offset-2 transition-colors hover:text-[#ededed] disabled:cursor-not-allowed disabled:text-[#555555] disabled:no-underline"
          >
            {all ? "Clear all" : "Select all five"}
          </button>
        </div>

        <div className="space-y-1.5">
          {FINDERS.map((finder) => {
            const on = selected.includes(finder.id);
            return (
              <button
                key={finder.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={busy}
                onClick={() => onToggle(finder.id)}
                className={`flex w-full items-start gap-3 border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6b9fd4] ${
                  busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                } ${
                  on
                    ? "border-[#4a7fb5] bg-[#1c2836]"
                    : "border-[#2e2e2e] bg-transparent hover:border-[#3d3d3d]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors ${
                    on
                      ? "border-[#4a7fb5] bg-[#2f6bb0] text-white"
                      : "border-[#4a4a4a] bg-transparent text-transparent"
                  }`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>

                <span className="min-w-0">
                  <span
                    className={`block text-[13px] ${
                      on ? "text-[#dce8f5]" : "text-[#a8a8a8]"
                    }`}
                  >
                    {finder.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-[12px] leading-snug ${
                      on ? "text-[#7f9ec0]" : "text-[#6b6b6b]"
                    }`}
                  >
                    {finder.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[12px] text-[#6b6b6b]">
          {none
            ? "Nothing selected."
            : `${selected.length} of ${FINDERS.length} selected. Each one is a separate pass over the transcript.`}
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={onGo}
          disabled={busy || none}
          className={`px-5 py-2.5 text-[13px] transition-colors ${
            busy || none
              ? "cursor-not-allowed bg-[#2e2e2e] text-[#555555]"
              : "bg-[#3d5f3d] text-[#e8f0e8] hover:bg-[#476e47]"
          }`}
        >
          {none
            ? "Pick at least one reading"
            : `Find clips · ${selected.length} reading${
                selected.length === 1 ? "" : "s"
              }`}
        </button>

        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="border border-[#4a4a4a] px-5 py-2.5 text-[13px] text-[#c8c8c8] transition-colors hover:border-[#5a5a5a] hover:text-[#ededed] disabled:cursor-not-allowed disabled:text-[#555555]"
        >
          Try a different video
        </button>
      </div>
    </div>
  );
}
