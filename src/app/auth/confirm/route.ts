import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeAdminPath } from "@/lib/security/redirect";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";

const ALLOWED_OTP_TYPES: ReadonlySet<EmailOtpType> = new Set(["recovery", "email", "email_change"]);

/**
 * Retorno dos e-mails do Supabase Auth (recuperação de senha).
 * Aceita o fluxo PKCE (?code=) e o fluxo por token_hash (template de e-mail
 * customizado). O destino passa pela allowlist do painel (sem open redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeAdminPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type && ALLOWED_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    target.pathname = next;
  } else {
    target.pathname = ADMIN_LOGIN_PATH;
    target.searchParams.set("erro", "link");
  }
  return NextResponse.redirect(target);
}
