"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Field, buttonPrimary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "failed"; message: string };

const CODE_PATTERN = /^\d{6}$/;

export function MfaForm({ next }: { next: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Evita inscrição dupla no StrictMode (efeito roda duas vezes em dev).
    if (started.current) return;
    started.current = true;

    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setMode({ kind: "failed", message: "Não foi possível carregar a verificação. Recarregue a página." });
        return;
      }

      const verified = data.totp[0];
      if (verified) {
        setMode({ kind: "verify", factorId: verified.id });
        return;
      }

      // Remove inscrições TOTP abandonadas antes de criar uma nova.
      for (const factor of data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const enrolled = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Painel Innovip ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrolled.error) {
        setMode({ kind: "failed", message: "Não foi possível iniciar a configuração do autenticador." });
        return;
      }
      setMode({
        kind: "enroll",
        factorId: enrolled.data.id,
        qrCode: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode.kind !== "verify" && mode.kind !== "enroll") return;
    setFormError(null);

    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!CODE_PATTERN.test(code)) {
      setCodeError("Digite os 6 números exibidos no aplicativo.");
      return;
    }
    setCodeError(undefined);
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mode.factorId,
      code,
    });

    if (error) {
      setPending(false);
      setFormError(
        error.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos."
          : "Código inválido ou expirado. Confira o horário do celular e tente de novo.",
      );
      return;
    }

    await supabase.rpc("log_admin_auth_event", {
      p_action: mode.kind === "enroll" ? "auth.mfa_enrolled" : "auth.mfa_verified",
    });

    router.replace(next);
    router.refresh();
  }

  if (mode.kind === "loading") {
    return <p className="text-center text-sm text-muted" role="status">Preparando verificação…</p>;
  }
  if (mode.kind === "failed") {
    return <Alert tone="error">{mode.message}</Alert>;
  }

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode.kind === "enroll" ? (
        <div className="flex flex-col gap-3 text-sm text-ink">
          <p>
            <strong>Primeiro acesso:</strong> escaneie o QR code com o aplicativo
            autenticador e digite o código gerado.
          </p>
          {/* QR code SVG gerado pelo Supabase (data URL). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mode.qrCode}
            alt="QR code para configurar o aplicativo autenticador"
            width={200}
            height={200}
            className="mx-auto rounded-lg border border-line bg-white p-2"
          />
          <details className="rounded-lg border border-line p-3">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              Não consigo escanear
            </summary>
            <p className="mt-2">Digite esta chave no aplicativo:</p>
            <code className="mt-1 block break-all rounded bg-brand-50 p-2 font-mono text-sm">
              {mode.secret}
            </code>
          </details>
        </div>
      ) : null}

      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field
        label="Código de 6 dígitos"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={7}
        required
        autoFocus
        error={codeError}
      />
      <button type="submit" className={buttonPrimary} disabled={!hydrated || pending}>
        {pending ? "Verificando…" : "Verificar"}
      </button>
    </form>
  );
}
