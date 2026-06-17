/**
 * Time relationship-map generation (single Kimi call).
 *
 * Usage:
 *   npx tsx scripts/benchmark-graph.ts MSFT
 *   npm run benchmark:graph -- CRM
 */
import { readFileSync, existsSync, unlinkSync } from "fs";
import path from "path";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

async function main(): Promise<void> {
  const ticker = (process.argv[2]?.trim() || "MSFT").toUpperCase();
  const { generateGraph } = await import("@/lib/generate-graph");
  const { llmConfigured, KIMI_GRAPH_MODEL } = await import("@/lib/config");
  const { resolveStock } = await import("@/lib/integrations/yahoo");

  if (!llmConfigured()) {
    console.error("LLM not configured. Set KIMI_API_KEY in .env.local");
    process.exit(1);
  }

  const cachePath = path.join(process.cwd(), "data", "graphs", `${ticker}.json`);
  if (existsSync(cachePath)) {
    unlinkSync(cachePath);
    console.log(`Removed cached graph: ${cachePath}`);
  }

  const quote = await resolveStock(ticker);
  const name = quote?.name ?? ticker;

  console.log("Graph generation benchmark (1 Kimi call)");
  console.log("──────────────────────────────────────────");
  console.log(`Ticker: ${ticker} (${name})`);
  console.log(`Model:  ${KIMI_GRAPH_MODEL} (graph)\n`);

  const start = performance.now();
  const graph = await generateGraph(ticker, name);
  const elapsedMs = Math.round(performance.now() - start);

  const byType = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Elapsed: ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} s)`);
  console.log(`Nodes:   ${graph.nodes.length}  Edges: ${graph.edges.length}`);
  console.log("By type:", byType);
  console.log("\nSample entities:");
  for (const n of graph.nodes.filter((x) => x.type !== "stock").slice(0, 6)) {
    console.log(`  · ${n.type}: ${n.name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
