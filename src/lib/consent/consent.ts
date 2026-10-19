/**
 * Preferências de consentimento (LGPD) — compartilhado entre servidor e
 * navegador. Guardadas em cookie primário (necessário) legível pelo JS,
 * porque é o navegador que decide carregar ou não o GTM.
 *
 * Categorias: necessários (sempre), analytics e marketing (desligados por
 * padrão). Escolha versionada: mudar CONSENT_VERSION (ex.: nova política ou
 * nova ferramenta) faz o banner aparecer de novo para todos.
 */
export const CONSENT_COOKIE = "innovip_consent";
export const CONSENT_VERSION = "2026-10-18";
/** Pergunta de novo após ~6 meses. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type ConsentChoice = {
  version: string;
  analytics: boolean;
  marketing: boolean;
  /** Identificador pseudônimo do registro (sem relação com a pessoa). */
  id: string;
  /** Momento da escolha (ISO). */
  at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Formato compacto e sem dados pessoais: v|a|m|id|at */
export function serializeConsent(c: ConsentChoice): string {
  return [c.version, c.analytics ? "1" : "0", c.marketing ? "1" : "0", c.id, c.at].join("|");
}

/**
 * Lê o cookie. Valor inválido, adulterado ou de versão antiga → null
 * (trata como "sem escolha": nada não essencial carrega).
 */
export function parseConsent(raw: string | undefined | null): ConsentChoice | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const [version, a, m, id, at] = value.split("|");
  if (version !== CONSENT_VERSION) return null;
  if ((a !== "0" && a !== "1") || (m !== "0" && m !== "1")) return null;
  if (!id || !UUID.test(id) || !at || Number.isNaN(Date.parse(at))) return null;
  return { version, analytics: a === "1", marketing: m === "1", id, at };
}

/** Sinais do Google Consent Mode v2 derivados das escolhas reais. */
export function consentModeSignals(c: Pick<ConsentChoice, "analytics" | "marketing"> | null) {
  const granted = (on: boolean | undefined) => (on ? "granted" : "denied");
  return {
    analytics_storage: granted(c?.analytics),
    ad_storage: granted(c?.marketing),
    ad_user_data: granted(c?.marketing),
    ad_personalization: granted(c?.marketing),
    functionality_storage: "granted",
    security_storage: "granted",
  } as const;
}

/** Cookies de terceiros a apagar quando o consentimento é negado/revogado. */
export function trackingCookieNames(all: string[], revoked: { analytics: boolean; marketing: boolean }): string[] {
  return all.filter((name) => {
    if (revoked.analytics && (name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name === "_gat" || name.startsWith("_gat_"))) return true;
    if (revoked.marketing && (name === "_fbp" || name === "_fbc" || name === "_gcl_au" || name.startsWith("_gcl_"))) return true;
    return false;
  });
}

/**
 * Caminho seguro para registro/medição: só o pathname, sem query nem hash,
 * limitado e só com caracteres esperados.
 */
export function safePath(input: string): string {
  let path = input;
  try {
    path = new URL(input, "https://interno.invalid").pathname;
  } catch {
    return "/";
  }
  path = path.toLowerCase().slice(0, 200);
  return /^\/[a-z0-9/_-]*$/.test(path) ? path : "/";
}
