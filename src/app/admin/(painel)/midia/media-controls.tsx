"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Alert, buttonPrimary, buttonSecondary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { TextArea, TextInput } from "@/components/admin/editor/fields";
import { formatDateTime } from "@/components/admin/ui";
import {
  createUploadAction,
  deleteMediaAction,
  processUploadAction,
  publishMediaAction,
  unpublishMediaAction,
  updateAltAction,
} from "./actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 10 * 1024 * 1024;

/** PUT direto no Storage (URL assinada) com progresso real via XHR. */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("rede"));
    xhr.send(file);
  });
}

export function Uploader() {
  const router = useRouter();
  const hydrated = useHydrated();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [alt, setAlt] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onUpload() {
    const file = inputRef.current?.files?.[0];
    setMessage(null);
    if (!file) return setMessage({ tone: "error", text: "Escolha um arquivo." });
    if (!ACCEPT.split(",").includes(file.type)) {
      return setMessage({ tone: "error", text: "Formato não aceito. Use JPEG, PNG, WebP ou AVIF (SVG não é aceito)." });
    }
    if (file.size > MAX_BYTES) return setMessage({ tone: "error", text: "Arquivo maior que 10 MB." });

    setStage("Preparando envio…");
    const start = await createUploadAction({ mime: file.type, size: file.size });
    if (!start.ok) {
      setStage(null);
      return setMessage({ tone: "error", text: start.message });
    }
    try {
      setStage("Enviando…");
      setProgress(0);
      await uploadWithProgress(start.data.signedUrl, file, setProgress);
    } catch {
      setStage(null);
      setProgress(null);
      return setMessage({ tone: "error", text: "Falha no envio. Verifique a conexão e tente de novo." });
    }
    setStage("Processando (removendo metadados e gerando versões)…");
    const done = await processUploadAction({ path: start.data.path, alt });
    setStage(null);
    setProgress(null);
    if (!done.ok) return setMessage({ tone: "error", text: done.message });
    setMessage({ tone: "success", text: "Imagem enviada. Ela fica privada até ser aprovada." });
    setAlt("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const busy = stage !== null;
  return (
    <section aria-labelledby="enviar-imagem" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
      <h2 id="enviar-imagem" className="text-lg font-semibold text-brand-800">Enviar imagem</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold">Arquivo</label>
        <p id={`${inputId}-dica`} className="text-sm text-muted">JPEG, PNG, WebP ou AVIF, até 10 MB. Use só imagens próprias ou licenciadas.</p>
        <input id={inputId} ref={inputRef} type="file" accept={ACCEPT} aria-describedby={`${inputId}-dica`} disabled={busy}
          className="min-h-11 rounded-[var(--radius-control)] border border-line bg-surface-raised p-2 text-sm" />
      </div>
      <TextInput label="Texto alternativo (descreva a imagem)" value={alt} maxLength={250}
        hint="Obrigatório para aprovar. Ex.: “Sala de atendimento com maca e iluminação natural”." onChange={(v) => setAlt(v ?? "")} />
      {stage ? (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <span>{stage}</span>
          {progress !== null ? <progress max={100} value={progress} className="w-full" aria-label="Progresso do envio">{progress}%</progress> : null}
        </div>
      ) : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <button type="button" className={`${buttonPrimary} self-start`} disabled={!hydrated || busy} onClick={onUpload}>
        {busy ? "Enviando…" : "Enviar"}
      </button>
    </section>
  );
}

type Asset = {
  id: string;
  status: "processing" | "private" | "published" | "archived";
  alt: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  revision: number;
  createdAt: string;
};

const STATUS: Record<Asset["status"], string> = {
  processing: "Processando",
  private: "Privada (não aprovada)",
  published: "Aprovada (no site)",
  archived: "Arquivada",
};

export function MediaCard({ asset, thumbUrl, usedIn }: { asset: Asset; thumbUrl: string | null; usedIn: string[] }) {
  const router = useRouter();
  const [alt, setAlt] = useState(asset.alt);
  const [approving, setApproving] = useState(false);
  const [rights, setRights] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string; list?: string[] } | null>(null);

  async function act(fn: () => Promise<{ ok: boolean; message?: string; problems?: string[] }>, success: string) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "error", text: res.message ?? "Falhou.", list: res.problems });
    setMessage({ tone: "success", text: success });
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-3">
      {thumbUrl ? (
        // Miniatura (URL assinada curta ou pública).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt={asset.alt || "Imagem sem texto alternativo"} width={asset.width ?? undefined} height={asset.height ?? undefined}
          loading="lazy" className="aspect-[4/3] w-full rounded-lg bg-brand-50 object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-brand-50 text-sm text-muted">Sem miniatura</div>
      )}
      <p className="text-xs text-muted">
        {STATUS[asset.status]} · {asset.width}×{asset.height} · {(asset.sizeBytes / 1024).toFixed(0)} KB · {formatDateTime(asset.createdAt)}
      </p>
      <p className="text-xs">
        {usedIn.length ? <>Usada em: {usedIn.join(", ")}</> : <span className="text-muted">Não usada em nenhum conteúdo.</span>}
      </p>

      {asset.status !== "archived" ? (
        <>
          <TextInput label="Texto alternativo" value={alt} maxLength={250} onChange={(v) => setAlt(v ?? "")} />
          {alt !== asset.alt ? (
            <button type="button" className={buttonSecondary} disabled={busy}
              onClick={() => act(() => updateAltAction(asset.id, alt, asset.revision), "Texto alternativo salvo.")}>
              Salvar texto alternativo
            </button>
          ) : null}

          {asset.status === "private" ? (
            approving ? (
              <div className="flex flex-col gap-2 rounded-lg border border-gold-300 bg-gold-100/40 p-3">
                <TextArea label="Licença ou autorização de uso" value={rights} maxLength={500} rows={3}
                  hint="Ex.: foto própria da clínica (out/2026); banco de imagens X, licença nº…; termo de autorização de imagem assinado em…"
                  onChange={(v) => setRights(v ?? "")} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonPrimary} disabled={busy || alt !== asset.alt}
                    onClick={() => act(() => publishMediaAction(asset.id, rights), "Imagem aprovada e disponível para o site.")}>
                    Confirmar aprovação
                  </button>
                  <button type="button" className={buttonSecondary} onClick={() => setApproving(false)}>Cancelar</button>
                </div>
                {alt !== asset.alt ? <p className="text-xs text-danger">Salve o texto alternativo antes.</p> : null}
              </div>
            ) : (
              <button type="button" className={buttonPrimary} disabled={busy} onClick={() => setApproving(true)}>Aprovar para o site</button>
            )
          ) : null}

          {asset.status === "published" ? (
            <button type="button" className={buttonSecondary} disabled={busy}
              onClick={() => {
                if (!window.confirm("Tirar a imagem do site? Cópias já distribuídas podem continuar em caches por algum tempo.")) return;
                void act(() => unpublishMediaAction(asset.id), "Imagem retirada do site.");
              }}>
              Tirar do site
            </button>
          ) : null}

          <button type="button" className="min-h-11 rounded px-3 text-sm font-semibold text-danger hover:bg-danger-bg" disabled={busy}
            onClick={() => {
              if (!window.confirm("Excluir esta imagem? Se houver registro de licença, ela será arquivada (a evidência fica guardada).")) return;
              void act(() => deleteMediaAction(asset.id), "Imagem removida.");
            }}>
            Excluir
          </button>
        </>
      ) : null}

      {message ? (
        <Alert tone={message.tone}>
          {message.text}
          {message.list?.length ? <ul className="mt-1 list-disc pl-5">{message.list.map((t) => <li key={t}>{t}</li>)}</ul> : null}
        </Alert>
      ) : null}
    </li>
  );
}
