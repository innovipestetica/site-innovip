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
    expect(styleWarnings({ background: "#183f35", text: "#ffffff", heading: "#f6edda", card: "#22574a", accent: "#e5c88b" })).toHaveLength(0);
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

describe("etiqueta das etapas", () => {
  const steps = [{ title: "Um" }, { title: "Dois", label: "Bônus" }];
  it("padrão “Etapa N”, palavra trocada, texto próprio por etapa ou nenhuma", () => {
    expect(html({ type: "steps", showLabel: true, items: steps })).toContain(">Etapa 1<");
    const passo = html({ type: "steps", showLabel: true, labelPrefix: "Passo", items: steps });
    expect(passo).toContain(">Passo 1<");
    expect(passo).toContain(">Bônus<");
    expect(passo).not.toContain("Passo 2");
    const none = html({ type: "steps", showLabel: false, items: steps });
    expect(none).not.toContain("Etapa");
    expect(none).not.toContain("Bônus");
    expect(html({ type: "steps", items: [{ title: "Antigo" }] })).toContain(">Etapa 1<"); // conteúdo salvo antes da opção
  });

  it("vale também no fluxo e no passo a passo com imagens", () => {
    const flow = html({ type: "care_flow", showLabel: true, labelPrefix: "Passo", items: [flowItems[0], { ...flowItems[1], label: "Conversa" }] });
    expect(flow).toContain(">Passo 01<");
    expect(flow).toContain(">Conversa<");
    expect(html({ type: "care_flow", showLabel: false, items: flowItems })).not.toContain("Etapa 0");
    const sc = html({ type: "steps_carousel", showLabel: false, autoplay: false, intervalSeconds: 5, items: [{ key: "s00001", title: "A" }] });
    expect(sc).not.toContain("Etapa 01");
  });
});

describe("perguntas frequentes", () => {
  it("duas colunas no computador", () => {
    const F = "aaaaaaaa-1111-4222-8333-444444444444";
    const faqCtx = { ...ctx, entries: new Map([[F, { id: F, type: "faq", slug: "x", title: "Dói?", summary: null, data: { answer: "Pouco." }, published: true }]]) } as unknown as RenderContext;
    const out = renderToStaticMarkup(<RenderBlocks blocks={[{ id: "abcdef1", type: "faq_list", entryIds: [F] } as Block]} ctx={faqCtx} />);
    expect(out).toContain("lg:grid-cols-2");
    expect(out).toContain("Dói?");
  });
});

describe("todos os blocos em todas as páginas", () => {
  it("Destaque no início vira h2 quando a página já tem título (tratamento, promoção, post)", () => {
    const hero = [{ id: "abcdef1", type: "hero", heading: "Bem-vinda" } as Block];
    expect(renderToStaticMarkup(<RenderBlocks blocks={hero} ctx={ctx} />)).toMatch(/<h1[^>]*>Bem-vinda/);
    const inPage = renderToStaticMarkup(<RenderBlocks blocks={hero} ctx={ctx} pageHasTitle />);
    expect(inPage).toMatch(/<h2[^>]*>Bem-vinda/);
    expect(inPage).not.toContain("<h1");
  });
});

describe("aviso de contraste dos cartões e destaques", () => {
  it("pega título e etiqueta difíceis de ler sobre cartão dourado", () => {
    const w = styleWarnings({ card: "#e5c88b", text: "#1e2b27", heading: "#2b6b59", background: "#2b6b59" });
    expect(w.some((x) => x.startsWith("Títulos dos cartões"))).toBe(true);
    expect(w.some((x) => x.startsWith("Destaques"))).toBe(true);
    expect(styleWarnings({ card: "#e5c88b", heading: "#183f35", accent: "#183f35", text: "#1e2b27" })).toHaveLength(0);
  });
});
