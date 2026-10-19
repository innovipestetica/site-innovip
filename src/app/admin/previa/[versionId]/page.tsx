import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { getVersion, versionToPayload } from "@/lib/cms/admin-data";
import { loadPreviewContext } from "@/lib/cms/preview-context";
import { CONTENT_TYPES } from "@/lib/cms/content-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/cms/format";
import { formatDateTime } from "@/components/admin/ui";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { PageOpening } from "@/components/site/page-parts";

// Prévia: autenticada, dinâmica e fora de qualquer cache público (o proxy
// também envia no-store/noindex para /admin).
export const metadata: Metadata = {
  title: "Prévia",
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewPage({ params }: PageProps<"/admin/previa/[versionId]">) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted" role="status">Carregando prévia…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: PageProps<"/admin/previa/[versionId]">["params"] }) {
  await requireAdmin();
  const { versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) notFound();

  const version = await getVersion(versionId);
  if (!version) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: entry } = await supabase
    .from("content_entries")
    .select("id, type, slug, published_version_id, latest_revision")
    .eq("id", version.entry_id)
    .single();
  if (!entry) notFound();

  const { payload } = versionToPayload(version);
  const ctx = await loadPreviewContext({ blocks: payload.blocks, data: payload.data, seo: payload.seo });
  const meta = CONTENT_TYPES[entry.type];
  const isLive = entry.published_version_id === version.id;
  const promo = entry.type === "promotion" ? (payload.details as Record<string, string | number | undefined>) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-gold-700 px-4 py-2 text-sm text-white">
        <span>
          <strong>PRÉVIA</strong> — {meta.label} · revisão {version.revision}
          {isLive ? " (é a versão no ar)" : " (não publicada)"} · visível só para administradores
        </span>
        <Link href={`/admin/conteudo/${meta.segment}/${entry.id}`} className="inline-flex min-h-11 items-center font-semibold underline">
          Voltar ao editor
        </Link>
      </div>
      <main id="conteudo" className="flex-1">
        <PageOpening firstBlockType={payload.blocks[0]?.type} title={payload.title} summary={payload.summary} />

        {promo ? (
          <section className="mx-auto w-full max-w-5xl px-4 pt-6">
            {promo.price_cents !== undefined ? (
              <p className="text-2xl font-bold text-ink">
                {promo.original_price_cents !== undefined ? <s className="mr-2 text-base font-normal text-muted">{formatCents(Number(promo.original_price_cents))}</s> : null}
                {formatCents(Number(promo.price_cents))}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              Válida de {formatDateTime(promo.starts_at as string | undefined)} até {formatDateTime(promo.ends_at as string | undefined)} (horário de Brasília).
            </p>
            {promo.terms ? (
              <details className="mt-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
                <summary className="min-h-11 cursor-pointer content-center font-semibold">Condições da oferta</summary>
                <p className="mt-2 whitespace-pre-line text-sm">{String(promo.terms)}</p>
              </details>
            ) : null}
          </section>
        ) : null}

        {entry.type === "faq" ? (
          <p className="mx-auto max-w-5xl whitespace-pre-line px-4 py-6">{String(payload.data.answer ?? "")}</p>
        ) : null}

        <RenderBlocks blocks={payload.blocks} ctx={ctx} />
      </main>
    </div>
  );
}
