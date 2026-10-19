import Link from "next/link";
import type { Metadata } from "next";
import { Picture } from "@/components/blocks/render-blocks";
import { Breadcrumbs } from "@/components/site/page-parts";
import { listPublished } from "@/lib/cms/public-data";
import { contextForCards } from "@/lib/cms/public-media";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { pageAttrs } from "@/lib/consent/tracking-config";

export const metadata: Metadata = buildMetadata({
  title: "Blog",
  description: "Conteúdos educativos sobre estética e cuidados, da equipe Innovip.",
  path: "/blog",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

export default async function BlogPage() {
  const posts = (await listPublished("blog_post")).sort((a, b) =>
    (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? ""),
  );
  if (posts.length === 0) return resolveMissing("/blog");
  const ctx = await contextForCards(posts);

  return (
    <main id="conteudo" className="flex-1" {...pageAttrs("blog_list")}>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Blog", href: "/blog" }]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-center text-3xl font-bold text-brand-800 sm:text-5xl">Blog</h1>
        <ul className="card-grid mt-8 [--card-gap:1.5rem]">
          {posts.map((p) => {
            const cover = typeof p.data.mediaId === "string" ? ctx.media.get(p.data.mediaId) : undefined;
            return (
              <li key={p.id}>
                <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 text-center">
                  {cover ? <Picture media={cover} sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" /> : null}
                  <h2 className="mt-3 text-lg font-semibold text-brand-800">
                    <Link href={`/blog/${p.slug}`} className="hover:underline">{p.title}</Link>
                  </h2>
                  {p.firstPublishedAt ? (
                    <p className="mt-1 text-xs text-muted"><time dateTime={p.firstPublishedAt}>{dateFmt.format(new Date(p.firstPublishedAt))}</time></p>
                  ) : null}
                  {p.summary ? <p className="mt-2 text-sm text-muted">{p.summary}</p> : null}
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
