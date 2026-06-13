"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Citation, EntityImpact, Signal, StockVerdict } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";
import { SignalPill } from "@/components/SignalPill";
import { SIGNAL_COLORS, pct } from "@/lib/ui";

function relativeTime(publishedAt?: string): string {
  if (!publishedAt) return "";
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function deriveDrivers(impacts: EntityImpact[]) {
  const bullish = impacts
    .filter((i) => i.signal === "positive")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4)
    .map((i) => `${i.name}: ${i.summary.split(".")[0]}`);
  const bearish = impacts
    .filter((i) => i.signal === "negative")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4)
    .map((i) => `${i.name}: ${i.summary.split(".")[0]}`);
  return { bullish, bearish };
}

export function ImpactDrawer({
  verdict,
  impacts,
  loading,
  selectedNodeId,
  stockNodeId,
  ticker,
  onSelect,
}: {
  verdict?: StockVerdict;
  impacts: EntityImpact[];
  loading: boolean;
  selectedNodeId?: string | null;
  stockNodeId?: string;
  ticker?: string;
  onSelect?: (nodeId: string) => void;
}) {
  const sorted = [...impacts].sort((a, b) => b.magnitude - a.magnitude);
  const stockSelected = Boolean(stockNodeId && selectedNodeId === stockNodeId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const verdictRef = useRef<HTMLDivElement | null>(null);

  const outlook = useMemo(() => {
    if (!verdict) return null;
    const derived = deriveDrivers(impacts);
    return {
      explanation: verdict.explanation ?? verdict.rationale,
      bullishDrivers:
        verdict.bullishDrivers?.length ? verdict.bullishDrivers : derived.bullish,
      bearishDrivers:
        verdict.bearishDrivers?.length ? verdict.bearishDrivers : derived.bearish,
    };
  }, [verdict, impacts]);

  // When a node is selected on the map, scroll to the right panel section.
  useEffect(() => {
    if (!selectedNodeId) return;
    if (stockNodeId && selectedNodeId === stockNodeId) {
      verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setExpandedId(null);
      return;
    }
    const el = cardRefs.current[selectedNodeId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setExpandedId(selectedNodeId);
  }, [selectedNodeId, stockNodeId]);

  const handleCardClick = (nodeId: string) => {
    onSelect?.(nodeId);
    setExpandedId((prev) => (prev === nodeId ? null : nodeId));
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden">
      {/* Verdict / stock outlook */}
      <div
        ref={verdictRef}
        className="border-b border-[var(--color-border)] p-4 transition-colors"
        style={{
          borderColor: stockSelected ? SIGNAL_COLORS[verdict?.signal ?? "neutral"] : undefined,
          background: stockSelected ? "var(--color-surface-2)" : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            {stockSelected ? `${ticker ?? "Stock"} outlook` : "Impact verdict"}
          </div>
          {stockSelected ? (
            <span className="text-[10px] font-medium text-[var(--color-accent)]">Selected</span>
          ) : null}
        </div>
        {loading || !verdict ? (
          <div className="mt-3 space-y-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--color-surface-2)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[var(--color-surface-2)]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-surface-2)]" />
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-3">
              <SignalPill signal={verdict.signal} />
              <span
                className="text-lg font-semibold"
                style={{ color: SIGNAL_COLORS[verdict.signal] }}
              >
                {verdict.expectedMove}
              </span>
              <span className="text-xs text-[var(--color-muted)]">{verdict.timeframe}</span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span>Confidence</span>
                <span>{pct(verdict.confidence)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: pct(verdict.confidence), background: SIGNAL_COLORS[verdict.signal] }}
                />
              </div>
            </div>

            {stockSelected && outlook ? (
              <>
                <div className="mt-4">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Why {ticker ?? "the stock"} is {directionLabel(verdict.signal)}
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-text)]">
                    {outlook.explanation}
                  </p>
                </div>
                <DriverList
                  label="Tailwinds"
                  drivers={outlook.bullishDrivers}
                  color={SIGNAL_COLORS.positive}
                />
                <DriverList
                  label="Headwinds"
                  drivers={outlook.bearishDrivers}
                  color={SIGNAL_COLORS.negative}
                />
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text)]">
                {verdict.rationale}
              </p>
            )}

            {!stockSelected && stockNodeId ? (
              <p className="mt-3 text-[11px] text-[var(--color-muted)]">
                Click the center {ticker ?? "stock"} node for a full up/down explanation.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Entities */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Connected landscape ({impacts.length})
        </div>
        <div className="space-y-2">
          {loading && impacts.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card h-20 animate-pulse" />
              ))
            : sorted.map((impact) => {
                const isOpen = expandedId === impact.nodeId;
                const isSelected = selectedNodeId === impact.nodeId;
                return (
                  <div
                    key={impact.nodeId}
                    ref={(el) => {
                      cardRefs.current[impact.nodeId] = el;
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCardClick(impact.nodeId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCardClick(impact.nodeId);
                      }
                    }}
                    className="card w-full cursor-pointer p-3 text-left transition-colors hover:border-[#3a3a3a]"
                    style={{
                      borderColor: isSelected ? SIGNAL_COLORS[impact.signal] : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{impact.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                          {NODE_TYPE_LABELS[impact.type]}
                        </div>
                      </div>
                      <SignalPill signal={impact.signal} />
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                      {impact.summary}
                    </p>

                    {impact.citations.length > 0 ? (
                      isOpen ? (
                        <SourceList citations={impact.citations} signal={impact.signal} />
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--color-muted)]">
                          <span>
                            {impact.citations.length} source
                            {impact.citations.length > 1 ? "s" : ""}
                          </span>
                          <span aria-hidden>· tap to read ▾</span>
                        </div>
                      )
                    ) : (
                      <div className="mt-2 text-[11px] text-[var(--color-muted)]">
                        No sources in this window.
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    </aside>
  );
}

function directionLabel(signal: Signal): string {
  if (signal === "positive") return "likely to rise";
  if (signal === "negative") return "likely to fall";
  return "mixed / range-bound";
}

function DriverList({
  label,
  drivers,
  color,
}: {
  label: string;
  drivers: string[];
  color: string;
}) {
  if (drivers.length === 0) return null;
  return (
    <div className="mt-3">
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {label}
      </div>
      <ul className="space-y-1.5">
        {drivers.map((d, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-[var(--color-text)]"
          >
            <span
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceList({
  citations,
  signal,
}: {
  citations: Citation[];
  signal: EntityImpact["signal"];
}) {
  const color = SIGNAL_COLORS[signal];
  return (
    <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        <span>Sources · most important first</span>
        <span aria-hidden>tap to collapse ▴</span>
      </div>
      {citations.map((c, i) => (
        <a
          key={i}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 transition-colors hover:border-[#3a3a3a]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: color }}
              />
              {c.source}
            </span>
            {c.publishedAt ? (
              <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                {relativeTime(c.publishedAt)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs font-medium leading-snug text-[var(--color-text)]">
            {c.title}
          </div>
          {c.snippet ? (
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
              {c.snippet}
            </p>
          ) : null}
          <div className="mt-1.5 text-[10px] font-medium text-[var(--color-accent)]">
            Read full story ↗
          </div>
        </a>
      ))}
    </div>
  );
}
