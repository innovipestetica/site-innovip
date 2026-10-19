import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/page-parts";
import { normalizeSearch, TreatmentGrid } from "@/components/site/treatment-grid";
import { getPublicTaxonomies, listPublished } from "@/lib/cms/public-data";
import { contextForCards } from "@/lib/cms/public-media";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

export const metadata: Metadata = buildMetadata({
  title: "Tratamentos",
  description: "Conheça os tratamentos faciais e corporais da Innovip. A indicação depende de avaliação individual.",
  path: "/tratamentos",
});

export default async function TreatmentsPage({ searchParams }: PageProps<"/tratamentos">) {
  const [treatments, taxonomies] = await Promise.all([listPublished("treatment"), getPublicTaxonomies()]);
  if (treatments.length === 0) return resolveMissing("/tratamentos");
  const ctx = await contextForCards(treatments);

  // Só oferece filtros que têm algum tratamento.
  const usedCategories = taxonomies.categories.filter((c) => treatments.some((t) => t.treatment?.categoryIds.includes(c.id)));
  const usedConcerns = taxonomies.concerns.filter((c) => treatments.some((t) => t.treatment?.concernIds.includes(c.id)));

  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("catalog")}>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Tratamentos", href: "/tratamentos" }]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-center text-3xl font-bold text-brand-800 sm:text-5xl">Tratamentos</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted">
          Não sabe o nome do procedimento? Filtre pelo que você deseja tratar. A indicação final é feita na avaliação individual.
        </p>

        <div className="mt-6">
          {/* O catálogo completo vai no HTML estático; o filtro (dados da URL) chega por streaming. */}
          <Suspense
            fallback={
              <>
                <FilterForm concerns={usedConcerns} categories={usedCategories} />
                <div className="mt-8"><TreatmentGrid items={treatments} media={ctx.media} /></div>
              </>
            }
          >
            <FilteredCatalog searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 80) ?? "";
}

type Option = { id: string; slug: string; name: string };

function FilterForm({
  concerns,
  categories,
  values = {},
}: {
  concerns: Option[];
  categories: Option[];
  values?: { q?: string; objetivo?: string; categoria?: string };
}) {
  return (
        <form method="get" role="search" aria-label="Filtrar tratamentos" className="mt-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="busca" className="text-sm font-semibold">Buscar</label>
            <input id="busca" name="q" type="search" defaultValue={values.q} maxLength={60} placeholder="Ex.: manchas, flacidez"
              className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3" />
          </div>
          {concerns.length ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="objetivo" className="text-sm font-semibold">O que deseja tratar</label>
              <select id="objetivo" name="objetivo" defaultValue={values.objetivo ?? ""} className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3">
                <option value="">Todos</option>
                {concerns.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          ) : null}
          {categories.length ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="categoria" className="text-sm font-semibold">Categoria</label>
              <select id="categoria" name="categoria" defaultValue={values.categoria ?? ""} className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3">
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          ) : null}
          <button type="submit" className="min-h-11 rounded-[var(--radius-control)] bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Filtrar</button>
        </form>

  );
}

async function FilteredCatalog({ searchParams }: { searchParams: PageProps<"/tratamentos">["searchParams"] }) {
  const sp = await searchParams;
  const [treatments, taxonomies] = await Promise.all([listPublished("treatment"), getPublicTaxonomies()]);
  const ctx = await contextForCards(treatments);

  const q = normalizeSearch(one(sp.q).trim());
  const concern = taxonomies.concerns.find((c) => c.slug === one(sp.objetivo));
  const category = taxonomies.categories.find((c) => c.slug === one(sp.categoria));

  const filtered = treatments.filter((t) => {
    if (concern && !t.treatment?.concernIds.includes(concern.id)) return false;
    if (category && !t.treatment?.categoryIds.includes(category.id)) return false;
    if (q && !normalizeSearch(`${t.title} ${t.summary ?? ""}`).includes(q)) return false;
    return true;
  });

  const active = [concern?.name, category?.name, q ? `“${one(sp.q)}”` : null].filter(Boolean);
  const usedCategories = taxonomies.categories.filter((c) => treatments.some((t) => t.treatment?.categoryIds.includes(c.id)));
  const usedConcerns = taxonomies.concerns.filter((c) => treatments.some((t) => t.treatment?.concernIds.includes(c.id)));
  return (
    <>
      <FilterForm
        concerns={usedConcerns}
        categories={usedCategories}
        values={{ q: one(sp.q), objetivo: concern?.slug, categoria: category?.slug }}
      />
      <div className="mt-8" />
      {active.length ? (
        <p className="mb-4 text-sm text-muted" role="status">
          {filtered.length} resultado(s) para {active.join(" · ")}.{" "}
          <Link href="/tratamentos" className="font-semibold text-brand-800 underline">Limpar filtros</Link>
        </p>
      ) : null}
      <TreatmentGrid items={filtered} media={ctx.media} emptyText="Nenhum tratamento com esses filtros. Fale com a equipe na avaliação." />
    </>
  );
}
