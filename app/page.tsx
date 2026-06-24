"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResponse, ImpactStrength, Signal, WatchlistItem } from "@/lib/types";
import { DEFAULT_WATCHLIST_ITEMS } from "@/lib/catalog";
import { Brand } from "@/components/Brand";
import { SignalPill } from "@/components/SignalPill";
import { WatchlistCard, type CardState } from "@/components/WatchlistCard";
import { SIGNAL_COLORS, SIGNAL_LABELS, strengthLabel } from "@/lib/ui";
import { STRENGTH_SCORE } from "@/lib/strength";

const STORAGE_KEY = "finnsmart.watchlist";

function loadWatchlist(): WatchlistItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_WATCHLIST_ITEMS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_WATCHLIST_ITEMS;

    // Migrate legacy string[] watchlists.
    if (typeof parsed[0] === "string") {
      return (parsed as string[]).map((ticker) => ({
        ticker: ticker.toUpperCase(),
        name: ticker.toUpperCase(),
      }));
    }

    return parsed as WatchlistItem[];
  } catch {
    return DEFAULT_WATCHLIST_ITEMS;
  }
}

export default function HomePage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST_ITEMS);
  const [hydrated, setHydrated] = useState(false);
  const [analyses, setAnalyses] = useState<Record<string, CardState>>({});
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WatchlistItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setWatchlist(loadWatchlist());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist, hydrated]);

  const cacheFetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated) return;
    watchlist.forEach(({ ticker }) => {
      if (cacheFetched.current.has(ticker)) return;
      cacheFetched.current.add(ticker);
      setAnalyses((prev) => ({ ...prev, [ticker]: { status: "loading" } }));
      fetch(`/api/analyze/${ticker}?horizon=medium`)
        .then(async (res) => {
          if (res.status === 404) {
            setAnalyses((prev) => ({ ...prev, [ticker]: { status: "idle" } }));
            return;
          }
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
          const data = (await res.json()) as AnalyzeResponse;
          setAnalyses((prev) => ({ ...prev, [ticker]: { status: "ready", data } }));
        })
        .catch((err: Error) =>
          setAnalyses((prev) => ({
            ...prev,
            [ticker]: { status: "error", error: err.message },
          }))
        );
    });
  }, [watchlist, hydrated]);

  // Debounced Yahoo Finance search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
          const data = (await res.json()) as { results: WatchlistItem[] };
          setSuggestions(data.results ?? []);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const addToWatchlist = useCallback(
    (item: WatchlistItem) => {
      setSearchError(null);
      if (watchlist.some((s) => s.ticker === item.ticker)) {
        setSearchError(`${item.ticker} is already on your watchlist.`);
        return;
      }
      setWatchlist((prev) => [...prev, item]);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [watchlist]
  );

  const addStock = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSearchError(null);

      const q = query.trim();
      if (!q) return;

      // Prefer an exact ticker match from suggestions.
      const exact = suggestions.find((s) => s.ticker === q.toUpperCase());
      if (exact) {
        addToWatchlist(exact);
        return;
      }

      if (suggestions.length === 1) {
        addToWatchlist(suggestions[0]);
        return;
      }

      if (suggestions.length > 1) {
        setSearchError("Pick a stock from the suggestions below.");
        setShowSuggestions(true);
        return;
      }

      // Last resort: resolve ticker directly.
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: WatchlistItem[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        const match =
          data.results?.find((s) => s.ticker === q.toUpperCase()) ?? data.results?.[0];
        if (!match) {
          setSearchError(`No stock found for "${q}". Try a ticker or company name.`);
          return;
        }
        addToWatchlist(match);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
      }
    },
    [query, suggestions, addToWatchlist]
  );

  const removeStock = useCallback((ticker: string) => {
    cacheFetched.current.delete(ticker);
    setAnalyses((prev) => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });
    setWatchlist((prev) => prev.filter((s) => s.ticker !== ticker));
  }, []);

  const tickers = useMemo(() => watchlist.map((s) => s.ticker), [watchlist]);
  const summary = useMemo(() => computeSummary(tickers, analyses), [tickers, analyses]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-20 pt-6">
      <header>
        <Brand />
      </header>

      <section className="mt-16">
        <h1 className="max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight md:text-[2.7rem]">
          Track how news ripples
          <br />
          through your portfolio.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Each stock becomes a living map of its suppliers, customers, partners and
          dependencies.
        </p>

        <form onSubmit={addStock} className="relative mt-7 max-w-md">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchError(null);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search any stock (e.g. MSFT, Apple, Berkshire)"
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[#3a3a3a]"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--color-text)] px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Add
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 ? (
            <ul className="absolute left-0 right-14 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
              {suggestions.map((item) => (
                <li key={item.ticker}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addToWatchlist(item)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    <span>
                      <span className="font-ticker font-semibold">{item.ticker}</span>
                      <span className="ml-2 text-[var(--color-muted)]">{item.name}</span>
                    </span>
                    {item.exchange ? (
                      <span className="text-[10px] uppercase text-[var(--color-muted)]">
                        {item.exchange}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searching ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">Searching…</p>
          ) : null}
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
                <span className="font-ticker">{summary.mostAffected.ticker}</span>{" "}
                <span className="text-sm font-normal text-[var(--color-muted)]">
                  {strengthLabel(summary.mostAffected.strength)} ·{" "}
                  {SIGNAL_LABELS[summary.mostAffected.signal].toLowerCase()}
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
        {watchlist.length === 0 ? (
          <div className="card grid place-items-center p-10 text-center text-[var(--color-muted)]">
            Your watchlist is empty. Search above to add a stock.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((item) => (
              <WatchlistCard
                key={item.ticker}
                ticker={item.ticker}
                name={item.name}
                state={analyses[item.ticker] ?? { status: "idle" }}
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
    | { ticker: string; signal: Signal; strength: ImpactStrength }
    | undefined;

  for (const ticker of tickers) {
    const v = analyses[ticker]?.data?.verdict;
    if (!v) continue;
    ready += 1;
    if (v.signal === "positive") bullish += 1;
    else if (v.signal === "negative") bearish += 1;
    else neutral += 1;
    score +=
      (v.signal === "positive" ? 1 : v.signal === "negative" ? -1 : 0) *
      STRENGTH_SCORE[v.strength];

    const rank = v.signal === "neutral" ? 0 : STRENGTH_SCORE[v.strength];
    if (!mostAffected || rank > STRENGTH_SCORE[mostAffected.strength]) {
      mostAffected = { ticker, signal: v.signal, strength: v.strength };
    }
  }

  const overall: Signal = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  return { overall, bullish, bearish, neutral, ready, mostAffected, label: SIGNAL_LABELS[overall] };
}
