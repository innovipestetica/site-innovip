import { Suspense } from "react";
import type { Metadata } from "next";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { PageIntro } from "@/components/site/page-parts";
import { PromotionStatus, PromotionTerms } from "@/components/site/promotion-status";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

/**
 * Landing pages de campanha. Navegação reduzida opcional; começam noindex
 * (definido no CMS) até decisão editorial. A oferta vem da promoção
 * associada (fonte única), com vigência conferida na requisição.
 */
export async function generateStaticParams() {
  const slugs = await listPublishedSlugs("landing");
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__marcador__" }];
}

export async function generateMetadata({ params }: PageProps<"/lp/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lp = await getPublishedEntry("landing", slug);
  if (!lp) return { robots: { index: false, follow: false } };
  const image = await getMedia(lp.seo.mediaId);
  return buildMetadata({ title: lp.title, description: lp.summary, path: `/lp/${slug}`, seo: lp.seo, image });
}

export default async function LandingPage({ params }: PageProps<"/lp/[slug]">) {
  const { slug } = await params;
  const lp = await getPublishedEntry("landing", slug);
  if (!lp) return resolveMissing(`/lp/${slug}`);

  const promotionId = lp.landing?.promotionEntryId ?? null;
  const ctx = await loadPublicContext({ blocks: lp.blocks, data: lp.data, promo: { entryId: promotionId } });
  const promoRef = promotionId ? ctx.entries.get(promotionId) : undefined;
  const promo = promoRef ? await getPublishedEntry("promotion", promoRef.slug) : null;
  const reduced = lp.landing?.reducedNavigation ?? true;
  const startsWithHero = lp.blocks[0]?.type === "hero";

  return (
    <>
      <SiteHeader reduced={reduced} />
      <main id="conteudo" className="flex-1" {...pageAttrs("landing")}>
        {!startsWithHero ? <PageIntro title={lp.title} summary={lp.summary} /> : null}
        {promo ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
            <Suspense fallback={<p className="text-sm text-muted" role="status">Verificando vigência da oferta…</p>}>
              <PromotionStatus promo={promo} ctx={ctx} ctaLocation="landing" />
            </Suspense>
            <PromotionTerms terms={promo.promotion?.terms} />
          </div>
        ) : null}
        <RenderBlocks blocks={lp.blocks} ctx={ctx} />
      </main>
      <SiteFooter reduced={reduced} />
    </>
  );
}
