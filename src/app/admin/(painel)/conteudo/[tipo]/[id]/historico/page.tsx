import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { getEntryForEdit, listVersions } from "@/lib/cms/admin-data";
import { CONTENT_TYPES, typeFromSegment } from "@/lib/cms/content-types";
import { AdminMain, PageHeader, formatDateTime } from "@/components/admin/ui";
import { RestoreButton } from "./restore-button";

export const metadata: Metadata = { title: "Histórico" };

export default function HistoryPage({ params }: PageProps<"/admin/conteudo/[tipo]/[id]/historico">) {
  return (
    <AdminMain>
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <History params={params} />
      </Suspense>
    </AdminMain>
  );
}

async function History({ params }: { params: PageProps<"/admin/conteudo/[tipo]/[id]/historico">["params"] }) {
  await requireAdmin();
  const { tipo, id } = await params;
  const type = typeFromSegment(tipo);
  if (!type || !z.uuid().safeParse(id).success) notFound();
  const entry = await getEntryForEdit(id);
  if (!entry || entry.type !== type) notFound();
  const versions = await listVersions(id);
  const meta = CONTENT_TYPES[type];

  return (
    <>
      <nav aria-label="Trilha" className="mb-2 text-sm">
        <Link href={`/admin/conteudo/${meta.segment}/${id}`} className="inline-flex min-h-11 items-center text-brand-800 underline underline-offset-4">
          ← Voltar ao editor
        </Link>
      </nav>
      <PageHeader
        title={`Histórico: ${entry.payload.title}`}
        description="Restaurar cria uma revisão nova com o conteúdo antigo; nada é apagado e o site só muda ao publicar."
      />
      <ol className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
        {versions.map((v) => {
          const isLive = v.id === entry.publishedVersionId;
          const isLatest = v.revision === entry.latestRevision;
          return (
            <li key={v.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-ink">
                  Revisão {v.revision} — {v.title}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(v.created_at)}
                  {isLive ? " · no ar" : ""}
                  {isLatest ? " · mais recente" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/previa/${v.id}`} target="_blank" rel="noopener"
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-line px-3 text-sm font-semibold hover:bg-brand-50">
                  Prévia
                </Link>
                {!isLatest && entry.lifecycleStatus !== "archived" ? (
                  <RestoreButton entryId={id} versionId={v.id} revision={v.revision} baseRevision={entry.latestRevision}
                    editorHref={`/admin/conteudo/${meta.segment}/${id}`} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
