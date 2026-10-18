import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requestNow } from "@/lib/request-time";
import { PromotionCard, RenderBlocks } from "@/components/blocks/render-blocks";
import { Breadcrumbs, ctaOnDark, ctaPrimary, ctaSecondary, JsonLd, PageIntro } from "@/components/site/page-parts";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { activePromotions, type RenderContext } from "@/lib/cms/render-context";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { whatsappHref } from "@/lib/cms/settings";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const slugs = await listPublishedSlugs("treatment");
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__marcador__" }];
}

export async function generateMetadata({ params }: PageProps<"/tratamentos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getPublishedEntry("treatment", slug);
  if (!t) return { robots: { index: false, follow: false } };
  const image = await getMedia(t.seo.mediaId ?? (t.data.mediaId as string | undefined));
  return buildMetadata({ title: t.title, description: t.summary, path: `/tratamentos/${slug}`, seo: t.seo, image });
}

export default async function TreatmentPage({ params }: PageProps<"/tratamentos/[slug]">) {
  const { slug } = await params;
  const t = await getPublishedEntry("treatment", slug);
  if (!t) return resolveMissing(`/tratamentos/${slug}`);

  const ctx = await loadPublicContext({ blocks: t.blocks, data: t.data });
  const cover = typeof t.data.mediaId === "string" ? ctx.media.get(t.data.mediaId) : null;
  const concerns = ctx.concerns.filter((c) => t.treatment?.concernIds.includes(c.id));
  const firstCategory = ctx.categories.find((c) => t.treatment?.categoryIds.includes(c.id));
  const hasNotice = t.blocks.some((b) => b.type === "notice");
  // Interesse pré-selecionado no formulário (slug genérico, sem dado pessoal).
  const evaluationHref = `/agendar-avaliacao?interesse=${encodeURIComponent(t.slug)}`;
  const wa = whatsappHref(ctx.settings);

  return (
    <main id="conteudo" className="flex-1">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Tratamentos", href: "/tratamentos" },
          ...(firstCategory ? [{ label: firstCategory.name, href: `/tratamentos/categoria/${firstCategory.slug}` }] : []),
          { label: t.title, href: `/tratamentos/${t.slug}` },
        ]}
      />
      <PageIntro title={t.title} summary={t.summary} media={cover}>
        <div className="flex flex-wrap gap-3">
          <Link href={evaluationHref} className={ctaPrimary} data-cta="evaluation" data-cta-location="treatment_intro">Agendar avaliação</Link>
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={ctaSecondary} data-cta="whatsapp" data-cta-location="treatment_intro">Falar no WhatsApp</a> : null}
        </div>
      </PageIntro>

      {concerns.length ? (
        <section aria-label="Indicado para" className="mx-auto w-full max-w-5xl px-4">
          <ul className="flex flex-wrap gap-2">
            {concerns.map((c) => (
              <li key={c.id}>
                <Link href={`/tratamentos?objetivo=${c.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-brand-50 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-100">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RenderBlocks blocks={t.blocks} ctx={ctx} />

      {t.treatment?.requiresEvaluation && !hasNotice ? (
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <p role="note" className="rounded-[var(--radius-card)] border-l-4 border-gold-700 bg-gold-100 p-4">
            A indicação depende de avaliação individual com profissional habilitado. Resultados variam de pessoa para pessoa.
          </p>
        </div>
      ) : null}

      <Suspense fallback={null}>
        <RelatedPromotions treatmentId={t.id} ctx={ctx} />
      </Suspense>

      {/* Faixa final só quando o conteúdo não tem chamada própria. */}
      {!t.blocks.some((b) => b.type === "cta") ? (
      <section className="bg-brand-800 text-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-10">
          <h2 className="text-2xl font-bold">Quer saber se {t.title} é indicado para você?</h2>
          <p className="text-white/90">Solicite uma avaliação. Nossa equipe entra em contato para combinar o horário.</p>
          <Link href={evaluationHref} className={ctaOnDark} data-cta="evaluation" data-cta-location="treatment_footer">
            Agendar avaliação
          </Link>
        </div>
      </section>
      ) : null}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: t.title,
          ...(t.summary ? { description: t.summary } : {}),
          url: absoluteUrl(`/tratamentos/${t.slug}`),
          inLanguage: "pt-BR",
          ...(t.updatedAt ? { dateModified: t.updatedAt } : {}),
        }}
      />
    </main>
  );
}

/** Promoções vigentes que incluem este tratamento (calculado na requisição). */
async function RelatedPromotions({ treatmentId, ctx }: { treatmentId: string; ctx: RenderContext }) {
  const related = [];
  for (const p of activePromotions(ctx.promotions, await requestNow())) {
    const promo = await getPublishedEntry("promotion", p.entry.slug);
    if (promo?.promotion?.treatmentIds.includes(treatmentId)) related.push(p);
  }
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="promocoes-relacionadas" className="mx-auto w-full max-w-5xl px-4 py-8">
      <h2 id="promocoes-relacionadas" className="mb-4 text-2xl font-bold text-brand-800">Promoções vigentes</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((p) => <PromotionCard key={p.entry.id} promotion={p} ctx={ctx} />)}
      </ul>
    </section>
  );
}
