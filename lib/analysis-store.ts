import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AnalyzeResponse, TimeHorizon } from "@/lib/types";
import { HORIZON_ORDER } from "@/lib/types";
import { normalizeAnalyzeResponse, stripProfileFromAnalysis } from "@/lib/strength";

/** On-disk cache: one file per ticker, keyed by time horizon. */
export interface TickerAnalysisStore {
  ticker: string;
  byHorizon: Partial<Record<TimeHorizon, AnalyzeResponse>>;
  lastUpdated?: string;
}

const STORE_DIR = path.join(process.cwd(), "data", "analysis");

function storePath(ticker: string): string {
  return path.join(STORE_DIR, `${ticker.toUpperCase()}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

export async function readTickerStore(ticker: string): Promise<TickerAnalysisStore | null> {
  try {
    const raw = await readFile(storePath(ticker), "utf8");
    const parsed = JSON.parse(raw) as TickerAnalysisStore;
    if (!parsed?.ticker || !parsed.byHorizon) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Returns cached analysis for a ticker + horizon, or null if none saved. */
export async function getCachedAnalysis(
  ticker: string,
  horizon: TimeHorizon
): Promise<AnalyzeResponse | null> {
  const store = await readTickerStore(ticker);
  const cached = store?.byHorizon[horizon];
  return cached ? stripProfileFromAnalysis(normalizeAnalyzeResponse(cached)) : null;
}

/** Best available cached analysis (prefers requested horizon, else most recently updated entry). */
export async function getAnyCachedAnalysis(
  ticker: string,
  preferredHorizon?: TimeHorizon
): Promise<AnalyzeResponse | null> {
  const store = await readTickerStore(ticker);
  if (!store) return null;
  if (preferredHorizon && store.byHorizon[preferredHorizon]) {
    return stripProfileFromAnalysis(normalizeAnalyzeResponse(store.byHorizon[preferredHorizon]!));
  }
  for (const h of HORIZON_ORDER) {
    if (store.byHorizon[h]) return stripProfileFromAnalysis(normalizeAnalyzeResponse(store.byHorizon[h]!));
  }
  return null;
}

/** Persist a completed analysis run (merges into existing horizons for the ticker). */
export async function saveAnalysis(result: AnalyzeResponse): Promise<void> {
  await ensureDir();
  const ticker = result.ticker.toUpperCase();
  const toSave = stripProfileFromAnalysis(result);
  const existing = (await readTickerStore(ticker)) ?? { ticker, byHorizon: {} };
  existing.byHorizon[result.horizon] = toSave;
  existing.lastUpdated = result.generatedAt;
  await writeFile(storePath(ticker), JSON.stringify(existing, null, 2), "utf8");
}
