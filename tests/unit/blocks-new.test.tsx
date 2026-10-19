import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { RenderBlocks } = await import("@/components/blocks/render-blocks");
const { blockSchema } = await import("@/lib/cms/blocks");
const { contrastRatio, styleWarnings } = await import("@/lib/cms/block-style");
import type { Block } from "@/lib/cms/blocks";
import type { RenderContext } from "@/lib/cms/render-context";

const A = "7d9f1c2a-1b2c-4d3e-8f90-112233445566";
const media = { id: A, alt: "Sala", width: 1200, height: 800, sources: [{ url: "https://cdn.test/a.webp", width: 1200 }] };
const ctx = { mode: "public", entries: new Map(), media: new Map([[A, media]]), settings: {}, categories: [], concerns: [], promotions: [] } as unknown as RenderContext;
const html = (block: object) => renderToStaticMarkup(<RenderBlocks blocks={[{ id: "abcdef1", ...block } as Block]} ctx={ctx} />);
const ok = (block: object) => blockSchema.safeParse({ id: "abcdef1", ...block }).success;

const flowItems = [
  { key: "k00001", icon: "calendario-relogio", title: "Agende sua avaliação", text: "Escolha o melhor dia." },
  { key: "k00002", icon: "pessoa-conversa", title: "Avaliação individual" },
  { key: "k00003", icon: "documento-mais", title: "Plano de tratamento" },
  { key: "k00004", icon: "maos-coracao", title: "Acompanhamento" },
];

describe("cores por bloco", () => {
  it("aceita só cores #RRGGBB e aplica variáveis no invólucro", () => {
    expect(ok({ type: "notice", tone: "info", text: "Oi", style: { background: "#183f35", text: "#ffffff" } })).toBe(true);
    expect(ok({ type: "notice", tone: "info", text: "Oi", style: { background: "red" } })).toBe(false);
    expect(ok({ type: "notice", tone: "info", text: "Oi", style: { text: "#fff;background:url(x)" } })).toBe(false);
    const out = html({ type: "notice", tone: "info", text: "Oi", style: { background: "#183f35", text: "#ffffff" } });
    expect(out).toMatch(/<div class="blk"[^>]*style="--blk-bg:#183f35;--blk-text:#ffffff"[^>]*data-background=""[^>]*data-text=""/);
    expect(html({ type: "notice", tone: "info", text: "Oi" })).not.toContain('class="blk"');
  });

  it("avisa contraste baixo e calcula a razão WCAG", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(styleWarnings({ background: "#ffffff", text: "#eeeeee" })).not.toHaveLength(0);
    expect(styleWarnings({ background: "#183f35", text: "#ffffff", heading: "#f6edda", card: "#22574a" })).toHaveLength(0);
  });
});

describe("fluxo do atendimento", () => {
  it("valida de 2 a 6 etapas e só ícones da lista", () => {
    expect(ok({ type: "care_flow", heading: "Como funciona", items: flowItems })).toBe(true);
    expect(ok({ type: "care_flow", items: flowItems.slice(0, 1) })).toBe(false);
    expect(ok({ type: "care_flow", items: [...flowItems.slice(0, 1), { key: "k00009", icon: "<script>", title: "x" }] })).toBe(false);
  });

  it("renderiza título, cartões numerados com ícone e etiqueta de etapa", () => {
    const out = html({ type: "care_flow", eyebrow: "Cuidado em cada etapa", heading: "Como funciona o atendimento", items: flowItems });
    expect(out).toContain("Como funciona o atendimento");
    expect(out.match(/data-flow-card/g)).toHaveLength(4);
    expect(out.match(/data-flow-icon/g)).toHaveLength(4);
    expect(out).toContain("Etapa 01");
    expect(out).toContain("lg:grid-cols-4");
    // Sem JS tudo aparece (nada começa escondido no HTML do servidor).
    expect(out).not.toContain("opacity-0");
  });
});

describe("passo a passo com imagens e galeria", () => {
  it("passo a passo em carrossel com imagem por etapa", () => {
    const items = [1, 2, 3, 4].map((n) => ({ key: `s0000${n}`, title: `Etapa ${n}`, mediaId: n === 1 ? A : undefined }));
    expect(ok({ type: "steps_carousel", items })).toBe(true);
    const out = html({ type: "steps_carousel", heading: "Como é", items, autoplay: true, intervalSeconds: 5 });
    expect(out).toContain('aria-roledescription="carrossel"');
    expect(out.match(/aria-roledescription="item"/g)).toHaveLength(4);
    expect(out).toContain("https://cdn.test/a.webp");
  });

  it("galeria em grade centraliza (card-grid) e em carrossel usa o carrossel", () => {
    expect(html({ type: "gallery", mediaIds: [A], layout: "grid" })).toContain("card-grid");
    expect(html({ type: "gallery", mediaIds: [A] })).toContain("card-grid"); // conteúdo antigo, sem layout
    expect(html({ type: "gallery", mediaIds: [A], layout: "carousel", autoplay: false, intervalSeconds: 5 })).toContain('aria-roledescription="carrossel"');
  });
});
