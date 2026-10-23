import type { Metadata } from "next";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { Breadcrumbs, PageOpening } from "@/components/site/page-parts";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";
import { getRedirect } from "@/lib/cms/public-data";
import { absoluteUrl } from "@/lib/seo";
import { RedirectPreview } from "@/components/site/redirect-preview";

/**
 * Páginas institucionais do CMS (tipo "page"): /a-innovip, /contato,
 * /resultados, /privacidade, /cookies… Qualquer outro caminho cai aqui e é
 * resolvido por redirecionamento cadastrado ou 404.
 */
export async function generateStaticParams() {
  const slugs = await listPublishedSlugs("page");
  // Cache Components exige ao menos um parâmetro; o marcador vira 404.
  return slugs.length ? slugs.map((slug) => ({ caminho: [slug] })) : [{ caminho: ["__marcador__"] }];
}

async function load(caminho: string[]) {
  if (caminho.length !== 1) return null;
  return getPublishedEntry("page", caminho[0]!);
}

export async function generateMetadata({ params }: PageProps<"/[...caminho]">): Promise<Metadata> {
  const { caminho } = await params;
  const page = await load(caminho);
  if (!page) {
    const path = `/${caminho.join("/")}`;
    const redirect = await getRedirect(path);
    if (!redirect?.previewTitle) return { robots: { index: false, follow: false } };
    const image = await getMedia(redirect.previewMediaId);
    const largest = image?.sources.at(-1);
    return {
      title: redirect.previewTitle,
      description: redirect.previewDescription || undefined,
      robots: { index: false, follow: true },
      openGraph: {
        title: redirect.previewTitle,
        description: redirect.previewDescription || undefined,
        siteName: redirect.previewSiteName || undefined,
        url: absoluteUrl(path),
        type: "website",
        locale: "pt_BR",
        images: largest ? [{ url: largest.url, width: largest.width, alt: image?.alt }] : undefined,
      },
    };
  }
  const image = await getMedia(page.seo.mediaId ?? (page.data.mediaId as string | undefined));
  return buildMetadata({ title: page.title, description: page.summary, path: `/${page.slug}`, seo: page.seo, image });
}

export default async function CmsPage({ params }: PageProps<"/[...caminho]">) {
  const { caminho } = await params;
  const page = await load(caminho);
  if (!page) {
    const redirect = await getRedirect(`/${caminho.join("/")}`);
    if (redirect?.previewTitle) return <RedirectPreview target={redirect.target} />;
    return resolveMissing(`/${caminho.join("/")}`);
  }

  const ctx = await loadPublicContext({ blocks: page.blocks, data: page.data });
  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("page")}>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: page.title, href: `/${page.slug}` }]} />
      <PageOpening firstBlockType={page.blocks[0]?.type} title={page.title} summary={page.summary} />
      <RenderBlocks blocks={page.blocks} ctx={ctx} />
    </main>
  );
}
