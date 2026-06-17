import type { GraphNode, NodeType, StockGraph } from "@/lib/types";
import { kimiChat, llmConfigured, parseJsonResponse } from "@/lib/integrations/kimi";

const ENTITY_CATEGORIES: NodeType[] = [
  "supplier",
  "customer",
  "partner",
  "equity",
  "government",
];

const ENTITY_RESEARCH_SYSTEM_PROMPT =
  "You are an equity research analyst mapping a company's most important real-world business relationships for someone learning how markets work. " +
  "Prioritize relationships where: (1) the dependency is significant and visible, (2) news about the connected entity would clearly impact this stock. " +
  "Respond with strict JSON only.";

const ENTITY_RESEARCH_INSTRUCTIONS =
  'List the 3-5 strongest, real, verifiable entities in this category. ' +
  'Return {"items":[{"name":"","ticker":"optional","relationship":""}]}. ' +
  'For each item, relationship must be one concrete sentence explaining what this entity provides or receives, and why disruption to them would matter to this stock ' +
  '(e.g. for a supplier: "This is the largest distributor of chips to NVIDIA — any supply constraint or pricing shift here flows directly into GPU availability and margins.").';

const MACRO_RESEARCH_SYSTEM_PROMPT =
  "You are an equity research analyst mapping macro and geopolitical risk channels that can move a stock directly — not through a specific supplier, customer, or partner. " +
  "Focus on world events, policy, and sector-wide forces where headlines would hit the target company itself. Respond with strict JSON only.";

const MACRO_RESEARCH_INSTRUCTIONS =
  'List the 3-5 most important macro/geopolitical channels that could move this stock directly. ' +
  "Examples: presidential statements naming the company, trade wars/export controls/tariffs on the sector, war or geopolitical tension affecting the industry, broad AI or tech regulation, market-wide sector sentiment shifts. " +
  'Return {"items":[{"name":"short theme label","relationship":""}]}. ' +
  'For each item, relationship must be one concrete sentence explaining how this macro channel transmits to the stock ' +
  '(e.g. "US export controls on advanced AI chips to China directly cap a major revenue pool for NVIDIA."). Do not list specific companies — name themes or policy channels only.';

function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "entity";
}

async function fetchCategoryItems(
  sym: string,
  name: string,
  category: NodeType
): Promise<{ category: NodeType; items: { name: string; ticker?: string; relationship: string }[] }> {
  const isMacro = category === "macro";
  const text = await kimiChat(
    [
      {
        role: "system",
        content: isMacro ? MACRO_RESEARCH_SYSTEM_PROMPT : ENTITY_RESEARCH_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          company: { ticker: sym, name },
          category,
          instructions: isMacro ? MACRO_RESEARCH_INSTRUCTIONS : ENTITY_RESEARCH_INSTRUCTIONS,
        }),
      },
    ],
    { json: true }
  );
  const parsed = parseJsonResponse<{
    items: { name: string; ticker?: string; relationship: string }[];
  }>(text);
  return { category, items: parsed.items ?? [] };
}

/** Generate a relationship map for a stock via parallel Kimi calls (one per category). */
export async function generateGraph(ticker: string, name: string): Promise<StockGraph> {
  if (!llmConfigured()) {
    throw new Error(
      "Set KIMI_API_KEY or TOKEN_ROUTER_API_KEY to generate relationship maps."
    );
  }

  const sym = ticker.toUpperCase();
  const allCategories: NodeType[] = [...ENTITY_CATEGORIES, "macro"];

  const lists = await Promise.all(
    allCategories.map((category) => fetchCategoryItems(sym, name, category))
  );

  const stockId = sym.toLowerCase();
  const nodes: GraphNode[] = [
    { id: stockId, name, ticker: sym, type: "stock", relationship: "Your stock" },
  ];
  const edges: StockGraph["edges"] = [];
  const usedIds = new Set<string>([stockId]);

  lists.forEach(({ category, items }) => {
    items.forEach((item) => {
      if (!item.name?.trim()) return;

      let base = `${category}_${slugId(item.name)}`;
      let id = base;
      let n = 1;
      while (usedIds.has(id)) {
        id = `${base}_${n++}`;
      }
      usedIds.add(id);

      nodes.push({
        id,
        name: item.name.trim(),
        ticker: item.ticker?.trim() || undefined,
        type: category,
        relationship: item.relationship?.trim() || category,
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
          relationType: item.relationship?.trim() || category,
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
