import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { AdminMain, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Planilha de acessos" };
type Event = Database["public"]["Tables"]["redirect_events"]["Row"];
type Params = Record<string, string | string[] | undefined>;
type Filters = { traffic: "people" | "bots" | "all"; device: string; sourcePath: string; campaign: string; search: string; from: string; to: string; page: number };
const PAGE_SIZE = 50;
const fields = "id, created_at, source_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_type, operating_system, browser, browser_language, country_code, region_code, city, visitor_key, is_returning, source_detail, clicked_page" as const;

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function filtersFrom(params: Params): Filters {
  const traffic = one(params.traffic);
  return { traffic: traffic === "bots" || traffic === "all" ? traffic : "people", device: one(params.device), sourcePath: one(params.source_path), campaign: one(params.campaign).trim().toLocaleLowerCase("pt-BR"), search: one(params.q).trim().toLocaleLowerCase("pt-BR"), from: one(params.from), to: one(params.to), page: Math.max(1, Number.parseInt(one(params.page), 10) || 1) };
}
function valid(events: Event[]) { return events.filter((event) => !event.utm_campaign?.startsWith("validacao")); }
function applyFilters(events: Event[], f: Filters) {
  const from = f.from ? new Date(`${f.from}T00:00:00-03:00`).getTime() : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999-03:00`).getTime() : null;
  return events.filter((e) => {
    if (f.traffic === "people" && e.device_type === "bot") return false;
    if (f.traffic === "bots" && e.device_type !== "bot") return false;
    if (f.device && e.device_type !== f.device) return false;
    if (f.sourcePath && e.source_path !== f.sourcePath) return false;
    if (f.campaign && !(e.utm_campaign ?? "").toLocaleLowerCase("pt-BR").includes(f.campaign)) return false;
    const time = new Date(e.created_at).getTime();
    if (from !== null && time < from) return false;
    if (to !== null && time > to) return false;
    if (f.search) {
      const text = [e.referrer_host, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.source_detail, e.clicked_page, e.city, e.browser].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      if (!text.includes(f.search)) return false;
    }
    return true;
  });
}
function queryString(f: Filters, page?: number) {
  const p = new URLSearchParams();
  if (f.traffic !== "people") p.set("traffic", f.traffic); if (f.device) p.set("device", f.device); if (f.sourcePath) p.set("source_path", f.sourcePath); if (f.campaign) p.set("campaign", f.campaign); if (f.search) p.set("q", f.search); if (f.from) p.set("from", f.from); if (f.to) p.set("to", f.to); if (page && page > 1) p.set("page", String(page));
  return p.toString();
}
function startOfDaysAgo(days: number) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - days); return date.getTime(); }
function peak(events: Event[], part: "weekday" | "hour") {
  const format = new Intl.DateTimeFormat("pt-BR", part === "weekday" ? { weekday: "long", timeZone: "America/Sao_Paulo" } : { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });
  const counts = new Map<string, number>(); for (const event of events) { const key = format.format(new Date(event.created_at)); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

export default async function LinkMetricsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return <Suspense fallback={<AdminMain><p className="text-sm text-muted" role="status">Carregando métricas…</p></AdminMain>}><LinkMetrics params={params} /></Suspense>;
}

async function LinkMetrics({ params }: { params: Params }) {
  await requireAdmin("/admin/metricas-links");
  const { data, error } = await createSupabasePrivilegedClient().from("redirect_events").select(fields).order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(`redirect_events analytics: ${error.code}`);
  const allEvents = valid((data ?? []) as Event[]); const filters = filtersFrom(params); const events = applyFilters(allEvents, filters);
  const sourcePaths = [...new Set(allEvents.map((e) => e.source_path))].sort(); const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE)); const currentPage = Math.min(filters.page, totalPages); const visibleEvents = events.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const today = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(0)).length; const week = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(6)).length; const month = events.filter((e) => new Date(e.created_at).getTime() >= startOfDaysAgo(29)).length; const uniques = new Set(events.map((e) => e.visitor_key).filter(Boolean)).size; const exportQuery = queryString(filters);
  return <AdminMain>
    <PageHeader title="Planilha de acessos" description="Filtre os acessos e oculte tráfego automatizado. A localização é aproximada e o IP não é armazenado." actions={<Link href={`/admin/metricas-links/exportar${exportQuery ? `?${exportQuery}` : ""}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Baixar CSV filtrado</Link>} />
    <form className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4" method="get">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-brand-800">Tráfego<select name="traffic" defaultValue={filters.traffic} className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-white px-3 text-sm"><option value="people">Somente pessoas</option><option value="bots">Somente bots</option><option value="all">Pessoas e bots</option></select></label>
        <label className="text-xs font-medium text-brand-800">Dispositivo<select name="device" defaultValue={filters.device} className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-white px-3 text-sm"><option value="">Todos</option><option value="celular">Celular</option><option value="tablet">Tablet</option><option value="computador">Computador</option><option value="bot">Bot</option></select></label>
        <label className="text-xs font-medium text-brand-800">Página acessada<select name="source_path" defaultValue={filters.sourcePath} className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-white px-3 text-sm"><option value="">Todas</option>{sourcePaths.map((path) => <option key={path} value={path}>{path}</option>)}</select></label>
        <label className="text-xs font-medium text-brand-800">Campanha<input name="campaign" defaultValue={filters.campaign} placeholder="Nome da campanha" className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line px-3 text-sm" /></label>
        <label className="text-xs font-medium text-brand-800">De<input type="date" name="from" defaultValue={filters.from} className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line px-3 text-sm" /></label>
        <label className="text-xs font-medium text-brand-800">Até<input type="date" name="to" defaultValue={filters.to} className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line px-3 text-sm" /></label>
        <label className="text-xs font-medium text-brand-800 sm:col-span-2">Buscar nos dados<input name="q" defaultValue={filters.search} placeholder="Origem, UTM, cidade, navegador ou página do clique" className="mt-1 block min-h-11 w-full rounded-[var(--radius-control)] border border-line px-3 text-sm" /></label>
      </div><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-[var(--radius-control)] bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">Aplicar filtros</button><Link href="/admin/metricas-links" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-line px-5 text-sm font-semibold text-brand-800 hover:bg-surface">Limpar</Link></div>
    </form>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Total filtrado", events.length], ["Hoje", today], ["Últimos 7 dias", week], ["Últimos 30 dias", month]].map(([label, value]) => <section key={String(label)} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold text-brand-800">{value}</p></section>)}</div>
    <section className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Visitantes únicos aproximados</p><p className="mt-1 text-xl font-bold text-brand-800">{uniques}</p></div><div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Dia com mais acessos</p><p className="mt-1 capitalize font-semibold text-brand-800">{peak(events, "weekday")}</p></div><div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4"><p className="text-sm text-muted">Horário com mais acessos</p><p className="mt-1 font-semibold text-brand-800">{peak(events, "hour")}{events.length ? "h" : ""}</p></div></section>
    {events.length === 0 ? <EmptyState>Nenhum acesso corresponde aos filtros.</EmptyState> : <section aria-labelledby="acessos-detalhados" className="rounded-[var(--radius-card)] border border-line bg-surface-raised">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line p-4"><div><h2 id="acessos-detalhados" className="font-semibold text-brand-800">Acessos detalhados</h2><p className="text-xs text-muted">{events.length} registro(s) · página {currentPage} de {totalPages}</p></div>{filters.traffic === "people" ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">Bots ocultos</span> : null}</div>
      <div className="max-h-[70vh] overflow-auto"><table className="min-w-[2000px] w-full text-left text-xs"><thead className="sticky top-0 z-10"><tr className="border-b border-line bg-surface text-muted shadow-sm">{["Data e hora","Página acessada","Origem","UTM origem","Mídia","Campanha","Conteúdo","Termo","Dispositivo","Sistema","Navegador","Idioma","Localização","Visita","Origem detalhada","Página do clique"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{visibleEvents.map((e, index) => <tr key={e.id} className={`border-b border-line/70 align-top last:border-0 ${index % 2 ? "bg-surface/60" : "bg-white"}`}><td className="whitespace-nowrap px-3 py-3">{formatDateTime(e.created_at)}</td><td className="whitespace-nowrap px-3 py-3"><code>{e.source_path}</code></td><td className="px-3 py-3">{e.referrer_host || "Direto"}</td><td className="px-3 py-3">{e.utm_source || "—"}</td><td className="px-3 py-3">{e.utm_medium || "—"}</td><td className="px-3 py-3">{e.utm_campaign || "—"}</td><td className="px-3 py-3">{e.utm_content || "—"}</td><td className="px-3 py-3">{e.utm_term || "—"}</td><td className="px-3 py-3 capitalize">{e.device_type || "—"}</td><td className="px-3 py-3">{e.operating_system || "—"}</td><td className="px-3 py-3">{e.browser || "—"}</td><td className="px-3 py-3">{e.browser_language || "—"}</td><td className="px-3 py-3">{[e.city, e.region_code, e.country_code].filter(Boolean).join(", ") || "—"}</td><td className="px-3 py-3">{e.is_returning === null ? "Não identificado" : e.is_returning ? "Repetida" : "Primeira"}</td><td className="px-3 py-3">{e.source_detail || "—"}</td><td className="max-w-xs break-all px-3 py-3">{e.clicked_page || "—"}</td></tr>)}</tbody></table></div>
      {totalPages > 1 ? <nav aria-label="Paginação dos acessos" className="flex items-center justify-between border-t border-line p-4 text-sm">{currentPage > 1 ? <Link className="font-semibold text-brand-700" href={`?${queryString(filters, currentPage - 1)}`}>← Anterior</Link> : <span />}<span className="text-muted">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, events.length)} de {events.length}</span>{currentPage < totalPages ? <Link className="font-semibold text-brand-700" href={`?${queryString(filters, currentPage + 1)}`}>Próxima →</Link> : <span />}</nav> : null}
    </section>}
  </AdminMain>;
}
