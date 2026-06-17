import type { TimeHorizon } from "@/lib/types";
import type { NewsItem } from "@/lib/integrations/brightdata";

/** Context-weight instructions injected into entity + verdict LLM prompts. */
export const HORIZON_REASONING_WEIGHTS: Record<TimeHorizon, string> = {
  immediate:
    "Weight your analysis 90% toward immediate operational disruptions (days), 10% toward medium-term trends. Ignore long-term structural signals.",
  medium:
    "Weight your analysis 30% toward immediate disruptions, 60% toward medium-term financial/competitive shifts (weeks to 3 months), 10% toward long-term structural signals.",
  long:
    "Weight your analysis 10% toward immediate disruptions, 20% toward medium-term shifts, 70% toward long-term structural and competitive positioning.",
};

export type NewsLayerId = "immediate" | "medium" | "long";

export interface SerpLayerSpec {
  id: NewsLayerId;
  /** Google `tbs` parameter for this slice. */
  tbs: string;
  /** Max results to request from SERP (cost control). */
  num: number;
  /** Keep articles published within [minHours, maxHours] ago. */
  minHours: number;
  maxHours: number;
}

/** Cap merged articles per entity after filtering — keeps Kimi input small. */
export const MAX_NEWS_PER_ENTITY: Record<TimeHorizon, number> = {
  immediate: 6,
  medium: 8,
  long: 10,
};

const HOURS_DAY = 24;
const HOURS_TWO_MONTHS = 60 * HOURS_DAY;
const HOURS_YEAR = 365 * HOURS_DAY;

function googleDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Custom Google date range: cdr:1,cd_min:...,cd_max:... */
export function tbsDateRange(from: Date, to: Date): string {
  return `cdr:1,cd_min:${googleDate(from)},cd_max:${googleDate(to)}`;
}

/** Build SERP layer specs with fresh date boundaries (call once per analyze run). */
export function buildSerpLayers(): Record<NewsLayerId, SerpLayerSpec> {
  const now = Date.now();
  const dayAgo = new Date(now - HOURS_DAY * 3_600_000);
  const twoMonthsAgo = new Date(now - HOURS_TWO_MONTHS * 3_600_000);
  const yearAgo = new Date(now - HOURS_YEAR * 3_600_000);

  return {
    immediate: {
      id: "immediate",
      tbs: "qdr:d",
      num: 5,
      minHours: 0,
      maxHours: HOURS_DAY,
    },
    medium: {
      id: "medium",
      // Exclude last 24h — immediate layer covers that window.
      tbs: tbsDateRange(twoMonthsAgo, dayAgo),
      num: 5,
      minHours: HOURS_DAY,
      maxHours: HOURS_TWO_MONTHS,
    },
    long: {
      id: "long",
      // Structural band: 2–12 months ago (not the full year in one query).
      tbs: tbsDateRange(yearAgo, twoMonthsAgo),
      num: 5,
      minHours: HOURS_TWO_MONTHS,
      maxHours: HOURS_YEAR,
    },
  };
}

/** Which SERP layers to fetch for the user-selected horizon (nested model). */
export function layersForHorizon(horizon: TimeHorizon): NewsLayerId[] {
  switch (horizon) {
    case "immediate":
      return ["immediate"];
    case "medium":
      return ["immediate", "medium"];
    case "long":
      return ["immediate", "medium", "long"];
  }
}

export function hoursAgo(publishedAt?: string): number {
  if (!publishedAt) return HOURS_DAY * 3;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return HOURS_DAY * 3;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

/** Strict time gate on SERP results; unknown dates kept only for immediate layer. */
export function filterNewsToLayer(
  items: NewsItem[],
  layer: SerpLayerSpec
): NewsItem[] {
  return items.filter((item) => {
    if (!item.publishedAt) return layer.id === "immediate";
    const h = hoursAgo(item.publishedAt);
    return h >= layer.minHours && h <= layer.maxHours;
  });
}

/** Layer priority when merging (immediate wins ties on same story). */
const LAYER_RANK: Record<NewsLayerId, number> = {
  immediate: 0,
  medium: 1,
  long: 2,
};

export function mergeLayeredNews(
  buckets: { layer: NewsLayerId; items: NewsItem[] }[],
  horizon: TimeHorizon
): NewsItem[] {
  const cap = MAX_NEWS_PER_ENTITY[horizon];
  const seen = new Set<string>();
  const merged: NewsItem[] = [];

  const flat = buckets
    .flatMap((b) => b.items.map((item) => ({ ...item, _layer: b.layer })))
    .sort((a, b) => {
      const lr = LAYER_RANK[a._layer] - LAYER_RANK[b._layer];
      if (lr !== 0) return lr;
      return hoursAgo(a.publishedAt) - hoursAgo(b.publishedAt);
    });

  for (const item of flat) {
    const key = normalizeTitle(item.title) + "|" + hostOf(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      title: item.title,
      url: item.url,
      source: item.source,
      snippet: item.snippet,
      publishedAt: item.publishedAt,
      weight: item.weight,
      sentiment: item.sentiment,
    });
    if (merged.length >= cap) break;
  }

  return merged;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Map legacy horizon ids from cached analysis to current model. */
export function normalizeHorizon(h: string): TimeHorizon {
  if (h === "short") return "medium";
  if (h === "immediate" || h === "medium" || h === "long") return h;
  return "medium";
}
