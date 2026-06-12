import type { StockGraph, WatchlistItem } from "./types";

import nvda from "@/data/graphs/nvda.json";
import aapl from "@/data/graphs/aapl.json";
import tsla from "@/data/graphs/tsla.json";

const GRAPHS: Record<string, StockGraph> = {
  NVDA: nvda as unknown as StockGraph,
  AAPL: aapl as unknown as StockGraph,
  TSLA: tsla as unknown as StockGraph,
};

/** Default watchlist shown on the home dashboard (NVDA first by request). */
export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "TSLA", name: "Tesla, Inc." },
];

export function getGraph(ticker: string): StockGraph | null {
  return GRAPHS[ticker.toUpperCase()] ?? null;
}

export function hasGraph(ticker: string): boolean {
  return Boolean(GRAPHS[ticker.toUpperCase()]);
}

export function listGraphs(): StockGraph[] {
  return Object.values(GRAPHS);
}
