import type { WatchlistItem } from "@/lib/types";

/** Client-safe catalog of stocks that have a pre-built relationship map. */
export const AVAILABLE_STOCKS: WatchlistItem[] = [
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "TSLA", name: "Tesla, Inc." },
];

export const DEFAULT_TICKERS = ["NVDA", "AAPL", "TSLA"];

export function findStock(query: string): WatchlistItem | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return AVAILABLE_STOCKS.find(
    (s) => s.ticker.toLowerCase() === q || s.name.toLowerCase().includes(q)
  );
}

export function isAvailable(ticker: string): boolean {
  return AVAILABLE_STOCKS.some((s) => s.ticker === ticker.toUpperCase());
}
