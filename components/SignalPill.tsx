import type { Signal } from "@/lib/types";
import { SIGNAL_LABELS, signalDot, signalPillClass } from "@/lib/ui";

export function SignalPill({
  signal,
  label,
}: {
  signal: Signal;
  label?: string;
}) {
  return (
    <span className={signalPillClass(signal)}>
      <span aria-hidden>{signalDot(signal)}</span>
      {label ?? SIGNAL_LABELS[signal]}
    </span>
  );
}
