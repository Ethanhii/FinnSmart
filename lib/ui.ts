import type { NodeType, Signal } from "@/lib/types";

export const SIGNAL_COLORS: Record<Signal, string> = {
  positive: "#2bd576",
  negative: "#ff5d6c",
  neutral: "#5b6b85",
};

export const SIGNAL_LABELS: Record<Signal, string> = {
  positive: "Bullish",
  negative: "Bearish",
  neutral: "Neutral",
};

export function signalPillClass(signal: Signal): string {
  if (signal === "positive") return "pill pill-pos";
  if (signal === "negative") return "pill pill-neg";
  return "pill pill-neutral";
}

export function signalDot(signal: Signal): string {
  return signal === "positive" ? "▲" : signal === "negative" ? "▼" : "■";
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  stock: "#4f8cff",
  supplier: "#f5a524",
  customer: "#36c5f0",
  partner: "#a98bff",
  equity: "#2bd576",
  government: "#ff8a5b",
};

/** Plural labels used for the category hubs that the stock branches into. */
export const CATEGORY_LABELS: Record<NodeType, string> = {
  stock: "Stock",
  supplier: "Suppliers",
  customer: "Customers & Distributors",
  partner: "Partners",
  equity: "Equity Holdings",
  government: "Government & Regulators",
};

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
