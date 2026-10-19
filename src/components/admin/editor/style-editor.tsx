"use client";

import { useId } from "react";
import type { BlockStyle } from "@/lib/cms/blocks";
import { BRAND_SWATCHES, STYLE_FIELDS, styleWarnings } from "@/lib/cms/block-style";

/** "Cores do bloco": cada cor é opcional (vazio = cor padrão do site). */
export function StyleEditor({ value, onChange }: { value: BlockStyle | undefined; onChange: (style: BlockStyle | undefined) => void }) {
  const style = value ?? {};
  const set = (key: keyof BlockStyle, color: string | undefined) => {
    const next: BlockStyle = { ...style, [key]: color };
    if (!color) delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const warnings = styleWarnings(value);
  const count = Object.keys(style).length;

  return (
    <details className="rounded-lg border border-line">
      <summary className="min-h-11 cursor-pointer content-center px-3 text-sm font-semibold">
        Cores do bloco {count ? <span className="font-normal text-muted">({count} personalizada{count > 1 ? "s" : ""})</span> : <span className="font-normal text-muted">(padrão do site)</span>}
      </summary>
      <div className="flex flex-col gap-4 border-t border-line p-3">
        {STYLE_FIELDS.map((f) => (
          <ColorField key={f.key} label={f.label} hint={f.hint} value={style[f.key]} onChange={(c) => set(f.key, c)} />
        ))}
        {warnings.length ? (
          <ul role="status" className="list-disc rounded-lg bg-danger-bg py-2 pr-3 pl-7 text-sm text-danger">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : null}
        {count ? (
          <button type="button" onClick={() => onChange(undefined)}
            className="min-h-11 self-start rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50">
            Voltar todas as cores ao padrão
          </button>
        ) : null}
      </div>
    </details>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value?: string; onChange: (c: string | undefined) => void }) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold">{label}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">{label}: escolher cor</label>
        <input id={id} type="color" value={value ?? "#ffffff"} onChange={(e) => onChange(e.target.value)}
          className="size-11 cursor-pointer rounded-[var(--radius-control)] border border-line bg-surface p-1" />
        <span className="min-w-20 font-mono text-sm">{value ?? "padrão"}</span>
        <ul className="flex flex-wrap gap-1" aria-label={`${label}: cores da marca`}>
          {BRAND_SWATCHES.map((s) => (
            <li key={s.hex}>
              <button type="button" onClick={() => onChange(s.hex)} aria-pressed={value === s.hex}
                aria-label={`${s.name} (${s.hex})`} title={s.name}
                className={`size-7 rounded-full border ${value === s.hex ? "border-ink ring-2 ring-brand-700" : "border-line"}`}
                style={{ backgroundColor: s.hex }} />
            </li>
          ))}
        </ul>
        {value ? (
          <button type="button" onClick={() => onChange(undefined)} className="min-h-11 rounded px-2 text-sm font-semibold text-brand-800 underline underline-offset-4">
            Usar padrão
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
