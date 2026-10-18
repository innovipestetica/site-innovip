import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { requireAdmin } from "@/lib/auth/admin";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Definir nova senha">
      <Suspense fallback={<p className="text-center text-sm text-muted">Verificando sessão…</p>}>
        <ResetGate />
      </Suspense>
    </AuthCard>
  );
}

async function ResetGate() {
  // Exige administrador com MFA antes de trocar a senha: um link de
  // recuperação sozinho (aal1) não basta.
  await requireAdmin("/admin/redefinir-senha");
  return <ResetPasswordForm />;
}
