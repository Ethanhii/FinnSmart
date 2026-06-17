/**
 * Time a single Bright Data SERP call — same path as lib/integrations/brightdata.ts.
 *
 * Usage:
 *   npx tsx scripts/benchmark-brightdata.ts
 *   npx tsx scripts/benchmark-brightdata.ts Qualcomm
 *   npm run benchmark:serp -- Foxconn
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

/** Load .env.local into process.env before any @/lib imports (config reads env at load time). */
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
  const { serpNews } = await import("@/lib/integrations/brightdata");
  const { brightDataConfigured } = await import("@/lib/config");

  const company = process.argv[2]?.trim() || "Apple";
  const query = `"${company}" stock news`;

  if (!brightDataConfigured()) {
    console.error(
      "Bright Data not configured. Set BRIGHTDATA_API_KEY and BRIGHTDATA_ZONE in .env.local"
    );
    process.exit(1);
  }

  console.log("Bright Data single SERP benchmark");
  console.log("─────────────────────────────────");
  console.log(`Query:  ${query}`);
  console.log(`Mode:   Google News (tbm=nws), num=5, tbs=qdr:d`);
  console.log("Calling api.brightdata.com/request …\n");

  const start = performance.now();
  const results = await serpNews(query, {
    num: 5,
    timeRange: "d",
    entityName: company,
  });
  const elapsedMs = Math.round(performance.now() - start);

  console.log(`Elapsed: ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} s)`);
  console.log(`Results: ${results.length} articles\n`);

  for (const [i, item] of results.entries()) {
    console.log(`${i + 1}. ${item.title}`);
    console.log(`   ${item.url}`);
    if (item.source) console.log(`   Source: ${item.source}`);
    if (item.publishedAt) console.log(`   Published: ${item.publishedAt}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
