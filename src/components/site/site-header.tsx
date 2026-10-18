import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getNavigation } from "@/lib/cms/navigation";
import { getPublicSettings } from "@/lib/cms/public-data";
import { MobileNav } from "./mobile-nav";

const EVALUATION_HREF = "/agendar-avaliacao";

/** Cabeçalho do site. `reduced` = campanha: só logo e CTA. */
export async function SiteHeader({ reduced = false }: { reduced?: boolean }) {
  const [items, settings] = await Promise.all([reduced ? Promise.resolve([]) : getNavigation(), getPublicSettings()]);
  const name = settings.business_name || "Innovip";

  return (
    <header className="relative z-30 border-b border-line bg-surface-raised/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center gap-2" aria-label={`${name} — página inicial`}>
          <Logo size={52} priority />
          <span className="sr-only">{name}</span>
        </Link>

        {items.length ? (
          <nav aria-label="Principal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-800">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          <Link
            href={EVALUATION_HREF}
            data-cta="evaluation"
            data-cta-location="header"
            className={`${reduced ? "inline-flex" : "hidden sm:inline-flex"} min-h-11 items-center rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800`}
          >
            Agendar avaliação
          </Link>
          {/* usePathname no menu móvel exige Suspense. */}
          <Suspense fallback={null}>
            <MobileNav items={items} ctaHref={EVALUATION_HREF} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
