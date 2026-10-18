import type { MetadataRoute } from "next";
import { publicPath, type ContentType } from "@/lib/cms/content-types";
import { getPublicTaxonomies, getPublishedEntry, listPublished } from "@/lib/cms/public-data";
import { absoluteUrl } from "@/lib/seo";

/**
 * Sitemap SOMENTE com páginas publicadas e indexáveis (sem noindex).
 * Em cache com a tag "content": atualiza a cada publicação.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const types: ContentType[] = ["page", "treatment", "promotion", "blog_post", "landing"];
  const [home, lists, { categories }] = await Promise.all([
    getPublishedEntry("home", "home"),
    Promise.all(types.map((t) => listPublished(t))),
    getPublicTaxonomies(),
  ]);

  const entries: MetadataRoute.Sitemap = [];
  if (home && !home.seo.noindex) entries.push({ url: absoluteUrl("/"), lastModified: home.updatedAt });

  const [pages, treatments, promotions, posts, landings] = lists as [
    Awaited<ReturnType<typeof listPublished>>, Awaited<ReturnType<typeof listPublished>>,
    Awaited<ReturnType<typeof listPublished>>, Awaited<ReturnType<typeof listPublished>>,
    Awaited<ReturnType<typeof listPublished>>,
  ];

  if (treatments.length) entries.push({ url: absoluteUrl("/tratamentos") });
  if (promotions.length) entries.push({ url: absoluteUrl("/promocoes") });
  if (posts.length) entries.push({ url: absoluteUrl("/blog") });

  for (const c of categories) {
    if (treatments.some((t) => t.treatment?.categoryIds.includes(c.id))) {
      entries.push({ url: absoluteUrl(`/tratamentos/categoria/${c.slug}`) });
    }
  }

  for (const item of [...pages, ...treatments, ...promotions, ...posts, ...landings]) {
    if (item.seo.noindex) continue;
    const path = publicPath(item.type, item.slug);
    if (path) entries.push({ url: absoluteUrl(path), lastModified: item.updatedAt });
  }
  return entries;
}
