import type { PipelineProfile } from "@/lib/pipeline-profile";

function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Compact phase breakdown shown after an analyzed run (when FINNSMART_PROFILE=true). */
export function PipelineProfileBanner({ profile }: { profile: PipelineProfile }) {
  const { phases, research, entityEval } = profile;
  const total = profile.totalMs;

  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2 text-xs text-[var(--color-muted)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-[var(--color-text)]">
          Analysis timing · {fmtMs(total)} total
        </span>
        <span>
          Research{" "}
          <span className="text-[var(--color-text)]">{fmtMs(phases.researchMs)}</span>
          <span className="opacity-70"> ({pct(phases.researchMs, total)}%)</span>
          <span className="opacity-70">
            {" "}
            · {research.serpCallCount} SERP
          </span>
        </span>
        <span>
          Entity eval{" "}
          <span className="text-[var(--color-text)]">{fmtMs(phases.entityEvalMs)}</span>
          <span className="opacity-70"> ({pct(phases.entityEvalMs, total)}%)</span>
          <span className="opacity-70"> · {entityEval.callCount} Kimi</span>
        </span>
        <span>
          Verdict{" "}
          <span className="text-[var(--color-text)]">{fmtMs(phases.verdictMs)}</span>
          <span className="opacity-70"> ({pct(phases.verdictMs, total)}%)</span>
        </span>
      </div>
      {research.slowestSerp[0] || entityEval.slowestKimi[0] ? (
        <div className="mt-1 flex flex-wrap gap-x-4 opacity-80">
          {research.slowestSerp[0] ? (
            <span>
              Slowest SERP: {research.slowestSerp[0].label} ({fmtMs(research.slowestSerp[0].ms)})
            </span>
          ) : null}
          {entityEval.slowestKimi[0] ? (
            <span>
              Slowest Kimi: {entityEval.slowestKimi[0].label} ({fmtMs(entityEval.slowestKimi[0].ms)})
            </span>
          ) : null}
          <span className="opacity-60">Full log in dev server terminal</span>
        </div>
      ) : null}
    </div>
  );
}
