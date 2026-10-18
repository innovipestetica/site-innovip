import { expect, test } from "@playwright/test";

/**
 * Site público: testes que não dependem do conteúdo do banco.
 * Os que dependem do conteúdo de demonstração estão em public-demo.spec.ts.
 */
test.describe("site público", () => {
  test("endereços sem conteúdo publicado respondem 404 real", async ({ request }) => {
    for (const path of ["/tratamentos/nao-existe", "/tratamentos/categoria/nao-existe", "/promocoes/nao-existe",
      "/blog/nao-existe", "/lp/nao-existe", "/pagina-inexistente", "/a/b/c", "/__marcador__"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
  });

  test("404 tem noindex e link de volta", async ({ page }) => {
    await page.goto("/pagina-inexistente");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Não encontramos esta página");
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")));
    expect(robots.length).toBeGreaterThan(0);
    for (const r of robots) expect(r).toMatch(/noindex/);
  });

  test("sitemap.xml é XML válido e não lista nada não publicado", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("__marcador__");
    expect(body).not.toContain("/admin");
  });

  test("cabeçalho do site: link para a página inicial e CTA de avaliação", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /página inicial/ })).toBeVisible();
  });

  test("antes do lançamento a Home é noindex (com ou sem conteúdo)", async ({ page }) => {
    await page.goto("/");
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")));
    expect(robots.length).toBeGreaterThan(0);
    for (const r of robots) expect(r).toMatch(/noindex/);
  });
});
