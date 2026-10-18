import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/page-parts";
import { TreatmentGrid } from "@/components/site/treatment-grid";
import { getPublicTaxonomies, listPublished } from "@/lib/cms/public-data";
import { contextForCards } from "@/lib/cms/public-media";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const { categories } = await getPublicTaxonomies();
  return categories.length ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "__marcador__" }];
}

async function load(slug: string) {
  const [{ categories }, treatments] = await Promise.all([getPublicTaxonomies(), listPublished("treatment")]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  const items = treatments.filter((t) => t.treatment?.categoryIds.includes(category.id));
  return items.length ? { category, items } : null; // categoria vazia não vira página
}

export async function generateMetadata({ params }: PageProps<"/tratamentos/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { robots: { index: false, follow: false } };
  return buildMetadata({
    title: `Tratamentos: ${data.category.name}`,
    description: data.category.description ?? `Tratamentos da categoria ${data.category.name} na Innovip.`,
    path: `/tratamentos/categoria/${slug}`,
  });
}

export default async function CategoryPage({ params }: PageProps<"/tratamentos/categoria/[slug]">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return resolveMissing(`/tratamentos/categoria/${slug}`);
  const ctx = await contextForCards(data.items);

  return (
    <main id="conteudo" className="flex-1">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Tratamentos", href: "/tratamentos" },
          { label: data.category.name, href: `/tratamentos/categoria/${slug}` },
        ]}
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-center text-3xl font-bold text-brand-800 sm:text-5xl">{data.category.name}</h1>
        {data.category.description ? <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted">{data.category.description}</p> : null}
        <div className="mt-8">
          <TreatmentGrid items={data.items} media={ctx.media} />
        </div>
      </div>
    </main>
  );
}
