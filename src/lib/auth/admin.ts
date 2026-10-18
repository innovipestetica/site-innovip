import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_LOGIN_PATH, ADMIN_MFA_PATH } from "./routes";

export type AdminContext = {
  userId: string;
  email: string | null;
};

export type AdminStatus =
  | { status: "anonymous" }
  | { status: "not_admin" }
  | { status: "mfa_required" }
  | { status: "ok"; admin: AdminContext };

/**
 * Camada de acesso (DAL) do administrador.
 *
 * - getClaims() valida a assinatura do JWT (não confia em getSession()).
 * - O banco decide se o usuário é o administrador (private.admin_account) e
 *   se a sessão tem MFA (aal2), via RPC admin_session_status.
 * - Nunca usa user_metadata nem e-mail como critério de autorização.
 *
 * Sem cache de propósito: cada chamada reavalia a sessão.
 */
export async function getAdminStatus(): Promise<AdminStatus> {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return { status: "anonymous" };

  const { data: dbStatus, error } = await supabase.rpc("admin_session_status");
  if (error) {
    // Falha de verificação nunca concede acesso.
    console.error("[auth] admin_session_status falhou", { code: error.code });
    return { status: "not_admin" };
  }

  if (dbStatus === "not_admin") return { status: "not_admin" };
  if (dbStatus === "mfa_required" || claims.aal !== "aal2") {
    return { status: "mfa_required" };
  }
  if (dbStatus !== "ok") return { status: "not_admin" };

  return {
    status: "ok",
    admin: {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
  };
}

/**
 * Para páginas: redireciona quando não for o administrador com MFA.
 * `returnTo` é um caminho interno fixo do código (não vem do usuário).
 */
export async function requireAdmin(returnTo?: string): Promise<AdminContext> {
  const result = await getAdminStatus();
  const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
  switch (result.status) {
    case "ok":
      return result.admin;
    case "mfa_required":
      redirect(`${ADMIN_MFA_PATH}${next}`);
    case "not_admin":
      redirect(`${ADMIN_LOGIN_PATH}?erro=acesso`);
    case "anonymous":
      redirect(`${ADMIN_LOGIN_PATH}${next}`);
  }
}

export class AdminAuthorizationError extends Error {
  constructor(readonly reason: Exclude<AdminStatus["status"], "ok">) {
    super("Operação restrita ao administrador.");
    this.name = "AdminAuthorizationError";
  }
}

/** Para Server Actions e Route Handlers: lança erro em vez de redirecionar. */
export async function assertAdmin(): Promise<AdminContext> {
  const result = await getAdminStatus();
  if (result.status !== "ok") throw new AdminAuthorizationError(result.status);
  return result.admin;
}
