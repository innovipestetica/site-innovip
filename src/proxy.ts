import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy-session";
import { ADMIN_LOGIN_PATH, isAdminPublicPath } from "@/lib/auth/routes";

/**
 * Proxy (antigo middleware) — roda só em /admin e /auth.
 * 1. Renova a sessão do Supabase e devolve os cookies atualizados.
 * 2. Redireciona visitantes sem sessão para o login (checagem OTIMISTA).
 *
 * Isto NÃO é a barreira de segurança: páginas, Server Actions, Route Handlers
 * e o banco (RLS) verificam o administrador de novo em cada operação.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  const needsSession =
    pathname.startsWith("/admin") && !isAdminPublicPath(pathname);

  if (needsSession && !claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = ADMIN_LOGIN_PATH;
    loginUrl.search = "";
    if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname);

    const redirect = NextResponse.redirect(loginUrl);
    // Preserva cookies limpos/renovados pelo SDK no redirecionamento.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return withPrivateHeaders(redirect);
  }

  return withPrivateHeaders(response);
}

function withPrivateHeaders(response: NextResponse): NextResponse {
  // Sessões e painel nunca entram em cache compartilhado nem em buscadores.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/auth/:path*"],
};
