import Link from "next/link";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 no-underline">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text)]">
        F
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-medium tracking-tight text-[var(--color-text)]">
          FinnSmart
        </span>
        {subtitle ? (
          <span className="block text-xs text-[var(--color-muted)]">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
