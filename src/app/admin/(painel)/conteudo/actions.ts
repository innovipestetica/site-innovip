"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { AdminAuthorizationError, assertAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG } from "@/lib/cms/cache-tags";
import {
  CONTENT_TYPE_LIST,
  initialPayload,
  slugSchema,
  validatePayload,
  type ContentType,
} from "@/lib/cms/content-types";
import { newBlockId } from "@/lib/cms/blocks";
import { mapDbError, type ActionResult } from "@/lib/cms/errors";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Server Actions do CMS. Cada uma:
 * 1) reverifica o administrador com MFA (assertAdmin) — o layout não basta;
 * 2) valida a entrada com Zod no servidor;
 * 3) chama a RPC com a sessão do administrador (RLS ativo);
 * 4) invalida as tags públicas quando o site muda.
 */

const uuid = z.uuid();
const contentType = z.enum(CONTENT_TYPE_LIST as [ContentType, ...ContentType[]]);

async function guard(): Promise<Extract<ActionResult, { ok: false }> | null> {
  try {
    await assertAdmin();
    return null;
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return { ok: false, kind: "forbidden", message: "Sessão expirada ou sem verificação em duas etapas. Entre novamente." };
    }
    throw error;
  }
}

/** Serializa para JSON puro (remove undefined) no formato aceito pela RPC. */
function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function invalidatePublic(...extra: string[]) {
  updateTag(TAG.content);
  for (const tag of extra) updateTag(tag);
}

export async function createEntryAction(input: {
  type: ContentType;
  title: string;
  slug: string;
}): Promise<ActionResult<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = z
    .object({ type: contentType, title: z.string().trim().min(1, "Informe o título.").max(200), slug: slugSchema })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "invalid",
      message: "Confira os campos.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const { type, title, slug } = parsed.data;
  const payload = initialPayload(type, title, newBlockId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_create_entry", {
    p_type: type,
    p_slug: type === "home" ? "home" : slug,
    p_payload: toJson(payload),
  });
  if (error) return mapDbError(error);
  return { ok: true, data: { id: data[0]!.entry_id } };
}

export async function saveVersionAction(input: {
  entryId: string;
  type: ContentType;
  baseRevision: number;
  payload: unknown;
}): Promise<ActionResult<{ revision: number; versionId: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const ids = z
    .object({ entryId: uuid, type: contentType, baseRevision: z.number().int().min(1) })
    .safeParse(input);
  if (!ids.success) return { ok: false, kind: "invalid", message: "Requisição inválida." };

  const validated = validatePayload(ids.data.type, input.payload);
  if (!validated.ok) {
    return { ok: false, kind: "invalid", message: "Há campos para corrigir.", issues: validated.issues };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_save_version", {
    p_entry_id: ids.data.entryId,
    p_base_revision: ids.data.baseRevision,
    p_payload: toJson(validated.payload),
  });
  if (error) return mapDbError(error);
  return { ok: true, data: { revision: data[0]!.revision, versionId: data[0]!.version_id } };
}

export async function checkPublishAction(versionId: string): Promise<ActionResult<{ problems: string[] }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(versionId).success) return { ok: false, kind: "invalid", message: "Versão inválida." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_check_publish", { p_version_id: versionId });
  if (error) return mapDbError(error);
  return { ok: true, data: { problems: data ?? [] } };
}

export async function publishAction(entryId: string, versionId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(entryId).success || !uuid.safeParse(versionId).success) {
    return { ok: false, kind: "invalid", message: "Requisição inválida." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cms_publish", { p_entry_id: entryId, p_version_id: versionId });
  if (error) return mapDbError(error);
  invalidatePublic();
  return { ok: true };
}

type LifecycleRpc = "cms_unpublish" | "cms_archive" | "cms_unarchive";

async function lifecycle(rpc: LifecycleRpc, entryId: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(entryId).success) return { ok: false, kind: "invalid", message: "Requisição inválida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(rpc, { p_entry_id: entryId });
  if (error) {
    const mapped = mapDbError(error);
    if (rpc !== "cms_unarchive" && mapped.kind === "invalid" && error.message.includes("dependem")) {
      mapped.message = "Outros conteúdos publicados usam este item. Remova a referência ou despublique-os antes.";
    }
    return mapped;
  }
  invalidatePublic();
  return { ok: true };
}

export async function unpublishAction(entryId: string) {
  return lifecycle("cms_unpublish", entryId);
}
export async function archiveAction(entryId: string) {
  return lifecycle("cms_archive", entryId);
}
export async function unarchiveAction(entryId: string) {
  return lifecycle("cms_unarchive", entryId);
}

export async function duplicateAction(entryId: string, newSlug: string): Promise<ActionResult<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;
  const slug = slugSchema.safeParse(newSlug);
  if (!uuid.safeParse(entryId).success || !slug.success) {
    return { ok: false, kind: "invalid", message: "Informe um endereço válido para a cópia." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_duplicate_entry", { p_entry_id: entryId, p_new_slug: slug.data });
  if (error) return mapDbError(error);
  return { ok: true, data: { id: data[0]!.entry_id } };
}

export async function changeSlugAction(entryId: string, newSlug: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const slug = slugSchema.safeParse(newSlug);
  if (!uuid.safeParse(entryId).success || !slug.success) {
    return { ok: false, kind: "invalid", message: slug.success ? "Requisição inválida." : slug.error.issues[0]!.message };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cms_change_slug", { p_entry_id: entryId, p_new_slug: slug.data });
  if (error) return mapDbError(error);
  invalidatePublic(TAG.redirects);
  return { ok: true };
}

export async function restoreVersionAction(
  entryId: string,
  versionId: string,
  baseRevision: number,
): Promise<ActionResult<{ revision: number }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(entryId).success || !uuid.safeParse(versionId).success || !Number.isInteger(baseRevision)) {
    return { ok: false, kind: "invalid", message: "Requisição inválida." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_restore_version", {
    p_entry_id: entryId,
    p_version_id: versionId,
    p_base_revision: baseRevision,
  });
  if (error) return mapDbError(error);
  return { ok: true, data: { revision: data[0]!.revision } };
}
