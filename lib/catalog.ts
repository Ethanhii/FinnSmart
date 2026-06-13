import type { WatchlistItem } from "@/lib/types";

/** Default watchlist shown on the home dashboard. Client-safe — no server imports. */
export const DEFAULT_WATCHLIST_ITEMS: WatchlistItem[] = [
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "TSLA", name: "Tesla, Inc." },
];

export const DEFAULT_TICKERS = DEFAULT_WATCHLIST_ITEMS.map((s) => s.ticker);
/** Known names for default tickers (watchlist display fallback). */
const KNOWN_NAMES = Object.fromEntries(
  DEFAULT_WATCHLIST_ITEMS.map((s) => [s.ticker, s.name])
) as Record<string, string>;

export function nameForTicker(ticker: string, fallback?: string): string {
  return KNOWN_NAMES[ticker.toUpperCase()] ?? fallback ?? ticker;
}
