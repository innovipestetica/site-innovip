import "server-only";

const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;

/**
 * Rastreamento só liga com TRACKING_ENABLED=true, ID do GTM válido e fora
 * de previews/desenvolvimento da Vercel (sem tags de produção em staging).
 * Lido no build das páginas públicas (variáveis de build).
 */
export function trackingConfig(): { enabled: false } | { enabled: true; gtmId: string } {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  const vercelEnv = process.env.VERCEL_ENV;
  const enabled =
    process.env.TRACKING_ENABLED === "true" &&
    GTM_ID.test(gtmId) &&
    (vercelEnv === undefined || vercelEnv === "production");
  return enabled ? { enabled: true, gtmId } : { enabled: false };
}

/** Tipos de página que podem revelar interesse de saúde (marketing bloqueado). */
export const SENSITIVE_PAGE_TYPES = new Set(["treatment", "category", "promotion", "landing"]);

export function pageAttrs(type: string) {
  return { "data-page-type": type, "data-page-sensitive": String(SENSITIVE_PAGE_TYPES.has(type)) };
}
