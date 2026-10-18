/**
 * Tags de cache das leituras PÚBLICAS ('use cache' + cacheTag).
 * O site é pequeno: qualquer publicação invalida todo o conteúdo público
 * (páginas, listagens e sitemap) — simples e sem risco de esquecer uma
 * dependência entre conteúdos. Alvo: refletir no site em até 60 s.
 */
export const TAG = {
  content: "content",
  settings: "settings",
  taxonomies: "taxonomies",
  redirects: "redirects",
  media: "media",
} as const;

export type CacheTag = (typeof TAG)[keyof typeof TAG];
