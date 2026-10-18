"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";

/**
 * Encerra a sessão no servidor (revoga o refresh token desta sessão e limpa
 * os cookies). Server Actions já têm proteção de origem contra CSRF no Next.js.
 */
export async function signOutAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    // Só grava se for o administrador; para outros usuários a RPC recusa.
    await supabase.rpc("log_admin_auth_event", { p_action: "auth.sign_out" });
    await supabase.auth.signOut({ scope: "local" });
  }

  const reason = formData.get("motivo");
  redirect(reason === "acesso" ? `${ADMIN_LOGIN_PATH}?erro=acesso` : ADMIN_LOGIN_PATH);
}
