import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { listMediaOptions } from "@/lib/cms/admin-data";
import { AdminMain, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { AddRedirectForm, DeleteRedirectButton, RedirectPreviewForm } from "./redirect-controls";

export const metadata: Metadata = { title: "Redirecionamentos" };

export default function RedirectsPage() {
  return (
    <AdminMain>
      <PageHeader
        title="Redirecionamentos"
        description="Gerencie endereços antigos e acompanhe os encaminhamentos do link /grupovip."
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
  const privileged = createSupabasePrivilegedClient();
  const [{ data, error }, { count: vipCount, error: countError }, { data: vipRecent, error: recentError }, mediaOptions] = await Promise.all([
    supabase.from("redirects").select("id, source_path, target_path, status_code, created_at, preview_title, preview_description, preview_site_name, preview_media_id").order("created_at", { ascending: false }).limit(500),
    privileged.from("redirect_events").select("id", { count: "exact", head: true }).eq("source_path", "/grupovip").or("utm_campaign.is.null,utm_campaign.neq.validacao"),
    privileged.from("redirect_events").select("id, created_at, referrer_host, utm_source, utm_medium, utm_campaign").eq("source_path", "/grupovip").or("utm_campaign.is.null,utm_campaign.neq.validacao").order("created_at", { ascending: false }).limit(20),
    listMediaOptions(),
  ]);
  if (error) throw new Error(`redirects: ${error.code}`);
  if (countError) throw new Error(`redirect_events count: ${countError.code}`);
  if (recentError) throw new Error(`redirect_events recent: ${recentError.code}`);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="grupovip-metricas" className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="grupovip-metricas" className="text-lg font-semibold text-brand-800">Acessos ao Grupo VIP</h2>
            <p className="mt-1 text-sm text-muted"><code>/grupovip</code> encaminha automaticamente para o grupo do WhatsApp.</p>
          </div>
          <p className="text-3xl font-bold text-brand-800">{vipCount ?? 0} <span className="text-sm font-normal text-muted">{vipCount === 1 ? "redirecionamento" : "redirecionamentos"}</span></p>
        </div>
        {vipRecent?.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line text-muted"><th className="px-2 py-2 font-medium">Data</th><th className="px-2 py-2 font-medium">Origem</th><th className="px-2 py-2 font-medium">Campanha</th></tr></thead>
              <tbody>{vipRecent.map((event) => (
                <tr key={event.id} className="border-b border-line/70 last:border-0">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(event.created_at)}</td>
                  <td className="px-2 py-2">{event.referrer_host || event.utm_source || "Acesso direto"}</td>
                  <td className="px-2 py-2">{[event.utm_campaign, event.utm_medium].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="mt-5 text-sm text-muted">Nenhum acesso registrado ainda.</p>}
      </section>
      <AddRedirectForm mediaOptions={mediaOptions} />
      {data.length === 0 ? (
        <EmptyState>Nenhum redirecionamento.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
          {data.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all text-sm"><code>{r.source_path}</code> → <code>{r.target_path}</code>{" "}<span className="text-xs text-muted">({r.status_code} · {formatDateTime(r.created_at)})</span></span>
                <DeleteRedirectButton id={r.id} source={r.source_path} />
              </div>
              <RedirectPreviewForm redirect={r} mediaOptions={mediaOptions} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
