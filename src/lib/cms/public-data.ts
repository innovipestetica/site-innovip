import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { blockSchema, type Block } from "./blocks";
import { TAG } from "./cache-tags";
import type { ContentType, Seo } from "./content-types";
import { parseVariants, publicObjectUrl } from "./media-urls";
import {
  collectRefs,
  type RenderContext,
  type RenderEntry,
  type RenderMedia,
  type RenderPromotion,
  type RenderTaxonomy,
} from "./render-context";
import { parseSettings, type SiteSettings } from "./settings";

/**
 * Leituras PÚBLICAS do site. Todas em 'use cache' com tags invalidadas na
 * publicação (updateTag em Server Actions do painel). Usam o cliente anônimo:
 * só o que o RLS libera para anon (publicado, colunas públicas).
 * Nada aqui depende da hora atual: vigência de promoção é filtrada fora do
 * cache, na renderização (activePromotions + connection()).
 */

function cachePolicy(...tags: string[]) {
  cacheTag(...tags);
  // Rede de segurança: mesmo sem invalidação, o cache expira.
  cacheLife("hours");
}

/** Bloco inválido (formato antigo/corrompido) é descartado, não quebra a página. */
function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((b) => {
    const parsed = blockSchema.safeParse(b);
    return parsed.success ? [parsed.data] : [];
  });
}

export type PublishedEntry = {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  summary: string | null;
  blocks: Block[];
  seo: Seo;
  data: Record<string, unknown>;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  updatedAt: string;
  treatment?: { requiresEvaluation: boolean; categoryIds: string[]; concernIds: string[] };
  promotion?: {
    startsAt: string | null;
    endsAt: string | null;
    priceCents: number | null;
    originalPriceCents: number | null;
    terms: string | null;
    treatmentIds: string[];
  };
  landing?: { campaignKey: string | null; promotionEntryId: string | null; reducedNavigation: boolean };
};

const ENTRY_SELECT = `
  id, type, slug, published_at, first_published_at, updated_at,
  version:content_versions!content_entries_published_version_fk(
    title, summary, blocks, seo, data,
    treatment_details(requires_evaluation),
    promotion_details(starts_at, ends_at, price_cents, original_price_cents, terms),
    landing_details(campaign_key, promotion_entry_id, reduced_navigation),
    treatment_categories(category_id),
    treatment_concerns(concern_id),
    promotion_treatments(treatment_entry_id)
  )
`;

type EntryRow = {
  id: string;
  type: ContentType;
  slug: string;
  published_at: string | null;
  first_published_at: string | null;
  updated_at: string;
  version: {
    title: string;
    summary: string | null;
    blocks: unknown;
    seo: unknown;
    data: unknown;
    treatment_details: { requires_evaluation: boolean } | null;
    promotion_details: {
      starts_at: string | null;
      ends_at: string | null;
      price_cents: number | null;
      original_price_cents: number | null;
      terms: string | null;
    } | null;
    landing_details: { campaign_key: string | null; promotion_entry_id: string | null; reduced_navigation: boolean } | null;
    treatment_categories: { category_id: string }[];
    treatment_concerns: { concern_id: string }[];
    promotion_treatments: { treatment_entry_id: string }[];
  } | null;
};

function toPublished(row: EntryRow): PublishedEntry | null {
  const v = row.version;
  if (!v) return null;
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: v.title,
    summary: v.summary,
    blocks: parseBlocks(v.blocks),
    seo: (v.seo ?? {}) as Seo,
    data: (v.data ?? {}) as Record<string, unknown>,
    publishedAt: row.published_at,
    firstPublishedAt: row.first_published_at,
    updatedAt: row.updated_at,
    treatment:
      row.type === "treatment"
        ? {
            requiresEvaluation: v.treatment_details?.requires_evaluation ?? true,
            categoryIds: v.treatment_categories.map((c) => c.category_id),
            concernIds: v.treatment_concerns.map((c) => c.concern_id),
          }
        : undefined,
    promotion:
      row.type === "promotion" && v.promotion_details
        ? {
            startsAt: v.promotion_details.starts_at,
            endsAt: v.promotion_details.ends_at,
            priceCents: v.promotion_details.price_cents,
            originalPriceCents: v.promotion_details.original_price_cents,
            terms: v.promotion_details.terms,
            treatmentIds: v.promotion_treatments.map((t) => t.treatment_entry_id),
          }
        : undefined,
    landing:
      row.type === "landing" && v.landing_details
        ? {
            campaignKey: v.landing_details.campaign_key,
            promotionEntryId: v.landing_details.promotion_entry_id,
            reducedNavigation: v.landing_details.reduced_navigation,
          }
        : undefined,
  };
}

export async function getPublishedEntry(type: ContentType, slug: string): Promise<PublishedEntry | null> {
  "use cache";
  cachePolicy(TAG.content);
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(ENTRY_SELECT)
    .eq("type", type)
    .eq("slug", slug)
    .eq("lifecycle_status", "published")
    .maybeSingle<EntryRow>();
  if (error) throw new Error(`getPublishedEntry: ${error.code}`);
  return data ? toPublished(data) : null;
}

export async function listPublished(type: ContentType): Promise<PublishedEntry[]> {
  "use cache";
  cachePolicy(TAG.content);
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(ENTRY_SELECT)
    .eq("type", type)
    .eq("lifecycle_status", "published")
    .order("sort_order", { ascending: true })
    .order("first_published_at", { ascending: false })
    .limit(500)
    .returns<EntryRow[]>();
  if (error) throw new Error(`listPublished: ${error.code}`);
  return (data ?? []).map(toPublished).filter((e): e is PublishedEntry => e !== null);
}

/** Slugs publicados (para generateStaticParams e sitemap). */
export async function listPublishedSlugs(type: ContentType): Promise<string[]> {
  "use cache";
  cachePolicy(TAG.content);
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select("slug")
    .eq("type", type)
    .eq("lifecycle_status", "published");
  if (error) throw new Error(`listPublishedSlugs: ${error.code}`);
  return (data ?? []).map((r) => r.slug);
}

export async function getPublicSettings(): Promise<SiteSettings> {
  "use cache";
  cachePolicy(TAG.settings);
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.from("site_settings_public").select("data").maybeSingle();
  if (error) throw new Error(`getPublicSettings: ${error.code}`);
  return parseSettings(data?.data);
}

export async function getPublicTaxonomies(): Promise<{ categories: RenderTaxonomy[]; concerns: RenderTaxonomy[] }> {
  "use cache";
  cachePolicy(TAG.taxonomies);
  const supabase = createSupabasePublicClient();
  const [cats, concerns] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, sort_order").order("sort_order").order("name"),
    supabase.from("concerns").select("id, name, slug, description, area, sort_order").order("sort_order").order("name"),
  ]);
  if (cats.error || concerns.error) throw new Error("getPublicTaxonomies");
  return {
    categories: cats.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description })),
    concerns: concerns.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, area: c.area })),
  };
}

/** Redirecionamento cadastrado para um caminho (ou null). */
export type PublicRedirect = {
  target: string;
  status: number;
  previewTitle: string | null;
  previewDescription: string | null;
  previewSiteName: string | null;
  previewMediaId: string | null;
};

export async function getRedirect(path: string): Promise<PublicRedirect | null> {
  "use cache";
  cachePolicy(TAG.redirects);
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("redirects")
    .select("target_path, status_code, preview_title, preview_description, preview_site_name, preview_media_id")
    .eq("source_path", path)
    .maybeSingle();
  if (error) throw new Error(`getRedirect: ${error.code}`);
  return data ? {
    target: data.target_path,
    status: data.status_code,
    previewTitle: data.preview_title,
    previewDescription: data.preview_description,
    previewSiteName: data.preview_site_name,
    previewMediaId: data.preview_media_id,
  } : null;
}

async function getEntriesByIds(ids: string[]): Promise<RenderEntry[]> {
  "use cache";
  cachePolicy(TAG.content);
  if (ids.length === 0) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(ENTRY_SELECT)
    .in("id", ids)
    .eq("lifecycle_status", "published")
    .returns<EntryRow[]>();
  if (error) throw new Error(`getEntriesByIds: ${error.code}`);
  return (data ?? []).flatMap((row) => {
    const e = toPublished(row);
    return e ? [{ id: e.id, type: e.type, slug: e.slug, title: e.title, summary: e.summary, data: e.data, published: true }] : [];
  });
}

async function getMediaByIds(ids: string[]): Promise<RenderMedia[]> {
  "use cache";
  cachePolicy(TAG.media);
  if (ids.length === 0) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, alt, width, height, public_variants")
    .in("id", ids);
  if (error) throw new Error(`getMediaByIds: ${error.code}`);
  return (data ?? []).flatMap((m) => {
    const sources = parseVariants(m.public_variants).map((v) => ({ url: publicObjectUrl(v.path), width: v.width }));
    return sources.length ? [{ id: m.id, alt: m.alt ?? "", width: m.width, height: m.height, sources }] : [];
  });
}

export async function getMedia(id: string | undefined | null): Promise<RenderMedia | null> {
  if (!id) return null;
  return (await getMediaByIds([id]))[0] ?? null;
}

/** Todas as promoções publicadas, com datas (vigência filtrada fora do cache). */
export async function getPublishedPromotions(): Promise<RenderPromotion[]> {
  const promos = await listPublished("promotion");
  return promos.flatMap((p) =>
    p.promotion?.startsAt && p.promotion.endsAt
      ? [{
          entry: { id: p.id, type: p.type, slug: p.slug, title: p.title, summary: p.summary, data: p.data, published: true },
          startsAt: p.promotion.startsAt,
          endsAt: p.promotion.endsAt,
          priceCents: p.promotion.priceCents,
          originalPriceCents: p.promotion.originalPriceCents,
        }]
      : [],
  );
}

/** Contexto de renderização público para um documento (blocos/data/seo). */
export async function loadPublicContext(doc: unknown): Promise<RenderContext> {
  const refs = collectRefs(doc);
  const entries = await getEntriesByIds([...refs.entries].sort());
  // Capas/fotos dos itens referenciados.
  for (const e of entries) if (typeof e.data.mediaId === "string") refs.media.add(e.data.mediaId);

  const [media, settings, taxonomies, promotions] = await Promise.all([
    getMediaByIds([...refs.media].sort()),
    getPublicSettings(),
    getPublicTaxonomies(),
    getPublishedPromotions(),
  ]);

  // Capas das promoções (cards de listagem).
  const promoMedia = promotions
    .map((p) => p.entry.data.mediaId)
    .filter((id): id is string => typeof id === "string" && !media.some((m) => m.id === id));
  const extraMedia = promoMedia.length ? await getMediaByIds([...new Set(promoMedia)].sort()) : [];

  return {
    mode: "public",
    entries: new Map(entries.map((e) => [e.id, e])),
    media: new Map([...media, ...extraMedia].map((m) => [m.id, m])),
    settings,
    categories: taxonomies.categories,
    concerns: taxonomies.concerns,
    promotions,
  };
}
