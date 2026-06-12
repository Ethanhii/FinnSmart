import type { Signal } from "@/lib/types";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  snippet?: string;
  publishedAt?: string;
  /** Mock-only hints used to synthesize impact without a live model. */
  sentiment?: Signal;
  weight?: number;
}

const h = (n: number) => {
  const d = new Date(Date.now() - n * 60 * 60 * 1000);
  return d.toISOString();
};

/**
 * Curated, realistic-sounding recent headlines per entity, keyed by the exact
 * node name used in the graph JSON. Each item carries a sentiment + weight so
 * the mock pipeline can produce a compelling, deterministic demo. In live mode
 * these are replaced by Bright Data SERP results and scored by Kimi.
 */
export const MOCK_NEWS: Record<string, NewsItem[]> = {
  // ---- Shared / multi-graph entities ----
  TSMC: [
    { title: "TSMC raises 2026 capex on insatiable AI chip demand", url: "https://example.com/tsmc-capex", source: "Reuters", snippet: "The foundry lifted its capital spending outlook, citing AI accelerator orders.", publishedAt: h(6), sentiment: "positive", weight: 0.6 },
    { title: "TSMC Arizona yields reach parity with Taiwan fabs", url: "https://example.com/tsmc-az", source: "Bloomberg", snippet: "US production ramps faster than expected.", publishedAt: h(14), sentiment: "positive", weight: 0.45 },
  ],
  NVIDIA: [
    { title: "NVIDIA next-gen GPU demand outstrips supply, says CEO", url: "https://example.com/nvda-demand", source: "CNBC", snippet: "Management points to multi-quarter backlog.", publishedAt: h(4), sentiment: "positive", weight: 0.7 },
  ],
  "China (Regulators)": [
    { title: "Beijing widens probe into foreign chipmakers", url: "https://example.com/china-probe", source: "FT", snippet: "Regulators signal antitrust and security reviews.", publishedAt: h(8), sentiment: "negative", weight: 0.6 },
    { title: "Domestic AI chip champions gain share in China", url: "https://example.com/china-local", source: "SCMP", snippet: "Local alternatives pressure imported accelerators.", publishedAt: h(20), sentiment: "negative", weight: 0.5 },
  ],
  "US Government": [
    { title: "US tightens export rules on advanced AI chips to China", url: "https://example.com/us-export", source: "WSJ", snippet: "New licensing requirements expand the restricted list.", publishedAt: h(3), sentiment: "negative", weight: 0.85 },
  ],
  "European Union": [
    { title: "EU regulators open fresh compliance review under DMA", url: "https://example.com/eu-dma", source: "Politico", snippet: "Potential fines loom for non-compliance.", publishedAt: h(10), sentiment: "negative", weight: 0.5 },
  ],

  // ---- NVDA suppliers / customers / partners ----
  "SK Hynix": [
    { title: "SK Hynix sells out HBM capacity through 2026", url: "https://example.com/skhynix-hbm", source: "Korea Herald", snippet: "HBM supply locked up by AI GPU makers.", publishedAt: h(7), sentiment: "positive", weight: 0.55 },
  ],
  Micron: [
    { title: "Micron lifts HBM revenue guidance on AI demand", url: "https://example.com/micron-hbm", source: "Reuters", snippet: "Memory maker raises outlook.", publishedAt: h(12), sentiment: "positive", weight: 0.45 },
  ],
  "Samsung Electronics": [
    { title: "Samsung's HBM qualification timeline remains uncertain", url: "https://example.com/samsung-hbm", source: "DigiTimes", snippet: "Mixed signals on advanced memory certification.", publishedAt: h(18), sentiment: "neutral", weight: 0.3 },
  ],
  Microsoft: [
    { title: "Microsoft raises AI capex guidance for the year", url: "https://example.com/msft-capex", source: "Bloomberg", snippet: "Azure buildout accelerates GPU purchases.", publishedAt: h(5), sentiment: "positive", weight: 0.7 },
  ],
  Meta: [
    { title: "Meta boosts capex to expand AI compute clusters", url: "https://example.com/meta-capex", source: "CNBC", snippet: "Zuckerberg commits to aggressive infrastructure spend.", publishedAt: h(9), sentiment: "positive", weight: 0.65 },
  ],
  "Amazon (AWS)": [
    { title: "AWS expands GPU instances amid surging AI workloads", url: "https://example.com/aws-gpu", source: "The Information", snippet: "New regions add accelerator capacity.", publishedAt: h(11), sentiment: "positive", weight: 0.6 },
  ],
  CoreWeave: [
    { title: "CoreWeave signs multi-year GPU cloud expansion", url: "https://example.com/crwv-expand", source: "Reuters", snippet: "Backlog grows with new enterprise deals.", publishedAt: h(13), sentiment: "positive", weight: 0.5 },
  ],
  "Arm Holdings": [
    { title: "Arm touts data-center design wins", url: "https://example.com/arm-dc", source: "EE Times", snippet: "Server roadmap gains traction.", publishedAt: h(22), sentiment: "neutral", weight: 0.3 },
  ],
  "Super Micro": [
    { title: "Super Micro faces renewed accounting questions", url: "https://example.com/smci-audit", source: "WSJ", snippet: "Filing delays raise governance concerns.", publishedAt: h(6), sentiment: "negative", weight: 0.45 },
  ],
  "Dell Technologies": [
    { title: "Dell AI server backlog hits record on GPU demand", url: "https://example.com/dell-ai", source: "Bloomberg", snippet: "Orders for accelerated systems climb.", publishedAt: h(16), sentiment: "positive", weight: 0.45 },
  ],
  "SoundHound AI": [
    { title: "SoundHound expands voice-AI partnerships", url: "https://example.com/soun-deal", source: "Business Wire", snippet: "New automotive and restaurant clients.", publishedAt: h(24), sentiment: "neutral", weight: 0.2 },
  ],

  // ---- AAPL chain ----
  Apple: [
    { title: "Apple services revenue hits new record", url: "https://example.com/aapl-services", source: "CNBC", snippet: "High-margin services keep growing.", publishedAt: h(5), sentiment: "positive", weight: 0.5 },
  ],
  Foxconn: [
    { title: "Foxconn reports steady output ahead of new iPhone cycle", url: "https://example.com/foxconn-output", source: "Nikkei", snippet: "Assembly lines running near capacity.", publishedAt: h(15), sentiment: "neutral", weight: 0.35 },
  ],
  Corning: [
    { title: "Corning unveils tougher cover glass for premium phones", url: "https://example.com/glw-glass", source: "PR Newswire", snippet: "Next-gen durability improvements.", publishedAt: h(19), sentiment: "positive", weight: 0.3 },
  ],
  Sony: [
    { title: "Sony image-sensor sales rise on smartphone upgrades", url: "https://example.com/sony-sensor", source: "Reuters", snippet: "Premium camera demand strong.", publishedAt: h(21), sentiment: "positive", weight: 0.3 },
  ],
  Qualcomm: [
    { title: "Qualcomm and Apple modem transition in focus", url: "https://example.com/qcom-modem", source: "Bloomberg", snippet: "In-house modem timeline debated.", publishedAt: h(17), sentiment: "neutral", weight: 0.3 },
  ],
  Broadcom: [
    { title: "Broadcom raises outlook on connectivity chips", url: "https://example.com/avgo-guide", source: "CNBC", snippet: "Component demand healthy.", publishedAt: h(23), sentiment: "positive", weight: 0.35 },
  ],
  "Best Buy": [
    { title: "Best Buy electronics sales stabilize", url: "https://example.com/bby-sales", source: "Reuters", snippet: "Consumer hardware demand firming.", publishedAt: h(26), sentiment: "neutral", weight: 0.25 },
  ],
  "Wireless Carriers": [
    { title: "Carriers ramp promotions for new phone launches", url: "https://example.com/carriers-promo", source: "Light Reading", snippet: "Subsidies aim to drive upgrades.", publishedAt: h(28), sentiment: "positive", weight: 0.3 },
  ],
  Google: [
    { title: "Court ruling clouds Google's default search deals", url: "https://example.com/googl-search", source: "WSJ", snippet: "Antitrust remedy could threaten payments to Apple.", publishedAt: h(7), sentiment: "negative", weight: 0.55 },
  ],
  OpenAI: [
    { title: "OpenAI ships new on-device model tier", url: "https://example.com/openai-ondevice", source: "The Verge", snippet: "Improves partner integrations.", publishedAt: h(9), sentiment: "positive", weight: 0.4 },
  ],
  "Goldman Sachs": [
    { title: "Goldman moves to exit consumer card partnerships", url: "https://example.com/gs-exit", source: "Bloomberg", snippet: "Apple Card future under negotiation.", publishedAt: h(12), sentiment: "negative", weight: 0.4 },
  ],
  Globalstar: [
    { title: "Globalstar expands satellite capacity for partner services", url: "https://example.com/gsat-cap", source: "Space News", snippet: "New satellites support connectivity features.", publishedAt: h(20), sentiment: "positive", weight: 0.35 },
  ],

  // ---- TSLA chain ----
  Tesla: [
    { title: "Tesla deliveries beat expectations in latest quarter", url: "https://example.com/tsla-deliveries", source: "Reuters", snippet: "Volume rebounds on new incentives.", publishedAt: h(5), sentiment: "positive", weight: 0.55 },
  ],
  Panasonic: [
    { title: "Panasonic steadies battery output for EV partners", url: "https://example.com/pana-batt", source: "Nikkei", snippet: "Cell production stabilizes.", publishedAt: h(16), sentiment: "neutral", weight: 0.35 },
  ],
  CATL: [
    { title: "CATL cuts battery cell prices on lower input costs", url: "https://example.com/catl-price", source: "Reuters", snippet: "Cheaper cells could lift EV margins.", publishedAt: h(8), sentiment: "positive", weight: 0.55 },
  ],
  "LG Energy Solution": [
    { title: "LG Energy expands cylindrical cell capacity", url: "https://example.com/lges-cap", source: "Korea Times", snippet: "New lines target EV demand.", publishedAt: h(18), sentiment: "positive", weight: 0.4 },
  ],
  Albemarle: [
    { title: "Lithium prices firm as Albemarle trims supply", url: "https://example.com/alb-lithium", source: "Bloomberg", snippet: "Higher input costs pressure battery makers.", publishedAt: h(14), sentiment: "negative", weight: 0.4 },
  ],
  Hertz: [
    { title: "Hertz reshuffles EV rental fleet strategy", url: "https://example.com/htz-fleet", source: "WSJ", snippet: "Mixed signals on future EV orders.", publishedAt: h(22), sentiment: "negative", weight: 0.35 },
  ],
  "Retail Buyers": [
    { title: "EV consumer demand steadies amid new incentives", url: "https://example.com/ev-demand", source: "Bloomberg", snippet: "Buyer interest holds up.", publishedAt: h(26), sentiment: "neutral", weight: 0.3 },
  ],
  xAI: [
    { title: "xAI advances training cluster buildout", url: "https://example.com/xai-cluster", source: "The Information", snippet: "Shared compute ambitions grow.", publishedAt: h(11), sentiment: "positive", weight: 0.35 },
  ],
  "SpaceX (Starlink)": [
    { title: "Starlink direct-to-device coverage expands", url: "https://example.com/starlink-d2d", source: "Space News", snippet: "Connectivity ecosystem strengthens.", publishedAt: h(24), sentiment: "positive", weight: 0.3 },
  ],
  "Bitcoin Holdings": [
    { title: "Bitcoin rallies to multi-month high", url: "https://example.com/btc-rally", source: "CoinDesk", snippet: "Crypto strength lifts corporate holders.", publishedAt: h(6), sentiment: "positive", weight: 0.4 },
  ],
};

/** Deterministic neutral fallback so every entity returns something. */
export function fallbackNews(name: string): NewsItem[] {
  return [
    {
      title: `${name}: no major headlines in the last 24 hours`,
      url: "https://example.com/no-news",
      source: "FinnSmart",
      snippet: "No market-moving news detected for this entity in the selected window.",
      publishedAt: h(2),
      sentiment: "neutral",
      weight: 0.1,
    },
  ];
}
