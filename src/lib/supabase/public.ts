import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente ANÔNIMO para leituras públicas em cache ('use cache').
 * Sem cookies nem sessão: só enxerga o que o RLS libera para anon
 * (conteúdo publicado e colunas públicas). Seguro para cache compartilhado.
 */
export function createSupabasePublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
