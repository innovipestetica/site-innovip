import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getEntryForEdit,
  listMediaOptions,
  listRefOptions,
  listTaxonomies,
} from "@/lib/cms/admin-data";
import { CONTENT_TYPES, typeFromSegment, type ContentType } from "@/lib/cms/content-types";
import { AdminMain, PageHeader } from "@/components/admin/ui";
import { EntryEditor } from "@/components/admin/editor/entry-editor";

export const metadata: Metadata = { title: "Editar conteúdo" };

export default function EditEntryPage({ params }: PageProps<"/admin/conteudo/[tipo]/[id]">) {
  return (
    <AdminMain>
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando editor…</p>}>
        <Editor params={params} />
      </Suspense>
    </AdminMain>
  );
}

/** Tipos que cada tipo pode referenciar nos blocos/relações. */
const REF_TYPES: ContentType[] = ["faq", "treatment", "testimonial", "team_member", "promotion"];

async function Editor({ params }: { params: PageProps<"/admin/conteudo/[tipo]/[id]">["params"] }) {
  await requireAdmin();
  const { tipo, id } = await params;
  const type = typeFromSegment(tipo);
  if (!type || !z.uuid().safeParse(id).success) notFound();

  const entry = await getEntryForEdit(id);
  if (!entry) notFound();
  // URL com tipo trocado: manda para o endereço certo.
  if (entry.type !== type) redirect(`/admin/conteudo/${CONTENT_TYPES[entry.type].segment}/${entry.id}`);

  const meta = CONTENT_TYPES[type];
  const [refOptions, mediaOptions, taxonomies] = await Promise.all([
    listRefOptions(REF_TYPES),
    listMediaOptions(),
    type === "treatment" ? listTaxonomies() : Promise.resolve({ categories: [], concerns: [] }),
  ]);

  return (
    <>
      <nav aria-label="Trilha" className="mb-2 text-sm">
        <Link href={`/admin/conteudo/${meta.segment}`} className="inline-flex min-h-11 items-center text-brand-800 underline underline-offset-4">
          ← {meta.plural}
        </Link>
      </nav>
      <PageHeader title={entry.payload.title || meta.label} description={meta.label} />
      <EntryEditor
        // key: recria o estado do editor quando outra revisão é carregada
        key={`${entry.id}:${entry.latestRevision}`}
        entry={{
          id: entry.id,
          type: entry.type,
          slug: entry.slug,
          lifecycleStatus: entry.lifecycleStatus,
          latestRevision: entry.latestRevision,
          latestVersionId: entry.latestVersionId,
          publishedRevision: entry.publishedRevision,
          schemaMismatch: entry.schemaMismatch,
        }}
        initialPayload={entry.payload}
        refOptions={refOptions.filter((o) => o.id !== entry.id)}
        mediaOptions={mediaOptions}
        categories={taxonomies.categories.filter((c) => c.status !== "archived")}
        concerns={taxonomies.concerns.filter((c) => c.status !== "archived")}
      />
    </>
  );
}
