import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { Alert, buttonSecondary } from "@/components/ui/form";
import { getAdminStatus } from "@/lib/auth/admin";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";
import { safeAdminPath } from "@/lib/security/redirect";
import { signOutAction } from "../actions";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default function MfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  return (
    <AuthCard
      title="Verificação em duas etapas"
      description="Use o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password etc.)."
    >
      <Suspense fallback={<p className="text-center text-sm text-muted">Verificando sessão…</p>}>
        <MfaGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function MfaGate({
  searchParams,
}: {
  searchParams: PageProps<"/admin/mfa">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeAdminPath(typeof params.next === "string" ? params.next : null);
  const result = await getAdminStatus();

  if (result.status === "anonymous") {
    redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }
  if (result.status === "ok") redirect(next);

  if (result.status === "not_admin") {
    return (
      <form action={signOutAction} className="flex flex-col gap-4">
        <input type="hidden" name="motivo" value="acesso" />
        <Alert tone="error">Esta conta não tem acesso ao painel.</Alert>
        <button type="submit" className={buttonSecondary}>
          Sair
        </button>
      </form>
    );
  }

  return <MfaForm next={next} />;
}
