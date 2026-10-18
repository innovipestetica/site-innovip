import "server-only";
import { getPublicSettings, listPublishedSlugs } from "./public-data";

export type NavItem = { label: string; href: string };

/**
 * Menu do site. Usa o menu das Configurações públicas quando definido;
 * senão monta um padrão SÓ com seções que têm conteúdo publicado
 * (nenhum link para página vazia).
 */
export async function getNavigation(): Promise<NavItem[]> {
  const settings = await getPublicSettings();
  if (settings.nav?.length) return settings.nav;

  const [treatments, promotions, posts, pages] = await Promise.all([
    listPublishedSlugs("treatment"),
    listPublishedSlugs("promotion"),
    listPublishedSlugs("blog_post"),
    listPublishedSlugs("page"),
  ]);
  const has = (slug: string) => pages.includes(slug);

  const items: (NavItem | false)[] = [
    treatments.length > 0 && { label: "Tratamentos", href: "/tratamentos" },
    has("resultados") && { label: "Resultados", href: "/resultados" },
    promotions.length > 0 && { label: "Promoções", href: "/promocoes" },
    has("a-innovip") && { label: "A Innovip", href: "/a-innovip" },
    posts.length > 0 && { label: "Blog", href: "/blog" },
    has("contato") && { label: "Contato", href: "/contato" },
  ];
  return items.filter((i): i is NavItem => i !== false);
}

/** Links legais do rodapé (só se a página existir publicada). */
export async function getLegalLinks(): Promise<NavItem[]> {
  const pages = await listPublishedSlugs("page");
  return [
    pages.includes("privacidade") && { label: "Política de privacidade", href: "/privacidade" },
    pages.includes("cookies") && { label: "Política de cookies", href: "/cookies" },
  ].filter((i): i is NavItem => !!i);
}
