import type { Report } from "@/app/lib/types";

const STEP_LABELS: Record<string, string> = {
  fetch_parallel: "Captions + replay (proxy)",
  analyse: "Local measurement",
  verdict: "Model verdict",
};

export function ReportCard({
  report,
  totalSeconds,
}: {
  report: Report;
  totalSeconds: number | null;
}) {
  const { timings, costs } = report;

  const entries = Object.entries(timings).sort((a, b) => b[1] - a[1]);
  const slowest = entries[0];
  const maxTime = slowest?.[1] ?? 1;

  const proxyMb =
    (costs.proxy_bytes_measured + costs.proxy_bytes_estimated) / 1_000_000;

  const proxyShare =
    costs.total_inr > 0 ? (costs.proxy_inr / costs.total_inr) * 100 : 0;

  return (
    <div className="border border-[#333333] bg-[#262626]">
      <div className="flex items-baseline justify-between border-b border-[#333333] p-4">
        <p className="text-[11px] tracking-wider text-[#8a8a8a] uppercase">
          Time and cost
        </p>
        <p className="font-mono text-[13px] text-[#ededed]">
          {totalSeconds?.toFixed(1)}s · ₹{costs.total_inr.toFixed(4)}
        </p>
      </div>

      <div className="space-y-5 p-4">
        {/* -- where the time went -- */}
        <div>
          <p className="mb-2.5 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
            Where the time went
          </p>
          <div className="space-y-2">
            {entries.map(([key, seconds]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-[12px] text-[#a8a8a8]">
                  {STEP_LABELS[key] ?? key}
                </span>
                <div className="h-1.5 flex-1 bg-[#1f1f1f]">
                  <div
                    className={
                      key === slowest?.[0]
                        ? "h-full bg-[#b58a4a]"
                        : "h-full bg-[#4a4a4a]"
                    }
                    style={{ width: `${(seconds / maxTime) * 100}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] text-[#8a8a8a]">
                  {seconds.toFixed(2)}s
                </span>
              </div>
            ))}
          </div>
          {slowest && (
            <p className="mt-2.5 text-[12px] text-[#8a8a8a]">
              Bottleneck:{" "}
              <span className="text-[#d0a860]">
                {STEP_LABELS[slowest[0]] ?? slowest[0]}
              </span>{" "}
              at {slowest[1].toFixed(2)}s
              {totalSeconds
                ? `, ${Math.round((slowest[1] / totalSeconds) * 100)}% of the run`
                : ""}
              .
            </p>
          )}
        </div>

        {/* -- where the money went -- */}
        <div className="border-t border-[#333333] pt-4">
          <p className="mb-2.5 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
            Where the money went
          </p>

          <table className="w-full text-[12px]">
            <tbody className="align-baseline">
              <Row
                label="GProxy bandwidth"
                detail={`${proxyMb.toFixed(2)} MB @ $0.90/GB`}
                value={`₹${costs.proxy_inr.toFixed(4)}`}
              />
              <Row
                label="Model"
                detail={`${costs.llm_tokens?.toLocaleString() ?? "—"} tokens · ${costs.model ?? ""}`}
                value={`₹${costs.llm_inr.toFixed(4)}`}
              />
              <Row
                label="YouTube Data API"
                detail={`${costs.youtube_api_units} of 10,000 daily units`}
                value="free"
              />
              <tr className="border-t border-[#333333]">
                <td className="pt-2.5 text-[#ededed]">Total</td>
                <td />
                <td className="pt-2.5 text-right font-mono text-[#ededed]">
                  ₹{costs.total_inr.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-3 text-[12px] leading-relaxed text-[#8a8a8a]">
            The proxy is {Math.round(proxyShare)}% of this run&apos;s cost, not
            the model. Bandwidth is the thing to optimise.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#5a5a5a]">
            {(costs.proxy_bytes_measured / 1000).toFixed(0)} KB of that is
            measured exactly (the subtitle file);{" "}
            {(costs.proxy_bytes_estimated / 1_000_000).toFixed(1)} MB is an
            estimate for yt-dlp&apos;s own page fetches, which cannot be measured
            from outside the library. Model cost is{" "}
            {costs.llm_cost_source === "openrouter"
              ? "the real figure OpenRouter billed"
              : "estimated from listed rates"}
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <tr>
      <td className="py-1 pr-3 whitespace-nowrap text-[#a8a8a8]">{label}</td>
      <td className="py-1 pr-3 text-[11px] text-[#6b6b6b]">{detail}</td>
      <td className="py-1 text-right font-mono text-[#c8c8c8]">{value}</td>
    </tr>
  );
}
