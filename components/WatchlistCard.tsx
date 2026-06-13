"use client";

import Link from "next/link";
import type { AnalyzeResponse } from "@/lib/types";
import { SignalPill } from "@/components/SignalPill";
import { SIGNAL_COLORS, pct } from "@/lib/ui";

export interface CardState {
  status: "idle" | "loading" | "ready" | "error";
  data?: AnalyzeResponse;
  error?: string;
}

export function WatchlistCard({
  ticker,
  name,
  state,
  onRemove,
}: {
  ticker: string;
  name: string;
  state: CardState;
  onRemove?: (ticker: string) => void;
}) {
  const verdict = state.data?.verdict;
  const mostAffected = verdict
    ? state.data?.impacts.find((i) => i.nodeId === verdict.mostAffectedNodeId)
    : undefined;

  return (
    <div className="card group relative p-5 transition-colors hover:border-[#3a3a3a]">
      {onRemove ? (
        <button
          aria-label={`Remove ${ticker}`}
          onClick={() => onRemove(ticker)}
          className="absolute right-3 top-3 hidden h-6 w-6 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] group-hover:grid"
        >
          ×
        </button>
      ) : null}

      <Link href={`/stock/${ticker}`} className="block no-underline">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
              {ticker}
            </div>
            <div className="max-w-[12rem] truncate text-xs text-[var(--color-muted)]">
              {name}
            </div>
          </div>
          {state.status === "ready" && verdict ? (
            <SignalPill signal={verdict.signal} />
          ) : state.status === "error" ? (
            <span className="pill pill-neutral">unavailable</span>
          ) : state.status === "idle" ? (
            <span className="pill pill-neutral">not analyzed</span>
          ) : state.status === "loading" ? (
            <span className="h-5 w-16 animate-pulse rounded-full bg-[var(--color-surface-2)]" />
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {state.status === "loading" ? (
            <>
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-surface-2)]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-surface-2)]" />
            </>
          ) : state.status === "idle" ? (
            <p className="text-sm text-[var(--color-muted)]">
              Open the map and click Analyze to trace news ripples.
            </p>
          ) : state.status === "error" ? (
            <p className="text-sm text-[var(--color-muted)]">
              {state.error ?? "Map not available yet."}
            </p>
          ) : verdict ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Expected move</span>
                <span
                  className="font-semibold"
                  style={{ color: SIGNAL_COLORS[verdict.signal] }}
                >
                  {verdict.expectedMove}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Most affected by</span>
                <span className="max-w-[10rem] truncate font-medium text-[var(--color-text)]">
                  {mostAffected?.name ?? "—"}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-muted)]">
                  <span>Confidence</span>
                  <span>{pct(verdict.confidence)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: pct(verdict.confidence),
                      background: SIGNAL_COLORS[verdict.signal],
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 text-xs font-medium text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-text)]">
          Open living map →
        </div>
      </Link>
    </div>
  );
}
