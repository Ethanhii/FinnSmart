import type {
  AnalyzeResponse,
  Citation,
  EntityImpact,
  GraphNode,
  Signal,
  StockGraph,
  StockVerdict,
  TimeHorizon,
} from "@/lib/types";
import { HORIZONS } from "@/lib/types";
import { serpNews, type NewsItem } from "@/lib/integrations/brightdata";
import {
  buildSerpLayers,
  filterNewsToLayer,
  HORIZON_REASONING_WEIGHTS,
  hoursAgo,
  layersForHorizon,
  mergeLayeredNews,
  type NewsLayerId,
  type SerpLayerSpec,
} from "@/lib/horizon-news";
import { kimiChat, llmConfigured, parseJsonResponse } from "@/lib/integrations/kimi";
import { fetchCompanyNews } from "@/lib/integrations/yahoo";
import { profileEnabled } from "@/lib/config";
import { createProfiler, type PipelineProfiler } from "@/lib/pipeline-profile";
import {
  compareStrength,
  parseStrength,
  STRENGTH_SCORE,
  strengthFromNumber,
} from "@/lib/strength";
import type { ImpactStrength } from "@/lib/types";

/** Relationship-type weighting: how much an entity's news matters to the stock. */
const TYPE_WEIGHT: Record<GraphNode["type"], number> = {
  stock: 0,
  supplier: 1,
  customer: 1.1,
  partner: 0.7,
  equity: 0.6,
  government: 1.3,
  macro: 1.35,
};

const SIGN: Record<Signal, number> = { positive: 1, negative: -1, neutral: 0 };

/** Orchestrates Steps 2-5 of the pipeline and returns the full analysis. */
export async function analyzeStock(
  graph: StockGraph,
  horizon: TimeHorizon = "medium"
): Promise<AnalyzeResponse> {
  const entities = graph.nodes.filter((n) => n.type !== "stock");
  const profiler = createProfiler(profileEnabled());

  const researchStart = performance.now();
  const [newsByEntity, directCompanyNews] = await Promise.all([
    (async () => {
      const serpStart = performance.now();
      const result = await fetchAllEntityNewsParallel(entities, horizon, graph, profiler);
      profiler?.setSerpWall(performance.now() - serpStart);
      return result;
    })(),
    (async () => {
      const yahooStart = performance.now();
      const result = await fetchDirectCompanyNews(graph.ticker, horizon);
      profiler?.setYahoo(performance.now() - yahooStart);
      return result;
    })(),
  ]);
  const researchMs = Math.round(performance.now() - researchStart);

  const evalStart = performance.now();
  const impacts = await Promise.all(
    entities.map((node) =>
      evaluateEntity(graph, node, newsByEntity.get(node.id) ?? [], horizon, profiler)
    )
  );
  const entityEvalMs = Math.round(performance.now() - evalStart);

  const verdictStart = performance.now();
  const verdict = await buildVerdict(
    graph,
    impacts,
    horizon,
    directCompanyNews,
    profiler
  );
  const verdictMs = Math.round(performance.now() - verdictStart);

  profiler?.finalize(graph.ticker, {
    researchMs,
    entityEvalMs,
    verdictMs,
  });

  return {
    ticker: graph.ticker,
    generatedAt: new Date().toISOString(),
    horizon,
    verdict,
    impacts,
    directCompanyNews,
  };
}

interface SerpTask {
  node: GraphNode;
  layer: SerpLayerSpec;
  query: string;
}

/** SERP query tuned by node type — macro themes use ticker + channel, not company-name news. */
function serpQueryForNode(graph: StockGraph, node: GraphNode): string {
  if (node.type === "macro") {
    return `${graph.ticker} ${node.name}`;
  }
  return `"${node.name}" stock news`;
}

const HORIZON_MAX_AGE_HOURS: Record<TimeHorizon, number> = {
  immediate: 24,
  medium: 60 * 24,
  long: 365 * 24,
};

/** Yahoo headlines about the ticker itself — filtered to the selected horizon window. */
async function fetchDirectCompanyNews(
  ticker: string,
  horizon: TimeHorizon
): Promise<Citation[]> {
  const raw = await fetchCompanyNews(ticker, 10);
  const maxAge = HORIZON_MAX_AGE_HOURS[horizon];

  return raw
    .filter((n) => hoursAgo(n.publishedAt) <= maxAge)
    .slice(0, 8)
    .map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      snippet: n.snippet,
      weight: 0.85,
    }));
}

/**
 * Flatten (entity × layer) into one task list and await all SERP calls together.
 * Medium horizon = 2× entities calls; long = 3× — all concurrent, no sequential awaits.
 */
async function fetchAllEntityNewsParallel(
  entities: GraphNode[],
  horizon: TimeHorizon,
  graph: StockGraph,
  profiler: PipelineProfiler | null
): Promise<Map<string, NewsItem[]>> {
  const layerSpecs = buildSerpLayers();
  const layerIds = layersForHorizon(horizon);

  const tasks: SerpTask[] = entities.flatMap((node) =>
    layerIds.map((id) => ({
      node,
      layer: layerSpecs[id],
      query: serpQueryForNode(graph, node),
    }))
  );

  const serpResults = await Promise.all(
    tasks.map(async ({ node, layer, query }) => {
      const start = performance.now();
      const raw = await serpNews(query, {
        tbs: layer.tbs,
        num: layer.num,
        entityName: node.name,
      });
      profiler?.recordSerp(`${node.name} · ${layer.id}`, performance.now() - start);
      const gated = filterNewsToLayer(dedupeNews(raw), layer);
      return { nodeId: node.id, layerId: layer.id, items: gated };
    })
  );

  const byEntity = new Map<string, { layer: NewsLayerId; items: NewsItem[] }[]>();

  for (const { nodeId, layerId, items } of serpResults) {
    const list = byEntity.get(nodeId) ?? [];
    list.push({ layer: layerId, items });
    byEntity.set(nodeId, list);
  }

  const merged = new Map<string, NewsItem[]>();
  for (const [nodeId, buckets] of byEntity) {
    merged.set(nodeId, mergeLayeredNews(buckets, horizon));
  }

  return merged;
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    if (!item.title) continue;
    const key = normalize(item.title) + "|" + hostOf(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Combined importance: editorial weight + recency (urgency). Higher = first. */
function citationImportance(n: NewsItem): number {
  const weight = n.weight ?? 0.3;
  const recency = Math.max(0, 1 - hoursAgo(n.publishedAt) / 720);
  return weight * 2 + recency;
}

function toCitations(news: NewsItem[]): Citation[] {
  return [...news]
    .sort((a, b) => citationImportance(b) - citationImportance(a))
    .slice(0, 6)
    .map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      snippet: n.snippet,
      weight: n.weight,
    }));
}

function reasoningBlock(horizon: TimeHorizon): string {
  return HORIZON_REASONING_WEIGHTS[horizon];
}

async function evaluateEntity(
  graph: StockGraph,
  node: GraphNode,
  news: NewsItem[],
  horizon: TimeHorizon,
  profiler: PipelineProfiler | null
): Promise<EntityImpact> {
  const citations = toCitations(news);
  const h = HORIZONS[horizon];

  if (llmConfigured() && news.length > 0) {
    try {
      const isMacro = node.type === "macro";
      const kimiStart = performance.now();
      const text = await kimiChat(
        [
          {
            role: "system",
            content: isMacro
              ? "You are a macro equity analyst. Given a target stock and a macro/geopolitical risk channel, decide how recent news on this theme is likely to affect the TARGET stock directly (not through a supplier or customer), over the requested TIME HORIZON. Respond with strict JSON only."
              : "You are a financial relationship analyst. Given a target stock, a connected entity, and recent news about that entity, decide how the news is likely to affect the TARGET stock through the stated relationship, over the requested TIME HORIZON. Respond with strict JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              targetStock: { ticker: graph.ticker, name: graph.name },
              entity: { name: node.name, type: node.type, relationship: node.relationship },
              timeHorizon: { label: h.label, window: h.range, meaning: h.description },
              contextWeights: reasoningBlock(horizon),
              news: news.map((n) => ({
                title: n.title,
                snippet: n.snippet,
                source: n.source,
                publishedAt: n.publishedAt,
              })),
              instructions:
                reasoningBlock(horizon) +
                " Return {\"signal\":\"positive|negative|neutral\",\"strength\":\"low|moderate|high\",\"summary\":\"<=2 sentences explaining the ripple to the target stock over this horizon\"}. Do not estimate price moves or percentages.",
            }),
          },
        ],
        { json: true }
      );
      profiler?.recordKimi(node.name, performance.now() - kimiStart);
      const parsed = parseJsonResponse<{
        signal: Signal;
        strength?: ImpactStrength | string;
        magnitude?: number;
        summary: string;
      }>(text);
      return {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        signal: parsed.signal ?? "neutral",
        strength: parsed.strength
          ? parseStrength(parsed.strength)
          : strengthFromNumber(parsed.magnitude ?? 0),
        summary: parsed.summary ?? "",
        citations,
      };
    } catch {
      // Fall through to deterministic scoring on any model/parse error.
    }
  }

  return mockEvaluate(node, news, citations);
}

function mockEvaluate(node: GraphNode, news: NewsItem[], citations: Citation[]): EntityImpact {
  let score = 0;
  let topWeight = 0;
  for (const n of news) {
    const w = n.weight ?? 0.3;
    score += SIGN[n.sentiment ?? "neutral"] * w;
    topWeight = Math.max(topWeight, w);
  }
  const signal: Signal = score > 0.05 ? "positive" : score < -0.05 ? "negative" : "neutral";
  const strength = strengthFromNumber(topWeight);

  const lead = news[0];
  const directionWord =
    signal === "positive" ? "supports" : signal === "negative" ? "pressures" : "is neutral for";
  const summary = lead
    ? `${node.name} news (${directionWord} the stock): ${lead.title}.`
    : `No material ${node.name} news in the window.`;

  return { nodeId: node.id, name: node.name, type: node.type, signal, strength, summary, citations };
}

async function buildVerdict(
  graph: StockGraph,
  impacts: EntityImpact[],
  horizon: TimeHorizon,
  directCompanyNews: Citation[] = [],
  profiler: PipelineProfiler | null = null
): Promise<StockVerdict> {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const mostAffected = [...impacts].sort((a, b) => compareStrength(a.strength, b.strength))[0];
  const h = HORIZONS[horizon];

  if (llmConfigured()) {
    try {
      const verdictStart = performance.now();
      const text = await kimiChat(
        [
          {
            role: "system",
            content:
              `You are a senior equity analyst. Combine per-entity impact assessments into one verdict for the target stock over the ${h.label} horizon (${h.range}: ${h.description}). Respond with strict JSON only.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              targetStock: { ticker: graph.ticker, name: graph.name },
              timeHorizon: { label: h.label, window: h.range, meaning: h.description },
              contextWeights: reasoningBlock(horizon),
              directCompanyNews: directCompanyNews.map((n) => ({
                title: n.title,
                snippet: n.snippet,
                source: n.source,
                publishedAt: n.publishedAt,
              })),
              impacts: impacts.map((i) => ({
                entity: nodeById.get(i.nodeId)?.name,
                type: nodeById.get(i.nodeId)?.type,
                relationship: nodeById.get(i.nodeId)?.relationship,
                signal: i.signal,
                strength: i.strength,
                summary: i.summary,
              })),
              instructions:
                reasoningBlock(horizon) +
                " Weight directCompanyNews heavily — these are idiosyncratic catalysts on the stock itself. " +
                ` Timeframe should reflect "${h.timeframe}". ` +
                "Return {\"signal\":\"positive|negative|neutral\",\"strength\":\"low|moderate|high\",\"timeframe\":\"<horizon timeframe>\",\"rationale\":\"<=2 sentences summary\",\"explanation\":\"3-5 sentences explaining WHY the stock is likely to rise or fall overall — investor-friendly prose\",\"bullishDrivers\":[\"<=12 words each, max 4\"],\"bearishDrivers\":[\"<=12 words each, max 4\"],\"mostAffectedEntity\":\"<entity or macro channel name>\"}. Do not estimate price moves, percentages, or confidence scores.",
            }),
          },
        ],
        { json: true }
      );
      profiler?.setVerdict(performance.now() - verdictStart);
      const parsed = parseJsonResponse<{
        signal: Signal;
        strength?: ImpactStrength | string;
        confidence?: number;
        timeframe: string;
        rationale: string;
        explanation?: string;
        bullishDrivers?: string[];
        bearishDrivers?: string[];
        mostAffectedEntity?: string;
      }>(text);
      const matchedId =
        graph.nodes.find((n) => n.name === parsed.mostAffectedEntity)?.id ??
        mostAffected?.nodeId ??
        "";
      return {
        signal: parsed.signal ?? "neutral",
        strength: parsed.strength
          ? parseStrength(parsed.strength)
          : strengthFromNumber(parsed.confidence ?? 0.5),
        timeframe: parsed.timeframe ?? h.timeframe,
        rationale: parsed.rationale ?? "",
        explanation: parsed.explanation ?? parsed.rationale ?? "",
        bullishDrivers: parsed.bullishDrivers?.filter(Boolean) ?? [],
        bearishDrivers: parsed.bearishDrivers?.filter(Boolean) ?? [],
        mostAffectedNodeId: matchedId,
      };
    } catch {
      // Fall through to deterministic verdict.
    }
  }

  return mockVerdict(graph, impacts, mostAffected, horizon);
}

const HORIZON_STRENGTH_BIAS: Record<TimeHorizon, number> = {
  immediate: 1,
  medium: 0.88,
  long: 0.72,
};

function mockVerdict(
  graph: StockGraph,
  impacts: EntityImpact[],
  mostAffected: EntityImpact | undefined,
  horizon: TimeHorizon
): StockVerdict {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  let net = 0;
  for (const i of impacts) {
    const type = nodeById.get(i.nodeId)?.type ?? "partner";
    net += SIGN[i.signal] * STRENGTH_SCORE[i.strength] * TYPE_WEIGHT[type];
  }

  const signal: Signal = net > 0.25 ? "positive" : net < -0.25 ? "negative" : "neutral";
  const abs = Math.abs(net);
  const strength = strengthFromNumber(
    (0.35 + Math.min(abs / 4, 0.45)) * HORIZON_STRENGTH_BIAS[horizon]
  );

  const drivers = [...impacts]
    .filter((i) => i.signal !== "neutral")
    .sort((a, b) => compareStrength(a.strength, b.strength))
    .slice(0, 3)
    .map((i) => `${nodeById.get(i.nodeId)?.name} (${i.signal})`);

  const bullishDrivers = [...impacts]
    .filter((i) => i.signal === "positive")
    .sort((a, b) => compareStrength(a.strength, b.strength))
    .slice(0, 4)
    .map((i) => `${nodeById.get(i.nodeId)?.name}: ${i.summary.split(".")[0]}.`);

  const bearishDrivers = [...impacts]
    .filter((i) => i.signal === "negative")
    .sort((a, b) => compareStrength(a.strength, b.strength))
    .slice(0, 4)
    .map((i) => `${nodeById.get(i.nodeId)?.name}: ${i.summary.split(".")[0]}.`);

  const rationale =
    drivers.length > 0
      ? `Over the ${HORIZONS[horizon].label.toLowerCase()} horizon, net connected-entity news leans ${signal}. Key drivers: ${drivers.join(", ")}.`
      : "No material news across the connected landscape; expect little ripple.";

  const direction =
    signal === "positive" ? "rise" : signal === "negative" ? "fall" : "move sideways";
  const explanation =
    drivers.length > 0
      ? `Over the ${HORIZONS[horizon].label.toLowerCase()} horizon, connected-entity news suggests ${graph.ticker} is likely to ${direction}. ` +
        `Positive ripples from ${bullishDrivers.length ? bullishDrivers.slice(0, 2).map((d) => d.split(":")[0]).join(" and ") : "few entities"} ` +
        `${bearishDrivers.length ? `are partly offset by pressure from ${bearishDrivers.slice(0, 2).map((d) => d.split(":")[0]).join(" and ")}.` : "dominate the landscape."}`
      : rationale;

  return {
    signal,
    strength,
    timeframe: HORIZONS[horizon].timeframe,
    rationale,
    explanation,
    bullishDrivers,
    bearishDrivers,
    mostAffectedNodeId: mostAffected?.nodeId ?? "",
  };
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
