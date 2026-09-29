import type { Verdict } from "@/app/lib/types";

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const passed = verdict.status === "PASS";

  return (
    <div
      className={`border bg-[#262626] ${
        passed ? "border-[#4a6b4a]" : "border-[#6b4a4a]"
      }`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#333333] p-4">
        <div>
          <p
            className={`text-[13px] tracking-wider uppercase ${
              passed ? "text-[#7fae7f]" : "text-[#c96a6a]"
            }`}
          >
            {passed ? "Approved" : "Rejected"}
          </p>
          <p className="mt-1 text-[13px] text-[#8a8a8a]">
            {verdict.content_type}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-2xl leading-none text-[#ededed]">
            {verdict.score}
            <span className="text-[13px] text-[#6b6b6b]">/100</span>
          </p>
          <p className="mt-1 text-[11px] text-[#6b6b6b]">clip potential</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 bg-[#1f1f1f]">
        <div
          className={passed ? "h-full bg-[#5f8f5f]" : "h-full bg-[#8f5f5f]"}
          style={{ width: `${verdict.score}%` }}
        />
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="mb-1 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
            Reasoning
          </p>
          <p className="text-[13px] leading-relaxed text-[#c8c8c8]">
            {verdict.reason}
          </p>
        </div>

        {verdict.evidence?.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
              Evidence from the transcript
            </p>
            <ul className="space-y-2">
              {verdict.evidence.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 font-mono text-[11px] text-[#6b6b6b]">
                    {formatStamp(item.at)}
                  </span>
                  <span className="border-l border-[#3d3d3d] pl-3 text-[13px] leading-relaxed text-[#b8b8b8]">
                    {item.quote}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {verdict.clip_potential && (
          <div>
            <p className="mb-1 text-[11px] tracking-wider text-[#6b6b6b] uppercase">
              What it could yield
            </p>
            <p className="text-[13px] leading-relaxed text-[#c8c8c8]">
              {verdict.clip_potential}
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[#333333] pt-4 text-[12px] sm:grid-cols-4">
          <Fact label="Face tracking" value={verdict.face_feasibility} />
          <Fact label="Transcript" value={verdict.transcript_quality} />
          <Fact
            label="Confidence"
            value={`${Math.round(verdict.confidence * 100)}%`}
          />
          <Fact
            label="Decided by"
            value={verdict.decided_by === "llm" ? "Model" : "Pre-check"}
          />
        </dl>

        {verdict.decided_by === "llm" && (
          <p className="text-[11px] text-[#5a5a5a]">
            {verdict.total_tokens?.toLocaleString()} tokens ·{" "}
            {verdict.llm_seconds?.toFixed(1)}s ·{" "}
            {verdict.cost_inr === 0
              ? "free tier"
              : `₹${verdict.cost_inr?.toFixed(4)}`}
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#6b6b6b]">{label}</dt>
      <dd className="mt-0.5 text-[#c8c8c8]">{value}</dd>
    </div>
  );
}

function formatStamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
