import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, blockSchema, newBlockId } from "@/lib/cms/blocks";
import {
  initialPayload,
  publicPath,
  slugify,
  validatePayload,
} from "@/lib/cms/content-types";
import {
  isSafeHref,
  parseRichText,
  richTextToPlain,
  richTextToSource,
} from "@/lib/cms/rich-text";

describe("biblioteca de blocos", () => {
  it("lista de tipos bate com a migração do banco", () => {
    const sql = readFileSync("supabase/migrations/20261019090000_cms_content.sql", "utf8");
    const match = sql.match(/b ->> 'type' = any \(array\[([\s\S]*?)\]\)/);
    expect(match).toBeTruthy();
    const dbTypes = [...match![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(dbTypes).toEqual([...BLOCK_TYPES].sort());
  });

  it("recusa bloco desconhecido e campo de HTML", () => {
    expect(blockSchema.safeParse({ id: "abc123", type: "html", html: "<b>x</b>" }).success).toBe(false);
    const parsed = blockSchema.safeParse({ id: "abc123", type: "notice", tone: "info", text: "ok", html: "<script>" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "html" in parsed.data).toBe(false); // campo extra descartado
  });

  it("ids de bloco novos são válidos e diferentes", () => {
    const a = newBlockId();
    const b = newBlockId();
    expect(a).toMatch(/^[a-z0-9]{6,24}$/);
    expect(a).not.toBe(b);
  });
});

describe("links seguros", () => {
  it.each(["/tratamentos/limpeza", "https://innovip.com.br", "tel:+5511999999999", "mailto:contato@exemplo.com"])(
    "aceita %s",
    (href) => expect(isSafeHref(href)).toBe(true),
  );
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>",
    "http://inseguro.com",
    "//evil.com",
    "https://user:pass@evil.com",
    "vbscript:x",
    " javascript:alert(1)",
  ])("recusa %s", (href) => expect(isSafeHref(href)).toBe(false));
});

describe("texto rico", () => {
  it("converte marcação leve e volta sem perdas", () => {
    const source = "## Como funciona\n\nTexto com **negrito**, *itálico* e [link](/contato).\n\n- um\n- dois\n\n1. primeiro\n2. segundo";
    const doc = parseRichText(source);
    expect(doc.map((n) => n.t)).toEqual(["h", "p", "ul", "ol"]);
    expect(richTextToSource(doc)).toBe(source);
    expect(richTextToPlain(doc)).toContain("Texto com negrito, itálico e link.");
  });

  it("link inseguro vira texto simples (nenhum href perigoso)", () => {
    for (const src of ["[clique](javascript:alert(1))", "[x](data:text/html,oi)", "[y](//evil.com)"]) {
      const doc = parseRichText(src);
      const nodes = doc.flatMap((n) => (n.t === "p" || n.t === "h" ? n.children : []));
      expect(nodes.some((n) => n.t === "link"), src).toBe(false);
      expect(richTextToPlain(doc), src).toContain(src.slice(1, src.indexOf("]")));
    }
  });
});

describe("validação de conteúdo", () => {
  it("slug sem acentos, minúsculo e com hífens", () => {
    expect(slugify("  Limpeza de Pele Profunda — Ação!  ")).toBe("limpeza-de-pele-profunda-acao");
  });

  it("caminho público por tipo", () => {
    expect(publicPath("treatment", "limpeza")).toBe("/tratamentos/limpeza");
    expect(publicPath("home", "home")).toBe("/");
    expect(publicPath("faq", "x")).toBeNull();
  });

  it("payload inicial do tratamento é válido e tem aviso de avaliação individual", () => {
    let n = 0;
    const payload = initialPayload("treatment", "Limpeza", () => `bloco${String(++n).padStart(3, "0")}`);
    const res = validatePayload("treatment", payload);
    expect(res.ok).toBe(true);
    expect(payload.blocks.some((b) => b.type === "notice")).toBe(true);
  });

  it("landing começa como noindex", () => {
    expect(initialPayload("landing", "LP", () => "abcdef1").seo.noindex).toBe(true);
  });

  it("bloco não permitido no tipo e datas invertidas são recusados", () => {
    const base = initialPayload("promotion", "Promo", () => "abcdef1");
    const res = validatePayload("promotion", {
      ...base,
      blocks: [{ id: "abcdef1", type: "hero", heading: "x" }],
      details: { starts_at: "2026-11-10T12:00:00-03:00", ends_at: "2026-11-01T12:00:00-03:00" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["blocks.0", "details.ends_at"]));
    }
  });

  it("descarta relações que não pertencem ao tipo", () => {
    const base = initialPayload("page", "Pág", () => "abcdef1");
    const res = validatePayload("page", {
      ...base,
      relations: { categories: ["7d9f1c2a-1b2c-4d3e-8f90-112233445566"], concerns: [], treatments: [] },
    });
    expect(res.ok && res.payload.relations.categories).toEqual([]);
  });
});

describe("destino do botão Agendar avaliação", async () => {
  const { evaluationTarget } = await import("@/lib/cms/settings");

  it("padrão: WhatsApp quando há número, senão formulário", () => {
    expect(evaluationTarget({ whatsapp: "5511999999999" }).mode).toBe("whatsapp");
    expect(evaluationTarget({}).href).toBe("/agendar-avaliacao");
  });

  it("link personalizado abre fora do site", () => {
    const t = evaluationTarget({ evaluation_cta: { mode: "link", url: "https://agenda.exemplo.com/innovip" } });
    expect(t).toMatchObject({ href: "https://agenda.exemplo.com/innovip", external: true });
  });

  it("WhatsApp nunca leva o tratamento na mensagem", () => {
    const t = evaluationTarget({ whatsapp: "5511999999999", evaluation_cta: { mode: "whatsapp" } }, { interest: "peeling" });
    expect(t.href).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
    expect(decodeURIComponent(t.href)).not.toContain("peeling");
  });

  it("WhatsApp escolhido sem número cai no formulário com o interesse", () => {
    const t = evaluationTarget({ evaluation_cta: { mode: "whatsapp" } }, { interest: "peeling" });
    expect(t).toMatchObject({ mode: "form", href: "/agendar-avaliacao?interesse=peeling", external: false });
  });

  it("rótulo personalizado", () => {
    expect(evaluationTarget({ evaluation_cta: { mode: "form", label: "Quero ser atendida" } }).label).toBe("Quero ser atendida");
  });
});
