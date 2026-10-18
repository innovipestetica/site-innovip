"use client";

import { useId, useState } from "react";
import { BLOCK_META, newBlockId, type Block, type BlockType, type CtaAction } from "@/lib/cms/blocks";
import {
  Checkbox,
  EntryMultiPicker,
  MediaMultiPicker,
  MediaPicker,
  RichTextArea,
  Select,
  TextArea,
  TextInput,
  type MediaOption,
  type RefOption,
} from "./fields";

type Issues = Record<string, string>;

/** Bloco recém-adicionado: campos vazios, validados no salvamento. */
function emptyBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "hero":
      return { id, type, heading: "", primary: { kind: "evaluation", label: "Agendar avaliação" } };
    case "rich_text":
      return { id, type, body: [] };
    case "image":
      return { id, type, mediaId: "" };
    case "cta":
      return { id, type, heading: "", action: { kind: "evaluation", label: "Agendar avaliação" } };
    case "features":
    case "steps":
      return { id, type, items: [{ title: "" }] };
    case "notice":
      return { id, type, tone: "important", text: "" };
    case "faq_list":
    case "treatment_list":
    case "testimonial_list":
    case "team_list":
      return { id, type, entryIds: [] };
    case "category_list":
      return { id, type };
    case "concern_list":
      return { id, type };
    case "promotion_list":
      return { id, type, limit: 6 };
    case "gallery":
      return { id, type, mediaIds: [] };
    case "contact":
      return { id, type, showMap: true, showForm: true };
  }
}

export function BlocksEditor(props: {
  blocks: Block[];
  allowed: BlockType[];
  onChange: (blocks: Block[]) => void;
  refOptions: RefOption[];
  mediaOptions: MediaOption[];
  issues: Issues;
}) {
  const [toAdd, setToAdd] = useState<BlockType | undefined>(props.allowed[0]);
  const { blocks, onChange } = props;

  const update = (idx: number, next: Block) => onChange(blocks.map((b, i) => (i === idx ? next : b)));
  const move = (idx: number, dir: -1 | 1) => {
    const n = [...blocks];
    const j = idx + dir;
    if (j < 0 || j >= n.length) return;
    [n[idx], n[j]] = [n[j]!, n[idx]!];
    onChange(n);
  };

  return (
    <section aria-labelledby="blocos-titulo" className="flex flex-col gap-4">
      <h2 id="blocos-titulo" className="text-lg font-semibold text-brand-800">Blocos da página</h2>
      {blocks.length === 0 ? <p className="text-sm text-muted">Nenhum bloco. Adicione abaixo.</p> : null}

      <ol className="flex flex-col gap-4">
        {blocks.map((block, idx) => (
          <li key={block.id} className="rounded-[var(--radius-card)] border border-line bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
              <h3 className="text-sm font-semibold text-ink">
                {idx + 1}. {BLOCK_META[block.type].label}
              </h3>
              <div className="flex flex-wrap gap-1">
                <IconButton label={`Mover bloco ${idx + 1} para cima`} disabled={idx === 0} onClick={() => move(idx, -1)}>↑</IconButton>
                <IconButton label={`Mover bloco ${idx + 1} para baixo`} disabled={idx === blocks.length - 1} onClick={() => move(idx, 1)}>↓</IconButton>
                <IconButton label={`Duplicar bloco ${idx + 1}`} onClick={() => {
                  const copy = { ...structuredClone(block), id: newBlockId() } as Block;
                  onChange([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)]);
                }}>⧉</IconButton>
                <IconButton label={`Remover bloco ${idx + 1}`} onClick={() => {
                  if (window.confirm(`Remover o bloco "${BLOCK_META[block.type].label}"?`)) onChange(blocks.filter((_, i) => i !== idx));
                }}>✕</IconButton>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4">
              {props.issues[`blocks.${idx}`] ? <p className="text-sm text-danger">{props.issues[`blocks.${idx}`]}</p> : null}
              <BlockFields
                block={block}
                onChange={(b) => update(idx, b)}
                refOptions={props.refOptions}
                mediaOptions={props.mediaOptions}
                issue={(field) => props.issues[`blocks.${idx}.${field}`]}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-card)] border border-dashed border-line p-4">
        <div className="min-w-56 flex-1">
          <Select
            label="Adicionar bloco"
            value={toAdd}
            options={props.allowed.map((t) => ({ value: t, label: BLOCK_META[t].label }))}
            onChange={(v) => setToAdd(v)}
            hint={toAdd ? BLOCK_META[toAdd].help : undefined}
          />
        </div>
        <button
          type="button"
          disabled={!toAdd}
          onClick={() => toAdd && onChange([...blocks, emptyBlock(toAdd)])}
          className="min-h-11 rounded-[var(--radius-control)] border border-brand-700 px-4 font-semibold text-brand-800 hover:bg-brand-50"
        >
          Adicionar
        </button>
      </div>
    </section>
  );
}

function IconButton(props: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="min-h-11 min-w-11 rounded-[var(--radius-control)] text-brand-800 hover:bg-brand-50 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

function CtaEditor(props: { label: string; value: CtaAction | undefined; onChange: (v: CtaAction | undefined) => void; optional?: boolean; issue?: string }) {
  const v = props.value;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{props.label}</legend>
      <Select
        label="Ação"
        value={v?.kind}
        emptyLabel={props.optional ? "Sem botão" : undefined}
        options={[
          { value: "evaluation", label: "Agendar avaliação (formulário)" },
          { value: "whatsapp", label: "WhatsApp (número das configurações)" },
          { value: "link", label: "Link" },
        ]}
        onChange={(kind) => {
          if (!kind) return props.onChange(undefined);
          const label = v?.label ?? (kind === "evaluation" ? "Agendar avaliação" : kind === "whatsapp" ? "Falar no WhatsApp" : "");
          props.onChange(kind === "link" ? { kind, label, href: v?.kind === "link" ? v.href : "" } : { kind, label });
        }}
      />
      {v ? (
        <>
          <TextInput label="Texto do botão" value={v.label} maxLength={40} onChange={(label) => props.onChange({ ...v, label: label ?? "" })} />
          {v.kind === "link" ? (
            <TextInput label="Destino" value={v.href} maxLength={500} hint="https://…, tel:, mailto: ou caminho do site (/contato)."
              onChange={(href) => props.onChange({ ...v, href: href ?? "" })} />
          ) : null}
        </>
      ) : null}
      {props.issue ? <p className="text-sm text-danger">{props.issue}</p> : null}
    </fieldset>
  );
}

function ItemsEditor(props: { items: { title: string; text?: string }[]; onChange: (items: { title: string; text?: string }[]) => void; issue?: string }) {
  const groupId = useId();
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={props.issue ? `${groupId}-erro` : undefined}>
      <legend className="text-sm font-semibold">Itens</legend>
      {props.items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <TextInput label={`Item ${i + 1}: título`} value={item.title} maxLength={80}
            onChange={(t) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, title: t ?? "" } : it)))} />
          <TextArea label={`Item ${i + 1}: texto`} value={item.text} maxLength={400} rows={2}
            onChange={(t) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, text: t } : it)))} />
          <button type="button" className="min-h-11 self-start rounded px-2 text-sm text-danger hover:bg-danger-bg"
            onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}>Remover item {i + 1}</button>
        </div>
      ))}
      {props.items.length < 12 ? (
        <button type="button" className="min-h-11 self-start rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50"
          onClick={() => props.onChange([...props.items, { title: "" }])}>Adicionar item</button>
      ) : null}
      {props.issue ? <p id={`${groupId}-erro`} className="text-sm text-danger">{props.issue}</p> : null}
    </fieldset>
  );
}

function BlockFields(props: {
  block: Block;
  onChange: (b: Block) => void;
  refOptions: RefOption[];
  mediaOptions: MediaOption[];
  issue: (field: string) => string | undefined;
}) {
  const { block: b, onChange, issue } = props;
  const heading = "heading" in b || ["rich_text", "features", "steps", "faq_list", "treatment_list", "category_list", "concern_list", "promotion_list", "testimonial_list", "team_list", "gallery", "contact"].includes(b.type);

  return (
    <>
      {b.type === "hero" ? (
        <>
          <TextInput label="Título principal" value={b.heading} maxLength={120} error={issue("heading")} onChange={(v) => onChange({ ...b, heading: v ?? "" })} />
          <TextArea label="Subtítulo" value={b.subheading} maxLength={300} onChange={(v) => onChange({ ...b, subheading: v })} />
          <MediaPicker label="Imagem" value={b.mediaId} options={props.mediaOptions} onChange={(v) => onChange({ ...b, mediaId: v })} />
          <CtaEditor label="Botão principal" optional value={b.primary} onChange={(v) => onChange({ ...b, primary: v })} issue={issue("primary.href") ?? issue("primary.label")} />
          <CtaEditor label="Botão secundário" optional value={b.secondary} onChange={(v) => onChange({ ...b, secondary: v })} issue={issue("secondary.href") ?? issue("secondary.label")} />
        </>
      ) : null}

      {b.type !== "hero" && b.type !== "image" && b.type !== "cta" && b.type !== "notice" && heading ? (
        <TextInput label="Título da seção (opcional)" value={"heading" in b ? (b.heading as string | undefined) : undefined} maxLength={120}
          onChange={(v) => onChange({ ...b, heading: v } as Block)} />
      ) : null}

      {b.type === "rich_text" ? (
        <RichTextArea label="Texto" value={b.body} error={issue("body")} onChange={(body) => onChange({ ...b, body })} />
      ) : null}

      {b.type === "image" ? (
        <>
          <MediaPicker label="Imagem" value={b.mediaId || undefined} options={props.mediaOptions} error={issue("mediaId")} onChange={(v) => onChange({ ...b, mediaId: v ?? "" })} />
          <TextInput label="Legenda (opcional)" value={b.caption} maxLength={200} onChange={(v) => onChange({ ...b, caption: v })} />
        </>
      ) : null}

      {b.type === "cta" ? (
        <>
          <TextInput label="Título" value={b.heading} maxLength={120} error={issue("heading")} onChange={(v) => onChange({ ...b, heading: v ?? "" })} />
          <TextArea label="Texto (opcional)" value={b.text} maxLength={300} onChange={(v) => onChange({ ...b, text: v })} />
          <CtaEditor label="Botão" value={b.action} onChange={(v) => v && onChange({ ...b, action: v })} issue={issue("action.href") ?? issue("action.label")} />
        </>
      ) : null}

      {b.type === "features" || b.type === "steps" ? (
        <ItemsEditor items={b.items} issue={issue("items")} onChange={(items) => onChange({ ...b, items })} />
      ) : null}

      {b.type === "notice" ? (
        <>
          <Select label="Tipo" value={b.tone} options={[{ value: "important", label: "Importante" }, { value: "info", label: "Informativo" }]}
            onChange={(v) => v && onChange({ ...b, tone: v })} />
          <TextArea label="Texto do aviso" value={b.text} maxLength={500} error={issue("text")} onChange={(v) => onChange({ ...b, text: v ?? "" })} />
        </>
      ) : null}

      {b.type === "faq_list" ? (
        <EntryMultiPicker label="Perguntas" types={["faq"]} options={props.refOptions} value={b.entryIds} error={issue("entryIds")} onChange={(entryIds) => onChange({ ...b, entryIds })} />
      ) : null}
      {b.type === "treatment_list" ? (
        <EntryMultiPicker label="Tratamentos" types={["treatment"]} options={props.refOptions} value={b.entryIds} error={issue("entryIds")} onChange={(entryIds) => onChange({ ...b, entryIds })} />
      ) : null}
      {b.type === "testimonial_list" ? (
        <EntryMultiPicker label="Depoimentos" types={["testimonial"]} options={props.refOptions} value={b.entryIds} error={issue("entryIds")}
          hint="Só depoimentos reais, com autorização registrada." onChange={(entryIds) => onChange({ ...b, entryIds })} />
      ) : null}
      {b.type === "team_list" ? (
        <EntryMultiPicker label="Profissionais" types={["team_member"]} options={props.refOptions} value={b.entryIds} error={issue("entryIds")} onChange={(entryIds) => onChange({ ...b, entryIds })} />
      ) : null}

      {b.type === "concern_list" ? (
        <Select label="Área" value={b.area} emptyLabel="Todas" options={[{ value: "facial", label: "Facial" }, { value: "corporal", label: "Corporal" }]}
          onChange={(area) => onChange({ ...b, area })} />
      ) : null}

      {b.type === "promotion_list" ? (
        <Select label="Quantidade máxima" value={String(b.limit)} options={[3, 6, 9, 12].map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(v) => onChange({ ...b, limit: Number(v ?? 6) })} />
      ) : null}

      {b.type === "gallery" ? (
        <MediaMultiPicker label="Imagens" value={b.mediaIds} options={props.mediaOptions} error={issue("mediaIds")} onChange={(mediaIds) => onChange({ ...b, mediaIds })} />
      ) : null}

      {b.type === "contact" ? (
        <>
          <Checkbox label="Mostrar mapa" hint="O mapa só carrega com consentimento do visitante." checked={b.showMap} onChange={(showMap) => onChange({ ...b, showMap })} />
          <Checkbox label="Mostrar formulário de contato" checked={b.showForm} onChange={(showForm) => onChange({ ...b, showForm })} />
        </>
      ) : null}

      {b.type === "category_list" ? <p className="text-sm text-muted">Mostra as categorias publicadas, na ordem definida em Categorias e objetivos.</p> : null}
    </>
  );
}
