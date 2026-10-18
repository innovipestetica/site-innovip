"use server";

import { updateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { AdminAuthorizationError, assertAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG } from "@/lib/cms/cache-tags";
import { slugSchema } from "@/lib/cms/content-types";
import { mapDbError, type ActionResult } from "@/lib/cms/errors";

const taxonomyInput = z.object({
  kind: z.enum(["categories", "concerns"]),
  id: z.uuid().optional(),
  baseRevision: z.number().int().min(1).optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  slug: slugSchema,
  description: z.string().trim().max(300).optional(),
  area: z.enum(["facial", "corporal"]).optional(),
  sort_order: z.number().int().min(-1000).max(1000).default(0),
  status: z.enum(["draft", "published", "archived"]),
});

export type TaxonomyInput = z.input<typeof taxonomyInput>;

export async function saveTaxonomyAction(input: TaxonomyInput): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return { ok: false, kind: "forbidden", message: "Sessão expirada. Entre novamente." };
    }
    throw error;
  }

  const parsed = taxonomyInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "invalid",
      message: "Confira os campos.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const { kind, id, baseRevision, area, ...fields } = parsed.data;
  const base = { ...fields, description: fields.description ?? null };
  const supabase = await createSupabaseServerClient();

  // Concorrência otimista na edição: só grava se a revisão não mudou.
  const nextRevision = (baseRevision ?? 0) + 1;
  let error: PostgrestError | null = null;
  let updated = 1;
  if (kind === "concerns") {
    const row = { ...base, area: area ?? null };
    if (!id) ({ error } = await supabase.from("concerns").insert(row));
    else {
      const res = await supabase.from("concerns").update({ ...row, revision: nextRevision })
        .eq("id", id).eq("revision", baseRevision ?? -1).select("id");
      error = res.error;
      updated = res.data?.length ?? 0;
    }
  } else {
    if (!id) ({ error } = await supabase.from("categories").insert(base));
    else {
      const res = await supabase.from("categories").update({ ...base, revision: nextRevision })
        .eq("id", id).eq("revision", baseRevision ?? -1).select("id");
      error = res.error;
      updated = res.data?.length ?? 0;
    }
  }
  if (error) return mapDbError(error);
  if (updated === 0) {
    return { ok: false, kind: "conflict", message: "Este item foi alterado em outra aba. Recarregue a página." };
  }

  updateTag(TAG.taxonomies);
  updateTag(TAG.content);
  return { ok: true };
}
