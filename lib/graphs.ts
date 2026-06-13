import "server-only";

import type { StockGraph } from "./types";

import nvda from "@/data/graphs/nvda.json";
import aapl from "@/data/graphs/aapl.json";
import tsla from "@/data/graphs/tsla.json";
import { generateGraph } from "@/lib/generate-graph";
import { readGraph, saveGraph } from "@/lib/graph-store";
import { resolveStock } from "@/lib/integrations/yahoo";

/** Bundled demo graphs — used as fallback before disk cache exists. */
const SEED_GRAPHS: Record<string, StockGraph> = {
  NVDA: nvda as unknown as StockGraph,
  AAPL: aapl as unknown as StockGraph,
  TSLA: tsla as unknown as StockGraph,
};

/** Prevent duplicate LLM generation when multiple requests hit the same ticker. */
const pending = new Map<string, Promise<StockGraph>>();

/** Load a graph from disk, bundled seeds, or null if not cached yet. */
export async function getGraph(ticker: string): Promise<StockGraph | null> {
  const key = ticker.toUpperCase();
  const fromDisk = await readGraph(key);
  if (fromDisk) return fromDisk;
  return SEED_GRAPHS[key] ?? null;
}

export async function hasGraph(ticker: string): Promise<boolean> {
  return Boolean(await getGraph(ticker));
}

/** Return cached graph or generate, persist, and return a new one. */
export async function getOrGenerateGraph(
  ticker: string,
  companyName?: string
): Promise<StockGraph> {
  const key = ticker.toUpperCase();
  const existing = await getGraph(key);
  if (existing) return existing;

  if (pending.has(key)) return pending.get(key)!;

  const job = (async () => {
    const resolved =
      companyName?.trim() ||
      (await resolveStock(key))?.name ||
      key;
    const graph = await generateGraph(key, resolved);
    await saveGraph(graph);
    return graph;
  })();

  pending.set(key, job);
  try {
    return await job;
  } finally {
    pending.delete(key);
  }
}

export function listSeedGraphs(): StockGraph[] {
  return Object.values(SEED_GRAPHS);
}
