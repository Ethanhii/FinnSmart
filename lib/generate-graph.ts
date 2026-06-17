import type { GraphNode, NodeType, StockGraph } from "@/lib/types";
import { kimiGraphChat, llmConfigured, parseJsonResponse } from "@/lib/integrations/kimi";

/** Max entities per category — keeps the map focused and the LLM response small/fast. */
const MAX_PER_CATEGORY = 3;

const CATEGORY_KEYS = [
  "suppliers",
  "customers",
  "partners",
  "equity",
  "government",
  "macro",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

const KEY_TO_TYPE: Record<CategoryKey, NodeType> = {
  suppliers: "supplier",
  customers: "customer",
  partners: "partner",
  equity: "equity",
  government: "government",
  macro: "macro",
};

interface EntityItem {
  name: string;
  ticker?: string;
  relationship: string;
}

type GraphResearchPayload = Record<CategoryKey, EntityItem[]>;

const GRAPH_SYSTEM_PROMPT =
  "You are an equity research analyst. Map a company's key business relationships in one JSON object. " +
  "Use real, verifiable names only. Keep relationship fields to one short sentence each. " +
  "Respond with strict JSON only — no markdown.";

const GRAPH_USER_TEMPLATE = (sym: string, name: string) =>
  JSON.stringify({
    company: { ticker: sym, name },
    task: "Return all six relationship buckets in a single JSON object.",
    limits: `At most ${MAX_PER_CATEGORY} items per bucket.`,
    schema: {
      suppliers: '[{"name":"","ticker":"optional","relationship":"why they matter to the stock"}]',
      customers: "same shape",
      partners: "same shape",
      equity: "same shape — stakes or strategic investments",
      government:
        '[{"name":"regulator or government body","relationship":"how policy affects the stock"}]',
      macro:
        '[{"name":"short theme label — not a company","relationship":"how this macro channel hits the stock directly"}]',
    },
    rules: [
      "suppliers/customers/partners/equity: name specific companies or institutions",
      "government: regulators and government bodies only",
      "macro: themes only (tariffs, export controls, sector sentiment) — no company names",
      "relationship: one concrete sentence per item",
    ],
  });

function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "entity";
}

function normalizeItems(raw: unknown): EntityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is EntityItem => Boolean(item && typeof item === "object"))
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      ticker: item.ticker?.trim() || undefined,
      relationship: String(item.relationship ?? "").trim(),
    }))
    .filter((item) => item.name.length > 0)
    .slice(0, MAX_PER_CATEGORY);
}

async function fetchAllCategories(
  sym: string,
  name: string
): Promise<{ category: NodeType; items: EntityItem[] }[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await kimiGraphChat([
          { role: "system", content: GRAPH_SYSTEM_PROMPT },
          { role: "user", content: GRAPH_USER_TEMPLATE(sym, name) },
        ]);

      if (!text.trim()) throw new Error("Empty LLM response");

      const parsed = parseJsonResponse<GraphResearchPayload>(text);

      return CATEGORY_KEYS.map((key) => ({
        category: KEY_TO_TYPE[key],
        items: normalizeItems(parsed[key]),
      }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Graph research failed after retries");
}

/** Generate a relationship map for a stock via a single structured Kimi call. */
export async function generateGraph(ticker: string, name: string): Promise<StockGraph> {
  if (!llmConfigured()) {
    throw new Error(
      "Set KIMI_API_KEY or TOKEN_ROUTER_API_KEY to generate relationship maps."
    );
  }

  const sym = ticker.toUpperCase();
  const lists = await fetchAllCategories(sym, name);

  const stockId = sym.toLowerCase();
  const nodes: GraphNode[] = [
    { id: stockId, name, ticker: sym, type: "stock", relationship: "Your stock" },
  ];
  const edges: StockGraph["edges"] = [];
  const usedIds = new Set<string>([stockId]);

  lists.forEach(({ category, items }) => {
    items.forEach((item) => {
      let base = `${category}_${slugId(item.name)}`;
      let id = base;
      let n = 1;
      while (usedIds.has(id)) {
        id = `${base}_${n++}`;
      }
      usedIds.add(id);

      nodes.push({
        id,
        name: item.name,
        ticker: item.ticker,
        type: category,
        relationship: item.relationship || category,
      });

      if (category === "equity") {
        edges.push({
          id: `e_${id}`,
          source: stockId,
          target: id,
          relationType: "holds equity in",
        });
      } else {
        edges.push({
          id: `e_${id}`,
          source: id,
          target: stockId,
          relationType: item.relationship || category,
        });
      }
    });
  });

  return {
    ticker: sym,
    name,
    description: `${name} ecosystem — suppliers, customers, partners, holdings, regulators, and macro risks.`,
    nodes,
    edges,
  };
}
