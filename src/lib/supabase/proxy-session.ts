import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Renova a sessão do Supabase (se o access token expirou) e devolve os
 * cookies atualizados na resposta. Roda no proxy apenas para /admin e /auth,
 * para que as páginas públicas continuem estáticas e cacheáveis.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<{
  response: NextResponse;
  claims: JwtPayload | null;
}> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Cabeçalhos anti-cache enviados pelo SDK junto com cookies novos.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e getClaims(): é aqui que
  // a sessão é validada (assinatura do JWT) e renovada se necessário.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
