/**
 * CLI helper — generate and persist a relationship map for any ticker.
 *
 * Usage:  npx tsx scripts/generateGraph.ts MSFT
 */
import { getOrGenerateGraph } from "@/lib/graphs";
import { resolveStock } from "@/lib/integrations/yahoo";

export { generateGraph } from "@/lib/generate-graph";

async function main() {
  const ticker = process.argv[2]?.trim();
  if (!ticker) {
    console.error("Usage: npx tsx scripts/generateGraph.ts TICKER");
    process.exit(1);
  }

  const quote = await resolveStock(ticker);
  const name = quote?.name ?? ticker.toUpperCase();
  console.log(`Generating map for ${ticker.toUpperCase()} (${name})…`);

  const graph = await getOrGenerateGraph(ticker, name);
  console.log(
    `Saved ${graph.nodes.length} nodes / ${graph.edges.length} edges → data/graphs/${graph.ticker}.json`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
