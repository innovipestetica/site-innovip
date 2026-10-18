import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import type { Database } from "./database.types";

/**
 * Cliente privilegiado (chave secreta): IGNORA o RLS.
 * Use apenas em operações internas do servidor que já passaram por validação
 * e autorização na aplicação (ex.: gravar lead, worker da outbox).
 * Operações administrativas comuns devem usar createSupabaseServerClient().
 */
export function createSupabasePrivilegedClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
