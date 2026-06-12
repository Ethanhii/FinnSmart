import { NextResponse } from "next/server";
import { getGraph } from "@/lib/graphs";
import { analyzeStock } from "@/lib/pipeline";
import { HORIZONS, type TimeHorizon } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const horizon = await parseHorizon(req);

  try {
    const result = await analyzeStock(graph, horizon);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

async function parseHorizon(req: Request): Promise<TimeHorizon> {
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
