import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthCard title="Painel Innovip" description="Acesso restrito ao administrador.">
      {/* useSearchParams lê dados da requisição: fica dentro de Suspense. */}
      <Suspense fallback={<p className="text-center text-sm text-muted">Carregando…</p>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
