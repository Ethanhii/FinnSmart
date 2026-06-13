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
import { kimiChat, llmConfigured, parseJsonResponse } from "@/lib/integrations/kimi";

/** Relationship-type weighting: how much an entity's news matters to the stock. */
const TYPE_WEIGHT: Record<GraphNode["type"], number> = {
  stock: 0,
  supplier: 1,
  customer: 1.1,
  partner: 0.7,
  equity: 0.6,
  government: 1.3,
};

const SIGN: Record<Signal, number> = { positive: 1, negative: -1, neutral: 0 };

/** Orchestrates Steps 2-5 of the pipeline and returns the full analysis. */
export async function analyzeStock(
  graph: StockGraph,
  horizon: TimeHorizon = "short"
): Promise<AnalyzeResponse> {
  const entities = graph.nodes.filter((n) => n.type !== "stock");
  const serpRange = HORIZONS[horizon].serpRange;

  // Step 2: fetch news for every entity in parallel (all Bright Data calls at once).
  const researched = await Promise.all(
    entities.map(async (node) => {
      const raw = await serpNews(`"${node.name}" stock news`, {
        timeRange: serpRange,
        num: 10,
        entityName: node.name,
      });
      return { node, news: dedupeNews(raw) };
    })
  );

  // Step 4: evaluate every entity in parallel (after all research completes).
  const impacts = await Promise.all(
    researched.map(({ node, news }) => evaluateEntity(graph, node, news, horizon))
  );

  // Step 5: combine every entity into a final verdict for the stock.
  const verdict = await buildVerdict(graph, impacts, horizon);

  return {
    ticker: graph.ticker,
    generatedAt: new Date().toISOString(),
    horizon,
    verdict,
    impacts,
  };
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

/** Hours since publication; smaller = more urgent. Unknown dates rank mid. */
function hoursAgo(publishedAt?: string): number {
  if (!publishedAt) return 240;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 240;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

/** Combined importance: editorial weight + recency (urgency). Higher = first. */
function citationImportance(n: NewsItem): number {
  const weight = n.weight ?? 0.3;
  const recency = Math.max(0, 1 - hoursAgo(n.publishedAt) / 720); // ~30d window
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

async function evaluateEntity(
  graph: StockGraph,
  node: GraphNode,
  news: NewsItem[],
  horizon: TimeHorizon
): Promise<EntityImpact> {
  const citations = toCitations(news);
  const h = HORIZONS[horizon];

  if (llmConfigured() && news.length > 0) {
    try {
      const text = await kimiChat(
        [
          {
            role: "system",
            content:
              "You are a financial relationship analyst. Given a target stock, a connected entity, and recent news about that entity, decide how the news is likely to affect the TARGET stock through the stated relationship, over the requested TIME HORIZON. Respond with strict JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              targetStock: { ticker: graph.ticker, name: graph.name },
              entity: { name: node.name, type: node.type, relationship: node.relationship },
              timeHorizon: { label: h.label, window: h.range, meaning: h.description },
              news: news.map((n) => ({ title: n.title, snippet: n.snippet, source: n.source })),
              instructions:
                `Judge impact specifically over the ${h.label} horizon (${h.range}: ${h.description}). ` +
                "Return {\"signal\":\"positive|negative|neutral\",\"magnitude\":0..1,\"summary\":\"<=2 sentences explaining the ripple to the target stock over this horizon\"}.",
            }),
          },
        ],
        { json: true }
      );
      const parsed = parseJsonResponse<{ signal: Signal; magnitude: number; summary: string }>(text);
      return {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        signal: parsed.signal ?? "neutral",
        magnitude: clamp(parsed.magnitude ?? 0),
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
  let weightSum = 0;
  let topWeight = 0;
  for (const n of news) {
    const w = n.weight ?? 0.3;
    score += SIGN[n.sentiment ?? "neutral"] * w;
    weightSum += w;
    topWeight = Math.max(topWeight, w);
  }
  const signal: Signal = score > 0.05 ? "positive" : score < -0.05 ? "negative" : "neutral";
  const magnitude = clamp(topWeight);

  const lead = news[0];
  const directionWord =
    signal === "positive" ? "supports" : signal === "negative" ? "pressures" : "is neutral for";
  const summary = lead
    ? `${node.name} news (${directionWord} the stock): ${lead.title}.`
    : `No material ${node.name} news in the window.`;

  return { nodeId: node.id, name: node.name, type: node.type, signal, magnitude, summary, citations };
}

async function buildVerdict(
  graph: StockGraph,
  impacts: EntityImpact[],
  horizon: TimeHorizon
): Promise<StockVerdict> {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const mostAffected = [...impacts].sort((a, b) => b.magnitude - a.magnitude)[0];
  const h = HORIZONS[horizon];

  if (llmConfigured()) {
    try {
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
              impacts: impacts.map((i) => ({
                entity: nodeById.get(i.nodeId)?.name,
                relationship: nodeById.get(i.nodeId)?.relationship,
                signal: i.signal,
                magnitude: i.magnitude,
                summary: i.summary,
              })),
              instructions:
                `Reason about the ${h.label} horizon. The expectedMove should be sized appropriately for that horizon and timeframe should reflect "${h.timeframe}". ` +
                "Return {\"signal\":\"positive|negative|neutral\",\"confidence\":0..1,\"expectedMove\":\"e.g. +1% to +3%\",\"timeframe\":\"<horizon timeframe>\",\"rationale\":\"<=2 sentences summary\",\"explanation\":\"3-5 sentences explaining WHY the stock is likely to rise or fall overall through its connected landscape — clear, investor-friendly prose\",\"bullishDrivers\":[\"<=12 words each, max 4\"],\"bearishDrivers\":[\"<=12 words each, max 4\"],\"mostAffectedEntity\":\"<entity name>\"}.",
            }),
          },
        ],
        { json: true }
      );
      const parsed = parseJsonResponse<{
        signal: Signal;
        confidence: number;
        expectedMove: string;
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
        confidence: clamp(parsed.confidence ?? 0.5),
        expectedMove: parsed.expectedMove ?? "flat",
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

/** Expected-move ranges scale with the horizon so the verdict visibly shifts. */
const MOVE_RANGES: Record<TimeHorizon, { small: string; large: string }> = {
  immediate: { small: "0.5% to 2%", large: "2% to 5%" },
  short: { small: "1% to 3%", large: "3% to 8%" },
  medium: { small: "3% to 8%", large: "8% to 20%" },
  long: { small: "5% to 15%", large: "15% to 40%" },
};

/** Longer horizons carry more uncertainty. */
const HORIZON_CONFIDENCE: Record<TimeHorizon, number> = {
  immediate: 1,
  short: 0.95,
  medium: 0.85,
  long: 0.7,
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
    net += SIGN[i.signal] * i.magnitude * TYPE_WEIGHT[type];
  }

  const signal: Signal = net > 0.25 ? "positive" : net < -0.25 ? "negative" : "neutral";
  const abs = Math.abs(net);
  const confidence = clamp((0.45 + Math.min(abs / 4, 0.45)) * HORIZON_CONFIDENCE[horizon]);

  const range = MOVE_RANGES[horizon];
  let expectedMove = "roughly flat";
  if (signal === "positive") expectedMove = `+${abs > 1.2 ? range.large : range.small}`;
  if (signal === "negative") expectedMove = `-${abs > 1.2 ? range.large : range.small}`;

  const drivers = [...impacts]
    .filter((i) => i.signal !== "neutral")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 3)
    .map((i) => `${nodeById.get(i.nodeId)?.name} (${i.signal})`);

  const bullishDrivers = [...impacts]
    .filter((i) => i.signal === "positive")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4)
    .map((i) => `${nodeById.get(i.nodeId)?.name}: ${i.summary.split(".")[0]}.`);

  const bearishDrivers = [...impacts]
    .filter((i) => i.signal === "negative")
    .sort((a, b) => b.magnitude - a.magnitude)
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
      ? `Over the ${HORIZONS[horizon].label.toLowerCase()} horizon, connected-entity news suggests ${graph.ticker} is likely to ${direction} (${expectedMove}). ` +
        `Positive ripples from ${bullishDrivers.length ? bullishDrivers.slice(0, 2).map((d) => d.split(":")[0]).join(" and ") : "few entities"} ` +
        `${bearishDrivers.length ? `are partly offset by pressure from ${bearishDrivers.slice(0, 2).map((d) => d.split(":")[0]).join(" and ")}.` : "dominate the landscape."}`
      : rationale;

  return {
    signal,
    confidence,
    expectedMove,
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
