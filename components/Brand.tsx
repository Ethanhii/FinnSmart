import Image from "next/image";
import Link from "next/link";

const LOGO_SRC =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663299981603/afrBAziRyMYEFjbhGLS8fD/finnsmart-logo-bRK8oyD9fqnapvZTBNd9Aj.webp";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 no-underline">
      <Image
        src={LOGO_SRC}
        alt="FinnSmart"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 transition-opacity group-hover:opacity-80"
      />
      <span className="leading-tight">
        <span className="block font-headline text-[15px] font-medium tracking-tight text-[var(--color-text)]">
          FinnSmart
        </span>
        {subtitle ? (
          <span className="block text-xs text-[var(--color-muted)]">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
