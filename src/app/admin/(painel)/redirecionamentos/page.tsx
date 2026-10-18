import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminMain, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { AddRedirectForm, DeleteRedirectButton } from "./redirect-controls";

export const metadata: Metadata = { title: "Redirecionamentos" };

export default function RedirectsPage() {
  return (
    <AdminMain>
      <PageHeader
        title="Redirecionamentos"
        description="Criados automaticamente (301) quando o endereço de um conteúdo publicado muda. O sistema impede ciclos."
      />
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <Redirects />
      </Suspense>
    </AdminMain>
  );
}

async function Redirects() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("redirects")
    .select("id, source_path, target_path, status_code, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`redirects: ${error.code}`);

  return (
    <div className="flex flex-col gap-6">
      <AddRedirectForm />
      {data.length === 0 ? (
        <EmptyState>Nenhum redirecionamento.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all text-sm">
                <code>{r.source_path}</code> → <code>{r.target_path}</code>{" "}
                <span className="text-xs text-muted">({r.status_code} · {formatDateTime(r.created_at)})</span>
              </span>
              <DeleteRedirectButton id={r.id} source={r.source_path} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
