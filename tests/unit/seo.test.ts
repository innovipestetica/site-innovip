import { describe, expect, it } from "vitest";
import { buildMetadata, jsonLdString } from "@/lib/seo";

// Barra invertida montada por código (evita ambiguidade de escapes no fonte).
const BS = String.fromCharCode(92);

describe("JSON-LD seguro", () => {
  it("não permite fechar a tag script nem injetar HTML", () => {
    const out = jsonLdString({ name: "</script><script>alert(1)</script> & <b>" });
    expect(out).not.toMatch(/[<>&]/);
    expect(out).toContain(`${BS}u003c/script${BS}u003e`);
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script> & <b>" });
  });

  it("escapa separadores de linha U+2028/U+2029", () => {
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = jsonLdString({ text });
    expect(out).toContain(`${BS}u2028`);
    expect(out).toContain(`${BS}u2029`);
    expect(JSON.parse(out).text).toBe(text);
  });
});

describe("metadados", () => {
  it("canonical usa a URL configurada e fica noindex antes do lançamento", () => {
    const meta = buildMetadata({ title: "Limpeza", path: "/tratamentos/limpeza" });
    expect(String(meta.alternates?.canonical)).toMatch(/\/tratamentos\/limpeza$/);
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("noindex do conteúdo também impede seguir links", () => {
    const meta = buildMetadata({ title: "LP", path: "/lp/x", seo: { noindex: true } });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
