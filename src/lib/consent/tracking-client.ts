"use client";

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  consentModeSignals,
  parseConsent,
  safePath,
  serializeConsent,
  trackingCookieNames,
  type ConsentChoice,
} from "./consent";

/**
 * Lado do navegador do consentimento e da medição.
 * - O GTM só é carregado DEPOIS de consentimento de analytics ou marketing
 *   (modo básico: nenhum ping antes do consentimento).
 * - Eventos só entram no dataLayer com consentimento, sem dados pessoais,
 *   sem query string, com event_id aleatório.
 */

type DataLayerItem = Record<string, unknown> | IArguments;
declare global {
  interface Window {
    dataLayer?: DataLayerItem[];
    __innovipGtmLoaded?: boolean;
  }
}

export const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

function readConsentRaw(): string | null {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.slice(CONSENT_COOKIE.length + 1) ?? null
  );
}

export function readConsent(): ConsentChoice | null {
  return parseConsent(readConsentRaw());
}

// Store mínimo para useSyncExternalStore: o cookie é a fonte da verdade.
const listeners = new Set<() => void>();
export const consentStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Valor bruto do cookie (string estável entre leituras). */
  getSnapshot: () => readConsentRaw() ?? "",
  /** No servidor não há escolha conhecida. */
  getServerSnapshot: () => null,
};
function notify() {
  for (const l of listeners) l();
}

export function writeConsent(choice: Pick<ConsentChoice, "analytics" | "marketing">, previous: ConsentChoice | null): ConsentChoice {
  const full: ConsentChoice = {
    version: CONSENT_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    id: previous?.id ?? crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(full))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  notify();
  return full;
}

/** Apaga cookies de GA/Meta no domínio atual e no domínio-pai. */
export function deleteTrackingCookies(revoked: { analytics: boolean; marketing: boolean }) {
  const names = trackingCookieNames(
    document.cookie.split("; ").map((c) => c.split("=")[0] ?? ""),
    revoked,
  );
  const host = window.location.hostname;
  const domains = ["", host, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  // gtag precisa empurrar o objeto `arguments` (formato esperado pelo GTM).
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer = window.dataLayer ?? []).push(arguments);
}

/** Atualiza o Consent Mode (só faz efeito se o GTM estiver carregado). */
export function updateConsentMode(choice: Pick<ConsentChoice, "analytics" | "marketing">) {
  if (window.__innovipGtmLoaded) gtag("consent", "update", consentModeSignals(choice));
}

/** Carrega o GTM uma única vez, com padrões negados + escolhas reais. */
export function loadGtm(gtmId: string, choice: Pick<ConsentChoice, "analytics" | "marketing">) {
  if (window.__innovipGtmLoaded || !GTM_ID_PATTERN.test(gtmId)) return;
  window.dataLayer = window.dataLayer ?? [];
  gtag("consent", "default", { ...consentModeSignals(null), wait_for_update: 500 });
  gtag("consent", "update", consentModeSignals(choice));
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(script);
  window.__innovipGtmLoaded = true;
}

export type PageInfo = { type: string; sensitive: boolean };

/** Lê o tipo da página marcado pelo servidor em <main data-page-type>. */
export function currentPageInfo(): PageInfo {
  const el = document.querySelector<HTMLElement>("[data-page-type]");
  return {
    type: el?.dataset.pageType ?? "other",
    sensitive: el?.dataset.pageSensitive === "true",
  };
}

/** Evento no dataLayer: só parâmetros aprovados (ver docs/eventos.md). */
export function pushEvent(event: string, params: Record<string, string | boolean | number>) {
  (window.dataLayer = window.dataLayer ?? []).push({ event, event_id: crypto.randomUUID(), ...params });
}

export function pushPageView(siteName: string) {
  const page = currentPageInfo();
  const path = safePath(window.location.pathname);
  pushEvent("page_view", {
    page_type: page.type,
    // Marketing (ex.: Meta) deve ignorar páginas sensíveis até revisão.
    page_sensitive: page.sensitive,
    page_location: `${window.location.origin}${path}`,
    page_path: path,
    // Título genérico em páginas que podem revelar interesse de saúde.
    page_title: page.sensitive ? siteName : document.title.slice(0, 120),
  });
}
