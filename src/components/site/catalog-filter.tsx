"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { normalizeSearch } from "@/lib/search";
import { useHydrated } from "@/components/ui/use-hydrated";

export type CatalogItem = {
  id: string;
  /** Título + resumo já normalizados (sem acento, minúsculas). */
  text: string;
  categories: string[];
  concerns: string[];
  /** Card pronto, renderizado no servidor. */
  card: ReactNode;
};

type Option = { slug: string; name: string };
type Values = { q: string; objetivo: string; categoria: string };

const field = "min-h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3";

/**
 * Filtro do catálogo que responde enquanto a pessoa digita ou escolhe, sem
 * recarregar a página. O estado fica no endereço (?q=&objetivo=&categoria=),
 * então links filtrados continuam funcionando. Sem JavaScript, o formulário
 * envia por GET com o botão "Filtrar" (servidor filtra igual).
 */
export function CatalogFilter({
  items,
  concerns,
  categories,
  initial,
  idPrefix = "",
}: {
  items: CatalogItem[];
  concerns: Option[];
  categories: Option[];
  initial: Values;
  idPrefix?: string;
}) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<Values>(initial);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

  const filtered = useMemo(() => {
    const q = normalizeSearch(values.q.trim());
    return items.filter(
      (t) =>
        (!values.objetivo || t.concerns.includes(values.objetivo)) &&
        (!values.categoria || t.categories.includes(values.categoria)) &&
        (!q || t.text.includes(q)),
    );
  }, [items, values]);

  // Endereço acompanha os filtros (com pausa curta: alguns navegadores limitam
  // o número de replaceState por segundo).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (values.q.trim()) params.set("q", values.q.trim());
      if (values.objetivo) params.set("objetivo", values.objetivo);
      if (values.categoria) params.set("categoria", values.categoria);
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }, 300);
    return () => window.clearTimeout(t);
  }, [values]);

  const active = [
    concerns.find((c) => c.slug === values.objetivo)?.name,
    categories.find((c) => c.slug === values.categoria)?.name,
    values.q.trim() ? `“${values.q.trim()}”` : null,
  ].filter(Boolean);

  return (
    <>
      <form
        method="get"
        role="search"
        aria-label="Filtrar tratamentos"
        onSubmit={(e) => hydrated && e.preventDefault()}
        className="mt-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}busca`} className="text-sm font-semibold">Buscar</label>
          <input id={`${idPrefix}busca`} name="q" type="search" value={values.q} maxLength={60} placeholder="Ex.: manchas, flacidez"
            onChange={(e) => set({ q: e.target.value })} className={field} />
        </div>
        {concerns.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}objetivo`} className="text-sm font-semibold">O que deseja tratar</label>
            <select id={`${idPrefix}objetivo`} name="objetivo" value={values.objetivo} onChange={(e) => set({ objetivo: e.target.value })} className={field}>
              <option value="">Todos</option>
              {concerns.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        ) : null}
        {categories.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}categoria`} className="text-sm font-semibold">Categoria</label>
            <select id={`${idPrefix}categoria`} name="categoria" value={values.categoria} onChange={(e) => set({ categoria: e.target.value })} className={field}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        ) : null}
        <noscript>
          <button type="submit" className="min-h-11 rounded-[var(--radius-control)] bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Filtrar</button>
        </noscript>
      </form>

      <div className="mt-8" />
      <p className="mb-4 min-h-5 text-center text-sm text-muted" role="status">
        {active.length ? (
          <>
            {filtered.length} resultado(s) para {active.join(" · ")}.{" "}
            <Link href="/tratamentos" className="font-semibold text-brand-800 underline"
              onClick={(e) => {
                if (!hydrated) return;
                e.preventDefault();
                setValues({ q: "", objetivo: "", categoria: "" });
              }}>
              Limpar filtros
            </Link>
          </>
        ) : null}
      </p>
      {filtered.length ? (
        <ul className="card-grid [--card-gap:1.25rem]">{filtered.map((t) => <Fragment key={t.id}>{t.card}</Fragment>)}</ul>
      ) : (
        <p className="text-center text-muted">Nenhum tratamento com esses filtros. Fale com a equipe na avaliação.</p>
      )}
    </>
  );
}
