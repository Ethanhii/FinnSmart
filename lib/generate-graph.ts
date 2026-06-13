import type { GraphNode, NodeType, StockGraph } from "@/lib/types";
import { kimiChat, llmConfigured, parseJsonResponse } from "@/lib/integrations/kimi";

const CATEGORIES: NodeType[] = ["supplier", "customer", "partner", "equity", "government"];

function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "entity";
}

/** Generate a relationship map for a stock via parallel Kimi calls (one per category). */
export async function generateGraph(ticker: string, name: string): Promise<StockGraph> {
  if (!llmConfigured()) {
    throw new Error(
      "Set KIMI_API_KEY or TOKEN_ROUTER_API_KEY to generate relationship maps."
    );
  }

  const sym = ticker.toUpperCase();
  const lists = await Promise.all(
    CATEGORIES.map(async (category) => {
      const text = await kimiChat(
        [
          {
            role: "system",
            content:
              "You are an equity research analyst mapping a company's business relationships. Respond with strict JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              company: { ticker: sym, name },
              category,
              instructions:
                'List the 3-5 strongest, real, verifiable entities in this category. Return {"items":[{"name":"","ticker":"optional","relationship":"one line"}]}.',
            }),
          },
        ],
        { json: true }
      );
      const parsed = parseJsonResponse<{
        items: { name: string; ticker?: string; relationship: string }[];
      }>(text);
      return { category, items: parsed.items ?? [] };
    })
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
    description: `${name} ecosystem — suppliers, customers, partners, holdings, and regulators.`,
    nodes,
    edges,
  };
}
