"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Catches any render crash in the page.
 *
 * Without this, a single bad property access unmounts the whole tree and the
 * user gets a blank dark screen with no way to tell what happened or what to do
 * next. That is the worst possible failure for a long-running pipeline UI,
 * because it looks identical to "the app is broken" whether the cause was a
 * missing field on one clip or a genuinely fatal problem.
 *
 * The message is deliberately shown verbatim. This is a tool being used by the
 * person who is also building it, so the actual error is more useful than a
 * reassuring sentence.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] render crashed:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-2xl border border-[#6b4a4a] bg-[#2a2020] p-5">
        <p className="text-[11px] tracking-wider text-[#c96a6a] uppercase">
          The screen crashed
        </p>

        <p className="mt-2 text-[14px] leading-relaxed text-[#d88a8a]">
          Something in the interface threw an error while rendering. Your
          pipeline run is unaffected — the transcript and any clips already
          found are on disk.
        </p>

        <pre className="mt-4 max-h-56 overflow-auto border border-[#4a3535] bg-[#1f1717] p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[#c8a0a0]">
          {error.message || "No message was attached to the error."}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-[#3d3d3d] px-4 py-2 text-[13px] text-[#ededed] transition-colors hover:bg-[#4a4a4a]"
          >
            Try rendering again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-[#4a4a4a] px-4 py-2 text-[13px] text-[#c8c8c8] transition-colors hover:border-[#5a5a5a] hover:text-[#ededed]"
          >
            Reload the page
          </button>
        </div>
      </div>
    </div>
  );
}
