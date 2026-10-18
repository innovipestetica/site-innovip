import type { MetadataRoute } from "next";

/**
 * Indexação só é liberada com SITE_INDEXING_ENABLED=true (produção, após o
 * lançamento). robots.txt não protege nada: /admin continua exigindo login.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXING_ENABLED !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/api", "/obrigado"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
