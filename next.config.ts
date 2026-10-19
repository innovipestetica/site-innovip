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
 * - Origens de GTM/GA4/Meta só com o rastreamento ligado (ver trackingOrigins).
 */
/**
 * Origens de medição: só quando o rastreamento está ligado (mesma regra de
 * src/lib/consent/tracking-config.ts). GTM carrega GA4 e o Pixel da Meta.
 * Sem 'unsafe-eval': no GTM, não usar "Variáveis JavaScript personalizadas".
 * TRACKING_DEBUG=true libera o Tag Assistant (depuração; desligar depois).
 */
function trackingOrigins() {
  const enabled =
    process.env.TRACKING_ENABLED === "true" &&
    /^GTM-[A-Z0-9]{4,12}$/.test(process.env.NEXT_PUBLIC_GTM_ID ?? "") &&
    (process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === "production");
  if (!enabled) return { script: [], connect: [], img: [], frame: [] };
  const debug = process.env.TRACKING_DEBUG === "true";
  return {
    script: ["https://www.googletagmanager.com", "https://connect.facebook.net", ...(debug ? ["https://tagassistant.google.com"] : [])],
    connect: [
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.facebook.com",
      "https://connect.facebook.net",
    ],
    img: ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://www.facebook.com", ...(debug ? ["https://ssl.gstatic.com", "https://www.gstatic.com"] : [])],
    frame: debug ? ["https://tagassistant.google.com", "https://www.googletagmanager.com"] : [],
  };
}

function contentSecurityPolicy(): string {
  const sb = supabaseOrigins();
  const tr = trackingOrigins();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...tr.script],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(sb ? [sb.http] : []), ...tr.img],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(sb ? [sb.http, sb.ws] : []), ...tr.connect],
    "frame-src": tr.frame.length ? tr.frame : ["'none'"],
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
