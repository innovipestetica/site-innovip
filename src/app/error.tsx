"use client";

import Link from "next/link";

// Nunca exibe a mensagem técnica ou o stack trace ao visitante.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold text-brand-800">
        Algo deu errado por aqui
      </h1>
      <p className="text-muted">
        Tente novamente em instantes. Se o problema continuar, volte à página
        inicial.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-[var(--radius-control)] bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-brand-700 px-5 font-semibold text-brand-800 hover:bg-brand-50"
        >
          Página inicial
        </Link>
      </div>
    </main>
  );
}
