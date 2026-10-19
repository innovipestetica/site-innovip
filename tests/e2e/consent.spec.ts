import { expect, test, type Page } from "@playwright/test";

/**
 * Consentimento e medição. Rodam contra um build com rastreamento ligado:
 *   TRACKING_ENABLED=true NEXT_PUBLIC_GTM_ID=GTM-TESTE01 npm run build
 * O script do GTM é interceptado (nada sai para a internet) e o registro em
 * /api/consent é simulado nos testes de interface (não grava no banco).
 * Pulados automaticamente quando o rastreamento está desligado.
 */

async function setup(page: Page) {
  const gtmRequests: string[] = [];
  await page.route("https://www.googletagmanager.com/**", (route) => {
    gtmRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/javascript", body: "/* gtm falso */" });
  });
  await page.route("**/api/consent", (route) => route.fulfill({ status: 204 }));
  return gtmRequests;
}

const dataLayer = (page: Page) =>
  page.evaluate(() => JSON.parse(JSON.stringify((window.dataLayer ?? []).map((i) => (Array.isArray(i) || typeof i !== "object" ? i : { ...i })))));

test.describe("consentimento e medição", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const enabled = await page.getByRole("button", { name: "Preferências de cookies" }).count();
    test.skip(enabled === 0, "rastreamento desligado neste build");
  });

  test("sem escolha: banner visível e nenhum GTM carregado", async ({ page, context }) => {
    await context.clearCookies();
    const gtm = await setup(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Cookies e privacidade" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(gtm).toHaveLength(0);
  });

  test("rejeitar: nada carrega e a escolha vale nas próximas páginas", async ({ page, context }) => {
    await context.clearCookies();
    const gtm = await setup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Rejeitar" }).click();
    await expect(page.getByRole("heading", { name: "Cookies e privacidade" })).toHaveCount(0);
    await page.goto("/tratamentos/demo-limpeza-de-pele").catch(() => {});
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Cookies e privacidade" })).toHaveCount(0);
    expect(gtm).toHaveLength(0);
    const cookie = (await context.cookies()).find((c) => c.name === "innovip_consent");
    expect(decodeURIComponent(cookie!.value)).toMatch(/\|0\|0\|/);
  });

  test("aceitar: GTM carrega após o consentimento, page_view sem query", async ({ page, context }) => {
    await context.clearCookies();
    const gtm = await setup(page);
    await page.goto("/?utm_source=teste&email=alguem@example.com");
    expect(gtm).toHaveLength(0);
    await page.getByRole("button", { name: "Aceitar" }).click();
    await expect.poll(() => gtm.length).toBe(1);

    const layer = await dataLayer(page);
    const views = layer.filter((e: { event?: string }) => e.event === "page_view");
    expect(views).toHaveLength(1);
    expect(views[0].page_location).not.toContain("?");
    expect(JSON.stringify(layer)).not.toContain("alguem@example.com");
    expect(JSON.stringify(layer)).not.toContain("utm_source");
    // Consent Mode: padrão negado antes do update concedido.
    const consentCalls = layer.filter((e: Record<string, unknown>) => e[0] === "consent");
    expect(consentCalls[0][1]).toBe("default");
    expect(consentCalls[0][2].analytics_storage).toBe("denied");
  });

  test("só analytics: sinais de anúncio continuam negados", async ({ page, context }) => {
    await context.clearCookies();
    await setup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Personalizar" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferências de cookies" });
    await dialog.getByRole("checkbox", { name: /Analytics/ }).check();
    await dialog.getByRole("button", { name: "Salvar escolhas" }).click();
    await expect.poll(async () => (await dataLayer(page)).some((e: Record<string, unknown>) => e[0] === "consent" && e[1] === "update")).toBe(true);
    const update = (await dataLayer(page)).find((e: Record<string, unknown>) => e[0] === "consent" && e[1] === "update");
    expect(update[2]).toMatchObject({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  });

  test("página de tratamento é sensível: título genérico", async ({ page, context, request }) => {
    test.skip((await request.get("/tratamentos/demo-limpeza-de-pele")).status() !== 200, "sem conteúdo de demonstração");
    await context.clearCookies();
    await setup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Aceitar" }).click();
    await page.goto("/tratamentos/demo-limpeza-de-pele");
    await expect.poll(async () => (await dataLayer(page)).filter((e: { event?: string }) => e.event === "page_view").length).toBe(1);
    const view = (await dataLayer(page)).find((e: { event?: string }) => e.event === "page_view");
    expect(view.page_sensitive).toBe(true);
    expect(view.page_type).toBe("treatment");
    expect(view.page_title).not.toMatch(/Limpeza/);
  });

  test("navegação no cliente: um page_view por página", async ({ page, context }) => {
    await context.clearCookies();
    await setup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Aceitar" }).click();
    await expect.poll(async () => (await dataLayer(page)).filter((e: { event?: string }) => e.event === "page_view").length).toBe(1);
    const link = page.locator('header a[href="/tratamentos"]').first();
    test.skip((await link.count()) === 0 || !(await link.isVisible()), "menu sem tratamentos neste viewport");
    await link.click();
    await page.waitForURL("**/tratamentos");
    await expect.poll(async () => (await dataLayer(page)).filter((e: { event?: string }) => e.event === "page_view").length).toBe(2);
    await page.waitForTimeout(500);
    expect((await dataLayer(page)).filter((e: { event?: string }) => e.event === "page_view")).toHaveLength(2);
  });

  test("revogar: apaga cookies de medição e recarrega", async ({ page, context }) => {
    await context.clearCookies();
    await setup(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Aceitar" }).click();
    await context.addCookies([{ name: "_ga", value: "GA1.1.123", url: page.url() }, { name: "_fbp", value: "fb.1.123", url: page.url() }]);
    await page.getByRole("button", { name: "Preferências de cookies" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferências de cookies" });
    await dialog.getByRole("checkbox", { name: /Analytics/ }).uncheck();
    await dialog.getByRole("checkbox", { name: /Marketing/ }).uncheck();
    await Promise.all([page.waitForEvent("load"), dialog.getByRole("button", { name: "Salvar escolhas" }).click()]);
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("_ga");
    expect(names).not.toContain("_fbp");
    expect(names).toContain("innovip_consent");
  });
});

test.describe("API de consentimento", () => {
  test("recusa outra origem, tipo errado e corpo inválido", async ({ request, baseURL }) => {
    const ok = { id: crypto.randomUUID(), version: "2026-10-18", analytics: true, marketing: false, path: "/" };
    expect((await request.post("/api/consent", { data: ok, headers: { origin: "https://malicioso.example" } })).status()).toBe(403);
    expect((await request.post("/api/consent", { data: "x", headers: { origin: baseURL!, "content-type": "text/plain" } })).status()).toBe(415);
    expect((await request.post("/api/consent", { data: { ...ok, id: "nao-uuid" }, headers: { origin: baseURL! } })).status()).toBe(400);
    expect((await request.post("/api/consent", { data: { ...ok, version: "1999-01-01" }, headers: { origin: baseURL! } })).status()).toBe(400);
  });
});
