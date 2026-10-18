import { expect, test } from "@playwright/test";

test.describe("fundação", () => {
  test("página inicial renderiza com um título e sem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("cabeçalhos de segurança presentes", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("anônimo em /admin é redirecionado ao login, sem cache e noindex", async ({ page }) => {
    const response = await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("anônimo não acessa nenhuma tela do CMS", async ({ request }) => {
    for (const path of [
      "/admin/conteudo/tratamentos",
      "/admin/conteudo/tratamentos/novo",
      "/admin/conteudo/paginas/00000000-0000-4000-8000-000000000000",
      "/admin/midia",
      "/admin/taxonomias",
      "/admin/configuracoes",
      "/admin/redirecionamentos",
      "/admin/previa/00000000-0000-4000-8000-000000000000",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers()["location"], path).toContain("/admin/login");
      expect(res.headers()["cache-control"], path).toContain("no-store");
    }
  });

  test("anônimo em rota protegida preserva o destino interno", async ({ page }) => {
    await page.goto("/admin/redefinir-senha");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fredefinir-senha$/);
  });

  test("login: campos com label, erro associado e área de toque", async ({ page }) => {
    await page.goto("/admin/login");
    const email = page.getByLabel("E-mail");
    const senha = page.getByLabel("Senha");
    await expect(email).toBeVisible();
    await expect(senha).toBeVisible();

    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = await email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText("Informe um e-mail válido.");

    const box = await page.getByRole("button", { name: "Entrar" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("antes do JavaScript, formulários de auth não enviam campos pela URL", async ({ request }) => {
    for (const path of ["/admin/login", "/admin/recuperar-senha"]) {
      const html = await (await request.get(path)).text();
      // O login pode vir só com o fallback do Suspense (form renderizado no
      // cliente). Se o form vier no HTML do servidor: POST e envio desativado.
      const forms = html.match(/<form[^>]*>/g) ?? [];
      for (const form of forms) expect(form, path).toContain('method="post"');
      const submits = html.match(/<button[^>]*type="submit"[^>]*>/g) ?? [];
      for (const button of submits) expect(button, path).toMatch(/\sdisabled/);
    }
  });

  test("login com credenciais erradas mostra mensagem neutra", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill("nao-existe@example.invalid");
    await page.getByLabel("Senha").fill("senha-incorreta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("#conteudo").getByRole("alert")).toHaveText(
      /E-mail ou senha inválidos\.|Muitas tentativas/,
    );
  });

  test("recuperação de senha responde sem revelar se a conta existe", async ({ page }) => {
    await page.goto("/admin/recuperar-senha");
    await page.getByLabel("E-mail").fill("nao-existe@example.invalid");
    await page.getByRole("button", { name: "Enviar link" }).click();
    const main = page.locator("#conteudo");
    await expect(main.getByRole("status").or(main.getByRole("alert"))).toHaveText(
      /Se o e-mail estiver cadastrado|Muitas solicitações/,
    );
  });

  test("open redirect bloqueado no retorno de e-mail", async ({ page }) => {
    await page.goto("/auth/confirm?next=https://malicioso.example/admin");
    await expect(page).toHaveURL(/\/admin\/login\?erro=link$/);
  });

  test("404 com alternativa de navegação", async ({ page }) => {
    const res = await page.goto("/pagina-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Ir para a página inicial" })).toBeVisible();
  });

  test("robots.txt bloqueia indexação antes do lançamento", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(await res.text()).toMatch(/Disallow: \/\s*$/m);
  });
});
