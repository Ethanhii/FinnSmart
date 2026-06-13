import { NextResponse } from "next/server";
import { getCachedAnalysis, saveAnalysis } from "@/lib/analysis-store";
import { getGraph } from "@/lib/graphs";
import { analyzeStock } from "@/lib/pipeline";
import { HORIZONS, type TimeHorizon } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Return saved analysis for demo / dashboard — no pipeline run. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const graph = getGraph(ticker);

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
  const graph = getGraph(ticker);

  if (!graph) {
    return NextResponse.json(
      { error: `No relationship map available for "${ticker.toUpperCase()}" yet.` },
      { status: 404 }
    );
  }

  const horizon = await parseHorizonFromBody(req);

  try {
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
  if (h && h in HORIZONS) return h as TimeHorizon;
  return "short";
}

async function parseHorizonFromBody(req: Request): Promise<TimeHorizon> {
  try {
    const body = (await req.json()) as { horizon?: string };
    if (body?.horizon && body.horizon in HORIZONS) {
      return body.horizon as TimeHorizon;
    }
  } catch {
    /* no/invalid body -> default */
  }
  return "short";
}
