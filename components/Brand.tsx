import Link from "next/link";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="21" r="2.75" fill="currentColor" />
      <path
        d="M11 13.5a7.5 7.5 0 0 1 13.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7 9a13 13 0 0 1 19 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 no-underline">
      <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--color-text)] transition-opacity group-hover:opacity-80">
        <LogoMark className="h-7 w-7" />
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

export { LogoMark };
