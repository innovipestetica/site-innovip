/** Rotas do painel acessíveis sem sessão. */
export const ADMIN_PUBLIC_PATHS = [
  "/admin/login",
  "/admin/recuperar-senha",
] as const;

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_MFA_PATH = "/admin/mfa";
export const ADMIN_HOME_PATH = "/admin";

export function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
