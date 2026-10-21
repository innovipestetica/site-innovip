import type { Metadata } from "next";
import { IndependentPage } from "@/components/site/independent-page";
import { BlackLandingPage } from "@/components/site/black-landing-page";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";

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

  if (lp.id === "e6e58ed6-8eae-45b3-917f-90196b5ecbfe" || lp.landing?.campaignKey === "black") {
    return <BlackLandingPage slug={slug} />;
  }

  const ctx = await loadPublicContext({ blocks: lp.blocks, data: lp.data });
  return <IndependentPage entry={lp} ctx={ctx} />;
}
