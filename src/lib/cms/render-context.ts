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
  startsAt: string;
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
  /** Promoções publicadas (com datas). A vigência é filtrada na hora da
   *  requisição (activePromotions), nunca dentro do cache. */
  promotions: RenderPromotion[];
};

/** Promoções vigentes no instante informado, ordenadas pelo fim mais próximo. */
export function activePromotions(promotions: RenderPromotion[], nowMs: number): RenderPromotion[] {
  return promotions
    .filter((p) => Date.parse(p.startsAt) <= nowMs && Date.parse(p.endsAt) > nowMs)
    .sort((a, b) => a.endsAt.localeCompare(b.endsAt));
}

/** Coleta ids referenciados (mesma convenção do banco). */
export function collectRefs(value: unknown, acc = { entries: new Set<string>(), media: new Set<string>() }) {
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, acc);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (/entryId$/i.test(k) && typeof v === "string") acc.entries.add(v);
      else if (/entryIds$/i.test(k) && Array.isArray(v)) v.forEach((x) => typeof x === "string" && acc.entries.add(x));
      else if (/mediaId$/i.test(k) && typeof v === "string") acc.media.add(v);
      else if (/mediaIds$/i.test(k) && Array.isArray(v)) v.forEach((x) => typeof x === "string" && acc.media.add(x));
      else collectRefs(v, acc);
    }
  }
  return acc;
}
