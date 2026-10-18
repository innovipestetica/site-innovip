import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-gold-700">
        Erro 404
      </p>
      <h1 className="text-2xl font-bold text-brand-800 sm:text-3xl">
        Não encontramos esta página
      </h1>
      <p className="text-muted">
        O endereço pode ter mudado ou a página não está mais disponível.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
      >
        Ir para a página inicial
      </Link>
    </main>
  );
}
