import { expect, test, type Page } from "@playwright/test";

/**
 * Carrossel de banners da Home (conteúdo de demonstração com 3 banners).
 * WCAG 2.2.2: movimento automático com pausa e respeito a "reduzir movimento".
 */
const carousel = (page: Page) => page.locator('[aria-roledescription="carrossel"]');
const visibleSlide = (page: Page) => carousel(page).locator('[aria-roledescription="banner"][aria-hidden="false"]');

test.describe("carrossel de banners", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    test.skip((await carousel(page).count()) === 0, "Home sem carrossel (demonstração ausente)");
  });

  test("um banner visível por vez; os outros ocultos e inertes", async ({ page }) => {
    const slides = carousel(page).locator('[aria-roledescription="banner"]');
    await expect(slides).toHaveCount(3);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "1 de 3");
    await expect(slides.nth(1)).toHaveAttribute("aria-hidden", "true");
    await expect(slides.nth(1)).toHaveAttribute("inert", "");
    // Página continua com um h1 (só para leitores de tela quando abre com carrossel).
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("setas, indicadores e teclado", async ({ page }) => {
    await page.getByRole("button", { name: "Próximo banner" }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "2 de 3");
    await page.getByRole("button", { name: "Banner anterior" }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "1 de 3");
    await page.getByRole("button", { name: "Mostrar banner 3 de 3" }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "3 de 3");
    await expect(page.getByRole("button", { name: "Mostrar banner 3 de 3" })).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("ArrowRight");
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "1 de 3"); // volta ao início
  });

  test("passa sozinho e para com o botão de pausa", async ({ page }) => {
    await page.mouse.move(0, 0); // fora do carrossel
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "2 de 3", { timeout: 15_000 });

    await page.getByRole("button", { name: "Pausar a passagem dos banners" }).click();
    await page.locator("footer").first().click({ position: { x: 5, y: 5 } }); // tira o foco e o mouse
    await page.mouse.move(0, 0);
    const current = await visibleSlide(page).getAttribute("aria-label");
    await page.waitForTimeout(7500);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", current!);
    await expect(page.getByRole("button", { name: "Continuar a passagem dos banners" })).toBeVisible();
  });

  test("com 'reduzir movimento' não passa sozinho nem mostra pausa", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.mouse.move(0, 0);
    await expect(page.getByRole("button", { name: /Pausar a passagem/ })).toHaveCount(0);
    await page.waitForTimeout(7500);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", "1 de 3");
  });

  test("imagem própria para celular e primeiro banner com prioridade", async ({ page }) => {
    const first = carousel(page).locator('[aria-roledescription="banner"]').first();
    await expect(first.locator('source[media="(max-width: 767px)"]')).toHaveCount(1);
    await expect(first.locator("img")).toHaveAttribute("fetchpriority", "high");
    await expect(carousel(page).locator('[aria-roledescription="banner"]').nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  });
});
