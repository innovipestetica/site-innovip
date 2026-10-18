import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { CONTENT_TYPES, typeFromSegment } from "@/lib/cms/content-types";
import { AdminMain, PageHeader } from "@/components/admin/ui";
import { NewEntryForm } from "./new-entry-form";

export const metadata: Metadata = { title: "Novo conteúdo" };

export default function NewEntryPage({ params }: PageProps<"/admin/conteudo/[tipo]/novo">) {
  return (
    <AdminMain>
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <NewEntry params={params} />
      </Suspense>
    </AdminMain>
  );
}

async function NewEntry({ params }: { params: PageProps<"/admin/conteudo/[tipo]/novo">["params"] }) {
  await requireAdmin();
  const { tipo } = await params;
  const type = typeFromSegment(tipo);
  if (!type) notFound();
  const meta = CONTENT_TYPES[type];
  return (
    <>
      <PageHeader title={`Novo: ${meta.label.toLowerCase()}`} description="Você poderá completar o conteúdo depois. Nada é publicado até você publicar." />
      <NewEntryForm type={type} segment={meta.segment} prefix={type === "home" ? null : meta.publicPrefix} />
    </>
  );
}
