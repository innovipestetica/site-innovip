import { expect, test, type Page } from "@playwright/test";

/**
 * Carrossel de banners da Home (funciona com qualquer quantidade de banners;
 * testes de troca são pulados quando há um só).
 * WCAG 2.2.2: movimento automático com pausa e respeito a "reduzir movimento".
 */
const carousel = (page: Page) => page.locator('[aria-roledescription="carrossel"]');
const visibleSlide = (page: Page) => carousel(page).locator('[aria-roledescription="banner"][aria-hidden="false"]');
const slides = (page: Page) => carousel(page).locator('[aria-roledescription="banner"]');
let n = 0;
const needsTwo = () => test.skip(n < 2, "carrossel com um banner só (nada para trocar)");

test.describe("carrossel de banners", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    test.skip((await carousel(page).count()) === 0, "Home sem carrossel");
    n = await slides(page).count();
  });

  test("um banner visível por vez; os outros ocultos e inertes", async ({ page }) => {
    await expect(visibleSlide(page)).toHaveCount(1);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `1 de ${n}`);
    if (n > 1) {
      await expect(slides(page).nth(1)).toHaveAttribute("aria-hidden", "true");
      await expect(slides(page).nth(1)).toHaveAttribute("inert", "");
    }
    // Página continua com um h1 (só para leitores de tela quando abre com carrossel).
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("setas, indicadores e teclado", async ({ page }) => {
    needsTwo();
    await page.getByRole("button", { name: "Próximo banner" }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `2 de ${n}`);
    await page.getByRole("button", { name: "Banner anterior" }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `1 de ${n}`);
    await page.getByRole("button", { name: `Mostrar banner ${n} de ${n}` }).click();
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `${n} de ${n}`);
    await expect(page.getByRole("button", { name: `Mostrar banner ${n} de ${n}` })).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("ArrowRight");
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `1 de ${n}`); // volta ao início
  });

  test("passa sozinho e para com o botão de pausa", async ({ page }) => {
    needsTwo();
    test.skip((await page.getByRole("button", { name: /Pausar a passagem/ }).count()) === 0, "passagem automática desligada");
    await page.mouse.move(0, 0); // fora do carrossel
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `2 de ${n}`, { timeout: 15_000 });

    await page.getByRole("button", { name: "Pausar a passagem dos banners" }).click();
    await page.locator("footer").first().click({ position: { x: 5, y: 5 } }); // tira o foco e o mouse
    await page.mouse.move(0, 0);
    const current = await visibleSlide(page).getAttribute("aria-label");
    await page.waitForTimeout(7500);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", current!);
    await expect(page.getByRole("button", { name: "Continuar a passagem dos banners" })).toBeVisible();
  });

  test("com 'reduzir movimento' não passa sozinho nem mostra pausa", async ({ page }) => {
    needsTwo();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.mouse.move(0, 0);
    await expect(page.getByRole("button", { name: /Pausar a passagem/ })).toHaveCount(0);
    await page.waitForTimeout(7500);
    await expect(visibleSlide(page)).toHaveAttribute("aria-label", `1 de ${n}`);
  });

  test("imagem própria para celular e primeiro banner com prioridade", async ({ page }) => {
    const first = slides(page).first();
    // A imagem de celular é opcional; quando existe, vem como <source> só para telas pequenas.
    for (const media of await first.locator("source").evaluateAll((els) => els.map((e) => e.getAttribute("media")))) {
      expect(media).toBe("(max-width: 767px)");
    }
    await expect(first.locator("img")).toHaveAttribute("fetchpriority", "high");
    if (n > 1) await expect(slides(page).nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  });
});
