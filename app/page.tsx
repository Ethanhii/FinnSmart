"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyzeResponse, Signal } from "@/lib/types";
import { AVAILABLE_STOCKS, DEFAULT_TICKERS, findStock } from "@/lib/catalog";
import { Brand } from "@/components/Brand";
import { SignalPill } from "@/components/SignalPill";
import { WatchlistCard, type CardState } from "@/components/WatchlistCard";
import { SIGNAL_COLORS, SIGNAL_LABELS } from "@/lib/ui";

const STORAGE_KEY = "finnsmart.watchlist";

export default function HomePage() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [hydrated, setHydrated] = useState(false);
  const [analyses, setAnalyses] = useState<Record<string, CardState>>({});
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load persisted watchlist.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setTickers(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist on change.
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  }, [tickers, hydrated]);

  // Fetch analysis for any ticker not yet loaded.
  useEffect(() => {
    tickers.forEach((ticker) => {
      if (analyses[ticker]) return;
      setAnalyses((prev) => ({ ...prev, [ticker]: { status: "loading" } }));
      fetch(`/api/analyze/${ticker}`, { method: "POST" })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
          return (await res.json()) as AnalyzeResponse;
        })
        .then((data) =>
          setAnalyses((prev) => ({ ...prev, [ticker]: { status: "ready", data } }))
        )
        .catch((err: Error) =>
          setAnalyses((prev) => ({
            ...prev,
            [ticker]: { status: "error", error: err.message },
          }))
        );
    });
  }, [tickers, analyses]);

  const addStock = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchError(null);
      const match = findStock(query);
      if (!match) {
        setSearchError(
          `No pre-built map for "${query}" yet. Try NVDA, AAPL or TSLA.`
        );
        return;
      }
      if (tickers.includes(match.ticker)) {
        setSearchError(`${match.ticker} is already on your watchlist.`);
        return;
      }
      setTickers((prev) => [...prev, match.ticker]);
      setQuery("");
    },
    [query, tickers]
  );

  const removeStock = useCallback((ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));
  }, []);

  const summary = useMemo(() => computeSummary(tickers, analyses), [tickers, analyses]);

  const nameFor = (ticker: string) =>
    AVAILABLE_STOCKS.find((s) => s.ticker === ticker)?.name ?? ticker;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-20 pt-6">
      <header className="flex items-center justify-between">
        <Brand subtitle="News ripple intelligence" />
        <span className="pill pill-neutral">Beta</span>
      </header>

      <section className="mt-16">
        <h1 className="max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-[2.7rem]">
          See how the news ripples to the stocks you own.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Each stock becomes a living map of its suppliers, customers, partners and
          dependencies. When news hits any of them, FinnSmart traces the impact back to
          your stock with green and red flows.
        </p>

        <form onSubmit={addStock} className="mt-7 flex max-w-md gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a stock to add (e.g. NVDA, Apple, Tesla)"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[#3a3a3a]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-text)] px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </form>
        {searchError ? (
          <p className="mt-2 text-sm text-[var(--color-neg)]">{searchError}</p>
        ) : null}
      </section>

      {/* Watchlist signal strip */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Watchlist signal
          </div>
          <div className="mt-2 flex items-center gap-3">
            <SignalPill signal={summary.overall} />
            <span className="text-sm text-[var(--color-muted)]">
              {summary.ready}/{tickers.length} analyzed
            </span>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Most affected stock
          </div>
          <div className="mt-2 text-lg font-semibold">
            {summary.mostAffected ? (
              <span style={{ color: SIGNAL_COLORS[summary.mostAffected.signal] }}>
                {summary.mostAffected.ticker}{" "}
                <span className="text-sm font-normal text-[var(--color-muted)]">
                  {summary.mostAffected.move}
                </span>
              </span>
            ) : (
              <span className="text-[var(--color-muted)]">—</span>
            )}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Landscape mood
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span style={{ color: SIGNAL_COLORS.positive }}>{summary.bullish} bullish</span>
            <span style={{ color: SIGNAL_COLORS.negative }}>{summary.bearish} bearish</span>
            <span className="text-[var(--color-muted)]">{summary.neutral} neutral</span>
          </div>
        </div>
      </section>

      {/* Watchlist grid */}
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Your stocks
        </h2>
        {tickers.length === 0 ? (
          <div className="card grid place-items-center p-10 text-center text-[var(--color-muted)]">
            Your watchlist is empty. Search above to add a stock.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tickers.map((ticker) => (
              <WatchlistCard
                key={ticker}
                ticker={ticker}
                name={nameFor(ticker)}
                state={analyses[ticker] ?? { status: "loading" }}
                onRemove={removeStock}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function computeSummary(
  tickers: string[],
  analyses: Record<string, CardState>
) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let ready = 0;
  let score = 0;
  let mostAffected:
    | { ticker: string; signal: Signal; move: string; mag: number }
    | undefined;

  for (const ticker of tickers) {
    const v = analyses[ticker]?.data?.verdict;
    if (!v) continue;
    ready += 1;
    if (v.signal === "positive") bullish += 1;
    else if (v.signal === "negative") bearish += 1;
    else neutral += 1;
    score += (v.signal === "positive" ? 1 : v.signal === "negative" ? -1 : 0) * v.confidence;

    const mag = v.signal === "neutral" ? 0 : v.confidence;
    if (!mostAffected || mag > mostAffected.mag) {
      mostAffected = { ticker, signal: v.signal, move: v.expectedMove, mag };
    }
  }

  const overall: Signal = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  return { overall, bullish, bearish, neutral, ready, mostAffected, label: SIGNAL_LABELS[overall] };
}
