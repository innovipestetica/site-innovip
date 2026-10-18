import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "./database.types";

/**
 * Cliente de servidor autenticado com a sessão do visitante (cookies).
 * Continua sujeito ao RLS: é o cliente padrão para operações administrativas.
 * Lê cookies, então só pode ser usado dentro de <Suspense>, Server Actions
 * ou Route Handlers — nunca em escopo "use cache".
 */
export async function createSupabaseServerClient() {
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components não podem gravar cookies. A renovação da
            // sessão acontece no proxy (src/proxy.ts), então pode ignorar.
          }
        },
      },
    },
  );
}
