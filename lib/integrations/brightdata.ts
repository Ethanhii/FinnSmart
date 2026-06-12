import { BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE, brightDataConfigured } from "@/lib/config";
import { MOCK_NEWS, fallbackNews, type NewsItem } from "@/data/mocks/news";

export type { NewsItem };

export interface SerpOptions {
  /** Google `tbs` style hint. We map to qdr param. */
  timeRange?: "h" | "d" | "w" | "m" | "y";
  num?: number;
  /** Used to resolve mock fixtures by exact entity name. */
  entityName?: string;
}

/**
 * Fetch recent Google News results for a query.
 *
 * Live mode -> Bright Data SERP API:
 *   POST https://api.brightdata.com/request
 *   { zone, url: "https://www.google.com/search?q=...&tbm=nws&brd_json=1", format: "raw" }
 *
 * Mock mode -> curated fixtures from data/mocks/news.ts.
 */
export async function serpNews(
  query: string,
  opts: SerpOptions = {}
): Promise<NewsItem[]> {
  if (!brightDataConfigured()) {
    return getMockNews(query, opts.entityName);
  }

  const { timeRange = "d", num = 10 } = opts;
  const searchParams = new URLSearchParams({
    q: query,
    tbm: "nws",
    brd_json: "1",
    num: String(num),
    hl: "en",
    gl: "us",
    tbs: `qdr:${timeRange}`,
  });
  const targetUrl = `https://www.google.com/search?${searchParams.toString()}`;

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
    },
    body: JSON.stringify({
      zone: BRIGHTDATA_ZONE,
      url: targetUrl,
      format: "raw",
    }),
    // News doesn't need to be cached between requests.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Bright Data SERP error ${res.status}: ${await res.text()}`);
  }

  const data = await parseBody(await res.text());
  const news: Record<string, unknown>[] = Array.isArray(data?.news)
    ? (data.news as Record<string, unknown>[])
    : [];

  return news.slice(0, num).map((n) => ({
    title: String(n.title ?? ""),
    url: String(n.link ?? n.url ?? ""),
    source: String(n.source ?? n.publisher ?? "Unknown"),
    snippet: typeof n.description === "string" ? n.description : undefined,
    publishedAt:
      typeof n.published === "string"
        ? n.published
        : typeof n.date === "string"
        ? n.date
        : undefined,
  }));
}

function parseBody(text: string): { news?: unknown[] } {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getMockNews(query: string, entityName?: string): NewsItem[] {
  if (entityName && MOCK_NEWS[entityName]) return MOCK_NEWS[entityName];

  // Otherwise match the longest fixture key contained in the query string.
  const match = Object.keys(MOCK_NEWS)
    .filter((key) => query.toLowerCase().includes(key.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];

  if (match) return MOCK_NEWS[match];
  return fallbackNews(entityName ?? query);
}
