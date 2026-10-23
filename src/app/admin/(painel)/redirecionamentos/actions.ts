"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { AdminAuthorizationError, assertAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG } from "@/lib/cms/cache-tags";
import { mapDbError, type ActionResult } from "@/lib/cms/errors";

const path = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^\/[a-z0-9/-]*$/, "Use um caminho do site, ex.: /tratamentos/nome-antigo (sem domínio, acentos ou ?).")
  .max(200);

const target = z.string().trim().max(1000).refine(
  (value) => path.safeParse(value).success || z.url({ protocol: /^https$/ }).safeParse(value).success,
  "Use um caminho do site ou um endereço completo iniciado por https://.",
);
const preview = {
  previewTitle: z.string().trim().max(120).optional(),
  previewDescription: z.string().trim().max(240).optional(),
  previewSiteName: z.string().trim().max(80).optional(),
  previewMediaId: z.union([z.uuid(), z.literal("")]).optional(),
};

async function guard() {
  try {
    await assertAdmin();
    return null;
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return { ok: false as const, kind: "forbidden" as const, message: "Sessão expirada. Entre novamente." };
    }
    throw error;
  }
}

export async function addRedirectAction(input: { source: string; target: string; status: number; previewTitle?: string; previewDescription?: string; previewSiteName?: string; previewMediaId?: string }): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z
    .object({ source: path.refine((p) => p !== "/", "A página inicial não pode ser redirecionada."), target, status: z.union([z.literal(301), z.literal(302)]), ...preview })
    .refine((v) => v.source !== v.target, { message: "Origem e destino iguais.", path: ["target"] })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, kind: "invalid", message: parsed.error.issues[0]!.message };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("redirects").insert({
    source_path: parsed.data.source,
    target_path: parsed.data.target,
    status_code: parsed.data.status,
    preview_title: parsed.data.previewTitle || null,
    preview_description: parsed.data.previewDescription || null,
    preview_site_name: parsed.data.previewSiteName || null,
    preview_media_id: parsed.data.previewMediaId || null,
  });
  if (error) {
    const mapped = mapDbError(error);
    if (error.code === "PT422") mapped.message = "Esse redirecionamento criaria um ciclo ou uma cadeia longa demais.";
    if (error.code === "23505") mapped.message = "Já existe um redirecionamento com essa origem.";
    return mapped;
  }
  updateTag(TAG.redirects);
  return { ok: true };
}

export async function updateRedirectPreviewAction(input: { id: string; previewTitle?: string; previewDescription?: string; previewSiteName?: string; previewMediaId?: string }): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z.object({ id: z.uuid(), ...preview }).safeParse(input);
  if (!parsed.success) return { ok: false, kind: "invalid", message: parsed.error.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("redirects").update({
    preview_title: parsed.data.previewTitle || null,
    preview_description: parsed.data.previewDescription || null,
    preview_site_name: parsed.data.previewSiteName || null,
    preview_media_id: parsed.data.previewMediaId || null,
  }).eq("id", parsed.data.id);
  if (error) return mapDbError(error);
  updateTag(TAG.redirects);
  return { ok: true };
}

export async function deleteRedirectAction(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!z.uuid().safeParse(id).success) return { ok: false, kind: "invalid", message: "Requisição inválida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("redirects").delete().eq("id", id);
  if (error) return mapDbError(error);
  updateTag(TAG.redirects);
  return { ok: true };
}
