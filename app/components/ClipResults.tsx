"use client";

import { useState } from "react";

import { ClipCard } from "./ClipCard";
import type { ClipsPayload } from "@/app/lib/types";

/**
 * The finished clips — every one of them, in full.
 *
 * Nothing is hidden behind a "show more". The whole job of this screen is to
 * let somebody look through what the pipeline found and pick, and paging that
 * gets in the way. Each card carries its own player, which loads on click, so
 * showing twenty costs no more on arrival than showing five.
 *
 * Ordered by the pipeline, not here, and deliberately not by hook strength —
 * that number describes the first three seconds only, and the strongest clip in
 * a video is regularly a quiet opening that pays off later. The order is
 * confidence in the cut, then whether real viewers are behind it, then how many
 * independent readings found the same moment.
 *
 * What the video was read as is kept at the bottom rather than the top. It is
 * genuinely useful — it says what the model thought the video was and what it
 * deliberately passed over — but it is context for someone checking the work,
 * not the answer they came for.
 */
export function ClipResults({ payload }: { payload: ClipsPayload }) {
  const [showWorkings, setShowWorkings] = useState(false);

  const { clips, readings, dropped, video_id: videoId } = payload;
  const withAudience = clips.filter((c) => c.why_chosen?.has_audience).length;
  const needsReview = clips.filter((c) => c.cut_status === "needs_review").length;
  const failedReadings = Object.entries(readings).filter(([, reading]) => reading.error);

  if (clips.length === 0) {
    return (
      <div className="border border-[#333333] bg-[#262626] p-4">
        <p className="text-[13px] leading-relaxed text-[#c8c8c8]">
          {dropped?.length
            ? "The model nominated moments, but none could be mapped to usable clips. Review the reasons below."
            : "No candidate clips were found in the readings that completed."}
        </p>
        {Object.entries(readings).map(([name, reading]) => (
          <p key={name} className="mt-3 text-[12px] leading-relaxed text-[#8a8a8a]">
            <span className="text-[#a8a8a8]">{name}:</span> {reading.error || reading.video_read}
          </p>
        ))}
        {dropped?.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px] text-[#c9a86a]">
            {dropped.map((why, index) => <li key={index}>{why}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border border-[#333333] bg-[#262626] p-4">
        <div>
          <p className="text-[15px] text-[#ededed]">
            {clips.length} candidate clip{clips.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6b6b6b]">
            {withAudience > 0
              ? `${withAudience} of them sit where real viewers commented or rewound. `
              : ""}
            {needsReview > 0
              ? `${needsReview} could not be cut precisely and need review. `
              : ""}
            {failedReadings.length > 0
              ? `${failedReadings.length} reading(s) failed; see details below. `
              : ""}
            Ordered by how well each one stands on its own, not by how hard it
            opens.
          </p>
        </div>
        <p className="font-mono text-[12px] text-[#6b6b6b]">
          {Object.keys(readings).join(" · ")}
        </p>
      </div>

      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} videoId={videoId} />
      ))}

      {/* How it read the video. For checking the work. */}
      <div className="border border-[#333333] bg-[#222222]">
        <button
          type="button"
          onClick={() => setShowWorkings((s) => !s)}
          aria-expanded={showWorkings}
          className="w-full p-4 text-left text-[13px] text-[#a8a8a8] transition-colors hover:text-[#ededed]"
        >
          {showWorkings ? "Hide" : "Show"} what it made of the video, and what it
          skipped
        </button>

        {showWorkings && (
          <div className="space-y-5 border-t border-[#333333] p-4">
            {Object.entries(readings).map(([name, reading]) => (
              <section key={name}>
                <p className="text-[11px] tracking-wider text-[#6b6b6b] uppercase">
                  {name} · {reading.coverage === null
                    ? "coverage unknown after response recovery"
                    : `read ${Math.round(reading.coverage * 100)}% of the transcript`}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#c8c8c8]">
                  {reading.error || reading.video_read}
                </p>

                {reading.near_misses?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] text-[#8a8a8a]">
                      Close calls it decided against
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {reading.near_misses.map((miss, i) => (
                        <li
                          key={i}
                          className="border-l border-[#3d3d3d] pl-3 text-[12px] leading-relaxed text-[#8a8a8a]"
                        >
                          {miss.why_not}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {reading.skipped?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] text-[#8a8a8a]">
                      Stretches it read and passed over
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {reading.skipped.map((skip, i) => (
                        <li key={i} className="text-[12px] text-[#6b6b6b]">
                          {skip.what}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}

            {dropped?.length > 0 && (
              <section className="border-t border-[#2e2e2e] pt-4">
                <p className="text-[11px] tracking-wider text-[#6b6b6b] uppercase">
                  Dropped as duplicates or unusable
                </p>
                <ul className="mt-2 space-y-1">
                  {dropped.map((why, i) => (
                    <li key={i} className="text-[12px] text-[#8a8a8a]">
                      {why}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
