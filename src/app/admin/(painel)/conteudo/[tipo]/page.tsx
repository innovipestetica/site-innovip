import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { listEntries, promotionWindows } from "@/lib/cms/admin-data";
import { requestNow } from "@/lib/request-time";
import {
  CONTENT_TYPES,
  LIFECYCLE_LABEL,
  publicPath,
  typeFromSegment,
  type LifecycleStatus,
} from "@/lib/cms/content-types";
import { AdminMain, EmptyState, PageHeader, StatusBadge, formatDateTime } from "@/components/admin/ui";
import { buttonPrimary, buttonSecondary } from "@/components/ui/form";

export const metadata: Metadata = { title: "Conteúdo" };

export default function ContentListPage({ params, searchParams }: PageProps<"/admin/conteudo/[tipo]">) {
  return (
    <AdminMain>
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <ContentList params={params} searchParams={searchParams} />
      </Suspense>
    </AdminMain>
  );
}

const STATUSES: (LifecycleStatus | "all")[] = ["all", "draft", "published", "unpublished", "archived"];
const SORTS = { updated: "Mais recentes", title: "Título (A–Z)", order: "Ordem definida" } as const;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function ContentList({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/conteudo/[tipo]">["params"];
  searchParams: PageProps<"/admin/conteudo/[tipo]">["searchParams"];
}) {
  await requireAdmin();
  const { tipo } = await params;
  const type = typeFromSegment(tipo);
  if (!type) notFound();
  const meta = CONTENT_TYPES[type];

  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80) ?? "";
  const statusRaw = one(sp.status);
  const status = STATUSES.includes(statusRaw as LifecycleStatus) ? (statusRaw as LifecycleStatus | "all") : "all";
  const sortRaw = one(sp.ordem);
  const sort = sortRaw && sortRaw in SORTS ? (sortRaw as keyof typeof SORTS) : "updated";
  const page = Math.max(1, Number.parseInt(one(sp.pagina) ?? "1", 10) || 1);

  const { rows, total, pageSize } = await listEntries({ type, q, status, sort, page });

  // A Home é única: vai direto para o editor (ou oferece criar).
  if (type === "home") {
    const home = rows[0];
    if (home?.id) redirect(`/admin/conteudo/home/${home.id}`);
    return (
      <>
        <PageHeader title="Home" />
        <EmptyState>
          <p>A Home ainda não foi criada.</p>
          <Link href="/admin/conteudo/home/novo" className={`${buttonPrimary} mt-4`}>
            Criar a Home
          </Link>
        </EmptyState>
      </>
    );
  }

  // Promoções: situação da versão NO AR (ou da última, se nunca publicada).
  const windows =
    type === "promotion"
      ? await promotionWindows(rows.map((r) => r.published_version_id ?? r.latest_version_id).filter((v): v is string => !!v))
      : new Map();
  const now = type === "promotion" ? await requestNow() : 0;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (overrides: Record<string, string | number>) => {
    const p = new URLSearchParams({ q, status, ordem: sort, pagina: String(page) });
    for (const [k, v] of Object.entries(overrides)) p.set(k, String(v));
    if (!q) p.delete("q");
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={meta.plural}
        description={`${total} item(ns)`}
        actions={
          <Link href={`/admin/conteudo/${meta.segment}/novo`} className={buttonPrimary}>
            Novo: {meta.label.toLowerCase()}
          </Link>
        }
      />

      <form method="get" role="search" className="mb-4 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="busca" className="text-sm font-semibold">Buscar</label>
          <input id="busca" name="q" defaultValue={q} type="search" maxLength={80} placeholder="Título ou endereço"
            className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface-raised px-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-semibold">Estado</label>
          <select id="estado" name="status" defaultValue={status} className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface-raised px-3">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "Todos (exceto arquivados)" : LIFECYCLE_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ordem" className="text-sm font-semibold">Ordenar</label>
          <select id="ordem" name="ordem" defaultValue={sort} className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface-raised px-3">
            {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className={buttonSecondary}>Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState>
          {q || status !== "all" ? "Nada encontrado com esses filtros." : `Nenhum(a) ${meta.label.toLowerCase()} ainda.`}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
          {rows.map((row) => {
            if (!row.id || !row.lifecycle_status) return null;
            const path = row.slug ? publicPath(type, row.slug) : null;
            const hasDraft = row.published_revision !== null && row.published_revision !== row.latest_revision;
            return (
              <li key={row.id}>
                <Link href={`/admin/conteudo/${meta.segment}/${row.id}`} className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-brand-50 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{row.title}</span>
                    {path ? <span className="block truncate text-xs text-muted">{path}</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {type === "promotion" ? (
                      <PromotionBadge window={windows.get(row.published_version_id ?? row.latest_version_id ?? "")} now={now} />
                    ) : null}
                    {hasDraft ? <span className="rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-700">alterações não publicadas</span> : null}
                    <StatusBadge status={row.lifecycle_status} />
                    <span>{formatDateTime(row.updated_at)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-2 text-sm">
          {page > 1 ? <Link className={buttonSecondary} href={qs({ pagina: page - 1 })}>Anterior</Link> : <span />}
          <span className="text-muted">Página {page} de {pages}</span>
          {page < pages ? <Link className={buttonSecondary} href={qs({ pagina: page + 1 })}>Próxima</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}

function PromotionBadge({ window: w, now }: { window?: { startsAt: string | null; endsAt: string | null }; now: number }) {
  if (!w?.startsAt || !w.endsAt) {
    return <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-muted">sem datas</span>;
  }
  const starts = Date.parse(w.startsAt);
  const ends = Date.parse(w.endsAt);
  const [label, cls] =
    now < starts
      ? ["agendada", "border-brand-300 bg-brand-50 text-brand-800"]
      : now >= ends
        ? ["encerrada", "border-line bg-surface text-muted"]
        : ["vigente", "border-success/30 bg-success-bg text-success"];
  return (
    <span className={`rounded-full border px-2 py-0.5 font-semibold ${cls}`} title={`${formatDateTime(w.startsAt)} – ${formatDateTime(w.endsAt)}`}>
      {label} · até {formatDateTime(w.endsAt)}
    </span>
  );
}
