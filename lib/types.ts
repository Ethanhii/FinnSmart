export type Signal = "positive" | "negative" | "neutral";

export type NodeType =
  | "stock"
  | "supplier"
  | "customer"
  | "partner"
  | "equity"
  | "government";

export interface GraphNode {
  id: string;
  name: string;
  ticker?: string;
  type: NodeType;
  /** Human-readable description of the relationship to the target stock. */
  relationship: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
}

export interface StockGraph {
  ticker: string;
  name: string;
  /** Short blurb shown on the stock page header. */
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Citation {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  /** Short summary of what this source reports about the news. */
  snippet?: string;
  /** 0..1 relative importance/urgency, used to order sources. */
  weight?: number;
}

export interface EntityImpact {
  nodeId: string;
  name: string;
  type: NodeType;
  signal: Signal;
  /** 0..1, how strongly this entity's news moves the target stock. */
  magnitude: number;
  summary: string;
  citations: Citation[];
}

export interface StockVerdict {
  signal: Signal;
  /** 0..1 confidence in the verdict. */
  confidence: number;
  /** e.g. "+1% to +3%" */
  expectedMove: string;
  /** e.g. "next 24-48h" */
  timeframe: string;
  rationale: string;
  /** Node id of the most impactful entity. */
  mostAffectedNodeId: string;
}

export type TimeHorizon = "immediate" | "short" | "medium" | "long";

export interface HorizonConfig {
  id: TimeHorizon;
  /** Dropdown label. */
  label: string;
  /** Short duration descriptor shown beside the label. */
  range: string;
  /** One-line explanation of what this horizon captures. */
  description: string;
  /** Default verdict timeframe text. */
  timeframe: string;
  /** Bright Data SERP recency window (Google `qdr:` value). */
  serpRange: "d" | "w" | "m" | "y";
}

export const HORIZONS: Record<TimeHorizon, HorizonConfig> = {
  immediate: {
    id: "immediate",
    label: "Immediate",
    range: "days to ~2 weeks",
    description:
      "Pure event-driven repricing; the market digests the headline itself.",
    timeframe: "next 1-2 weeks",
    serpRange: "w",
  },
  short: {
    id: "short",
    label: "Short term",
    range: "up to ~3 months",
    description: "Within the current quarter / before next earnings.",
    timeframe: "next ~3 months",
    serpRange: "m",
  },
  medium: {
    id: "medium",
    label: "Medium term",
    range: "3 to 12 months",
    description:
      "The next few earnings cycles, where supply-chain and partnership effects flow through to reported numbers.",
    timeframe: "next 3-12 months",
    serpRange: "m",
  },
  long: {
    id: "long",
    label: "Long term",
    range: "12+ months",
    description: "Structural: regulation, competitive shifts, thesis changes.",
    timeframe: "12+ months",
    serpRange: "y",
  },
};

export const HORIZON_ORDER: TimeHorizon[] = ["immediate", "short", "medium", "long"];

export const DEFAULT_HORIZON: TimeHorizon = "short";

export interface AnalyzeResponse {
  ticker: string;
  generatedAt: string;
  horizon: TimeHorizon;
  verdict: StockVerdict;
  impacts: EntityImpact[];
}

export interface WatchlistItem {
  ticker: string;
  name: string;
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  stock: "Your stock",
  supplier: "Supplier",
  customer: "Customer",
  partner: "Partner",
  equity: "Equity holding",
  government: "Government / Regulator",
};
