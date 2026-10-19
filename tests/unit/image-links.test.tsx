import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import type { Block } from "@/lib/cms/blocks";
import type { RenderContext } from "@/lib/cms/render-context";

vi.mock("server-only", () => ({}));

/** HTML gerado para imagens com link (sem banco: contexto montado à mão). */
const A = "7d9f1c2a-1b2c-4d3e-8f90-112233445566";
const B = "8e0a2d3b-2c3d-4e4f-9a01-223344556677";
const media = (id: string, alt: string) => ({ id, alt, width: 1600, height: 600, sources: [{ url: `https://cdn.test/${id}.webp`, width: 1600 }] });
const ctx = {
  mode: "public",
  entries: new Map(),
  media: new Map([[A, media(A, "Clínica por dentro")], [B, media(B, "Equipe")]]),
  settings: {},
  categories: [],
  concerns: [],
  promotions: [],
} as unknown as RenderContext;

const html = (block: object) => renderToStaticMarkup(<RenderBlocks blocks={[{ id: "abcdef1", ...block } as Block]} ctx={ctx} />);
const links = (markup: string) => [...markup.matchAll(/<a [^>]*>/g)].map((m) => m[0]);

describe("imagens clicáveis", () => {
  it("imagem: link interno sem nova aba; sem link, nenhuma âncora", () => {
    const [a] = links(html({ type: "image", mediaId: A, link: "/tratamentos" }));
    expect(a).toContain('href="/tratamentos"');
    expect(a).not.toContain("target=");
    expect(links(html({ type: "image", mediaId: A }))).toHaveLength(0);
  });

  it("link externo abre em nova aba com rel seguro e aviso para leitor de tela", () => {
    const out = html({ type: "image", mediaId: A, link: "https://instagram.com/innovip" });
    expect(links(out)[0]).toMatch(/target="_blank".*rel="noopener noreferrer"|rel="noopener noreferrer".*target="_blank"/);
    expect(out).toContain("(abre em nova aba)");
  });

  it("galeria: link só nas imagens que têm", () => {
    const out = html({ type: "gallery", mediaIds: [A, B], links: { [B]: "/equipe" } });
    expect(links(out)).toHaveLength(1);
    expect(links(out)[0]).toContain('href="/equipe"');
  });

  it("banner sem botão: o banner inteiro é o link; com botão, só a imagem (sem link dentro de link)", () => {
    const whole = html({ type: "banner_carousel", slides: [{ key: "slide100", mediaId: A, title: "Novidade", link: "/promocoes" }] });
    expect(links(whole)).toHaveLength(1);
    expect(whole).toMatch(/<a [^>]*href="\/promocoes"[^>]*>.*Novidade.*<\/a>/s);

    const both = html({
      type: "banner_carousel",
      slides: [{ key: "slide100", mediaId: A, title: "Novidade", link: "/promocoes", action: { kind: "link", label: "Ver", href: "/contato" } }],
    });
    expect(links(both).map((a) => a.match(/href="([^"]+)"/)![1])).toEqual(["/promocoes", "/contato"]);
    expect(both).not.toMatch(/<a [^>]*href="\/promocoes"[^>]*>(?:(?!<\/a>).)*<a /s);
  });

  it("destaque (hero): imagem com link", () => {
    expect(links(html({ type: "hero", heading: "Oi", mediaId: A, imageLink: "/promocoes" }))[0]).toContain('href="/promocoes"');
  });
});
