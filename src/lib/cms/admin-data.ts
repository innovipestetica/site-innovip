import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { blocksSchema, CURRENT_SCHEMA_VERSION, type Block } from "./blocks";
import type { ContentType, LifecycleStatus, Seo, VersionPayload } from "./content-types";

/**
 * Leituras do PAINEL. Usam a sessão do administrador (RLS ativo): para quem
 * não é admin com MFA, retornam só o que já é público. As páginas chamam
 * requireAdmin() antes; o RLS é a segunda barreira. Nunca em cache público.
 */

export const PAGE_SIZE = 20;

export type EntryListRow = Database["public"]["Views"]["cms_entry_list"]["Row"];

export type ListParams = {
  type: ContentType;
  q?: string;
  status?: LifecycleStatus | "all";
  sort?: "updated" | "title" | "order";
  page?: number;
};

export async function listEntries(params: ListParams) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("cms_entry_list")
    .select("*", { count: "exact" })
    .eq("type", params.type);

  if (params.status && params.status !== "all") {
    query = query.eq("lifecycle_status", params.status);
  } else {
    query = query.neq("lifecycle_status", "archived");
  }

  const q = params.q?.trim();
  if (q) {
    // Escapa curingas do ILIKE e caracteres de sintaxe do filtro do PostgREST.
    const safe = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ").slice(0, 80);
    query = query.or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }

  switch (params.sort) {
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "order":
      query = query.order("sort_order", { ascending: true }).order("title", { ascending: true });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`listEntries: ${error.code}`);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

/** Opções para seletores de referência (entryIds) no editor. */
export async function listRefOptions(types: ContentType[]) {
  if (types.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cms_entry_list")
    .select("id, type, title, slug, lifecycle_status")
    .in("type", types)
    .neq("lifecycle_status", "archived")
    .order("title", { ascending: true })
    .limit(500);
  if (error) throw new Error(`listRefOptions: ${error.code}`);
  return data ?? [];
}

export type EditorEntry = {
  id: string;
  type: ContentType;
  slug: string;
  lifecycleStatus: LifecycleStatus;
  latestRevision: number;
  latestVersionId: string;
  publishedVersionId: string | null;
  publishedRevision: number | null;
  firstPublishedAt: string | null;
  updatedAt: string;
  payload: VersionPayload;
  /** Blocos salvos com schema_version diferente da atual. */
  schemaMismatch: boolean;
};

const VERSION_SELECT = `
  id, revision, schema_version, title, summary, blocks, seo, data, created_at,
  treatment_details(requires_evaluation, clinical_reviewer, clinical_reviewed_on),
  promotion_details(starts_at, ends_at, price_cents, original_price_cents, terms),
  landing_details(campaign_key, promotion_entry_id, reduced_navigation),
  treatment_categories(category_id),
  treatment_concerns(concern_id),
  promotion_treatments(treatment_entry_id)
`;

type VersionRow = {
  id: string;
  revision: number;
  schema_version: number;
  title: string;
  summary: string | null;
  blocks: unknown;
  seo: unknown;
  data: unknown;
  created_at: string;
  treatment_details: Record<string, unknown> | null;
  promotion_details: Record<string, unknown> | null;
  landing_details: Record<string, unknown> | null;
  treatment_categories: { category_id: string }[];
  treatment_concerns: { concern_id: string }[];
  promotion_treatments: { treatment_entry_id: string }[];
};

function stripNulls(obj: Record<string, unknown> | null): Record<string, unknown> {
  if (!obj) return {};
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null));
}

export function versionToPayload(v: VersionRow): { payload: VersionPayload; schemaMismatch: boolean } {
  const parsedBlocks = blocksSchema.safeParse(v.blocks);
  return {
    schemaMismatch: v.schema_version !== CURRENT_SCHEMA_VERSION || !parsedBlocks.success,
    payload: {
      schema_version: CURRENT_SCHEMA_VERSION,
      title: v.title,
      summary: v.summary ?? undefined,
      blocks: parsedBlocks.success ? parsedBlocks.data : ((v.blocks as Block[]) ?? []),
      seo: (v.seo ?? {}) as Seo,
      data: (v.data ?? {}) as Record<string, unknown>,
      details: stripNulls(v.treatment_details ?? v.promotion_details ?? v.landing_details),
      relations: {
        categories: v.treatment_categories.map((r) => r.category_id),
        concerns: v.treatment_concerns.map((r) => r.concern_id),
        treatments: v.promotion_treatments.map((r) => r.treatment_entry_id),
      },
    },
  };
}

export async function getEntryForEdit(id: string): Promise<EditorEntry | null> {
  const supabase = await createSupabaseServerClient();
  const { data: entry, error } = await supabase
    .from("cms_entry_list")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEntryForEdit: ${error.code}`);
  if (!entry || !entry.id || !entry.type || !entry.latest_version_id) return null;

  const { data: version, error: vErr } = await supabase
    .from("content_versions")
    .select(VERSION_SELECT)
    .eq("id", entry.latest_version_id)
    .single<VersionRow>();
  if (vErr) throw new Error(`getEntryForEdit(version): ${vErr.code}`);

  const { payload, schemaMismatch } = versionToPayload(version);
  return {
    id: entry.id,
    type: entry.type,
    slug: entry.slug ?? "",
    lifecycleStatus: entry.lifecycle_status ?? "draft",
    latestRevision: entry.latest_revision ?? 0,
    latestVersionId: entry.latest_version_id,
    publishedVersionId: entry.published_version_id,
    publishedRevision: entry.published_revision,
    firstPublishedAt: entry.first_published_at,
    updatedAt: entry.updated_at ?? "",
    payload,
    schemaMismatch,
  };
}

export async function getVersion(versionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_versions")
    .select(`${VERSION_SELECT}, entry_id`)
    .eq("id", versionId)
    .maybeSingle<VersionRow & { entry_id: string }>();
  if (error) throw new Error(`getVersion: ${error.code}`);
  return data;
}

export async function listVersions(entryId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_versions")
    .select("id, revision, title, schema_version, created_at, created_by")
    .eq("entry_id", entryId)
    .order("revision", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listVersions: ${error.code}`);
  return data ?? [];
}

/** Mídias disponíveis para seletores do editor. */
export async function listMediaOptions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, alt, status, width, height, created_at")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`listMediaOptions: ${error.code}`);
  return data ?? [];
}

export async function listTaxonomies() {
  const supabase = await createSupabaseServerClient();
  const [cats, concerns] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("concerns").select("*").order("sort_order").order("name"),
  ]);
  if (cats.error || concerns.error) throw new Error("listTaxonomies");
  return { categories: cats.data ?? [], concerns: concerns.data ?? [] };
}

export async function getSettings() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings_public")
    .select("data, revision, updated_at")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`getSettings: ${error.code}`);
  return data;
}

export async function dashboardCounts() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cms_entry_list").select("type, lifecycle_status");
  if (error) throw new Error(`dashboardCounts: ${error.code}`);
  const counts = new Map<string, { published: number; draft: number; other: number }>();
  for (const row of data ?? []) {
    if (!row.type) continue;
    const c = counts.get(row.type) ?? { published: 0, draft: 0, other: 0 };
    if (row.lifecycle_status === "published") c.published++;
    else if (row.lifecycle_status === "draft") c.draft++;
    else c.other++;
    counts.set(row.type, c);
  }
  const { data: recent } = await supabase
    .from("cms_entry_list")
    .select("id, type, title, lifecycle_status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);
  return { counts, recent: recent ?? [] };
}
