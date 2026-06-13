import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { StockGraph } from "@/lib/types";

const STORE_DIR = path.join(process.cwd(), "data", "graphs");

function storePath(ticker: string): string {
  return path.join(STORE_DIR, `${ticker.toUpperCase()}.json`);
}

/** Legacy seed files used lowercase filenames (nvda.json). */
function legacyPath(ticker: string): string {
  return path.join(STORE_DIR, `${ticker.toLowerCase()}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

function isValidGraph(parsed: unknown): parsed is StockGraph {
  if (!parsed || typeof parsed !== "object") return false;
  const g = parsed as StockGraph;
  return Boolean(g.ticker && g.name && Array.isArray(g.nodes) && Array.isArray(g.edges));
}

/** Read a cached relationship map from disk. */
export async function readGraph(ticker: string): Promise<StockGraph | null> {
  for (const file of [storePath(ticker), legacyPath(ticker)]) {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      if (isValidGraph(parsed)) return parsed;
    } catch {
      /* try next path */
    }
  }
  return null;
}

export async function hasStoredGraph(ticker: string): Promise<boolean> {
  return Boolean(await readGraph(ticker));
}

/** Persist a generated relationship map. */
export async function saveGraph(graph: StockGraph): Promise<void> {
  await ensureDir();
  const normalized: StockGraph = {
    ...graph,
    ticker: graph.ticker.toUpperCase(),
  };
  await writeFile(storePath(normalized.ticker), JSON.stringify(normalized, null, 2), "utf8");
}
