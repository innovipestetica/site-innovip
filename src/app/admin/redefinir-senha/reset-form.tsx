"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Field, buttonPrimary } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { passwordProblem } from "@/lib/validation/password";

export function ResetPasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    const problem = passwordProblem(password);
    if (problem) return setErrors({ password: problem });
    if (password !== confirm) return setErrors({ confirm: "As senhas não conferem." });
    setErrors({});
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      setFormError(
        error.code === "weak_password"
          ? "Senha fraca ou já vazada em outros sites. Escolha outra."
          : error.code === "same_password"
            ? "A nova senha precisa ser diferente da atual."
            : "Não foi possível alterar a senha. Tente novamente.",
      );
      return;
    }

    await supabase.rpc("log_admin_auth_event", { p_action: "auth.password_changed" });
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Mínimo de 12 caracteres. Prefira uma frase longa."
        required
        error={errors.password}
      />
      <Field
        label="Repita a nova senha"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm}
      />
      <button type="submit" className={buttonPrimary} disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
