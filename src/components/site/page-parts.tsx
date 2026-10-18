import Link from "next/link";
import { absoluteUrl, jsonLdString } from "@/lib/seo";
import type { RenderMedia } from "@/lib/cms/render-context";
import { Picture } from "@/components/blocks/render-blocks";

/** Dados estruturados (somente fatos; nada de notas ou avaliações inventadas). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

export type Crumb = { label: string; href: string };

/** Trilha de navegação + BreadcrumbList. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Trilha de navegação" className="mx-auto w-full max-w-5xl px-4 pt-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1 text-muted">
          {items.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden="true">›</span> : null}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-brand-800 hover:underline">{c.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
        }}
      />
    </>
  );
}

/** Cabeçalho de página (quando o conteúdo não começa com um bloco hero). */
export function PageIntro({
  title,
  summary,
  media,
  children,
}: {
  title: string;
  summary?: string | null;
  media?: RenderMedia | null;
  children?: React.ReactNode;
}) {
  return (
    <header className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 pb-4 pt-6 md:grid-cols-[1.2fr_1fr] md:pt-10">
      <div>
        <h1 className="text-3xl font-bold text-brand-800 sm:text-4xl">{title}</h1>
        {summary ? <p className="mt-4 text-lg text-muted">{summary}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
      {media ? <Picture media={media} sizes="(min-width: 768px) 40vw, 100vw" priority /> : null}
    </header>
  );
}

export const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800";
export const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-brand-700 px-6 font-semibold text-brand-800 hover:bg-brand-50";
/** Botão sobre fundo escuro (faixas de chamada). */
export const ctaOnDark =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-white px-6 font-semibold text-white hover:bg-white/10";
