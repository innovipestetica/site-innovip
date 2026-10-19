import type { Metadata } from "next";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { Breadcrumbs, JsonLd, PageIntro } from "@/components/site/page-parts";
import { getMedia, getPublishedEntry, listPublishedSlugs, loadPublicContext } from "@/lib/cms/public-data";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

export async function generateStaticParams() {
  const slugs = await listPublishedSlugs("blog_post");
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__marcador__" }];
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedEntry("blog_post", slug);
  if (!post) return { robots: { index: false, follow: false } };
  const image = await getMedia(post.seo.mediaId ?? (post.data.mediaId as string | undefined));
  return buildMetadata({ title: post.title, description: post.summary, path: `/blog/${slug}`, seo: post.seo, image, type: "article" });
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPublishedEntry("blog_post", slug);
  if (!post) return resolveMissing(`/blog/${slug}`);

  const ctx = await loadPublicContext({ blocks: post.blocks, data: post.data });
  const cover = typeof post.data.mediaId === "string" ? ctx.media.get(post.data.mediaId) : null;
  const publisher = ctx.settings.business_name || "Innovip";

  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("blog_post")}>
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title, href: `/blog/${post.slug}` },
        ]}
      />
      <article>
        <PageIntro title={post.title} summary={post.summary} media={cover}>
          {post.firstPublishedAt ? (
            <p className="text-sm text-muted">
              Publicado em <time dateTime={post.firstPublishedAt}>{dateFmt.format(new Date(post.firstPublishedAt))}</time>
            </p>
          ) : null}
        </PageIntro>
        <RenderBlocks blocks={post.blocks} ctx={ctx} />
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          ...(post.summary ? { description: post.summary } : {}),
          ...(post.firstPublishedAt ? { datePublished: post.firstPublishedAt } : {}),
          dateModified: post.updatedAt,
          mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
          ...(cover?.sources.at(-1) ? { image: cover.sources.at(-1)!.url } : {}),
          publisher: { "@type": "Organization", name: publisher },
          inLanguage: "pt-BR",
        }}
      />
    </main>
  );
}
