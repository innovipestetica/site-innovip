import type { Metadata } from "next";
import { BlackLandingPage } from "@/components/site/black-landing-page";
import { getMedia, getPublishedEntry, listPublishedSlugs } from "@/lib/cms/public-data";
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

  return <BlackLandingPage slug={slug} />;
}
