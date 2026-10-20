"use client";

import { useId, useState } from "react";
import { BLOCK_META, FEATURE_ICON_KEYS, FEATURE_ICON_LABELS, newBlockId, type Block, type BlockType, type CtaAction, type FeatureIcon } from "@/lib/cms/blocks";
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
import { confirmDialog } from "@/components/admin/dialog";
import { StyleEditor } from "./style-editor";
import { FLOW_ICONS, FLOW_ICON_NAMES, FlowIcon } from "@/components/blocks/flow-icons";

type Issues = Record<string, string>;

/** Bloco recém-adicionado: campos vazios, validados no salvamento. */
function emptyBlock(type: BlockType, independentLinks = false): Block {
  const id = newBlockId();
  const action: CtaAction = independentLinks
    ? { kind: "link", label: "Botão", href: "/" }
    : { kind: "evaluation", label: "Agendar avaliação" };
  switch (type) {
    case "hero":
      return { id, type, heading: "", primary: action };
    case "banner_carousel":
      return { id, type, slides: [{ key: newBlockId(), mediaId: "" }], autoplay: true, intervalSeconds: 6 };
    case "rich_text":
      return { id, type, body: [] };
    case "image":
      return { id, type, mediaId: "" };
    case "cta":
      return { id, type, heading: "", action };
    case "features":
      return { id, type, items: [{ title: "" }] };
    case "steps":
      return { id, type, showLabel: true, items: [{ title: "" }] };
    case "steps_carousel":
      return { id, type, showLabel: true, items: [{ key: newBlockId(), title: "" }], autoplay: true, intervalSeconds: 5 };
    case "care_flow":
      return {
        id,
        type,
        eyebrow: "Cuidado em cada etapa",
        heading: "Como funciona o atendimento",
        showLabel: true,
        items: [
          { key: newBlockId(), icon: "calendario-relogio", title: "Agende sua avaliação", text: "Escolha o melhor dia e horário pelo nosso canal de atendimento." },
          { key: newBlockId(), icon: "pessoa-conversa", title: "Avaliação individual", text: "Conversamos sobre seus objetivos, histórico de saúde e expectativas." },
          { key: newBlockId(), icon: "documento-mais", title: "Plano de tratamento", text: "Você recebe as opções indicadas, o número estimado de sessões e os cuidados." },
          { key: newBlockId(), icon: "maos-coracao", title: "Acompanhamento", text: "Seguimos com você em cada etapa, com retornos e ajustes quando necessário." },
        ],
      };
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
      return { id, type, mediaIds: [], layout: "grid", autoplay: true, intervalSeconds: 5 };
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
  independentLinks?: boolean;
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
                  void confirmDialog(`Remover o bloco "${BLOCK_META[block.type].label}"?`, { confirmLabel: "Remover", danger: true }).then(
                    (yes) => yes && onChange(blocks.filter((_, i) => i !== idx)),
                  );
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
                independentLinks={props.independentLinks}
              />
              <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold">Imagem de fundo do bloco</legend>
                <MediaPicker label="Imagem (opcional)" value={block.backdrop?.mediaId} options={props.mediaOptions}
                  onChange={(mediaId) => update(idx, { ...block, backdrop: mediaId ? { mediaId, position: block.backdrop?.position ?? "center", overlay: block.backdrop?.overlay ?? 35, minHeight: block.backdrop?.minHeight } : undefined } as Block)} />
                {block.backdrop ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Select label="Posição" value={block.backdrop.position}
                      options={["center", "top", "bottom", "left", "right"].map((value) => ({ value, label: { center: "Centro", top: "Topo", bottom: "Base", left: "Esquerda", right: "Direita" }[value]! }))}
                      onChange={(position) => position && update(idx, { ...block, backdrop: { ...block.backdrop!, position } } as Block)} />
                    <TextInput label="Escurecimento (%)" value={String(block.backdrop.overlay)} maxLength={2}
                      hint="0 a 90" onChange={(value) => update(idx, { ...block, backdrop: { ...block.backdrop!, overlay: Math.min(90, Math.max(0, Number(value) || 0)) } } as Block)} />
                    <TextInput label="Altura mínima (px)" value={block.backdrop.minHeight ? String(block.backdrop.minHeight) : undefined} maxLength={4}
                      hint="Opcional, até 1200" onChange={(value) => update(idx, { ...block, backdrop: { ...block.backdrop!, minHeight: value ? Math.min(1200, Math.max(0, Number(value) || 0)) : undefined } } as Block)} />
                  </div>
                ) : null}
              </fieldset>
              <StyleEditor value={block.style} onChange={(style) => update(idx, { ...block, style } as Block)} />
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
          onClick={() => toAdd && onChange([...blocks, emptyBlock(toAdd, props.independentLinks)])}
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

function CtaEditor(props: { label: string; value: CtaAction | undefined; onChange: (v: CtaAction | undefined) => void; optional?: boolean; issue?: string; independentLinks?: boolean }) {
  const v = props.value;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{props.label}</legend>
      <Select
        label="Ação"
        value={v?.kind}
        emptyLabel={props.optional ? "Sem botão" : undefined}
        options={props.independentLinks ? [
          { value: "link", label: "Link próprio desta página" },
        ] : [
          { value: "evaluation", label: "Agendar avaliação (destino definido em Configurações públicas)" },
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

/** Etiqueta das etapas: liga/desliga e troca a palavra ("Etapa" → "Passo"…). */
function StepLabelFields(props: { showLabel?: boolean; labelPrefix?: string; onChange: (v: { showLabel: boolean; labelPrefix?: string }) => void }) {
  const show = props.showLabel !== false;
  return (
    <div className="grid gap-4 rounded-lg border border-line p-3 sm:grid-cols-2">
      <Checkbox label="Mostrar etiqueta nas etapas" checked={show}
        hint="Ex.: “Etapa 01”. Desmarque para não mostrar nada."
        onChange={(showLabel) => props.onChange({ showLabel, labelPrefix: props.labelPrefix })} />
      {show ? (
        <TextInput label="Palavra da etiqueta" value={props.labelPrefix} maxLength={30}
          hint="O número entra depois. Vazio = “Etapa”. Ex.: “Passo” → “Passo 01”."
          onChange={(labelPrefix) => props.onChange({ showLabel: true, labelPrefix })} />
      ) : null}
    </div>
  );
}

type ListItem = { title: string; text?: string; label?: string; icon?: FeatureIcon; iconMediaId?: string };

function ItemsEditor(props: { items: ListItem[]; onChange: (items: ListItem[]) => void; issue?: string; withLabel?: boolean; withIcon?: boolean; mediaOptions?: MediaOption[] }) {
  const groupId = useId();
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={props.issue ? `${groupId}-erro` : undefined}>
      <legend className="text-sm font-semibold">Itens</legend>
      {props.items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          {props.withLabel ? (
            <TextInput label={`Item ${i + 1}: etiqueta própria (opcional)`} value={item.label} maxLength={40}
              hint="Substitui a etiqueta automática só neste item."
              onChange={(label) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, label } : it)))} />
          ) : null}
          {props.withIcon ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label={`Item ${i + 1}: ícone pronto`} value={item.icon ?? "care"}
                options={FEATURE_ICON_KEYS.map((icon) => ({ value: icon, label: FEATURE_ICON_LABELS[icon] }))}
                onChange={(icon) => icon && props.onChange(props.items.map((it, j) => (j === i ? { ...it, icon } : it)))} />
              <MediaPicker label={`Item ${i + 1}: ícone personalizado`} value={item.iconMediaId} options={props.mediaOptions ?? []}
                hint="Opcional. Envie seu PNG ou WebP em Mídia; ele substitui o ícone pronto."
                onChange={(iconMediaId) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, iconMediaId } : it)))} />
            </div>
          ) : null}
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
  independentLinks?: boolean;
}) {
  const { block: b, onChange, issue } = props;
  const heading = "heading" in b || ["rich_text", "features", "steps", "faq_list", "treatment_list", "category_list", "concern_list", "promotion_list", "testimonial_list", "team_list", "gallery", "steps_carousel", "contact"].includes(b.type);

  return (
    <>
      {b.type === "hero" ? (
        <>
          <TextInput label="Título principal" value={b.heading} maxLength={120} error={issue("heading")}
            hint={props.independentLinks ? "Para colorir somente um trecho, use: {#008d68 texto colorido}" : undefined}
            onChange={(v) => onChange({ ...b, heading: v ?? "" })} />
          <TextArea label="Subtítulo" value={b.subheading} maxLength={300} onChange={(v) => onChange({ ...b, subheading: v })} />
          <MediaPicker label="Imagem" value={b.mediaId} options={props.mediaOptions} onChange={(v) => onChange({ ...b, mediaId: v })} />
          {b.mediaId ? (
            <TextInput label="Link ao clicar na imagem" value={b.imageLink} maxLength={500} error={issue("imageLink")}
              hint={"Opcional. https://…, caminho do site (/tratamentos), tel: ou mailto:. Links externos abrem em nova aba."} onChange={(imageLink) => onChange({ ...b, imageLink })} />
          ) : null}
          <CtaEditor independentLinks={props.independentLinks} label="Botão principal" optional value={b.primary} onChange={(v) => onChange({ ...b, primary: v })} issue={issue("primary.href") ?? issue("primary.label")} />
          <CtaEditor independentLinks={props.independentLinks} label="Botão secundário" optional value={b.secondary} onChange={(v) => onChange({ ...b, secondary: v })} issue={issue("secondary.href") ?? issue("secondary.label")} />
        </>
      ) : null}

      {b.type !== "hero" && b.type !== "banner_carousel" && b.type !== "image" && b.type !== "cta" && b.type !== "notice" && b.type !== "care_flow" && heading ? (
        <TextInput label="Título da seção (opcional)" value={"heading" in b ? (b.heading as string | undefined) : undefined} maxLength={120}
          hint={props.independentLinks ? "Para colorir somente um trecho, use: {#008d68 texto colorido}" : undefined}
          onChange={(v) => onChange({ ...b, heading: v } as Block)} />
      ) : null}

      {b.type === "banner_carousel" ? (
        <BannerSlidesEditor block={b} onChange={onChange} mediaOptions={props.mediaOptions} issue={issue} independentLinks={props.independentLinks} />
      ) : null}

      {b.type === "rich_text" ? (
        <RichTextArea label="Texto" value={b.body} error={issue("body")} onChange={(body) => onChange({ ...b, body })} />
      ) : null}

      {b.type === "image" ? (
        <>
          <MediaPicker label="Imagem" value={b.mediaId || undefined} options={props.mediaOptions} error={issue("mediaId")} onChange={(v) => onChange({ ...b, mediaId: v ?? "" })} />
          <TextInput label="Legenda (opcional)" value={b.caption} maxLength={200} onChange={(v) => onChange({ ...b, caption: v })} />
          <TextInput label="Link ao clicar na imagem" value={b.link} maxLength={500} error={issue("link")}
            hint={"Opcional. https://…, caminho do site (/tratamentos), tel: ou mailto:. Links externos abrem em nova aba."} onChange={(link) => onChange({ ...b, link })} />
        </>
      ) : null}

      {b.type === "cta" ? (
        <>
          <TextInput label="Título" value={b.heading} maxLength={120} error={issue("heading")}
            hint={props.independentLinks ? "Para colorir somente um trecho, use: {#008d68 texto colorido}" : undefined}
            onChange={(v) => onChange({ ...b, heading: v ?? "" })} />
          <TextArea label="Texto (opcional)" value={b.text} maxLength={300} onChange={(v) => onChange({ ...b, text: v })} />
          <CtaEditor independentLinks={props.independentLinks} label="Botão" value={b.action} onChange={(v) => v && onChange({ ...b, action: v })} issue={issue("action.href") ?? issue("action.label")} />
        </>
      ) : null}

      {b.type === "care_flow" ? <CareFlowEditor block={b} onChange={onChange} issue={issue} /> : null}

      {b.type === "steps_carousel" ? (
        <StepsCarouselEditor block={b} onChange={onChange} mediaOptions={props.mediaOptions} issue={issue} />
      ) : null}

      {b.type === "features" || b.type === "steps" ? (
        <>
          {b.type === "steps" ? (
            <StepLabelFields showLabel={b.showLabel} labelPrefix={b.labelPrefix} onChange={(v) => onChange({ ...b, ...v })} />
          ) : null}
          <ItemsEditor items={b.items} issue={issue("items")} withLabel={b.type === "steps"} withIcon={b.type === "features"} mediaOptions={props.mediaOptions} onChange={(items) => onChange({ ...b, items } as Block)} />
        </>
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
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Exibição" value={b.layout}
              options={[{ value: "grid", label: "Grade (3 por linha)" }, { value: "carousel", label: "Carrossel (3 por vez)" }]}
              onChange={(v) => onChange({ ...b, layout: v ?? "grid" })} />
            {b.layout === "carousel" ? (
              <>
                <Checkbox label="Passar automaticamente" checked={b.autoplay} hint="Sempre com botão de pausar."
                  onChange={(autoplay) => onChange({ ...b, autoplay })} />
                <Select label="Tempo de cada passagem" value={String(b.intervalSeconds) as "4" | "5" | "6" | "8"}
                  options={["4", "5", "6", "8"].map((v) => ({ value: v, label: `${v} segundos` }))}
                  onChange={(v) => onChange({ ...b, intervalSeconds: Number(v ?? 5) as 4 | 5 | 6 | 8 })} />
              </>
            ) : null}
          </div>
          <MediaMultiPicker label="Imagens" value={b.mediaIds} options={props.mediaOptions} error={issue("mediaIds")}
            onChange={(mediaIds) => onChange({ ...b, mediaIds, links: pickLinks(b.links, mediaIds) })} />
          {b.mediaIds.length ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold">Links das imagens (opcionais)</legend>
              {b.mediaIds.map((id, i) => (
                <TextInput key={id} label={`Imagem ${i + 1}: ${mediaName(props.mediaOptions, id)}`} value={b.links?.[id]} maxLength={500}
                  error={issue(`links.${id}`)} hint={i === 0 ? "Opcional. https://…, caminho do site (/tratamentos), tel: ou mailto:. Links externos abrem em nova aba." : undefined}
                  onChange={(href) => onChange({ ...b, links: pickLinks({ ...b.links, [id]: href ?? "" }, b.mediaIds) })} />
              ))}
            </fieldset>
          ) : null}
        </>
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

/** Mantém só links preenchidos de imagens ainda selecionadas. */
function pickLinks(links: Record<string, string> | undefined, ids: string[]) {
  const kept = Object.fromEntries(Object.entries(links ?? {}).filter(([id, href]) => ids.includes(id) && href.trim()));
  return Object.keys(kept).length ? kept : undefined;
}

function mediaName(options: MediaOption[], id: string) {
  const alt = options.find((m) => m.id === id)?.alt ?? "imagem";
  return alt.length > 50 ? `${alt.slice(0, 50)}…` : alt;
}

type CareFlowBlock = Extract<Block, { type: "care_flow" }>;

function CareFlowEditor(props: { block: CareFlowBlock; onChange: (b: Block) => void; issue: (field: string) => string | undefined }) {
  const { block: b, onChange } = props;
  const setItems = (items: CareFlowBlock["items"]) => onChange({ ...b, items });
  const update = (i: number, patch: Partial<CareFlowBlock["items"][number]>) =>
    setItems(b.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const n = [...b.items];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    setItems(n);
  };
  return (
    <div className="flex flex-col gap-4">
      <TextInput label="Chamada acima do título (opcional)" value={b.eyebrow} maxLength={60}
        hint="Texto pequeno em dourado, ex.: “Cuidado em cada etapa”." onChange={(eyebrow) => onChange({ ...b, eyebrow })} />
      <TextInput label="Título" value={b.heading} maxLength={120} onChange={(heading) => onChange({ ...b, heading })} />
      <StepLabelFields showLabel={b.showLabel} labelPrefix={b.labelPrefix} onChange={(v) => onChange({ ...b, ...v })} />
      {props.issue("items") ? <p className="text-sm text-danger">{props.issue("items")}</p> : null}
      <ol className="flex flex-col gap-3">
        {b.items.map((it, i) => (
          <li key={it.key} className="flex flex-col gap-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Etapa {i + 1}</span>
              <span className="flex gap-1">
                <IconButton label={`Mover etapa ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)}>↑</IconButton>
                <IconButton label={`Mover etapa ${i + 1} para baixo`} disabled={i === b.items.length - 1} onClick={() => move(i, 1)}>↓</IconButton>
                <IconButton label={`Remover etapa ${i + 1}`} disabled={b.items.length <= 2}
                  onClick={() => void confirmDialog(`Remover a etapa ${i + 1}?`, { confirmLabel: "Remover", danger: true }).then((yes) => yes && setItems(b.items.filter((_, j) => j !== i)))}>✕</IconButton>
              </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                <FlowIcon name={it.icon} className="size-6" />
              </span>
              <div className="flex-1">
                <Select label="Ícone" value={it.icon}
                  options={FLOW_ICON_NAMES.map((n) => ({ value: n, label: FLOW_ICONS[n].label }))}
                  onChange={(icon) => icon && update(i, { icon })} />
              </div>
            </div>
            {b.showLabel !== false ? (
              <TextInput label="Etiqueta própria (opcional)" value={it.label} maxLength={40}
                hint={`Substitui “${b.labelPrefix || "Etapa"} ${String(i + 1).padStart(2, "0")}” só nesta etapa.`}
                onChange={(label) => update(i, { label })} />
            ) : null}
            <TextInput label="Título" value={it.title} maxLength={80} error={props.issue(`items.${i}.title`)}
              onChange={(title) => update(i, { title: title ?? "" })} />
            <TextArea label="Descrição (opcional)" value={it.text} maxLength={240} rows={2} onChange={(text) => update(i, { text })} />
          </li>
        ))}
      </ol>
      {b.items.length < 6 ? (
        <button type="button" className="min-h-11 self-start rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50"
          onClick={() => setItems([...b.items, { key: newBlockId(), icon: "brilho", title: "" }])}>
          Adicionar etapa
        </button>
      ) : <p className="text-sm text-muted">Máximo de 6 etapas.</p>}
    </div>
  );
}

type StepsCarouselBlock = Extract<Block, { type: "steps_carousel" }>;

function StepsCarouselEditor(props: {
  block: StepsCarouselBlock;
  onChange: (b: Block) => void;
  mediaOptions: MediaOption[];
  issue: (field: string) => string | undefined;
}) {
  const { block: b, onChange } = props;
  const setItems = (items: StepsCarouselBlock["items"]) => onChange({ ...b, items });
  const update = (i: number, patch: Partial<StepsCarouselBlock["items"][number]>) =>
    setItems(b.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const n = [...b.items];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    setItems(n);
  };
  return (
    <div className="flex flex-col gap-4">
      <StepLabelFields showLabel={b.showLabel} labelPrefix={b.labelPrefix} onChange={(v) => onChange({ ...b, ...v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Checkbox label="Passar automaticamente" checked={b.autoplay}
          hint="Sempre com botão de pausar; não passa sozinho para quem pede menos movimento."
          onChange={(autoplay) => onChange({ ...b, autoplay })} />
        <Select label="Tempo de cada passagem" value={String(b.intervalSeconds) as "4" | "5" | "6" | "8"}
          options={["4", "5", "6", "8"].map((v) => ({ value: v, label: `${v} segundos` }))}
          onChange={(v) => onChange({ ...b, intervalSeconds: Number(v ?? 5) as 4 | 5 | 6 | 8 })} />
      </div>
      {props.issue("items") ? <p className="text-sm text-danger">{props.issue("items")}</p> : null}
      <ol className="flex flex-col gap-3">
        {b.items.map((it, i) => (
          <li key={it.key} className="flex flex-col gap-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Etapa {i + 1}</span>
              <span className="flex gap-1">
                <IconButton label={`Mover etapa ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)}>↑</IconButton>
                <IconButton label={`Mover etapa ${i + 1} para baixo`} disabled={i === b.items.length - 1} onClick={() => move(i, 1)}>↓</IconButton>
                <IconButton label={`Remover etapa ${i + 1}`} disabled={b.items.length === 1}
                  onClick={() => void confirmDialog(`Remover a etapa ${i + 1}?`, { confirmLabel: "Remover", danger: true }).then((yes) => yes && setItems(b.items.filter((_, j) => j !== i)))}>✕</IconButton>
              </span>
            </div>
            <MediaPicker label="Imagem (opcional)" value={it.mediaId} options={props.mediaOptions}
              hint="Formato paisagem funciona melhor (ex.: 1200×800)." onChange={(mediaId) => update(i, { mediaId })} />
            {b.showLabel !== false ? (
              <TextInput label="Etiqueta própria (opcional)" value={it.label} maxLength={40}
                hint={`Substitui “${b.labelPrefix || "Etapa"} ${String(i + 1).padStart(2, "0")}” só nesta etapa.`}
                onChange={(label) => update(i, { label })} />
            ) : null}
            <TextInput label="Título" value={it.title} maxLength={80} error={props.issue(`items.${i}.title`)}
              onChange={(title) => update(i, { title: title ?? "" })} />
            <TextArea label="Texto (opcional)" value={it.text} maxLength={400} rows={2} onChange={(text) => update(i, { text })} />
          </li>
        ))}
      </ol>
      {b.items.length < 12 ? (
        <button type="button" className="min-h-11 self-start rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50"
          onClick={() => setItems([...b.items, { key: newBlockId(), title: "" }])}>
          Adicionar etapa
        </button>
      ) : <p className="text-sm text-muted">Máximo de 12 etapas.</p>}
    </div>
  );
}

type CarouselBlock = Extract<Block, { type: "banner_carousel" }>;

function BannerSlidesEditor(props: {
  block: CarouselBlock;
  onChange: (b: Block) => void;
  mediaOptions: MediaOption[];
  issue: (field: string) => string | undefined;
  independentLinks?: boolean;
}) {
  const { block: b, onChange } = props;
  const setSlides = (slides: CarouselBlock["slides"]) => onChange({ ...b, slides });
  const update = (i: number, patch: Partial<CarouselBlock["slides"][number]>) =>
    setSlides(b.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const n = [...b.slides];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    setSlides(n);
  };

  return (
    <div className="flex flex-col gap-4">
      <TextInput label="Nome do carrossel (para leitores de tela)" value={b.label} maxLength={80}
        hint="Ex.: “Destaques da clínica”. Não aparece na tela." onChange={(label) => onChange({ ...b, label })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Checkbox label="Passar automaticamente" checked={b.autoplay}
          hint="Sempre com botão de pausa; não passa sozinho para quem pede menos movimento."
          onChange={(autoplay) => onChange({ ...b, autoplay })} />
        <Select label="Tempo de cada banner" value={String(b.intervalSeconds) as "5" | "6" | "8" | "10"}
          options={[{ value: "5", label: "5 segundos" }, { value: "6", label: "6 segundos" }, { value: "8", label: "8 segundos" }, { value: "10", label: "10 segundos" }]}
          onChange={(v) => onChange({ ...b, intervalSeconds: Number(v ?? 6) as 5 | 6 | 8 | 10 })} />
      </div>
      {props.issue("slides") ? <p className="text-sm text-danger">{props.issue("slides")}</p> : null}

      <ol className="flex flex-col gap-3">
        {b.slides.map((slide, i) => (
          <li key={slide.key} className="flex flex-col gap-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Banner {i + 1}</span>
              <span className="flex gap-1">
                <IconButton label={`Mover banner ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)}>↑</IconButton>
                <IconButton label={`Mover banner ${i + 1} para baixo`} disabled={i === b.slides.length - 1} onClick={() => move(i, 1)}>↓</IconButton>
                <IconButton label={`Remover banner ${i + 1}`} disabled={b.slides.length === 1}
                  onClick={() => void confirmDialog(`Remover o banner ${i + 1}?`, { confirmLabel: "Remover", danger: true }).then((yes) => yes && setSlides(b.slides.filter((_, j) => j !== i)))}>✕</IconButton>
              </span>
            </div>
            <MediaPicker label="Imagem (computador)" value={slide.mediaId || undefined} options={props.mediaOptions}
              error={props.issue(`slides.${i}.mediaId`)}
              hint="Formato largo, ex.: 1920×700. O texto alternativo vem da Mídia."
              onChange={(v) => update(i, { mediaId: v ?? "" })} />
            <MediaPicker label="Imagem para celular (opcional)" value={slide.mobile?.mediaId} options={props.mediaOptions}
              hint="Formato mais alto, ex.: 800×1000. Sem ela, usa a do computador."
              onChange={(v) => update(i, { mobile: v ? { mediaId: v } : undefined })} />
            <TextInput label="Título (opcional)" value={slide.title} maxLength={120} onChange={(title) => update(i, { title })} />
            <TextArea label="Texto (opcional)" value={slide.text} maxLength={240} rows={2} onChange={(text) => update(i, { text })} />
            <CtaEditor independentLinks={props.independentLinks} label="Botão (opcional)" optional value={slide.action}
              issue={props.issue(`slides.${i}.action.href`) ?? props.issue(`slides.${i}.action.label`)}
              onChange={(action) => update(i, { action })} />
            <TextInput label="Link ao clicar no banner" value={slide.link} maxLength={500} error={props.issue(`slides.${i}.link`)}
              hint={"Opcional. https://…, caminho do site (/tratamentos), tel: ou mailto:. Links externos abrem em nova aba."} onChange={(link) => update(i, { link })} />
          </li>
        ))}
      </ol>
      {b.slides.length < 8 ? (
        <button type="button" className="min-h-11 self-start rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50"
          onClick={() => setSlides([...b.slides, { key: newBlockId(), mediaId: "" }])}>
          Adicionar banner
        </button>
      ) : <p className="text-sm text-muted">Máximo de 8 banners.</p>}
    </div>
  );
}
