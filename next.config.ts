import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

function supabaseOrigins(): { http: string; ws: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  const url = new URL(raw);
  return {
    http: url.origin,
    ws: `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`,
  };
}

/**
 * CSP sem nonce, para manter páginas públicas estáticas/cacheáveis
 * (nonce exige renderização dinâmica em todas as páginas e é incompatível com
 * o static shell do Cache Components).
 * - 'unsafe-inline' em script-src: necessário para os scripts inline de
 *   hidratação do Next.js sem nonce. Mitigado por: React escapa saída, o CMS
 *   não aceita HTML/JS, e as demais diretivas restringem origens.
 * - 'unsafe-eval' só em desenvolvimento (exigido pelo React em dev).
 * - Origens de GTM/GA4/Meta entram na etapa de integrações, com consentimento.
 */
function contentSecurityPolicy(): string {
  const sb = supabaseOrigins();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(sb ? [sb.http] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(sb ? [sb.http, sb.ws] : [])],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Desligado de propósito: com ele, endereços não gerados no build recebem
  // a casca da página com status 200 antes de saber se o conteúdo existe.
  // Sem ele, slug inexistente responde 404 e redirecionamentos saem como
  // HTTP (não meta refresh). As páginas continuam em cache (use cache).
  partialPrefetching: false,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Painel, autenticação e API: nunca indexar nem cachear publicamente.
        source: "/:prefix(admin|auth|api)/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
