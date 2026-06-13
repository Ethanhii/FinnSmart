"use client";

import { Handle, Position } from "@xyflow/react";
import type { NodeType, Signal } from "@/lib/types";
import { CATEGORY_LABELS, NODE_TYPE_COLORS, SIGNAL_COLORS } from "@/lib/ui";
import { NODE_TYPE_LABELS } from "@/lib/types";

const SIDES = [
  { id: "t", position: Position.Top },
  { id: "r", position: Position.Right },
  { id: "b", position: Position.Bottom },
  { id: "l", position: Position.Left },
];

function HiddenHandles() {
  return (
    <>
      {SIDES.map((s) => (
        <Handle
          key={s.id}
          id={s.id}
          type="source"
          position={s.position}
          style={{ opacity: 0, width: 1, height: 1, border: "none", background: "transparent" }}
          isConnectable={false}
        />
      ))}
    </>
  );
}

export interface EntityNodeData {
  name: string;
  type: NodeType;
  relationship: string;
  signal?: Signal;
  magnitude?: number;
  isMostAffected?: boolean;
  loading?: boolean;
  [key: string]: unknown;
}

export function EntityNode({ data }: { data: EntityNodeData }) {
  const typeColor = NODE_TYPE_COLORS[data.type];
  const signalColor = data.signal ? SIGNAL_COLORS[data.signal] : undefined;

  return (
    <div
      className="relative w-44 rounded-lg border bg-[var(--color-surface)] px-3 py-2.5 transition-colors"
      style={{ borderColor: signalColor ?? "var(--color-border)" }}
    >
      <HiddenHandles />
      {data.isMostAffected ? (
        <span
          className="absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ background: signalColor ?? "var(--color-text)", color: "#000" }}
        >
          TOP IMPACT
        </span>
      ) : null}
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: typeColor }}
        />
        <span className="truncate text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          {NODE_TYPE_LABELS[data.type]}
        </span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text)]">
        {data.name}
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        {data.loading ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-border)]" />
        ) : data.signal ? (
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((data.magnitude ?? 0) * 100)}%`,
              background: signalColor,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export interface StockNodeData {
  ticker: string;
  name: string;
  signal?: Signal;
  selected?: boolean;
  [key: string]: unknown;
}

export function StockNode({ data }: { data: StockNodeData }) {
  const color = data.signal ? SIGNAL_COLORS[data.signal] : "var(--color-text)";
  return (
    <div
      className="relative grid w-40 cursor-pointer place-items-center rounded-xl bg-[var(--color-surface)] px-4 py-4 text-center transition-colors"
      style={{
        border: `${data.selected ? 2.5 : 1.5}px solid ${color}`,
        boxShadow: data.selected ? `0 0 0 2px ${color}33` : undefined,
      }}
    >
      <HiddenHandles />
      <div className="text-2xl font-semibold tracking-tight" style={{ color }}>
        {data.ticker}
      </div>
      <div className="mt-0.5 max-w-[9rem] truncate text-[11px] text-[var(--color-muted)]">
        {data.name}
      </div>
      <div className="mt-2 text-[10px] font-medium text-[var(--color-muted)]">
        {data.selected ? (
          <span className="text-[var(--color-text)]">Outlook shown →</span>
        ) : (
          <span>Click for outlook</span>
        )}
      </div>
    </div>
  );
}

export interface CategoryNodeData {
  category: NodeType;
  count: number;
  signal?: Signal;
  magnitude?: number;
  expanded?: boolean;
  loading?: boolean;
  [key: string]: unknown;
}

export function CategoryNode({ data }: { data: CategoryNodeData }) {
  const typeColor = NODE_TYPE_COLORS[data.category];
  const signalColor = data.signal ? SIGNAL_COLORS[data.signal] : undefined;
  const border = data.expanded
    ? "var(--color-text)"
    : signalColor ?? "var(--color-border)";

  return (
    <div
      className="relative w-52 rounded-xl border bg-[var(--color-surface)] px-3.5 py-3 transition-colors"
      style={{ borderColor: border }}
    >
      <HiddenHandles />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColor }} />
          <span className="text-sm font-medium text-[var(--color-text)]">
            {CATEGORY_LABELS[data.category]}
          </span>
        </div>
        <span className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
          {data.count}
        </span>
      </div>

      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        {data.loading ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-border)]" />
        ) : data.signal ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round((data.magnitude ?? 0) * 100)}%`, background: signalColor }}
          />
        ) : null}
      </div>

      <div className="mt-2 text-[10px] font-medium text-[var(--color-muted)]">
        {data.expanded ? (
          <span className="text-[var(--color-text)]">— Click to minimize</span>
        ) : (
          <span>+ Click to expand</span>
        )}
      </div>
    </div>
  );
}

export const nodeTypes = { entity: EntityNode, stock: StockNode, category: CategoryNode };
