import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe o e-mail do administrador para receber um link de redefinição."
    >
      <RecoverForm />
    </AuthCard>
  );
}
