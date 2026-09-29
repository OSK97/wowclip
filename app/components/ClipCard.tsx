"use client";

import { useState } from "react";

import { formatDuration, type Clip } from "@/app/lib/types";

/**
 * One clip, shown in full.
 *
 * Nothing is collapsed. The point of this screen is to let somebody look at
 * every reel the pipeline found and decide, and a card that hides its own
 * reasoning behind a toggle makes that slower rather than tidier.
 *
 * The player is the one exception. A YouTube iframe is a heavy third-party
 * embed, and mounting one per clip on arrival makes the page crawl for players
 * nobody pressed. So each card shows the video's own thumbnail with a play
 * control, and the iframe replaces it on the first click.
 *
 * The case for the clip is split in two, and the split is deliberate. "Nine
 * viewers commented on this second" came out of YouTube's API; "this removes
 * the excuse the viewer is holding" is a model's reading of the words. Shown as
 * one list, the second borrows the authority of the first.
 */
export function ClipCard({
  clip,
  videoId,
}: {
  clip: Clip;
  videoId: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const why = clip.why_chosen;
  const audience =
    why?.measured?.filter(
      (m) => m.kind === "comments" || m.kind === "replayed",
    ) ?? [];
  const craft =
    why?.measured?.filter(
      (m) => m.kind === "pause" || m.kind === "reaction" || m.kind === "delivery",
    ) ?? [];

  const start = formatDuration(Math.floor(clip.source_start_s));
  const end = formatDuration(Math.floor(clip.source_end_s));

  return (
    <article className="border border-[#333333] bg-[#262626]">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-[#333333] p-4">
        <span className="mt-0.5 shrink-0 border border-[#3d3d3d] px-2 py-1 font-mono text-[12px] text-[#8a8a8a]">
          {clip.rank}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-snug text-[#ededed]">
            {clip.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#6b6b6b]">
            <span className="font-mono text-[#a8a8a8]">
              {start} – {end}
            </span>
            <span>{clip.duration_s.toFixed(1)}s</span>
            <span className="text-[#4a4a4a]">·</span>
            <span>{clip.category}</span>
            {clip.is_one_liner && (
              <>
                <span className="text-[#4a4a4a]">·</span>
                <span>one-liner</span>
              </>
            )}
            {audience.length > 0 && (
              <span className="border border-[#4a6b4a] px-1.5 py-0.5 text-[11px] text-[#7fae7f]">
                audience evidence
              </span>
            )}
            {(why?.agreement ?? 0) > 1 && (
              <span className="border border-[#4a7fb5] px-1.5 py-0.5 text-[11px] text-[#7f9ec0]">
                {why.agreement} readings agree
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player: thumbnail until pressed, then the real embed */}
      <div className="border-b border-[#333333] bg-black">
        <div className="relative aspect-video">
          {playing && clip.embed_url ? (
            <iframe
              src={`${clip.embed_url}&autoplay=1`}
              title={clip.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play this clip, ${start} to ${end}`}
              className="group absolute inset-0 h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover opacity-55 transition-opacity group-hover:opacity-70"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center border border-white/40 bg-black/65 text-white transition-colors group-hover:bg-black/80">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
              <span className="absolute right-2 bottom-2 bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white">
                {clip.duration_s.toFixed(1)}s
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {audience.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
              Measured — real people, not the model
            </p>
            <ul className="space-y-2">
              {audience.map((item, i) => (
                <li
                  key={i}
                  className="border-l-2 border-[#4a6b4a] pl-3 text-[13px] leading-relaxed text-[#c8c8c8]"
                >
                  {item.text}
                  {item.quote && (
                    <span className="mt-1 block text-[12px] text-[#8a8a8a]">
                      &ldquo;{item.quote}&rdquo;
                      {typeof item.likes === "number" && item.likes > 0 && (
                        <span className="text-[#6b6b6b]">
                          {" "}
                          — {item.likes.toLocaleString()} likes
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {why?.reading && (
          <section>
            <p className="mb-2 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
              Why this works — the model&rsquo;s reading
            </p>
            <p className="text-[13px] leading-relaxed text-[#c8c8c8]">
              {why.reading}
            </p>
          </section>
        )}

        {craft.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
              Also measured in this stretch
            </p>
            <ul className="flex flex-wrap gap-2">
              {craft.map((item, i) => (
                <li
                  key={i}
                  className="border border-[#3d3d3d] px-2 py-1 text-[12px] text-[#a8a8a8]"
                >
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[#333333] pt-4 text-[12px] sm:grid-cols-4">
          <Fact label="Exact cut" value={`${clip.source_start_s.toFixed(2)}s`} />
          <Fact label="Ends" value={`${clip.source_end_s.toFixed(2)}s`} />
          <Fact label="Confidence" value={clip.confidence} />
          <Fact
            label="Found by"
            value={(why?.found_by ?? clip.nominated_by).join(", ") || "—"}
          />
        </dl>

        {clip.segments?.[0]?.start_words && (
          <p className="text-[12px] leading-relaxed text-[#6b6b6b]">
            Opens on{" "}
            <span className="text-[#a8a8a8]">
              &ldquo;{clip.segments[0].start_words}&rdquo;
            </span>
            , closes on{" "}
            <span className="text-[#a8a8a8]">
              &ldquo;{clip.segments[clip.segments.length - 1].end_words}&rdquo;
            </span>
            . Both matched against the audio&rsquo;s own words, so the cut lands
            on a syllable rather than a caption boundary.
          </p>
        )}

        {why?.boundary && (
          <p className="text-[12px] leading-relaxed text-[#6b6b6b]">
            <span className="text-[#8a8a8a]">Cut note:</span> {why.boundary}
          </p>
        )}

        {clip.flags?.length > 0 && (
          <ul className="space-y-1">
            {clip.flags.map((flag, i) => (
              <li key={i} className="text-[12px] text-[#c9a86a]">
                {flag}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-[#333333] pt-4">
          <button
            type="button"
            onClick={() => setShowTranscript((s) => !s)}
            className="text-[12px] text-[#8a8a8a] underline decoration-[#4a4a4a] underline-offset-2 transition-colors hover:text-[#ededed]"
          >
            {showTranscript ? "Hide the words" : "Read the exact words"}
          </button>

          {clip.youtube_url && (
            <a
              href={clip.youtube_url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-[#8a8a8a] underline decoration-[#4a4a4a] underline-offset-2 transition-colors hover:text-[#ededed]"
            >
              Open on YouTube
            </a>
          )}
        </div>

        {showTranscript && (
          <p className="border border-[#2e2e2e] bg-[#1f1f1f] p-3 text-[13px] leading-relaxed text-[#b8b8b8]">
            {clip.transcript}
          </p>
        )}
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#6b6b6b]">{label}</dt>
      <dd className="mt-0.5 break-words text-[#c8c8c8]">{value}</dd>
    </div>
  );
}
