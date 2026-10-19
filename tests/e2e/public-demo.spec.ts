import { expect, test } from "@playwright/test";

/**
 * Site público COM o conteúdo de demonstração (npm run demo:seed).
 * Pulados automaticamente quando a demonstração não existe.
 */
test.describe("site público com demonstração", () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/tratamentos/demo-limpeza-de-pele");
    test.skip(res.status() !== 200, "conteúdo de demonstração ausente (rode npm run demo:seed)");
  });

  test("promoção encerrada: aviso, alternativas e nenhum CTA de compra", async ({ page }) => {
    await page.goto("/promocoes/demo-promocao-encerrada");
    await expect(page.getByRole("status").filter({ hasText: "Oferta encerrada" })).toBeVisible();
    await expect(page.locator('a[data-cta="evaluation"][href*="promocao="]')).toHaveCount(0);
  });

  test("promoção vigente: preço, prazo e CTA (se houver destino de agendamento)", async ({ page, request }) => {
    const hasDestination = (await request.get("/agendar-avaliacao", { maxRedirects: 0 })).status() === 307;
    await page.goto("/promocoes/demo-promocao-vigente");
    await expect(page.getByText(/Válida até/)).toBeVisible();
    const cta = page.locator('a[data-cta="evaluation"][data-cta-location="promotion_page"]');
    await expect(cta).toHaveCount(hasDestination ? 1 : 0);
  });

  test("listagem de promoções exclui as encerradas", async ({ page }) => {
    await page.goto("/promocoes");
    await expect(page.getByRole("heading", { name: /Promoção vigente/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Promoção encerrada/ })).toHaveCount(0);
  });

  test("filtro do catálogo mantém a seleção e filtra", async ({ page }) => {
    await page.goto("/tratamentos?objetivo=demo-manchas");
    test.skip((await page.locator('#objetivo option[value="demo-manchas"]').count()) === 0, "objetivo de demonstração removido");
    await expect(page.locator("#objetivo")).toHaveValue("demo-manchas");
    await expect(page.locator("main h3")).toHaveCount(2);
  });

  test("botão sobre faixa escura tem contraste", async ({ page }) => {
    await page.goto("/");
    // Sem destino de agendamento o botão da faixa fica oculto (nada a medir).
    test.skip((await page.locator("section.bg-brand-800 a[data-cta]").count()) === 0, "faixa sem botão (sem destino)");
    const colors = await page.locator("section.bg-brand-800 a[data-cta]").first().evaluate((a) => ({
      fg: getComputedStyle(a).color,
      bg: getComputedStyle(a).backgroundColor,
      section: getComputedStyle(a.closest("section")!).backgroundColor,
    }));
    // Botão com fundo próprio: texto x fundo do botão; transparente: texto x faixa.
    const transparent = colors.bg === "rgba(0, 0, 0, 0)" || colors.bg === "transparent";
    expect(colors.fg).not.toBe(transparent ? colors.section : colors.bg);
  });

  test("menu móvel: aria-expanded, foco e Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só no celular");
    await page.goto("/");
    const button = page.locator("header button[aria-expanded]");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(":focus")).toHaveText("Tratamentos");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });

  test("páginas sem rolagem horizontal", async ({ page }) => {
    for (const path of ["/", "/tratamentos", "/tratamentos/demo-limpeza-de-pele", "/promocoes", "/lp/demo-campanha", "/blog/demo-post"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, path).toBe(false);
    }
  });

  test("sitemap lista o publicado e exclui a landing noindex", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("/tratamentos/demo-limpeza-de-pele");
    expect(body).not.toContain("/lp/demo-campanha");
  });
});
