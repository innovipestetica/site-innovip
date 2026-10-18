import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

// Página provisória da etapa 1. A Home editável por blocos chega na etapa 3.
export const metadata: Metadata = {
  title: { absolute: "Innovip — Clínica de Estética" },
  robots: { index: false, follow: false },
};

export default function Home() {
  return (
    <main
      id="conteudo"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      <Logo size={220} priority />
      <h1 className="text-2xl font-bold text-brand-800 sm:text-3xl">
        Site em construção
      </h1>
      <p className="max-w-md text-base text-muted">
        Em breve, o novo site da Innovip.
      </p>
    </main>
  );
}
