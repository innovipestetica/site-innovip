import type { Metadata } from "next";
import type { Seo } from "@/lib/cms/content-types";
import type { RenderMedia } from "@/lib/cms/render-context";

/** Origem canônica: SEMPRE a URL configurada, nunca o Host da requisição. */
export function canonicalOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${canonicalOrigin()}${path === "/" ? "" : path}` || canonicalOrigin();
}

/** Antes do lançamento (SITE_INDEXING_ENABLED != true) tudo é noindex. */
export function indexingEnabled(): boolean {
  return process.env.SITE_INDEXING_ENABLED === "true";
}

export function buildMetadata(input: {
  title: string;
  description?: string | null;
  path: string;
  seo?: Seo;
  image?: RenderMedia | null;
  type?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const title = input.seo?.title || input.title;
  const description = input.seo?.description || input.description || undefined;
  const noindex = input.noindex || input.seo?.noindex || !indexingEnabled();
  const largest = input.image?.sources.at(-1);
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(input.path) },
    robots: noindex ? { index: false, follow: !input.seo?.noindex } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: absoluteUrl(input.path),
      type: input.type ?? "website",
      locale: "pt_BR",
      images: largest ? [{ url: largest.url, width: largest.width, alt: input.image?.alt }] : undefined,
    },
  };
}

// Separadores de linha U+2028/U+2029 (montados por código, sem literais).
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const JSON_LD_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  [LINE_SEP]: "\\u2028",
  [PARA_SEP]: "\\u2029",
};
const JSON_LD_UNSAFE = new RegExp(`[<>&${LINE_SEP}${PARA_SEP}]`, "g");

/** Serializa JSON-LD sem permitir fechar a tag <script> (XSS). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(JSON_LD_UNSAFE, (c) => JSON_LD_ESCAPES[c] ?? c);
}
