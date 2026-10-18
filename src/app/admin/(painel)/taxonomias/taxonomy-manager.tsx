"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, buttonPrimary, buttonSecondary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { Select, TextArea, TextInput } from "@/components/admin/editor/fields";
import { slugify } from "@/lib/cms/content-types";
import { saveTaxonomyAction, type TaxonomyInput } from "./actions";

type Item = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  area?: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
  revision: number;
};

const STATUS_LABEL = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" } as const;

export function TaxonomyManager(props: { kind: "categories" | "concerns"; title: string; items: Item[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <section aria-labelledby={`${props.kind}-titulo`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${props.kind}-titulo`} className="text-lg font-semibold text-brand-800">{props.title}</h2>
        {!creating ? (
          <button type="button" className={buttonSecondary} onClick={() => setCreating(true)}>Adicionar</button>
        ) : null}
      </div>
      {creating ? <ItemForm kind={props.kind} onDone={() => setCreating(false)} /> : null}
      {props.items.length === 0 && !creating ? (
        <p className="text-sm text-muted">Nada cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.items.map((item) => <ItemRow key={`${item.id}:${item.revision}`} kind={props.kind} item={item} />)}
        </ul>
      )}
    </section>
  );
}

function ItemRow({ kind, item }: { kind: "categories" | "concerns"; item: Item }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface-raised">
      {editing ? (
        <ItemForm kind={kind} item={item} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <span>
            <span className="font-medium">{item.name}</span>{" "}
            <span className="text-xs text-muted">/{item.slug} · {STATUS_LABEL[item.status]}{item.area ? ` · ${item.area}` : ""} · ordem {item.sort_order}</span>
          </span>
          <button type="button" className="min-h-11 px-2 text-sm font-semibold text-brand-800 underline" onClick={() => setEditing(true)}>
            Editar <span className="sr-only">{item.name}</span>
          </button>
        </div>
      )}
    </li>
  );
}

function ItemForm({ kind, item, onDone }: { kind: "categories" | "concerns"; item?: Item; onDone: () => void }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState<TaxonomyInput>({
    kind,
    id: item?.id,
    baseRevision: item?.revision,
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    description: item?.description ?? undefined,
    area: (item?.area as "facial" | "corporal" | null | undefined) ?? undefined,
    sort_order: item?.sort_order ?? 0,
    status: item?.status ?? "draft",
  });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const res = await saveTaxonomyAction(v);
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      setIssues(Object.fromEntries((res.issues ?? []).map((i) => [i.path, i.message])));
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Nome" value={v.name} maxLength={80} error={issues.name}
          onChange={(name) => setV((p) => ({ ...p, name: name ?? "", slug: item ? p.slug : slugify(name ?? "") }))} />
        <TextInput label="Endereço (slug)" value={v.slug} maxLength={80} error={issues.slug}
          onChange={(slug) => setV((p) => ({ ...p, slug: (slug ?? "").toLowerCase() }))} />
      </div>
      <TextArea label="Descrição (opcional)" value={v.description} maxLength={300} rows={2}
        onChange={(description) => setV((p) => ({ ...p, description }))} />
      <div className="grid gap-3 sm:grid-cols-3">
        {kind === "concerns" ? (
          <Select label="Área" value={v.area} emptyLabel="Ambas" options={[{ value: "facial", label: "Facial" }, { value: "corporal", label: "Corporal" }]}
            onChange={(area) => setV((p) => ({ ...p, area }))} />
        ) : null}
        <TextInput label="Ordem" value={String(v.sort_order ?? 0)} onChange={(s) => setV((p) => ({ ...p, sort_order: Number.parseInt(s ?? "0", 10) || 0 }))} />
        <Select label="Estado" value={v.status} options={(["draft", "published", "archived"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          onChange={(status) => status && setV((p) => ({ ...p, status }))} />
      </div>
      <div className="flex gap-2">
        <button type="button" className={buttonPrimary} disabled={!hydrated || pending} onClick={save}>{pending ? "Salvando…" : "Salvar"}</button>
        <button type="button" className={buttonSecondary} onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}
