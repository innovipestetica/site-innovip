import type { ContentType } from "./content-types";
import type { SiteSettings } from "./settings";

/**
 * Dados que os componentes de bloco precisam além do próprio bloco.
 * Montado por um carregador público (só publicado) ou de prévia (painel).
 */
export type RenderEntry = {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  summary: string | null;
  data: Record<string, unknown>;
  /** false apenas na prévia, para sinalizar referências não publicadas. */
  published: boolean;
};

export type RenderMedia = {
  id: string;
  alt: string;
  width: number | null;
  height: number | null;
  /** Variantes ordenadas por largura (URL pública ou assinada na prévia). */
  sources: { url: string; width: number }[];
};

export type RenderTaxonomy = { id: string; name: string; slug: string; description: string | null; area?: string | null };

export type RenderPromotion = {
  entry: RenderEntry;
  endsAt: string;
  priceCents: number | null;
  originalPriceCents: number | null;
};

export type RenderContext = {
  mode: "public" | "preview";
  entries: Map<string, RenderEntry>;
  media: Map<string, RenderMedia>;
  settings: SiteSettings;
  categories: RenderTaxonomy[];
  concerns: RenderTaxonomy[];
  activePromotions: RenderPromotion[];
};

/** Coleta ids referenciados (mesma convenção do banco). */
export function collectRefs(value: unknown, acc = { entries: new Set<string>(), media: new Set<string>() }) {
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, acc);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "entryId" && typeof v === "string") acc.entries.add(v);
      else if (k === "entryIds" && Array.isArray(v)) v.forEach((x) => typeof x === "string" && acc.entries.add(x));
      else if (k === "mediaId" && typeof v === "string") acc.media.add(v);
      else if (k === "mediaIds" && Array.isArray(v)) v.forEach((x) => typeof x === "string" && acc.media.add(x));
      else collectRefs(v, acc);
    }
  }
  return acc;
}
