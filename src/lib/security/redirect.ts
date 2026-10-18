/**
 * Proteção contra open redirect: aceita apenas caminhos internos do painel.
 * Qualquer valor fora da lista (URL absoluta, "//host", "\\host", esquemas,
 * caracteres de controle) cai no destino padrão.
 */
const ALLOWED_PREFIXES = ["/admin"] as const;
const DEFAULT_PATH = "/admin";

export function safeAdminPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_PATH,
): string {
  if (!candidate || candidate.length > 512) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  let url: URL;
  try {
    url = new URL(candidate, "https://interno.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://interno.invalid") return fallback;

  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) return fallback;

  // Descarta query e hash: não propagamos parâmetros arbitrários.
  return url.pathname;
}
