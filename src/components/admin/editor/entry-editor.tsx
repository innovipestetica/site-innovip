"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, buttonPrimary, buttonSecondary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { StatusBadge } from "@/components/admin/ui";
import {
  CONTENT_TYPES,
  publicPath,
  type ContentType,
  type LifecycleStatus,
  type VersionPayload,
} from "@/lib/cms/content-types";
import type { Block } from "@/lib/cms/blocks";
import {
  archiveAction,
  changeSlugAction,
  checkPublishAction,
  duplicateAction,
  publishAction,
  saveVersionAction,
  unarchiveAction,
  unpublishAction,
} from "@/app/admin/(painel)/conteudo/actions";
import { BlocksEditor } from "./blocks-editor";
import {
  Checkbox,
  DateTimeInput,
  EntryMultiPicker,
  MediaPicker,
  MoneyInput,
  TextArea,
  TextInput,
  type MediaOption,
  type RefOption,
} from "./fields";
import { confirmDialog, promptDialog } from "@/components/admin/dialog";
import { ColorField } from "./style-editor";

export type Taxonomy = { id: string; name: string; status: string };

export type EditorProps = {
  entry: {
    id: string;
    type: ContentType;
    slug: string;
    lifecycleStatus: LifecycleStatus;
    latestRevision: number;
    latestVersionId: string;
    publishedRevision: number | null;
    schemaMismatch: boolean;
  };
  initialPayload: VersionPayload;
  refOptions: RefOption[];
  mediaOptions: MediaOption[];
  categories: Taxonomy[];
  concerns: Taxonomy[];
};

type Message = { tone: "error" | "success" | "info"; text: string; list?: string[] };

export function EntryEditor(props: EditorProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { entry } = props;
  const meta = CONTENT_TYPES[entry.type];

  const [payload, setPayload] = useState<VersionPayload>(props.initialPayload);
  const [saved, setSaved] = useState(() => JSON.stringify(props.initialPayload));
  const [revision, setRevision] = useState(entry.latestRevision);
  const [versionId, setVersionId] = useState(entry.latestVersionId);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [slugValue, setSlugValue] = useState(entry.slug);

  const dirty = useMemo(() => JSON.stringify(payload) !== saved, [payload, saved]);
  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof VersionPayload>(key: K, value: VersionPayload[K]) =>
    setPayload((p) => ({ ...p, [key]: value }));
  const setData = (key: string, value: unknown) =>
    setPayload((p) => ({ ...p, data: { ...p.data, [key]: value === "" ? undefined : value } }));
  const setDetail = (key: string, value: unknown) =>
    setPayload((p) => ({ ...p, details: { ...p.details, [key]: value === "" ? undefined : value } }));
  const d = payload.data as Record<string, string | undefined>;
  const det = payload.details as Record<string, unknown>;

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    setMessage(null);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    await run("save", async () => {
      const res = await saveVersionAction({ entryId: entry.id, type: entry.type, baseRevision: revision, payload });
      if (!res.ok) {
        setIssues(Object.fromEntries((res.issues ?? []).map((i) => [i.path, i.message])));
        if (res.kind === "conflict") setConflict(true);
        setMessage({ tone: "error", text: res.message, list: res.issues?.slice(0, 8).map((i) => i.message) });
        return;
      }
      setIssues({});
      setRevision(res.data.revision);
      setVersionId(res.data.versionId);
      setSaved(JSON.stringify(payload));
      setMessage({ tone: "success", text: `Salvo como revisão ${res.data.revision}. O site só muda quando você publicar.` });
      router.refresh();
    });
  }

  async function onPublish() {
    await run("publish", async () => {
      const check = await checkPublishAction(versionId);
      if (!check.ok) return setMessage({ tone: "error", text: check.message });
      if (check.data.problems.length) {
        return setMessage({ tone: "error", text: "Ainda não dá para publicar:", list: check.data.problems });
      }
      if (!(await confirmDialog(`Publicar a revisão ${revision}? Ela substituirá a versão no ar em até 1 minuto.`, { confirmLabel: "Publicar" }))) return;
      const res = await publishAction(entry.id, versionId);
      if (!res.ok) return setMessage({ tone: "error", text: res.message, list: res.problems });
      setMessage({ tone: "success", text: `Revisão ${revision} publicada.` });
      router.refresh();
    });
  }

  async function lifecycle(kind: "unpublish" | "archive" | "unarchive") {
    const confirmText = {
      unpublish: "Despublicar? O conteúdo sai do site (as versões ficam guardadas).",
      archive: "Arquivar? O conteúdo sai do site e da lista principal.",
      unarchive: "Tirar do arquivo? Ele volta como despublicado/rascunho.",
    }[kind];
    if (!(await confirmDialog(confirmText, { confirmLabel: { unpublish: "Despublicar", archive: "Arquivar", unarchive: "Tirar do arquivo" }[kind], danger: kind !== "unarchive" }))) return;
    await run(kind, async () => {
      const fn = { unpublish: unpublishAction, archive: archiveAction, unarchive: unarchiveAction }[kind];
      const res = await fn(entry.id);
      if (!res.ok) return setMessage({ tone: "error", text: res.message });
      setMessage({ tone: "success", text: "Feito." });
      router.refresh();
    });
  }

  async function onDuplicate() {
    const slug = await promptDialog("Endereço (slug) da cópia:", `${entry.slug}-copia`, "Endereço (slug)");
    if (!slug) return;
    await run("duplicate", async () => {
      const res = await duplicateAction(entry.id, slug);
      if (!res.ok) return setMessage({ tone: "error", text: res.message });
      router.push(`/admin/conteudo/${meta.segment}/${res.data.id}`);
    });
  }

  async function onChangeSlug() {
    const slug = await promptDialog(
      "Novo endereço (slug). Se já foi publicado, o endereço antigo redirecionará (301) para o novo.",
      entry.slug,
      "Endereço (slug)",
    );
    if (!slug || slug === entry.slug) return;
    await run("slug", async () => {
      const res = await changeSlugAction(entry.id, slug);
      if (!res.ok) return setMessage({ tone: "error", text: res.message });
      setMessage({ tone: "success", text: "Endereço alterado." });
      router.refresh();
    });
  }

  async function onApplySlug() {
    const slug = slugValue.trim();
    if (!slug || slug === entry.slug) return;
    await run("slug", async () => {
      const res = await changeSlugAction(entry.id, slug);
      if (!res.ok) return setMessage({ tone: "error", text: res.message });
      setMessage({ tone: "success", text: "Endereço alterado. O endereço antigo redirecionará para o novo." });
      router.refresh();
    });
  }

  const path = entry.type === "landing" && entry.slug === "black"
    ? "/black"
    : publicPath(entry.type, entry.slug);
  const disabled = !hydrated || busy !== null;
  const isArchived = entry.lifecycleStatus === "archived";
  const unpublishedChanges = entry.publishedRevision !== null && entry.publishedRevision !== revision;

  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonPrimary} disabled={disabled || !dirty || isArchived || conflict} onClick={onSave}>
        {busy === "save" ? "Salvando…" : "Salvar"}
      </button>
      {!isArchived ? (
        <button type="button" className={buttonSecondary} disabled={disabled || dirty || conflict} onClick={onPublish}
          title={dirty ? "Salve antes de publicar" : undefined}>
          {busy === "publish" ? "Publicando…" : `Publicar revisão ${revision}`}
        </button>
      ) : null}
      <Link href={`/admin/previa/${versionId}`} target="_blank" rel="noopener" className={buttonSecondary} aria-disabled={dirty}>
        Prévia{dirty ? " (última salva)" : ""}
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={entry.lifecycleStatus} />
          <span className="text-muted">
            Revisão {revision}
            {entry.publishedRevision !== null ? ` · no ar: revisão ${entry.publishedRevision}` : " · nunca publicado"}
          </span>
          {unpublishedChanges ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700">há revisão não publicada</span> : null}
          {dirty ? <span role="status" className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-danger">alterações não salvas</span> : null}
        </div>
        {actionBar}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4" href={`/admin/conteudo/${meta.segment}/${entry.id}/historico`}>Histórico</Link>
          {entry.type !== "home" ? (
            <>
              <button type="button" disabled={disabled || dirty} onClick={onDuplicate} className="min-h-11 font-semibold text-brand-800 underline underline-offset-4">Duplicar</button>
              <button type="button" disabled={disabled || dirty} onClick={onChangeSlug} className="min-h-11 font-semibold text-brand-800 underline underline-offset-4">Alterar endereço</button>
            </>
          ) : null}
          {entry.lifecycleStatus === "published" ? (
            <button type="button" disabled={disabled || dirty} onClick={() => lifecycle("unpublish")} className="min-h-11 font-semibold text-danger underline underline-offset-4">Despublicar</button>
          ) : null}
          {entry.type !== "home" && !isArchived ? (
            <button type="button" disabled={disabled || dirty} onClick={() => lifecycle("archive")} className="min-h-11 font-semibold text-danger underline underline-offset-4">Arquivar</button>
          ) : null}
          {isArchived ? (
            <button type="button" disabled={disabled || dirty} onClick={() => lifecycle("unarchive")} className="min-h-11 font-semibold text-brand-800 underline underline-offset-4">Tirar do arquivo</button>
          ) : null}
          {path && entry.lifecycleStatus === "published" ? (
            <a className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4" href={path} target="_blank" rel="noopener">Ver no site</a>
          ) : null}
        </div>
        {message ? (
          <Alert tone={message.tone}>
            <p>{message.text}</p>
            {message.list?.length ? <ul className="mt-1 list-disc pl-5">{message.list.map((t) => <li key={t}>{t}</li>)}</ul> : null}
            {conflict ? (
              <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => window.location.reload()}>
                Recarregar a versão mais nova (descarta o que não foi salvo)
              </button>
            ) : null}
          </Alert>
        ) : null}
        {entry.schemaMismatch ? (
          <Alert tone="info">Este conteúdo foi salvo num formato de blocos antigo. Revise os blocos antes de salvar.</Alert>
        ) : null}
        {isArchived ? <Alert tone="info">Conteúdo arquivado: tire do arquivo para editar ou publicar.</Alert> : null}
      </div>

      <fieldset disabled={isArchived} className="flex flex-col gap-6">
        <section aria-labelledby="dados-gerais" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
          <h2 id="dados-gerais" className="text-lg font-semibold text-brand-800">Dados gerais</h2>
          <TextInput
            label={entry.type === "faq" ? "Pergunta" : entry.type === "team_member" ? "Nome" : entry.type === "testimonial" ? "Identificação interna" : "Título"}
            value={payload.title} maxLength={200} required error={issues.title}
            onChange={(v) => set("title", v ?? "")}
          />
          {entry.type !== "faq" && entry.type !== "testimonial" ? (
            <TextArea label="Resumo" value={payload.summary} maxLength={500} error={issues.summary}
              hint="Usado em listagens e como descrição padrão." onChange={(v) => set("summary", v)} />
          ) : null}
          {entry.type !== "home" ? (
            <p className="text-sm text-muted">
              Endereço: <code className="rounded bg-brand-50 px-1">{path ?? entry.slug}</code>
            </p>
          ) : null}
          {entry.type === "landing" ? (
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <TextInput label="Slug da página" value={slugValue} maxLength={120}
                hint="Use letras minúsculas, números e hífens. Ex.: black-friday"
                onChange={(value) => setSlugValue(value ?? "")} />
              <button type="button" className={buttonSecondary}
                disabled={disabled || dirty || !slugValue.trim() || slugValue.trim() === entry.slug}
                onClick={onApplySlug}>
                {busy === "slug" ? "Alterando…" : "Alterar endereço"}
              </button>
            </div>
          ) : null}
        </section>

        <TypeFields
          type={entry.type}
          d={d}
          det={det}
          setData={setData}
          setDetail={setDetail}
          payload={payload}
          setPayload={setPayload}
          issues={issues}
          refOptions={props.refOptions}
          mediaOptions={props.mediaOptions}
          categories={props.categories}
          concerns={props.concerns}
        />

        {meta.usesBlocks ? (
          <BlocksEditor
            blocks={payload.blocks}
            allowed={meta.allowedBlocks}
            onChange={(blocks: Block[]) => set("blocks", blocks)}
            refOptions={props.refOptions}
            mediaOptions={props.mediaOptions}
            issues={issues}
            independentLinks={entry.type === "landing"}
          />
        ) : null}

        {meta.publicPrefix ? (
          <section aria-labelledby="seo" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
            <h2 id="seo" className="text-lg font-semibold text-brand-800">SEO</h2>
            <TextInput label="Título para buscadores" value={payload.seo.title} maxLength={70} error={issues["seo.title"]}
              hint="Até 70 caracteres. Vazio = título do conteúdo." onChange={(v) => set("seo", { ...payload.seo, title: v })} />
            <TextArea label="Descrição para buscadores" value={payload.seo.description} maxLength={170} error={issues["seo.description"]}
              hint="Até 170 caracteres. Vazio = resumo." onChange={(v) => set("seo", { ...payload.seo, description: v })} />
            <MediaPicker label="Imagem de compartilhamento" value={payload.seo.mediaId} options={props.mediaOptions}
              onChange={(v) => set("seo", { ...payload.seo, mediaId: v })} />
            <Checkbox label="Não indexar (noindex)" hint="Recomendado para campanhas temporárias até decisão editorial."
              checked={payload.seo.noindex ?? false} onChange={(v) => set("seo", { ...payload.seo, noindex: v || undefined })} />
          </section>
        ) : null}
      </fieldset>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">{actionBar}</div>
    </div>
  );
}

function TypeFields(props: {
  type: ContentType;
  d: Record<string, string | undefined>;
  det: Record<string, unknown>;
  setData: (k: string, v: unknown) => void;
  setDetail: (k: string, v: unknown) => void;
  payload: VersionPayload;
  setPayload: React.Dispatch<React.SetStateAction<VersionPayload>>;
  issues: Record<string, string>;
  refOptions: RefOption[];
  mediaOptions: MediaOption[];
  categories: Taxonomy[];
  concerns: Taxonomy[];
}) {
  const { type, d, det, setData, setDetail, issues, payload, setPayload } = props;
  const setRelations = (key: "categories" | "concerns" | "treatments", ids: string[]) =>
    setPayload((p) => ({ ...p, relations: { ...p.relations, [key]: ids } }));

  const cover = (
    <MediaPicker label="Imagem de capa" value={d.mediaId} options={props.mediaOptions} onChange={(v) => setData("mediaId", v)} />
  );

  const wrap = (title: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
      <h2 className="text-lg font-semibold text-brand-800">{title}</h2>
      {children}
    </section>
  );

  switch (type) {
    case "treatment":
      return wrap("Tratamento", (
        <>
          {cover}
          <TaxonomyChecks label="Categorias" items={props.categories} value={payload.relations.categories} onChange={(ids) => setRelations("categories", ids)} />
          <TaxonomyChecks label="Objetivos (o que a pessoa deseja tratar)" items={props.concerns} value={payload.relations.concerns} onChange={(ids) => setRelations("concerns", ids)} />
        </>
      ));
    case "promotion":
      return wrap("Promoção", (
        <>
          {cover}
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeInput label="Início" value={det.starts_at as string | undefined} error={issues["details.starts_at"]} onChange={(v) => setDetail("starts_at", v)} />
            <DateTimeInput label="Fim" value={det.ends_at as string | undefined} error={issues["details.ends_at"]} onChange={(v) => setDetail("ends_at", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput label="Preço promocional (opcional)" cents={det.price_cents as number | undefined} error={issues["details.price_cents"]} onChange={(v) => setDetail("price_cents", v)} />
            <MoneyInput label="Preço original (opcional)" cents={det.original_price_cents as number | undefined} onChange={(v) => setDetail("original_price_cents", v)}
              hint="Só se aprovado pela clínica." />
          </div>
          <TextArea label="Condições completas" rows={5} value={det.terms as string | undefined} maxLength={4000} error={issues["details.terms"]}
            hint="Obrigatórias para publicar. Sem escassez inventada." onChange={(v) => setDetail("terms", v)} />
          <EntryMultiPicker label="Tratamentos relacionados" types={["treatment"]} options={props.refOptions} value={payload.relations.treatments}
            onChange={(ids) => setRelations("treatments", ids)} />
        </>
      ));
    case "landing":
      return wrap("Identidade visual independente", (
        <>
          <p className="text-sm text-muted">Esta página não usa cabeçalho, rodapé, WhatsApp ou configurações públicas do site. Imagens, cores e links pertencem somente a ela.</p>
          <MediaPicker label="Logo própria (opcional)" value={d.logoMediaId} options={props.mediaOptions} onChange={(v) => setData("logoMediaId", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Fundo geral" hint="Cor de fundo da página." value={d.pageBackground} onChange={(v) => setData("pageBackground", v)} />
            <ColorField label="Texto geral" hint="Cor padrão dos textos." value={d.pageText} onChange={(v) => setData("pageText", v)} />
            <ColorField label="Cor de destaque" hint="Linhas, detalhes e destaques." value={d.pageAccent} onChange={(v) => setData("pageAccent", v)} />
            <ColorField label="Fundo dos botões" hint="Cor padrão dos botões." value={d.buttonBackground} onChange={(v) => setData("buttonBackground", v)} />
            <ColorField label="Texto dos botões" hint="Cor do texto dos botões." value={d.buttonText} onChange={(v) => setData("buttonText", v)} />
          </div>
          <div className="mt-2 border-t border-line pt-4">
            <h3 className="mb-4 font-semibold text-ink">Textos complementares da landing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Texto pequeno do topo" value={d.heroEyebrow} maxLength={120} placeholder="Experiências que começam antes" onChange={(v) => setData("heroEyebrow", v)} />
              <TextInput label="Título pequeno dos benefícios" value={d.benefitsLabel} maxLength={100} placeholder="Benefícios da lista" onChange={(v) => setData("benefitsLabel", v)} />
              <TextInput label="Informação 1 abaixo do botão" value={d.trustItem1} maxLength={100} placeholder="Entrada gratuita" onChange={(v) => setData("trustItem1", v)} />
              <TextInput label="Informação 2 abaixo do botão" value={d.trustItem2} maxLength={100} placeholder="Canal oficial" onChange={(v) => setData("trustItem2", v)} />
              <TextInput label="Informação 3 abaixo do botão" value={d.trustItem3} maxLength={100} placeholder="Saia quando quiser" onChange={(v) => setData("trustItem3", v)} />
              <TextInput label="Frase acima de “Veja a evolução”" value={d.storyEyebrow} maxLength={120} placeholder="Uma experiência em outro nível" onChange={(v) => setData("storyEyebrow", v)} />
              <TextInput label="Título pequeno dos passos" value={d.stepsLabel} maxLength={100} placeholder="Como funciona" onChange={(v) => setData("stepsLabel", v)} />
              <TextInput label="Título pequeno do FAQ" value={d.faqLabel} maxLength={100} placeholder="Perguntas frequentes" onChange={(v) => setData("faqLabel", v)} />
              <TextInput label="Texto pequeno da chamada final" value={d.footerEyebrow} maxLength={100} placeholder="Seu próximo passo" onChange={(v) => setData("footerEyebrow", v)} />
              <TextInput label="Observação no final da página" value={d.footerNote} maxLength={200} placeholder="Innovip Clínica de Estética · Atendimento individual e responsável." onChange={(v) => setData("footerNote", v)} />
            </div>
          </div>
        </>
      ));
    case "faq":
      return wrap("Resposta", (
        <TextArea label="Resposta" rows={6} value={d.answer} maxLength={3000} error={issues["data.answer"]} onChange={(v) => setData("answer", v)} />
      ));
    case "team_member":
      return wrap("Profissional", (
        <>
          <TextInput label="Função" value={d.role} maxLength={120} onChange={(v) => setData("role", v)} />
          <TextInput label="Registro profissional (se aplicável)" value={d.registration} maxLength={60}
            hint="Informe exatamente como no conselho. Não invente credenciais." onChange={(v) => setData("registration", v)} />
          <TextArea label="Apresentação" value={d.bio} maxLength={1500} rows={4} onChange={(v) => setData("bio", v)} />
          <MediaPicker label="Foto" value={d.mediaId} options={props.mediaOptions} onChange={(v) => setData("mediaId", v)} />
        </>
      ));
    case "testimonial":
      return wrap("Depoimento", (
        <>
          <TextArea label="Depoimento" value={d.quote} maxLength={1500} rows={4} onChange={(v) => setData("quote", v)} />
          <TextInput label="Como identificar a pessoa no site" value={d.author_display} maxLength={80} hint="Ex.: M. S., 34 anos — conforme autorizado." onChange={(v) => setData("author_display", v)} />
          <TextArea label="Registro da autorização (obrigatório para publicar)" value={d.authorization_note} maxLength={500}
            hint="Ex.: termo assinado em 10/10/2026, arquivado em Mídia > evidências. Não publique depoimentos fictícios."
            onChange={(v) => setData("authorization_note", v)} />
          <MediaPicker label="Foto (somente com autorização de imagem)" value={d.mediaId} options={props.mediaOptions} onChange={(v) => setData("mediaId", v)} />
        </>
      ));
    case "technology":
    case "blog_post":
      return wrap(type === "technology" ? "Tecnologia" : "Post", cover);
    default:
      return null;
  }
}

function TaxonomyChecks(props: { label: string; items: Taxonomy[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{props.label}</legend>
      {props.items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma cadastrada. Crie em <Link className="underline" href="/admin/taxonomias">Categorias e objetivos</Link>.</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {props.items.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-brand-50">
              <input type="checkbox" className="size-5 accent-brand-700" checked={props.value.includes(t.id)}
                onChange={(e) => props.onChange(e.target.checked ? [...props.value, t.id] : props.value.filter((v) => v !== t.id))} />
              <span className="text-sm">
                {t.name}
                {t.status === "archived" ? (
                  <span className="ml-1 text-xs text-gold-700">(arquivada — desmarque para publicar)</span>
                ) : t.status !== "published" ? (
                  <span className="ml-1 text-xs text-gold-700">(não publicada)</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
