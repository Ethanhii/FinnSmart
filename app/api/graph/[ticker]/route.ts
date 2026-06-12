import { NextResponse } from "next/server";
import { getGraph } from "@/lib/graphs";

export async function GET(
  _req: Request,
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

  return NextResponse.json(graph);
}
