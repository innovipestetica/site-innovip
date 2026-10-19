import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { JsonLd, PageOpening } from "@/components/site/page-parts";
import { getMedia, getPublicSettings, getPublishedEntry, loadPublicContext } from "@/lib/cms/public-data";
import type { SiteSettings } from "@/lib/cms/settings";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

export async function generateMetadata(): Promise<Metadata> {
  const [home, settings] = await Promise.all([getPublishedEntry("home", "home"), getPublicSettings()]);
  if (!home) {
    return { title: { absolute: "Innovip — Clínica de Estética" }, robots: { index: false, follow: false } };
  }
  const image = await getMedia(home.seo.mediaId ?? (home.data.mediaId as string | undefined));
  return {
    ...buildMetadata({
      title: home.seo.title || settings.seo_default_title || home.title,
      description: home.seo.description || settings.seo_default_description || home.summary,
      path: "/",
      seo: home.seo,
      image,
    }),
    title: { absolute: home.seo.title || settings.seo_default_title || home.title },
  };
}

/** Negócio local com dados factuais das Configurações públicas. */
function localBusiness(s: SiteSettings) {
  if (!s.business_name) return null;
  const a = s.address;
  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: s.business_name,
    url: absoluteUrl("/"),
    ...(s.phone ? { telephone: `+${s.phone}` } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(a?.street && a.city
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: [a.street, a.number, a.complement].filter(Boolean).join(", "),
            addressLocality: a.city,
            ...(a.state ? { addressRegion: a.state } : {}),
            ...(a.postal_code ? { postalCode: a.postal_code } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(s.map_url ? { hasMap: s.map_url } : {}),
    sameAs: Object.values(s.social ?? {}).filter(Boolean),
  };
}

export default async function HomePage() {
  const [home, settings] = await Promise.all([getPublishedEntry("home", "home"), getPublicSettings()]);

  // Sem Home publicada: página provisória (noindex), sem conteúdo inventado.
  if (!home) {
    return (
      <main id="conteudo" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center" {...pageAttrs("home")}>
        <Logo size={220} priority />
        <h1 className="text-2xl font-bold text-brand-800 sm:text-3xl">Site em construção</h1>
        <p className="max-w-md text-base text-muted">Em breve, o novo site da Innovip.</p>
      </main>
    );
  }

  const ctx = await loadPublicContext({ blocks: home.blocks, data: home.data });
  const business = localBusiness(settings);
  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("home")}>
      <PageOpening firstBlockType={home.blocks[0]?.type} title={home.title} summary={home.summary} />
      <RenderBlocks blocks={home.blocks} ctx={ctx} />
      {business ? <JsonLd data={business} /> : null}
    </main>
  );
}
