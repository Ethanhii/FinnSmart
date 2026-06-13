"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import type {
  AnalyzeResponse,
  EntityImpact,
  GraphNode,
  NodeType,
  Signal,
  StockGraph,
  TimeHorizon,
} from "@/lib/types";
import { DEFAULT_HORIZON, HORIZONS, HORIZON_ORDER, NODE_TYPE_LABELS } from "@/lib/types";
import {
  nodeTypes,
  type CategoryNodeData,
  type EntityNodeData,
  type StockNodeData,
} from "@/components/map/nodes";
import { ImpactDrawer } from "@/components/map/ImpactDrawer";
import { ResizableDrawerPanel } from "@/components/map/ResizableDrawerPanel";
import { SignalPill } from "@/components/SignalPill";
import { Brand } from "@/components/Brand";
import { CATEGORY_LABELS, NODE_TYPE_COLORS, SIGNAL_COLORS } from "@/lib/ui";

const TYPE_ORDER: NodeType[] = ["supplier", "customer", "partner", "equity", "government"];
const SIGN: Record<Signal, number> = { positive: 1, negative: -1, neutral: 0 };

interface Pos {
  x: number;
  y: number;
}

const hubId = (cat: NodeType) => `cat:${cat}`;

interface Layout {
  stockId: string;
  positions: Record<string, Pos>;
  categories: NodeType[];
  entitiesByCategory: Record<string, GraphNode[]>;
}

function buildLayout(graph: StockGraph): Layout {
  const positions: Record<string, Pos> = {};
  const stock = graph.nodes.find((n) => n.type === "stock");
  const stockId = stock?.id ?? "stock";
  positions[stockId] = { x: 0, y: 0 };

  const categories = TYPE_ORDER.filter((t) => graph.nodes.some((n) => n.type === t));
  const entitiesByCategory: Record<string, GraphNode[]> = {};

  const R_HUB = 320;
  const CLUSTER_START = 230; // distance beyond the hub where companies begin
  const ROW_GAP = 92;
  const COL_OFFSET = 104;

  categories.forEach((cat, i) => {
    const angle = (i / categories.length) * Math.PI * 2 - Math.PI / 2;
    const u = { x: Math.cos(angle), y: Math.sin(angle) }; // radial direction
    const p = { x: -Math.sin(angle), y: Math.cos(angle) }; // perpendicular

    positions[hubId(cat)] = { x: u.x * R_HUB, y: u.y * R_HUB };

    const entities = graph.nodes.filter((n) => n.type === cat);
    entitiesByCategory[cat] = entities;

    entities.forEach((node, j) => {
      const col = j % 2;
      const row = Math.floor(j / 2);
      const along = R_HUB + CLUSTER_START + row * ROW_GAP;
      const side = (col === 0 ? -1 : 1) * (entities.length > 1 ? COL_OFFSET : 0);
      positions[node.id] = {
        x: u.x * along + p.x * side,
        y: u.y * along + p.y * side,
      };
    });
  });

  return { stockId, positions, categories, entitiesByCategory };
}

function side(dx: number, dy: number): string {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "b" : "t";
}

/** Zooms to expanded clusters, or back to the overview when all are collapsed. */
function FitController({
  expanded,
  layout,
}: {
  expanded: Set<NodeType>;
  layout: Layout | null;
}) {
  const rf = useReactFlow();
  useEffect(() => {
    if (!layout) return;
    const t = setTimeout(() => {
      if (expanded.size > 0) {
        const ids = new Set<string>([layout.stockId]);
        expanded.forEach((cat) => {
          ids.add(hubId(cat));
          layout.entitiesByCategory[cat].forEach((n) => ids.add(n.id));
        });
        rf.fitView({
          nodes: [...ids].map((id) => ({ id })),
          padding: 0.2,
          duration: 450,
        });
      } else {
        rf.fitView({ padding: 0.22, duration: 450 });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [expanded, layout, rf]);
  return null;
}

export function StockView({ ticker }: { ticker: string }) {
  const [graph, setGraph] = useState<StockGraph | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<NodeType>>(() => new Set());

  // Selected horizon (dropdown) vs the horizon the current analysis reflects.
  const [horizon, setHorizon] = useState<TimeHorizon>(DEFAULT_HORIZON);
  const [appliedHorizon, setAppliedHorizon] = useState<TimeHorizon>(DEFAULT_HORIZON);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load graph.
  useEffect(() => {
    let active = true;
    fetch(`/api/graph/${ticker}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Not found");
        return (await res.json()) as StockGraph;
      })
      .then((g) => active && setGraph(g))
      .catch((e: Error) => active && setGraphError(e.message));
    return () => {
      active = false;
    };
  }, [ticker]);

  const runAnalysis = useCallback(
    (h: TimeHorizon) => {
      setAnalyzing(true);
      fetch(`/api/analyze/${ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon: h }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
          return (await res.json()) as AnalyzeResponse;
        })
        .then((data) => {
          setAnalysis(data);
          setAppliedHorizon(h);
          setHorizon(h);
        })
        .catch(() => {
          /* keep any previously loaded cached analysis on failure */
        })
        .finally(() => setAnalyzing(false));
    },
    [ticker]
  );

  // Load saved analysis for the selected horizon — no pipeline run on page visit.
  useEffect(() => {
    if (!graph || analyzing) return;
    let active = true;
    fetch(`/api/analyze/${ticker}?horizon=${horizon}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AnalyzeResponse;
      })
      .then((data) => {
        if (!active || !data) return;
        setAnalysis(data);
        setAppliedHorizon(data.horizon);
      });
    return () => {
      active = false;
    };
  }, [graph, ticker, horizon, analyzing]);

  const horizonDirty = Boolean(analysis) && horizon !== appliedHorizon && !analyzing;
  const hasAnalysis = Boolean(analysis);

  const layout = useMemo(() => (graph ? buildLayout(graph) : null), [graph]);

  const impactByNode = useMemo(() => {
    const map = new Map<string, EntityImpact>();
    analysis?.impacts.forEach((i) => map.set(i.nodeId, i));
    return map;
  }, [analysis]);

  const categoryById = useMemo(() => {
    const map = new Map<string, NodeType>();
    graph?.nodes.forEach((n) => map.set(n.id, n.type));
    return map;
  }, [graph]);

  // Aggregate signal/magnitude per category from its entities' impacts.
  const categoryAgg = useMemo(() => {
    const agg: Record<string, { signal: Signal; magnitude: number }> = {};
    if (!graph) return agg;
    for (const cat of TYPE_ORDER) {
      const entities = graph.nodes.filter((n) => n.type === cat);
      if (entities.length === 0) continue;
      let score = 0;
      let top = 0;
      let any = false;
      for (const e of entities) {
        const im = impactByNode.get(e.id);
        if (!im) continue;
        any = true;
        score += SIGN[im.signal] * im.magnitude;
        top = Math.max(top, im.magnitude);
      }
      if (!any) continue;
      agg[cat] = {
        signal: score > 0.05 ? "positive" : score < -0.05 ? "negative" : "neutral",
        magnitude: top,
      };
    }
    return agg;
  }, [graph, impactByNode]);

  // Build / rebuild React Flow nodes + edges when data or expansion changes.
  // Preserve user-dragged positions instead of resetting to the layout grid.
  useEffect(() => {
    if (!graph || !layout) return;
    const mostAffectedId = analysis?.verdict.mostAffectedNodeId;
    const { positions, categories } = layout;
    let posLookup: Record<string, Pos> = positions;

    setRfNodes((prev) => {
      const savedPos = new Map(prev.map((n) => [n.id, n.position]));
      const pos = (id: string): Pos => savedPos.get(id) ?? positions[id] ?? { x: 0, y: 0 };

      const nodes: Node[] = [];

      // Center stock.
      const stockNode = graph.nodes.find((n) => n.type === "stock");
      if (stockNode) {
        nodes.push({
          id: layout.stockId,
          type: "stock",
          position: pos(layout.stockId),
          data: {
            ticker: stockNode.ticker ?? stockNode.name,
            name: stockNode.name,
            signal: analysis?.verdict.signal,
            selected: selected === layout.stockId,
          } satisfies StockNodeData,
        });
      }

      // Category hubs.
      categories.forEach((cat) => {
        const agg = categoryAgg[cat];
        nodes.push({
          id: hubId(cat),
          type: "category",
          position: pos(hubId(cat)),
          data: {
            category: cat,
            count: layout.entitiesByCategory[cat].length,
            signal: agg?.signal,
            magnitude: agg?.magnitude,
            expanded: expanded.has(cat),
            loading: analyzing && !agg,
          } satisfies CategoryNodeData,
        });
      });

      // Entities (hidden unless their category is expanded).
      graph.nodes
        .filter((n) => n.type !== "stock")
        .forEach((node) => {
          const impact = impactByNode.get(node.id);
          nodes.push({
            id: node.id,
            type: "entity",
            position: pos(node.id),
            hidden: !expanded.has(node.type),
            selected: selected === node.id,
            data: {
              name: node.name,
              type: node.type,
              relationship: node.relationship,
              signal: impact?.signal,
              magnitude: impact?.magnitude,
              isMostAffected: node.id === mostAffectedId,
              loading: analyzing && !impact,
            } satisfies EntityNodeData,
          });
        });

      posLookup = Object.fromEntries(nodes.map((n) => [n.id, n.position]));
      return nodes;
    });

    setRfEdges(() => {
      const pos = (id: string): Pos => posLookup[id] ?? positions[id] ?? { x: 0, y: 0 };
      const edges: Edge[] = [];

      // Stock -> category hub (always visible).
      categories.forEach((cat) => {
        const sp = pos(layout.stockId);
        const tp = pos(hubId(cat));
        const agg = categoryAgg[cat];
        const color = agg ? SIGNAL_COLORS[agg.signal] : "#2e2e2e";
        const strong = agg && agg.signal !== "neutral" && agg.magnitude > 0.35;
        edges.push({
          id: `hub_${cat}`,
          source: layout.stockId,
          target: hubId(cat),
          sourceHandle: side(tp.x - sp.x, tp.y - sp.y),
          targetHandle: side(sp.x - tp.x, sp.y - tp.y),
          animated: Boolean(strong),
          style: {
            stroke: color,
            strokeWidth: agg ? 1.5 + agg.magnitude * 4 : 1.5,
            opacity: agg ? 0.95 : 0.5,
          },
        });
      });

      // Category hub -> entity (visible only when expanded).
      graph.nodes
        .filter((n) => n.type !== "stock")
        .forEach((node) => {
          const sp = pos(hubId(node.type));
          const tp = pos(node.id);
          const impact = impactByNode.get(node.id);
          const color = impact ? SIGNAL_COLORS[impact.signal] : "#2e2e2e";
          const strong = impact && impact.signal !== "neutral" && impact.magnitude > 0.35;
          edges.push({
            id: `e_${node.id}`,
            source: hubId(node.type),
            target: node.id,
            hidden: !expanded.has(node.type),
            sourceHandle: side(tp.x - sp.x, tp.y - sp.y),
            targetHandle: side(sp.x - tp.x, sp.y - tp.y),
            animated: Boolean(strong),
            style: {
              stroke: color,
              strokeWidth: impact ? 1 + impact.magnitude * 4 : 1,
              opacity: impact ? 0.9 : 0.45,
            },
          });
        });

      return edges;
    });
  }, [
    graph,
    layout,
    impactByNode,
    categoryAgg,
    analysis,
    analyzing,
    selected,
    expanded,
    setRfNodes,
    setRfEdges,
  ]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.type === "stock") {
      setSelected(node.id);
    } else if (node.type === "category") {
      const cat = (node.data as CategoryNodeData).category;
      // Click toggles the branch; multiple branches can stay open.
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        return next;
      });
    } else if (node.type === "entity") {
      setSelected(node.id);
    }
  }, []);

  const selectFromDrawer = useCallback(
    (nodeId: string) => {
      setSelected(nodeId);
      const cat = categoryById.get(nodeId);
      if (cat && cat !== "stock") {
        setExpanded((prev) => new Set(prev).add(cat));
      }
    },
    [categoryById]
  );

  const verdict = analysis?.verdict;
  const presentTypes = layout?.categories ?? [];

  if (graphError) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">No map for {ticker} yet</h1>
          <p className="mt-2 text-[var(--color-muted)]">{graphError}</p>
          <Link href="/" className="mt-4 inline-block text-[var(--color-accent)]">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-4">
          <Brand />
          <span className="text-[var(--color-border)]">/</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{ticker}</span>
              {verdict ? <SignalPill signal={verdict.signal} /> : null}
            </div>
            <div className="text-xs text-[var(--color-muted)]">{graph?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Time horizon selector */}
          <label className="flex items-center gap-2" title={HORIZONS[horizon].description}>
            <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
              Time horizon
            </span>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as TimeHorizon)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-text)] outline-none hover:border-[#3a3a3a] focus:border-[#3a3a3a]"
            >
              {HORIZON_ORDER.map((id) => (
                <option key={id} value={id}>
                  {HORIZONS[id].label} · {HORIZONS[id].range}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => runAnalysis(horizon)}
            disabled={analyzing}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={
              !hasAnalysis || horizonDirty
                ? { borderColor: "var(--color-text)", background: "var(--color-text)", color: "#000" }
                : { borderColor: "var(--color-border)", background: "var(--color-surface)" }
            }
          >
            {analyzing
              ? "Tracing ripples…"
              : !hasAnalysis
              ? "Analyze"
              : horizonDirty
              ? `Re-analyze · ${HORIZONS[horizon].label}`
              : "Re-analyze"}
          </button>
          <Link
            href="/"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {horizonDirty ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-1.5 text-xs text-[var(--color-muted)]">
          Horizon changed to{" "}
          <span className="font-medium text-[var(--color-text)]">
            {HORIZONS[horizon].label}
          </span>{" "}
          ({HORIZONS[horizon].range}) — click Re-analyze to update, or switch back to load a saved run.
        </div>
      ) : !hasAnalysis && !analyzing ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-1.5 text-xs text-[var(--color-muted)]">
          Click <span className="font-medium text-[var(--color-text)]">Analyze</span> to trace
          news ripples across this map.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Sandbox map */}
        <div className="relative min-w-0 flex-1">
          <ReactFlowProvider>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.2}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1c1c1c" />
              <Controls showInteractive={false} />
              <FitController expanded={expanded} layout={layout} />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Legend */}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
            {presentTypes.map((t) => (
              <span
                key={t}
                className="pill"
                style={{ background: "var(--color-surface)", color: "var(--color-muted)" }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: NODE_TYPE_COLORS[t] }} />
                {NODE_TYPE_LABELS[t]}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-2 text-xs text-[var(--color-muted)]">
            <span className="rounded-md bg-[var(--color-surface)] px-2 py-1">
              Click branches to expand — open several at once
            </span>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-6 rounded" style={{ background: SIGNAL_COLORS.positive }} />
                Positive ripple
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-6 rounded" style={{ background: SIGNAL_COLORS.negative }} />
                Negative ripple
              </span>
            </div>
          </div>
        </div>

        {/* Drawer — drag left edge to resize */}
        <ResizableDrawerPanel>
          <ImpactDrawer
            verdict={verdict}
            impacts={analysis?.impacts ?? []}
            loading={analyzing}
            selectedNodeId={selected}
            stockNodeId={layout?.stockId}
            ticker={ticker}
            onSelect={selectFromDrawer}
          />
        </ResizableDrawerPanel>
      </div>
    </div>
  );
}
