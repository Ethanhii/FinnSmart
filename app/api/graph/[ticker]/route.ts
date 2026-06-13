import { NextResponse } from "next/server";
import { getGraph, getOrGenerateGraph } from "@/lib/graphs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Return a cached relationship map (disk or bundled seeds). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const graph = await getGraph(ticker);

  if (!graph) {
    return NextResponse.json(
      {
        error: `No relationship map for "${ticker.toUpperCase()}" yet. Open the stock page to generate one.`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(graph);
}

/** Generate (if missing) and persist a relationship map for any ticker. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  let companyName: string | undefined;
  try {
    const body = (await req.json()) as { name?: string };
    companyName = body?.name?.trim() || undefined;
  } catch {
    /* empty body is fine */
  }

  try {
    const graph = await getOrGenerateGraph(ticker, companyName);
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Graph generation failed" },
      { status: 500 }
    );
  }
}
