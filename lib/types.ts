import type { PipelineProfile } from "@/lib/pipeline-profile";

export type Signal = "positive" | "negative" | "neutral";

/** Qualitative ripple strength — not a price or probability forecast. */
export type ImpactStrength = "low" | "moderate" | "high";

export type NodeType =
  | "stock"
  | "supplier"
  | "customer"
  | "partner"
  | "equity"
  | "government"
  | "macro";

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
  /** Rough qualitative strength of the ripple to the target stock. */
  strength: ImpactStrength;
  summary: string;
  citations: Citation[];
}

export interface StockVerdict {
  signal: Signal;
  /** Rough overall strength of the news-driven read-through. */
  strength: ImpactStrength;
  /** e.g. "next 24-48h" */
  timeframe: string;
  rationale: string;
  /** Investor-facing narrative: why the stock is likely up/down overall (Kimi). */
  explanation?: string;
  /** Top reasons pushing the stock higher over this horizon. */
  bullishDrivers?: string[];
  /** Top reasons pressuring the stock over this horizon. */
  bearishDrivers?: string[];
  /** Node id of the most impactful entity. */
  mostAffectedNodeId: string;
}

export type TimeHorizon = "immediate" | "medium" | "long";

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
}

export const HORIZONS: Record<TimeHorizon, HorizonConfig> = {
  immediate: {
    id: "immediate",
    label: "Immediate",
    range: "last 24 hours",
    description:
      "Breaking headlines and operational shocks — pure event-driven repricing.",
    timeframe: "next 1-2 days",
  },
  medium: {
    id: "medium",
    label: "Medium term",
    range: "last 2 months",
    description:
      "Includes immediate news plus financial and competitive shifts over weeks to ~2 months.",
    timeframe: "next 2-8 weeks",
  },
  long: {
    id: "long",
    label: "Long term",
    range: "last 12 months",
    description:
      "Layered view: immediate + medium signals plus structural and thesis-level trends up to one year.",
    timeframe: "6-12 months",
  },
};

export const HORIZON_ORDER: TimeHorizon[] = ["immediate", "medium", "long"];

export const DEFAULT_HORIZON: TimeHorizon = "medium";

export interface AnalyzeResponse {
  ticker: string;
  generatedAt: string;
  horizon: TimeHorizon;
  verdict: StockVerdict;
  impacts: EntityImpact[];
  /** Headlines about the stock itself (Yahoo Finance — not ecosystem ripples). */
  directCompanyNews?: Citation[];
  /** Server-terminal timing only when FINNSMART_PROFILE=true — stripped from API responses. */
  profile?: PipelineProfile;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  exchange?: string;
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  stock: "Your stock",
  supplier: "Supplier",
  customer: "Customer",
  partner: "Partner",
  equity: "Equity holding",
  government: "Government / Regulator",
  macro: "Macro / Geopolitical",
};
