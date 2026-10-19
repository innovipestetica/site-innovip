import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/page-parts";
import { TreatmentCard } from "@/components/site/treatment-grid";
import { CatalogFilter, type CatalogItem } from "@/components/site/catalog-filter";
import { normalizeSearch } from "@/lib/search";
import type { PublishedEntry } from "@/lib/cms/public-data";
import type { RenderMedia } from "@/lib/cms/render-context";
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
  const catalog = buildCatalog(treatments, taxonomies, ctx.media);

  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("catalog")}>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Tratamentos", href: "/tratamentos" }]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-center text-3xl font-bold text-brand-800 sm:text-5xl">Tratamentos</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted">
          Não sabe o nome do procedimento? Filtre pelo que você deseja tratar. A indicação final é feita na avaliação individual.
        </p>

        <div className="mt-6">
          {/* Catálogo completo no HTML estático; os valores do endereço chegam por streaming. */}
          <Suspense fallback={<CatalogFilter {...catalog} initial={EMPTY} idPrefix="inicial-" />}>
            <FilteredCatalog searchParams={searchParams} catalog={catalog} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

const EMPTY = { q: "", objetivo: "", categoria: "" };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 80) ?? "";
}

type Taxonomies = Awaited<ReturnType<typeof getPublicTaxonomies>>;

/** Cards prontos + dados de filtro. Só oferece filtros que têm algum tratamento. */
function buildCatalog(treatments: PublishedEntry[], taxonomies: Taxonomies, media: Map<string, RenderMedia>) {
  const slugs = (all: { id: string; slug: string }[], ids: string[] = []) =>
    all.filter((x) => ids.includes(x.id)).map((x) => x.slug);
  const items: CatalogItem[] = treatments.map((t) => ({
    id: t.id,
    text: normalizeSearch(`${t.title} ${t.summary ?? ""}`),
    categories: slugs(taxonomies.categories, t.treatment?.categoryIds),
    concerns: slugs(taxonomies.concerns, t.treatment?.concernIds),
    card: <TreatmentCard key={t.id} entry={t} media={media} />,
  }));
  const used = (all: { slug: string; name: string }[], key: "categories" | "concerns") =>
    all.filter((x) => items.some((i) => i[key].includes(x.slug))).map(({ slug, name }) => ({ slug, name }));
  return { items, categories: used(taxonomies.categories, "categories"), concerns: used(taxonomies.concerns, "concerns") };
}

async function FilteredCatalog({
  searchParams,
  catalog,
}: {
  searchParams: PageProps<"/tratamentos">["searchParams"];
  catalog: ReturnType<typeof buildCatalog>;
}) {
  const sp = await searchParams;
  // Valores desconhecidos no endereço são ignorados.
  const objetivo = catalog.concerns.some((c) => c.slug === one(sp.objetivo)) ? one(sp.objetivo) : "";
  const categoria = catalog.categories.some((c) => c.slug === one(sp.categoria)) ? one(sp.categoria) : "";
  return <CatalogFilter {...catalog} initial={{ q: one(sp.q).slice(0, 60), objetivo, categoria }} />;
}
