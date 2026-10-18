"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { AdminAuthorizationError, assertAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG } from "@/lib/cms/cache-tags";
import { mapDbError, type ActionResult } from "@/lib/cms/errors";
import { settingsSchema } from "@/lib/cms/settings";
import type { Json } from "@/lib/supabase/database.types";

/** Remove strings vazias e objetos vazios (campo vazio = oculto no site). */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const p = prune(v);
      if (p === undefined || p === "" || (p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 0)) continue;
      out[k] = p;
    }
    return out;
  }
  return typeof value === "string" ? value.trim() : value;
}

export async function saveSettingsAction(baseRevision: number, input: unknown): Promise<ActionResult<{ revision: number }>> {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return { ok: false, kind: "forbidden", message: "Sessão expirada. Entre novamente." };
    }
    throw error;
  }
  if (!z.number().int().min(1).safeParse(baseRevision).success) {
    return { ok: false, kind: "invalid", message: "Requisição inválida." };
  }
  const parsed = settingsSchema.safeParse(prune(input));
  if (!parsed.success) {
    return {
      ok: false,
      kind: "invalid",
      message: "Há campos para corrigir.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cms_save_settings", {
    p_base_revision: baseRevision,
    p_data: JSON.parse(JSON.stringify(parsed.data)) as Json,
  });
  if (error) return mapDbError(error);

  updateTag(TAG.settings);
  updateTag(TAG.content);
  return { ok: true, data: { revision: data } };
}
