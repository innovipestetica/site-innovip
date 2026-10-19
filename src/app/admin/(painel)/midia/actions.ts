"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { AdminAuthorizationError, assertAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG } from "@/lib/cms/cache-tags";
import { mapDbError, type ActionResult } from "@/lib/cms/errors";
import { parseVariants, PRIVATE_BUCKET, PUBLIC_BUCKET, type Variant } from "@/lib/cms/media-urls";
import {
  ALLOWED_MIMES,
  extForMime,
  MAX_UPLOAD_BYTES,
  MediaValidationError,
  processImage,
} from "@/lib/media/process";

/**
 * Mídia: upload direto ao bucket PRIVADO (URL assinada), processamento no
 * servidor e publicação de CÓPIAS otimizadas no bucket público (já no envio).
 * Tudo com a sessão do administrador (RLS e políticas do Storage ativos).
 */

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

const uuid = z.uuid();
const ORIGINAL_PATH = /^originals\/([0-9a-f-]{36})\.(jpg|png|webp|avif)$/;

export async function createUploadAction(input: { mime: string; size: number }): Promise<
  ActionResult<{ path: string; signedUrl: string }>
> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = z
    .object({
      mime: z.enum(ALLOWED_MIMES as [string, ...string[]], { message: "Formato não aceito. Use JPEG, PNG, WebP ou AVIF." }),
      size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, "Arquivo maior que 10 MB."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, kind: "invalid", message: parsed.error.issues[0]!.message };

  // Nome com UUID: sem nome original do arquivo (que pode conter dados pessoais).
  const path = `originals/${randomUUID()}.${extForMime(parsed.data.mime)}`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[midia] createSignedUploadUrl falhou");
    return { ok: false, kind: "error", message: "Não foi possível iniciar o envio." };
  }
  return { ok: true, data: { path, signedUrl: data.signedUrl } };
}

export async function processUploadAction(input: { path: string; alt?: string }): Promise<ActionResult<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const match = ORIGINAL_PATH.exec(input.path ?? "");
  const alt = z.string().trim().max(250).optional().safeParse(input.alt);
  if (!match || !alt.success) return { ok: false, kind: "invalid", message: "Envio inválido." };
  const assetId = match[1]!;

  const supabase = await createSupabaseServerClient();
  const bucket = supabase.storage.from(PRIVATE_BUCKET);
  const cleanup = async (paths: string[]) => {
    await bucket.remove([input.path, ...paths]);
  };

  const { data: blob, error: dlError } = await bucket.download(input.path);
  if (dlError || !blob) return { ok: false, kind: "error", message: "Arquivo enviado não encontrado." };

  let processed;
  try {
    processed = await processImage(Buffer.from(await blob.arrayBuffer()));
  } catch (error) {
    await cleanup([]);
    if (error instanceof MediaValidationError) return { ok: false, kind: "invalid", message: error.message };
    console.error("[midia] falha ao processar imagem");
    return { ok: false, kind: "error", message: "Não foi possível processar a imagem." };
  }

  // Extensão do caminho precisa bater com o formato real.
  if (processed.kind.ext !== match[2]) {
    await cleanup([]);
    return { ok: false, kind: "invalid", message: "O conteúdo do arquivo não corresponde ao formato declarado." };
  }

  // Duplicata exata: reaproveita a mídia existente.
  const { data: dup } = await supabase.from("media_assets").select("id").eq("sha256", processed.sha256).maybeSingle();
  if (dup) {
    await cleanup([]);
    return { ok: false, kind: "duplicate", message: "Esta imagem já está na biblioteca." };
  }

  // Original sem metadados substitui o enviado; variantes webp ao lado.
  const variantPaths: string[] = [];
  const up = await bucket.upload(input.path, processed.original, { contentType: processed.kind.mime, upsert: true });
  if (up.error) {
    await cleanup([]);
    return { ok: false, kind: "error", message: "Falha ao gravar a imagem." };
  }
  const variants: Variant[] = [];
  for (const v of processed.variants) {
    const path = `variants/${assetId}/${v.width}.webp`;
    const res = await bucket.upload(path, v.buffer, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (res.error) {
      await cleanup(variantPaths);
      return { ok: false, kind: "error", message: "Falha ao gravar as versões otimizadas." };
    }
    variantPaths.push(path);
    variants.push({ width: v.width, height: v.height, path, format: "webp" });
  }

  // Envio já libera a imagem para o site (decisão da clínica, 19/10/2026).
  const published = await copyToPublic(supabase, assetId, variants);
  if (!published.ok) {
    await cleanup(variantPaths);
    return published;
  }

  const { error } = await supabase.from("media_assets").insert({
    id: assetId,
    status: "published",
    public_variants: published.data,
    mime: processed.kind.mime,
    size_bytes: processed.original.length,
    width: processed.width,
    height: processed.height,
    alt: alt.data || null,
    private_original_path: input.path,
    private_variants: variants,
    sha256: processed.sha256,
  });
  if (error) {
    await cleanup(variantPaths);
    await supabase.storage.from(PUBLIC_BUCKET).remove(published.data.map((v) => v.path));
    return mapDbError(error);
  }
  updateTag(TAG.media);
  return { ok: true, data: { id: assetId } };
}

/** Copia SOMENTE as variantes otimizadas (sem o original) para o bucket público. */
async function copyToPublic(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  variants: Variant[],
): Promise<ActionResult<Variant[]>> {
  const publicVariants: Variant[] = [];
  for (const v of variants) {
    const target = `${id}/${v.width}.webp`;
    await supabase.storage.from(PUBLIC_BUCKET).remove([target]);
    const { error: copyError } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .copy(v.path, target, { destinationBucket: PUBLIC_BUCKET });
    if (copyError) {
      await supabase.storage.from(PUBLIC_BUCKET).remove(publicVariants.map((p) => p.path));
      console.error("[midia] cópia para o bucket público falhou");
      return { ok: false, kind: "error", message: "Não foi possível publicar a imagem." };
    }
    publicVariants.push({ ...v, path: target });
  }
  return { ok: true, data: publicVariants };
}

export async function updateAltAction(id: string, alt: string, baseRevision: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = z.object({ id: uuid, alt: z.string().trim().max(250), baseRevision: z.number().int() }).safeParse({ id, alt, baseRevision });
  if (!parsed.success) return { ok: false, kind: "invalid", message: "Texto alternativo inválido (até 250 caracteres)." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ alt: parsed.data.alt || null, revision: baseRevision + 1 })
    .eq("id", id)
    .eq("revision", baseRevision)
    .select("status");
  if (error) return mapDbError(error);
  if (!data?.length) return { ok: false, kind: "conflict", message: "A imagem foi alterada em outra aba. Recarregue a página." };
  if (data[0]?.status === "published") updateTag(TAG.content);
  return { ok: true };
}

/** Volta a imagem ao site (ex.: depois de "Tirar do site"). */
export async function publishMediaAction(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(id).success) return { ok: false, kind: "invalid", message: "Requisição inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: asset, error } = await supabase.from("media_assets").select("id, status, private_variants").eq("id", id).single();
  if (error || !asset) return { ok: false, kind: "not_found", message: "Imagem não encontrada." };
  if (asset.status === "published") return { ok: true };

  const variants = parseVariants(asset.private_variants);
  if (variants.length === 0) return { ok: false, kind: "invalid", message: "Imagem sem versões processadas." };
  const published = await copyToPublic(supabase, id, variants);
  if (!published.ok) return published;

  const { error: upError } = await supabase
    .from("media_assets")
    .update({ status: "published", public_variants: published.data })
    .eq("id", id);
  if (upError) return mapDbError(upError);

  updateTag(TAG.media);
  updateTag(TAG.content);
  return { ok: true };
}

/** IDs de conteúdos cuja versão PUBLICADA usa a mídia. */
async function publishedUsers(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("version_media_refs")
    .select("version_id, content_versions!inner(entry_id, title, content_entries!content_versions_entry_id_fkey!inner(id, published_version_id, lifecycle_status))")
    .eq("media_id", id);
  type Row = { version_id: string; content_versions: { title: string; content_entries: { id: string; published_version_id: string | null; lifecycle_status: string } } };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.content_versions.content_entries.published_version_id === r.version_id && r.content_versions.content_entries.lifecycle_status === "published")
    .map((r) => r.content_versions.title);
}

export async function unpublishMediaAction(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(id).success) return { ok: false, kind: "invalid", message: "Requisição inválida." };

  const users = await publishedUsers(id);
  if (users.length) {
    return { ok: false, kind: "invalid", message: "Imagem usada em conteúdo publicado:", problems: users };
  }
  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase.from("media_assets").select("public_variants").eq("id", id).single();
  const paths = parseVariants(asset?.public_variants).map((v) => v.path);
  if (paths.length) await supabase.storage.from(PUBLIC_BUCKET).remove(paths);
  const { error } = await supabase.from("media_assets").update({ status: "private", public_variants: [] }).eq("id", id);
  if (error) return mapDbError(error);
  updateTag(TAG.media);
  updateTag(TAG.content);
  return { ok: true };
}

/** Exclui se não houver referência; com evidência de licença, arquiva. */
export async function deleteMediaAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!uuid.safeParse(id).success) return { ok: false, kind: "invalid", message: "Requisição inválida." };

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("version_media_refs").select("version_id", { count: "exact", head: true }).eq("media_id", id);
  if (count) {
    return { ok: false, kind: "invalid", message: `Imagem usada em ${count} versão(ões) de conteúdo. Remova as referências antes.` };
  }
  const { data: asset } = await supabase
    .from("media_assets")
    .select("private_original_path, private_variants, public_variants")
    .eq("id", id)
    .single();
  if (!asset) return { ok: false, kind: "not_found", message: "Imagem não encontrada." };

  const publicPaths = parseVariants(asset.public_variants).map((v) => v.path);
  if (publicPaths.length) await supabase.storage.from(PUBLIC_BUCKET).remove(publicPaths);

  const { count: perms } = await supabase.from("media_permissions").select("id", { count: "exact", head: true }).eq("media_id", id);
  if (perms) {
    // Mantém a evidência de licença; tira do site e da biblioteca ativa.
    const { error } = await supabase.from("media_assets").update({ status: "archived", public_variants: [] }).eq("id", id);
    if (error) return mapDbError(error);
    updateTag(TAG.media);
    return { ok: true, data: { archived: true } };
  }

  await supabase.storage
    .from(PRIVATE_BUCKET)
    .remove([asset.private_original_path, ...parseVariants(asset.private_variants).map((v) => v.path)]);
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) return mapDbError(error);
  updateTag(TAG.media);
  return { ok: true, data: { archived: false } };
}
