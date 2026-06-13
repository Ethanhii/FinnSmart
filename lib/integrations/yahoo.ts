import type { WatchlistItem } from "@/lib/types";

const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";

interface YahooQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
}

/** Search US-listed equities via Yahoo Finance (no API key). */
export async function searchStocks(query: string, limit = 12): Promise<WatchlistItem[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    quotesCount: String(limit),
    newsCount: "0",
    listsCount: "0",
  });

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { "User-Agent": "FinnSmart/1.0" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance search failed (${res.status})`);
  }

  const data = (await res.json()) as { quotes?: YahooQuote[] };
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];

  const seen = new Set<string>();
  const out: WatchlistItem[] = [];

  for (const quote of quotes) {
    if (!quote.symbol) continue;
    if (quote.quoteType && quote.quoteType !== "EQUITY") continue;

    const ticker = quote.symbol.toUpperCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);

    out.push({
      ticker,
      name: quote.longname ?? quote.shortname ?? ticker,
      exchange: quote.exchange,
    });
  }

  return out;
}

/** Resolve a ticker symbol to its company name. */
export async function resolveStock(ticker: string): Promise<WatchlistItem | null> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return null;

  const results = await searchStocks(sym, 8);
  const exact = results.find((r) => r.ticker === sym);
  if (exact) return exact;

  // Yahoo often returns the exact symbol first even without exact match.
  return results[0] ?? { ticker: sym, name: sym };
}
