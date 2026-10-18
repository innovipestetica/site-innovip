"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, Field, buttonPrimary } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const emailSchema = z.email().max(254);

// Mesma resposta exista ou não a conta (sem enumeração).
const NEUTRAL_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos.";

export function RecoverForm() {
  const [emailError, setEmailError] = useState<string>();
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "limited">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError("Informe um e-mail válido.");
      return;
    }
    setEmailError(undefined);
    setStatus("pending");

    const supabase = createSupabaseBrowserClient();
    // Precisa bater EXATAMENTE com uma Redirect URL do Supabase Auth (sem
    // query string). O /auth/confirm leva para "definir nova senha".
    const redirectTo = `${window.location.origin}/auth/confirm`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

    setStatus(error?.status === 429 ? "limited" : "sent");
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{NEUTRAL_MESSAGE}</Alert>
        <Link href="/admin/login" className="mx-auto inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {status === "limited" ? (
        <Alert tone="error">Muitas solicitações. Aguarde alguns minutos e tente novamente.</Alert>
      ) : null}
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        error={emailError}
      />
      <button type="submit" className={buttonPrimary} disabled={status === "pending"}>
        {status === "pending" ? "Enviando…" : "Enviar link"}
      </button>
      <Link href="/admin/login" className="mx-auto inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4">
        Voltar ao login
      </Link>
    </form>
  );
}
