import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { AdminMain, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Planilha de acessos" };

type Event = Database["public"]["Tables"]["redirect_events"]["Row"];
const fields = "id, created_at, source_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_type, operating_system, browser, browser_language, country_code, region_code, city, visitor_key, is_returning, source_detail, clicked_page" as const;

function valid(events: Event[]) {
  return events.filter((event) => !event.utm_campaign?.startsWith("validacao"));
}

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

function peak(events: Event[], part: "weekday" | "hour") {
  const format = new Intl.DateTimeFormat("pt-BR", part === "weekday"
    ? { weekday: "long", timeZone: "America/Sao_Paulo" }
    : { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = format.format(new Date(event.created_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

export default function LinkMetricsPage() {
  return (
    <Suspense fallback={<AdminMain><p className="text-sm text-muted" role="status">Carregando métricas…</p></AdminMain>}>
      <LinkMetrics />
    </Suspense>
  );
}

async function LinkMetrics() {
  await requireAdmin("/admin/metricas-links");
  const supabase = createSupabasePrivilegedClient();
  const { data, error, count } = await supabase
    .from("redirect_events")
    .select(fields, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`redirect_events analytics: ${error.code}`);

  const events = valid((data ?? []) as Event[]);
  const today = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(0)).length;
  const week = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(6)).length;
  const month = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(29)).length;
  const uniques = new Set(events.map((e) => e.visitor_key).filter(Boolean)).size;
  const total = Math.max(0, (count ?? events.length) - ((data ?? []).length - events.length));
  return (
    <AdminMain>
      <PageHeader
        title="Planilha de acessos"
        description="Métricas dos links rastreáveis. A localização é aproximada e o endereço IP não é armazenado."
        actions={<Link href="/admin/metricas-links/exportar" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Baixar CSV</Link>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Total', total], ['Hoje', today], ['Últimos 7 dias', week], ['Últimos 30 dias', month]].map(([label, value]) => (
          <section key={String(label)} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
            <p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold text-brand-800">{value}</p>
          </section>
        ))}
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Visitantes únicos aproximados</p><p className="mt-1 text-xl font-bold text-brand-800">{uniques}</p></div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Dia com mais acessos</p><p className="mt-1 capitalize font-semibold text-brand-800">{peak(events, "weekday")}</p></div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Horário com mais acessos</p><p className="mt-1 font-semibold text-brand-800">{peak(events, "hour")}{events.length ? "h" : ""}</p></div>
      </section>

      {events.length === 0 ? <EmptyState>Nenhum acesso registrado ainda.</EmptyState> : (
        <section aria-labelledby="acessos-detalhados" className="rounded-[var(--radius-card)] border border-line bg-surface-raised">
          <div className="border-b border-line p-4"><h2 id="acessos-detalhados" className="font-semibold text-brand-800">Acessos detalhados</h2><p className="text-xs text-muted">Exibindo até 5.000 registros mais recentes.</p></div>
          <div className="overflow-x-auto">
            <table className="min-w-[2000px] w-full text-left text-xs">
              <thead><tr className="border-b border-line bg-surface text-muted">
                {['Data e hora','Página acessada','Origem','UTM origem','Mídia','Campanha','Conteúdo','Termo','Dispositivo','Sistema','Navegador','Idioma','Localização','Visita','Origem detalhada','Página do clique'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-3">{formatDateTime(event.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-3"><code>{event.source_path}</code></td>
                  <td className="px-3 py-3">{event.referrer_host || 'Direto'}</td>
                  <td className="px-3 py-3">{event.utm_source || '—'}</td><td className="px-3 py-3">{event.utm_medium || '—'}</td><td className="px-3 py-3">{event.utm_campaign || '—'}</td><td className="px-3 py-3">{event.utm_content || '—'}</td><td className="px-3 py-3">{event.utm_term || '—'}</td>
                  <td className="px-3 py-3 capitalize">{event.device_type || '—'}</td><td className="px-3 py-3">{event.operating_system || '—'}</td><td className="px-3 py-3">{event.browser || '—'}</td><td className="px-3 py-3">{event.browser_language || '—'}</td>
                  <td className="px-3 py-3">{[event.city, event.region_code, event.country_code].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-3">{event.is_returning === null ? 'Não identificado' : event.is_returning ? 'Repetida' : 'Primeira'}</td>
                  <td className="px-3 py-3">{event.source_detail || '—'}</td><td className="max-w-xs break-all px-3 py-3">{event.clicked_page || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </AdminMain>
  );
}
