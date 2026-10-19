import { expect, test, type Page } from "@playwright/test";

/**
 * Catálogo /tratamentos: filtra enquanto digita/escolhe (sem botão), mantém o
 * estado no endereço e aceita links com ?q=&objetivo=&categoria=.
 * Funciona com qualquer conteúdo publicado.
 */
const cards = (page: Page) => page.locator("main ul.card-grid > li");
const titles = (page: Page) => page.locator("main ul.card-grid h3").allTextContents();

test.describe("filtro do catálogo", () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/tratamentos");
    test.skip(res.status() !== 200, "catálogo sem tratamentos publicados");
  });

  test("sem botão Filtrar; digitar filtra na hora e atualiza o endereço", async ({ page }) => {
    await page.goto("/tratamentos");
    await expect(page.locator("#busca")).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrar" })).toHaveCount(0);

    const all = await cards(page).count();
    const first = (await titles(page))[0]!;
    const term = first.split(" ")[0]!.slice(0, 5);
    const urlBefore = page.url();

    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    await page.locator("#busca").fill(term);
    // Todo card visível contém o termo (no título ou no resumo).
    await expect
      .poll(async () => (await cards(page).allTextContents()).every((t) => norm(t).includes(norm(term))))
      .toBe(true);
    await expect(cards(page)).not.toHaveCount(0);
    expect(await cards(page).count()).toBeLessThanOrEqual(all);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(term)}`));
    expect(page.url()).not.toBe(urlBefore);

    await page.locator("#busca").fill("zzzz-nada");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText("Nenhum tratamento com esses filtros")).toBeVisible();

    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(cards(page)).toHaveCount(all);
    await expect(page).toHaveURL(/\/tratamentos$/);
  });

  test("escolher objetivo filtra sem recarregar e vai para o endereço", async ({ page }) => {
    await page.goto("/tratamentos");
    const options = await page.locator("#objetivo option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value).filter(Boolean));
    test.skip(options.length === 0, "sem objetivos com tratamentos");
    const all = await cards(page).count();
    // Marca na página: some se ela recarregar.
    await page.evaluate(() => ((window as unknown as { __semRecarregar: boolean }).__semRecarregar = true));

    await page.locator("#objetivo").selectOption(options[0]!);
    await expect(page).toHaveURL(new RegExp(`objetivo=${options[0]}`));
    expect(await cards(page).count()).toBeLessThanOrEqual(all);
    await expect(page.getByRole("status").filter({ hasText: "resultado(s)" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar)).toBe(true);
  });

  test("link com filtros abre já filtrado e com os campos preenchidos", async ({ page, request }) => {
    const html = await (await request.get("/tratamentos")).text();
    const objetivo = /<option value="([a-z0-9-]+)">/.exec(html.slice(html.indexOf('id="inicial-objetivo"')))?.[1];
    test.skip(!objetivo, "sem objetivos");
    await page.goto(`/tratamentos?objetivo=${objetivo}&q=`);
    await expect(page.locator("#objetivo")).toHaveValue(objetivo!);
    const filtered = await cards(page).count();
    await page.goto("/tratamentos");
    expect(filtered).toBeLessThanOrEqual(await cards(page).count());
  });
});
