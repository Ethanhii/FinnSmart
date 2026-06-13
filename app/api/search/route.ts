import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

/** Search equities via Yahoo Finance (ticker or company name). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchStocks(q, 12);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 }
    );
  }
}
