import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Início" };

export default function AdminHomePage() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-800">Painel Innovip</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-muted">Carregando…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const admin = await requireAdmin();
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-muted">
        Conectado como <strong className="text-ink">{admin.email ?? "administrador"}</strong>, com
        verificação em duas etapas.
      </p>
      <section
        aria-labelledby="proximas-etapas"
        className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5"
      >
        <h2 id="proximas-etapas" className="text-lg font-semibold text-brand-800">
          Em construção
        </h2>
        <p className="mt-2 text-sm text-muted">
          Os módulos de conteúdo (Home, tratamentos, promoções, blog), mídia e leads
          entram nas próximas etapas. Este painel não exibe números de exemplo.
        </p>
      </section>
    </div>
  );
}
