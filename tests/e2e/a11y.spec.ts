import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Acessibilidade automatizada (axe-core) com regras WCAG 2.0/2.1/2.2 A e AA.
 * Cobre o que é detectável por máquina (contraste, nomes acessíveis,
 * semântica, rótulos). Teclado, leitores de tela e reduced-motion seguem
 * com verificação manual (docs/relatorio-testes.md).
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PUBLIC_PAGES = [
  "/",
  "/tratamentos",
  "/tratamentos/demo-limpeza-de-pele",
  "/tratamentos/categoria/demo-faciais",
  "/promocoes",
  "/promocoes/demo-promocao-vigente",
  "/promocoes/demo-promocao-encerrada",
  "/lp/demo-campanha",
  "/blog",
  "/blog/demo-post",
  "/demo-sobre",
  "/pagina-inexistente",
];

const ADMIN_PAGES = ["/admin/login", "/admin/recuperar-senha"];

for (const path of [...PUBLIC_PAGES, ...ADMIN_PAGES]) {
  test(`sem violações WCAG A/AA detectáveis: ${path}`, async ({ page, request }) => {
    const status = (await request.get(path, { maxRedirects: 0 })).status();
    test.skip(status !== 200 && path !== "/pagina-inexistente", `página indisponível (${status}) — conteúdo de demonstração ausente?`);
    await page.goto(path);
    // Aguarda conteúdo em streaming (promoções, filtros).
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((v) => ({
      regra: v.id,
      impacto: v.impact,
      nós: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
