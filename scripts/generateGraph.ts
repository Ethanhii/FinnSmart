/**
 * Step 1 — Relationship graph generation (pre-built before the demo).
 *
 * This is a stub documenting how the per-stock relationship maps in
 * `data/graphs/*.json` are produced by a Kimi research swarm. For the
 * prototype the three demo graphs are hand-curated; once a Kimi key is set
 * this script can regenerate/extend them.
 *
 * Intended flow:
 *   1. For a target ticker, ask Kimi to enumerate the company's key
 *      suppliers, customers/distributors, partners, equity holdings and
 *      relevant governments/regulators (the "swarm" can run one call per
 *      relationship category in parallel for breadth + recall).
 *   2. Ask Kimi to de-duplicate and rank each list, keeping the strongest,
 *      best-verified relationships with a one-line description each.
 *   3. Emit a StockGraph (see lib/types.ts) and write it to
 *      data/graphs/<ticker>.json.
 *
 * Run (once implemented):  npx tsx scripts/generateGraph.ts NVDA
 */
import type { StockGraph } from "@/lib/types";
import { kimiChat, kimiConfigured, parseJsonResponse } from "@/lib/integrations/kimi";

const CATEGORIES = ["supplier", "customer", "partner", "equity", "government"] as const;

export async function generateGraph(ticker: string, name: string): Promise<StockGraph> {
  if (!kimiConfigured()) {
    throw new Error("Set KIMI_API_KEY to generate graphs. Demo uses data/graphs/*.json.");
  }

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
              company: { ticker, name },
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

  const stockId = ticker.toLowerCase();
  const nodes: StockGraph["nodes"] = [
    { id: stockId, name, ticker, type: "stock", relationship: "Your stock" },
  ];
  const edges: StockGraph["edges"] = [];

  lists.forEach(({ category, items }) => {
    items.forEach((item, i) => {
      const id = `${category}_${i}_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
      nodes.push({ id, name: item.name, ticker: item.ticker, type: category, relationship: item.relationship });
      if (category === "equity") {
        edges.push({ id: `e_${id}`, source: stockId, target: id, relationType: "holds equity in" });
      } else {
        edges.push({ id: `e_${id}`, source: id, target: stockId, relationType: item.relationship });
      }
    });
  });

  return { ticker, name, description: `${name} relationship map.`, nodes, edges };
}
