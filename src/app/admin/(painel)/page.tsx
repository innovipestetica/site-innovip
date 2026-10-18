import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { dashboardCounts } from "@/lib/cms/admin-data";
import { CONTENT_TYPES, CONTENT_TYPE_LIST } from "@/lib/cms/content-types";
import { AdminMain, StatusBadge, formatDateTime } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Início" };

export default function AdminHomePage() {
  return (
    <AdminMain>
      <h1 className="text-2xl font-bold text-brand-800">Painel Innovip</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-muted" role="status">Carregando…</p>}>
        <Dashboard />
      </Suspense>
    </AdminMain>
  );
}

async function Dashboard() {
  const admin = await requireAdmin();
  const { counts, recent } = await dashboardCounts();

  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="text-muted">
        Conectado como <strong className="text-ink">{admin.email ?? "administrador"}</strong>, com
        verificação em duas etapas.
      </p>

      <section aria-labelledby="resumo">
        <h2 id="resumo" className="mb-3 text-lg font-semibold text-brand-800">Conteúdo</h2>
        {/* Números reais do banco: nada de exemplo. */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT_TYPE_LIST.map((type) => {
            const c = counts.get(type) ?? { published: 0, draft: 0, other: 0 };
            return (
              <li key={type}>
                <Link
                  href={`/admin/conteudo/${CONTENT_TYPES[type].segment}`}
                  className="block rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 hover:border-brand-300"
                >
                  <span className="font-semibold text-ink">{CONTENT_TYPES[type].plural}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {c.published} publicado(s) · {c.draft} rascunho(s)
                    {c.other ? ` · ${c.other} outro(s)` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="recentes">
        <h2 id="recentes" className="mb-3 text-lg font-semibold text-brand-800">Editados recentemente</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Nenhum conteúdo criado ainda.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
            {recent.map((r) =>
              r.id && r.type ? (
                <li key={r.id}>
                  <Link
                    href={`/admin/conteudo/${CONTENT_TYPES[r.type].segment}/${r.id}`}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-brand-50"
                  >
                    <span className="font-medium text-ink">{r.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {CONTENT_TYPES[r.type].label} · {formatDateTime(r.updated_at)}
                      {r.lifecycle_status ? <StatusBadge status={r.lifecycle_status} /> : null}
                    </span>
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
