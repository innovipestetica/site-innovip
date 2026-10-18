"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, Field, buttonPrimary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeAdminPath } from "@/lib/security/redirect";
import { ADMIN_MFA_PATH } from "@/lib/auth/routes";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
  password: z.string().min(1, "Informe a senha.").max(128),
});

const MESSAGES: Record<string, string> = {
  acesso: "Esta conta não tem acesso ao painel.",
  link: "O link é inválido ou expirou. Solicite um novo.",
  sessao: "Sua sessão terminou. Entre novamente.",
};

export function LoginForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAdminPath(params.get("next"));
  const notice = MESSAGES[params.get("erro") ?? ""];

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors({ email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] });
      return;
    }
    setErrors({});
    setPending(true);

    // Login direto do navegador no Supabase Auth: o limite de tentativas por
    // IP do Supabase vale para o IP real do visitante.
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setPending(false);

    if (error) {
      // Mesma mensagem para e-mail inexistente e senha errada (sem enumeração).
      setFormError(
        error.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : "E-mail ou senha inválidos.",
      );
      return;
    }

    // O servidor decide se é o administrador e exige o segundo fator.
    router.replace(`${ADMIN_MFA_PATH}?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        error={errors.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <button type="submit" className={buttonPrimary} disabled={!hydrated || pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <Link
        href="/admin/recuperar-senha"
        className="mx-auto inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
