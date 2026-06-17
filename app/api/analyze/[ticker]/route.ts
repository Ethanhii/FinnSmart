import { NextResponse } from "next/server";
import { getCachedAnalysis, saveAnalysis } from "@/lib/analysis-store";
import { getGraph, getOrGenerateGraph } from "@/lib/graphs";
import { analyzeStock } from "@/lib/pipeline";
import type { TimeHorizon } from "@/lib/types";
import { normalizeHorizon } from "@/lib/horizon-news";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Return saved analysis for demo / dashboard — no pipeline run. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const graph = await getGraph(ticker);

  if (!graph) {
    return NextResponse.json(
      { error: `No relationship map available for "${ticker.toUpperCase()}" yet.` },
      { status: 404 }
    );
  }

  const horizon = parseHorizonFromUrl(req.url);
  const cached = await getCachedAnalysis(ticker, horizon);

  if (!cached) {
    return NextResponse.json(
      { error: "No saved analysis for this ticker and horizon yet." },
      { status: 404 }
    );
  }

  return NextResponse.json(cached);
}

/** Run the live pipeline and persist the result for future visits. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  let companyName: string | undefined;
  let horizon: TimeHorizon = "medium";

  try {
    const body = (await req.json()) as { horizon?: string; name?: string };
    if (body?.horizon) {
      horizon = normalizeHorizon(body.horizon);
    }
    companyName = body?.name?.trim() || undefined;
  } catch {
    /* default horizon */
  }

  try {
    const graph = await getOrGenerateGraph(ticker, companyName);
    const result = await analyzeStock(graph, horizon);
    await saveAnalysis(result);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

function parseHorizonFromUrl(url: string): TimeHorizon {
  const h = new URL(url).searchParams.get("horizon");
  if (h) return normalizeHorizon(h);
  return "medium";
}
