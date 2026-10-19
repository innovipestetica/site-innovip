"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import type { ContentType } from "@/lib/cms/content-types";
import { CONTENT_TYPES, LIFECYCLE_LABEL, type LifecycleStatus } from "@/lib/cms/content-types";
import { centsToInput, localInputToUtc, parseBrlToCents, utcToLocalInput } from "@/lib/cms/format";
import { parseRichText, richTextToSource, type RichText } from "@/lib/cms/rich-text";

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border bg-surface-raised px-3 text-base text-ink";

function Described({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {hint ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      {children(describedBy)}
      {error ? <p id={errorId} className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function TextInput(props: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  maxLength?: number;
  hint?: string;
  error?: string;
  type?: "text" | "date" | "url" | "tel" | "email";
  required?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Described id={id} label={props.label} hint={props.hint} error={props.error}>
      {(describedBy) => (
        <input
          id={id}
          type={props.type ?? "text"}
          value={props.value ?? ""}
          maxLength={props.maxLength}
          required={props.required}
          placeholder={props.placeholder}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value === "" ? undefined : e.target.value)}
          className={`${inputClass} ${props.error ? "border-danger" : "border-line"}`}
        />
      )}
    </Described>
  );
}

export function TextArea(props: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  maxLength?: number;
  rows?: number;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <Described id={id} label={props.label} hint={props.hint} error={props.error}>
      {(describedBy) => (
        <textarea
          id={id}
          rows={props.rows ?? 3}
          value={props.value ?? ""}
          maxLength={props.maxLength}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value === "" ? undefined : e.target.value)}
          className={`${inputClass} py-2 ${props.error ? "border-danger" : "border-line"}`}
        />
      )}
    </Described>
  );
}

/** Texto rico editado com marcação leve; guarda o documento estruturado. */
export function RichTextArea(props: {
  label: string;
  value: RichText;
  onChange: (v: RichText) => void;
  error?: string;
}) {
  // Estado local do texto para não "pular" o cursor ao converter.
  const [source, setSource] = useState(() => richTextToSource(props.value));
  const id = useId();
  return (
    <Described
      id={id}
      label={props.label}
      error={props.error}
      hint="Parágrafos separados por linha em branco. ## subtítulo · - lista · 1. lista numerada · **negrito** · *itálico* · [texto](https://link ou /pagina)"
    >
      {(describedBy) => (
        <textarea
          id={id}
          rows={8}
          value={source}
          maxLength={20000}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setSource(e.target.value);
            props.onChange(parseRichText(e.target.value));
          }}
          className={`${inputClass} py-2 font-mono text-sm ${props.error ? "border-danger" : "border-line"}`}
        />
      )}
    </Described>
  );
}

export function Checkbox(props: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-1 size-5 accent-brand-700"
        aria-describedby={props.hint ? `${id}-dica` : undefined}
      />
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink">{props.label}</label>
        {props.hint ? <p id={`${id}-dica`} className="text-sm text-muted">{props.hint}</p> : null}
      </div>
    </div>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  emptyLabel?: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <Described id={id} label={props.label} hint={props.hint} error={props.error}>
      {(describedBy) => (
        <select
          id={id}
          value={props.value ?? ""}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange((e.target.value || undefined) as T | undefined)}
          className={`${inputClass} border-line`}
        >
          {props.emptyLabel !== undefined ? <option value="">{props.emptyLabel}</option> : null}
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Described>
  );
}

export function MoneyInput(props: {
  label: string;
  cents: number | undefined;
  onChange: (cents: number | undefined) => void;
  hint?: string;
  error?: string;
}) {
  const [text, setText] = useState(centsToInput(props.cents));
  const [localError, setLocalError] = useState<string>();
  const id = useId();
  return (
    <Described id={id} label={props.label} hint={props.hint ?? "Em reais, ex.: 199,90. Deixe vazio para não exibir preço."} error={localError ?? props.error}>
      {(describedBy) => (
        <input
          id={id}
          inputMode="decimal"
          value={text}
          aria-invalid={localError || props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setText(e.target.value);
            const cents = parseBrlToCents(e.target.value);
            if (cents === null) {
              setLocalError("Valor inválido.");
            } else {
              setLocalError(undefined);
              props.onChange(cents);
            }
          }}
          className={`${inputClass} ${localError || props.error ? "border-danger" : "border-line"}`}
        />
      )}
    </Described>
  );
}

export function DateTimeInput(props: {
  label: string;
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <Described id={id} label={props.label} hint="Horário de Brasília (America/Sao_Paulo)." error={props.error}>
      {(describedBy) => (
        <input
          id={id}
          type="datetime-local"
          value={utcToLocalInput(props.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value ? localInputToUtc(e.target.value) : undefined)}
          className={`${inputClass} ${props.error ? "border-danger" : "border-line"}`}
        />
      )}
    </Described>
  );
}

export type RefOption = {
  id: string | null;
  type: ContentType | null;
  title: string | null;
  slug: string | null;
  lifecycle_status: LifecycleStatus | null;
};

/** Escolha de vários conteúdos (ordem = ordem de seleção). */
export function EntryMultiPicker(props: {
  label: string;
  types: ContentType[];
  options: RefOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  hint?: string;
  error?: string;
}) {
  const [filter, setFilter] = useState("");
  const groupId = useId();
  const candidates = useMemo(
    () =>
      props.options.filter(
        (o) => o.id && o.type && props.types.includes(o.type) &&
          (!filter || (o.title ?? "").toLowerCase().includes(filter.toLowerCase())),
      ),
    [props.options, props.types, filter],
  );
  const byId = new Map(props.options.map((o) => [o.id, o]));

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={props.error ? `${groupId}-erro` : undefined}>
      <legend className="text-sm font-semibold text-ink">{props.label}</legend>
      {props.hint ? <p className="text-sm text-muted">{props.hint}</p> : null}
      {props.value.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm">
          {props.value.map((id, idx) => {
            const o = byId.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-1">
                <span>
                  {idx + 1}. {o?.title ?? "(item removido)"}
                  {o?.lifecycle_status && o.lifecycle_status !== "published" ? (
                    <span className="ml-2 text-xs text-gold-700">({LIFECYCLE_LABEL[o.lifecycle_status]} — precisa estar publicado)</span>
                  ) : null}
                </span>
                <span className="flex gap-1">
                  <button type="button" className="min-h-9 min-w-9 rounded hover:bg-brand-100" aria-label={`Subir ${o?.title ?? "item"}`} disabled={idx === 0}
                    onClick={() => { const n = [...props.value]; [n[idx - 1], n[idx]] = [n[idx]!, n[idx - 1]!]; props.onChange(n); }}>↑</button>
                  <button type="button" className="min-h-9 min-w-9 rounded hover:bg-brand-100" aria-label={`Remover ${o?.title ?? "item"}`}
                    onClick={() => props.onChange(props.value.filter((v) => v !== id))}>✕</button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <input
        type="search"
        aria-label={`Filtrar ${props.label.toLowerCase()}`}
        placeholder="Filtrar por título"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={`${inputClass} border-line`}
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
        {candidates.length === 0 ? (
          <p className="p-3 text-sm text-muted">
            Nenhum item encontrado. Crie em {props.types.map((t) => CONTENT_TYPES[t].plural).join(", ")}.
          </p>
        ) : (
          candidates.map((o) => {
            const checked = props.value.includes(o.id!);
            return (
              <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 hover:bg-brand-50">
                <input
                  type="checkbox"
                  className="size-5 accent-brand-700"
                  checked={checked}
                  onChange={(e) =>
                    props.onChange(e.target.checked ? [...props.value, o.id!] : props.value.filter((v) => v !== o.id))
                  }
                />
                <span className="text-sm">{o.title}</span>
                {o.lifecycle_status ? <span className="ml-auto text-xs text-muted">{LIFECYCLE_LABEL[o.lifecycle_status]}</span> : null}
              </label>
            );
          })
        )}
      </div>
      {props.error ? <p id={`${groupId}-erro`} className="text-sm text-danger">{props.error}</p> : null}
    </fieldset>
  );
}

export type MediaOption = { id: string; alt: string | null; status: string; width: number | null; height: number | null };

function mediaLabel(m: MediaOption) {
  const size = m.width && m.height ? ` · ${m.width}×${m.height}` : "";
  const status = m.status === "published" ? "" : " · fora do site";
  return `${m.alt || "(sem texto alternativo)"}${size}${status}`;
}

export function MediaPicker(props: {
  label: string;
  value: string | undefined;
  options: MediaOption[];
  onChange: (id: string | undefined) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <Select
      label={props.label}
      value={props.value}
      emptyLabel="Nenhuma"
      hint={props.hint ?? "Imagens enviadas em Mídia."}
      error={props.error}
      options={props.options.map((m) => ({ value: m.id, label: mediaLabel(m) }))}
      onChange={props.onChange}
    />
  );
}

export function MediaMultiPicker(props: {
  label: string;
  value: string[];
  options: MediaOption[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-ink">{props.label}</legend>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
        {props.options.length === 0 ? (
          <p className="p-3 text-sm text-muted">Nenhuma imagem enviada ainda (menu Mídia).</p>
        ) : (
          props.options.map((m) => (
            <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 hover:bg-brand-50">
              <input
                type="checkbox"
                className="size-5 accent-brand-700"
                checked={props.value.includes(m.id)}
                onChange={(e) => props.onChange(e.target.checked ? [...props.value, m.id] : props.value.filter((v) => v !== m.id))}
              />
              <span className="text-sm">{mediaLabel(m)}</span>
            </label>
          ))
        )}
      </div>
      {props.error ? <p className="text-sm text-danger">{props.error}</p> : null}
    </fieldset>
  );
}
