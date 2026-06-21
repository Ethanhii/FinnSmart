import type { AnalyzeResponse, EntityImpact, ImpactStrength, StockVerdict } from "@/lib/types";

export const STRENGTH_RANK: Record<ImpactStrength, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

/** Numeric score for mock aggregation (not shown to users). */
export const STRENGTH_SCORE: Record<ImpactStrength, number> = {
  low: 0.3,
  moderate: 0.6,
  high: 1,
};

export function strengthLabel(s: ImpactStrength): string {
  if (s === "high") return "High";
  if (s === "moderate") return "Moderate";
  return "Low";
}

export function strengthFromNumber(n: number): ImpactStrength {
  if (n >= 0.55) return "high";
  if (n >= 0.25) return "moderate";
  return "low";
}

export function parseStrength(raw: unknown): ImpactStrength {
  if (typeof raw === "string") {
    const s = raw.toLowerCase().trim();
    if (s === "high" || s === "strong") return "high";
    if (s === "moderate" || s === "medium" || s === "med") return "moderate";
    if (s === "low" || s === "weak" || s === "minimal") return "low";
  }
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return strengthFromNumber(Math.max(0, Math.min(1, raw)));
  }
  return "moderate";
}

export function compareStrength(a: ImpactStrength, b: ImpactStrength): number {
  return STRENGTH_RANK[b] - STRENGTH_RANK[a];
}

/** Discrete bar width for map nodes — not a percentage prediction. */
export function strengthBarWidth(s: ImpactStrength): string {
  if (s === "high") return "90%";
  if (s === "moderate") return "55%";
  return "25%";
}

export function isStrongImpact(s: ImpactStrength): boolean {
  return s === "high";
}

/** Upgrade cached analyses that still use magnitude / confidence / expectedMove. */
export function normalizeImpact(impact: EntityImpact & { magnitude?: number }): EntityImpact {
  if ("strength" in impact && impact.strength) {
    return impact;
  }
  return {
    ...impact,
    strength: strengthFromNumber(impact.magnitude ?? 0),
  };
}

export function normalizeVerdict(
  verdict: StockVerdict & {
    confidence?: number;
    expectedMove?: string;
    magnitude?: never;
  }
): StockVerdict {
  if ("strength" in verdict && verdict.strength) {
    return verdict;
  }
  const legacyConf =
    typeof verdict.confidence === "number" ? verdict.confidence : 0.5;
  return {
    signal: verdict.signal,
    strength: strengthFromNumber(legacyConf),
    timeframe: verdict.timeframe,
    rationale: verdict.rationale,
    explanation: verdict.explanation,
    bullishDrivers: verdict.bullishDrivers,
    bearishDrivers: verdict.bearishDrivers,
    mostAffectedNodeId: verdict.mostAffectedNodeId,
  };
}

export function normalizeAnalyzeResponse(data: AnalyzeResponse): AnalyzeResponse {
  return {
    ...data,
    verdict: normalizeVerdict(data.verdict as StockVerdict & { confidence?: number }),
    impacts: data.impacts.map((i) =>
      normalizeImpact(i as EntityImpact & { magnitude?: number })
    ),
  };
}

/** Profile timing is server-terminal only — never send to the client. */
export function stripProfileFromAnalysis(data: AnalyzeResponse): AnalyzeResponse {
  const { profile: _profile, ...rest } = data;
  return rest;
}
