import type { MetadataRoute } from "next";

/** Permite páginas públicas e mantém áreas internas fora dos rastreadores. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/api", "/agendar-avaliacao"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
