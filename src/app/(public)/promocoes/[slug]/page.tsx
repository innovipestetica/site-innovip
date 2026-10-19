import { Suspense } from "react";
import type { Metadata } from "next";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { Breadcrumbs, PageIntro } from "@/components/site/page-parts";
import { PromotionStatus, PromotionTerms } from "@/components/site/promotion-status";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

export async function generateStaticParams() {
  const slugs = await listPublishedSlugs("promotion");
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__marcador__" }];
}

export async function generateMetadata({ params }: PageProps<"/promocoes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublishedEntry("promotion", slug);
  if (!p) return { robots: { index: false, follow: false } };
  const image = await getMedia(p.seo.mediaId ?? (p.data.mediaId as string | undefined));
  return buildMetadata({ title: p.title, description: p.summary, path: `/promocoes/${slug}`, seo: p.seo, image });
}

export default async function PromotionPage({ params }: PageProps<"/promocoes/[slug]">) {
  const { slug } = await params;
  const promo = await getPublishedEntry("promotion", slug);
  if (!promo) return resolveMissing(`/promocoes/${slug}`);

  const ctx = await loadPublicContext({
    blocks: promo.blocks,
    data: promo.data,
    related: { entryIds: promo.promotion?.treatmentIds ?? [] },
  });
  const cover = typeof promo.data.mediaId === "string" ? ctx.media.get(promo.data.mediaId) : null;

  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("promotion")}>
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Promoções", href: "/promocoes" },
          { label: promo.title, href: `/promocoes/${promo.slug}` },
        ]}
      />
      <PageIntro title={promo.title} summary={promo.summary} media={cover} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <Suspense fallback={<p className="text-sm text-muted" role="status">Verificando vigência da oferta…</p>}>
          <PromotionStatus promo={promo} ctx={ctx} ctaLocation="promotion_page" />
        </Suspense>
        <PromotionTerms terms={promo.promotion?.terms} />
      </div>
      <RenderBlocks blocks={promo.blocks} ctx={ctx} pageHasTitle />
    </main>
  );
}
