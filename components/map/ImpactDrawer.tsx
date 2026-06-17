"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Citation, EntityImpact, Signal, StockVerdict } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";
import { SignalPill } from "@/components/SignalPill";
import { SIGNAL_COLORS, pct } from "@/lib/ui";

type DrawerTab = "company" | "ecosystem";

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
  directCompanyNews = [],
  loading,
  selectedNodeId,
  stockNodeId,
  ticker,
  onSelect,
}: {
  verdict?: StockVerdict;
  impacts: EntityImpact[];
  directCompanyNews?: Citation[];
  loading: boolean;
  selectedNodeId?: string | null;
  stockNodeId?: string;
  ticker?: string;
  onSelect?: (nodeId: string) => void;
}) {
  const sorted = [...impacts].sort((a, b) => b.magnitude - a.magnitude);
  const stockSelected = Boolean(stockNodeId && selectedNodeId === stockNodeId);
  const sym = ticker ?? "Stock";

  const [tab, setTab] = useState<DrawerTab>("ecosystem");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  // Map selection → scroll the right section into view.
  useEffect(() => {
    if (!selectedNodeId) return;
    if (stockNodeId && selectedNodeId === stockNodeId) {
      verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setExpandedId(null);
      return;
    }
    setTab("ecosystem");
    const el = cardRefs.current[selectedNodeId];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    setExpandedId(selectedNodeId);
  }, [selectedNodeId, stockNodeId]);

  const handleCardClick = (nodeId: string) => {
    onSelect?.(nodeId);
    setExpandedId((prev) => (prev === nodeId ? null : nodeId));
  };

  const showCompanyTab = directCompanyNews.length > 0 || loading;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden">
      {/* Verdict — pinned summary */}
      <div
        ref={verdictRef}
        className="shrink-0 border-b border-[var(--color-border)] p-4 transition-colors"
        style={{
          borderColor: stockSelected ? SIGNAL_COLORS[verdict?.signal ?? "neutral"] : undefined,
          background: stockSelected ? "var(--color-surface-2)" : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            {stockSelected ? `${sym} outlook` : "Impact verdict"}
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
                    Why {sym} is {directionLabel(verdict.signal)}
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
                Click the center {sym} node for a full up/down explanation.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      {showCompanyTab ? (
        <div
          className="flex shrink-0 gap-1 border-b border-[var(--color-border)] p-2"
          role="tablist"
          aria-label="News sections"
        >
          <TabButton
            active={tab === "company"}
            onClick={() => {
              setTab("company");
              scrollRef.current?.scrollTo({ top: 0 });
            }}
            label={`${sym} news`}
            count={directCompanyNews.length || undefined}
          />
          <TabButton
            active={tab === "ecosystem"}
            onClick={() => {
              setTab("ecosystem");
              scrollRef.current?.scrollTo({ top: 0 });
            }}
            label="Ecosystem"
            count={impacts.length || undefined}
          />
        </div>
      ) : (
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Connected landscape ({impacts.length})
        </div>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "company" && showCompanyTab ? (
          <CompanyNewsPanel
            ticker={sym}
            items={directCompanyNews}
            loading={loading && directCompanyNews.length === 0}
          />
        ) : (
          <EcosystemPanel
            impacts={sorted}
            loading={loading}
            expandedId={expandedId}
            selectedNodeId={selectedNodeId}
            cardRefs={cardRefs}
            onCardClick={handleCardClick}
          />
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--color-surface-2)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-muted)",
        border: active ? "1px solid var(--color-border)" : "1px solid transparent",
      }}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            background: active ? "var(--color-border)" : "var(--color-surface-2)",
            color: "var(--color-muted)",
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function CompanyNewsPanel({
  ticker,
  items,
  loading,
}: {
  ticker: string;
  items: Citation[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--color-muted)]">
        No direct headlines for {ticker} in this window.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-[11px] text-[var(--color-muted)]">
        Headlines about {ticker} from Yahoo Finance — not ecosystem ripples.
      </p>
      {items.map((c, i) => (
        <NewsLink key={i} citation={c} />
      ))}
    </div>
  );
}

function EcosystemPanel({
  impacts,
  loading,
  expandedId,
  selectedNodeId,
  cardRefs,
  onCardClick,
}: {
  impacts: EntityImpact[];
  loading: boolean;
  expandedId: string | null;
  selectedNodeId?: string | null;
  cardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onCardClick: (nodeId: string) => void;
}) {
  if (loading && impacts.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-[11px] text-[var(--color-muted)]">
        News rippling through connected suppliers, customers, partners, and macro channels.
      </p>
      {impacts.map((impact) => {
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
            onClick={() => onCardClick(impact.nodeId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCardClick(impact.nodeId);
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
  );
}

function NewsLink({ citation: c }: { citation: Citation }) {
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 transition-colors hover:border-[#3a3a3a]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--color-text)]">{c.source}</span>
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
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
          {c.snippet}
        </p>
      ) : null}
    </a>
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
