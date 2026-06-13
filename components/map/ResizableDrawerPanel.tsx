"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const STORAGE_KEY = "finnsmart.drawerWidth";

function clamp(n: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

export function ResizableDrawerPanel({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const n = Number(saved);
        if (!Number.isNaN(n)) setWidth(clamp(n));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setWidth(clamp(window.innerWidth - e.clientX));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth((w) => {
        try {
          localStorage.setItem(STORAGE_KEY, String(w));
        } catch {
          /* ignore */
        }
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  return (
    <div
      className="relative hidden shrink-0 md:block"
      style={{ width }}
    >
      {/* Drag handle on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize analysis panel"
        onMouseDown={(e) => {
          e.preventDefault();
          startDrag();
        }}
        className="absolute left-0 top-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none"
      >
        <div className="mx-auto h-full w-px bg-[var(--color-border)] transition-colors hover:w-0.5 hover:bg-[var(--color-muted)]" />
      </div>

      <div className="h-full border-l border-[var(--color-border)] bg-[var(--color-bg)]">
        {children}
      </div>
    </div>
  );
}
