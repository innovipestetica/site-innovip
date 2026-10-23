"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, buttonPrimary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { MediaPicker, Select, TextArea, TextInput, type MediaOption } from "@/components/admin/editor/fields";
import { addRedirectAction, deleteRedirectAction, updateRedirectPreviewAction } from "./actions";
import { alertDialog, confirmDialog } from "@/components/admin/dialog";

export function AddRedirectForm({ mediaOptions }: { mediaOptions: MediaOption[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"301" | "302">("301");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewDescription, setPreviewDescription] = useState("");
  const [previewSiteName, setPreviewSiteName] = useState("");
  const [previewMediaId, setPreviewMediaId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    setError(null);
    const res = await addRedirectAction({ source, target, status: Number(status), previewTitle, previewDescription, previewSiteName, previewMediaId });
    setPending(false);
    if (!res.ok) return setError(res.message);
    setSource("");
    setTarget("");
    setPreviewTitle(""); setPreviewDescription(""); setPreviewSiteName(""); setPreviewMediaId(undefined);
    router.refresh();
  }

  return (
    <section aria-labelledby="novo-redirecionamento" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
      <h2 id="novo-redirecionamento" className="text-lg font-semibold text-brand-800">Adicionar manualmente</h2>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
        <TextInput label="De (caminho antigo)" value={source} maxLength={200} placeholder="/pagina-antiga" onChange={(v) => setSource(v ?? "")} />
        <TextInput label="Para (caminho atual)" value={target} maxLength={200} placeholder="/pagina-nova" onChange={(v) => setTarget(v ?? "")} />
        <Select label="Tipo" value={status} options={[{ value: "301", label: "301 (permanente)" }, { value: "302", label: "302 (temporário)" }]}
          onChange={(v) => v && setStatus(v)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Título da prévia (opcional)" value={previewTitle} maxLength={120} placeholder="Entre para o Grupo VIP Innovip" onChange={(v) => setPreviewTitle(v ?? "")} />
        <TextInput label="Nome do site (opcional)" value={previewSiteName} maxLength={80} placeholder="Innovip Estética" onChange={(v) => setPreviewSiteName(v ?? "")} />
        <TextArea label="Descrição da prévia (opcional)" value={previewDescription} maxLength={240} rows={3} onChange={(v) => setPreviewDescription(v ?? "")} />
        <MediaPicker label="Imagem da prévia (opcional)" value={previewMediaId} options={mediaOptions} hint="Recomendado: imagem horizontal de 1200 × 630 px." onChange={setPreviewMediaId} />
      </div>
      <button type="button" className={`${buttonPrimary} self-start`} disabled={!hydrated || pending || !source || !target} onClick={add}>
        {pending ? "Adicionando…" : "Adicionar"}
      </button>
    </section>
  );
}

export function RedirectPreviewForm({ redirect, mediaOptions }: {
  redirect: { id: string; preview_title: string | null; preview_description: string | null; preview_site_name: string | null; preview_media_id: string | null };
  mediaOptions: MediaOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(redirect.preview_title ?? "");
  const [description, setDescription] = useState(redirect.preview_description ?? "");
  const [siteName, setSiteName] = useState(redirect.preview_site_name ?? "");
  const [mediaId, setMediaId] = useState<string | undefined>(redirect.preview_media_id ?? undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <details className="mt-3 rounded-lg border border-line bg-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-800">Editar prévia do compartilhamento</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextInput label="Título" value={title} maxLength={120} onChange={(v) => setTitle(v ?? "")} />
        <TextInput label="Nome do site" value={siteName} maxLength={80} onChange={(v) => setSiteName(v ?? "")} />
        <TextArea label="Descrição" value={description} maxLength={240} rows={3} onChange={(v) => setDescription(v ?? "")} />
        <MediaPicker label="Imagem" value={mediaId} options={mediaOptions} hint="Recomendado: 1200 × 630 px." onChange={setMediaId} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={buttonPrimary} disabled={pending} onClick={async () => {
          setPending(true); setMessage(null);
          const result = await updateRedirectPreviewAction({ id: redirect.id, previewTitle: title, previewDescription: description, previewSiteName: siteName, previewMediaId: mediaId });
          setPending(false); setMessage(result.ok ? "Prévia salva." : result.message); if (result.ok) router.refresh();
        }}>{pending ? "Salvando…" : "Salvar prévia"}</button>
        {message ? <span className="text-sm text-muted" role="status">{message}</span> : null}
      </div>
    </details>
  );
}

export function DeleteRedirectButton({ id, source }: { id: string; source: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-11 self-start rounded px-3 text-sm font-semibold text-danger hover:bg-danger-bg"
      onClick={async () => {
        if (!(await confirmDialog(`Remover o redirecionamento de ${source}? Links antigos passarão a dar 404.`, { confirmLabel: "Remover", danger: true }))) return;
        setPending(true);
        const res = await deleteRedirectAction(id);
        setPending(false);
        if (!res.ok) await alertDialog(res.message);
        else router.refresh();
      }}
    >
      Remover <span className="sr-only">{source}</span>
    </button>
  );
}
