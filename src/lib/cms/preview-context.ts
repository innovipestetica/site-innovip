import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettings, listTaxonomies } from "./admin-data";
import { collectRefs, type RenderContext, type RenderEntry, type RenderMedia } from "./render-context";
import { parseSettings } from "./settings";
import { parseVariants, PRIVATE_BUCKET, publicObjectUrl } from "./media-urls";

/**
 * Contexto da PRÉVIA (painel): mostra também referências não publicadas
 * (sinalizadas) e imagens ainda não aprovadas via URL assinada curta.
 * Só funciona com a sessão do administrador (RLS + bucket privado).
 */
export async function loadPreviewContext(doc: unknown): Promise<RenderContext> {
  const supabase = await createSupabaseServerClient();
  const refs = collectRefs(doc);

  const [settingsRow, taxonomies] = await Promise.all([getSettings(), listTaxonomies()]);

  // Conteúdos referenciados (última revisão).
  const entries = new Map<string, RenderEntry>();
  if (refs.entries.size) {
    const { data: rows } = await supabase
      .from("cms_entry_list")
      .select("id, type, slug, title, summary, lifecycle_status, latest_version_id")
      .in("id", [...refs.entries]);
    const versionIds = (rows ?? []).map((r) => r.latest_version_id).filter((v): v is string => !!v);
    const { data: versions } = versionIds.length
      ? await supabase.from("content_versions").select("id, data").in("id", versionIds)
      : { data: [] };
    const dataById = new Map((versions ?? []).map((v) => [v.id, v.data as Record<string, unknown>]));
    for (const r of rows ?? []) {
      if (!r.id || !r.type) continue;
      const data = dataById.get(r.latest_version_id ?? "") ?? {};
      entries.set(r.id, {
        id: r.id,
        type: r.type,
        slug: r.slug ?? "",
        title: r.title ?? "",
        summary: r.summary,
        data,
        published: r.lifecycle_status === "published",
      });
      // Capas/fotos dos itens referenciados também entram na prévia.
      if (typeof data.mediaId === "string") refs.media.add(data.mediaId);
    }
  }

  // Mídias: aprovadas usam URL pública; as demais, URL assinada (5 min).
  const media = new Map<string, RenderMedia>();
  if (refs.media.size) {
    const { data: assets } = await supabase
      .from("media_assets")
      .select("id, alt, width, height, status, public_variants, private_variants")
      .in("id", [...refs.media]);
    for (const a of assets ?? []) {
      const published = a.status === "published";
      const variants = parseVariants(published ? a.public_variants : a.private_variants);
      let sources: RenderMedia["sources"] = [];
      if (published) {
        sources = variants.map((v) => ({ url: publicObjectUrl(v.path), width: v.width }));
      } else if (variants.length) {
        const { data: signed } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .createSignedUrls(variants.map((v) => v.path), 300);
        sources = variants
          .map((v, i) => ({ url: signed?.[i]?.signedUrl ?? "", width: v.width }))
          .filter((s) => s.url);
      }
      if (sources.length) {
        media.set(a.id, { id: a.id, alt: a.alt ?? "", width: a.width, height: a.height, sources });
      }
    }
  }

  // Promoções vigentes (publicadas e dentro do prazo).
  const nowIso = new Date().toISOString();
  const { data: promoRows } = await supabase
    .from("content_entries")
    .select("id, slug, published_version_id, content_versions!content_entries_published_version_fk(title, summary, data, promotion_details(starts_at, ends_at, price_cents, original_price_cents))")
    .eq("type", "promotion")
    .eq("lifecycle_status", "published");
  const activePromotions: RenderContext["activePromotions"] = [];
  for (const p of promoRows ?? []) {
    const v = (Array.isArray(p.content_versions) ? p.content_versions[0] : p.content_versions) as
      | { title: string; summary: string | null; data: Record<string, unknown>; promotion_details: { starts_at: string | null; ends_at: string | null; price_cents: number | null; original_price_cents: number | null } | null }
      | null;
    const d = v?.promotion_details;
    if (!v || !d?.starts_at || !d.ends_at || d.starts_at > nowIso || d.ends_at <= nowIso) continue;
    activePromotions.push({
      entry: { id: p.id, type: "promotion", slug: p.slug, title: v.title, summary: v.summary, data: v.data ?? {}, published: true },
      endsAt: d.ends_at,
      priceCents: d.price_cents,
      originalPriceCents: d.original_price_cents,
    });
  }
  activePromotions.sort((a, b) => a.endsAt.localeCompare(b.endsAt));

  const pub = <T extends { status: string }>(rows: T[]) => rows.filter((r) => r.status === "published");
  return {
    mode: "preview",
    entries,
    media,
    settings: parseSettings(settingsRow.data),
    categories: pub(taxonomies.categories).map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description })),
    concerns: pub(taxonomies.concerns).map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, area: c.area })),
    activePromotions,
  };
}
