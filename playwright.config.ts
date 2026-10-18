import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E contra o build de produção local (`next start`), não o modo dev, para
 * verificar cabeçalhos, cache e CSP como serão publicados.
 * Pré-requisito: `npm run build` com .env.local preenchido.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  // PW_CHANNEL=msedge (ou chrome) usa o navegador já instalado em vez de baixar o Chromium.
  use: { baseURL, trace: "retain-on-failure", channel: process.env.PW_CHANNEL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
