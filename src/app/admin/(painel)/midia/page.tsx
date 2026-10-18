import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseVariants, PRIVATE_BUCKET, publicObjectUrl } from "@/lib/cms/media-urls";
import { AdminMain, EmptyState, PageHeader } from "@/components/admin/ui";
import { MediaCard, Uploader } from "./media-controls";

export const metadata: Metadata = { title: "Mídia" };

export default function MediaPage({ searchParams }: PageProps<"/admin/midia">) {
  return (
    <AdminMain>
      <PageHeader
        title="Mídia"
        description="Imagens ficam privadas até serem aprovadas. Aprovar exige texto alternativo e registro de licença ou autorização de imagem."
      />
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <Media searchParams={searchParams} />
      </Suspense>
    </AdminMain>
  );
}

async function Media({ searchParams }: { searchParams: PageProps<"/admin/midia">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const showArchived = sp.arquivadas === "1";
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("media_assets")
    .select("id, status, alt, width, height, size_bytes, mime, revision, created_at, private_variants, public_variants")
    .order("created_at", { ascending: false })
    .limit(200);
  query = showArchived ? query.eq("status", "archived") : query.neq("status", "archived");
  const { data: assets, error } = await query;
  if (error) throw new Error(`media: ${error.code}`);

  // Onde cada imagem é usada (títulos dos conteúdos).
  const ids = assets.map((a) => a.id);
  const { data: refs } = ids.length
    ? await supabase
        .from("version_media_refs")
        .select("media_id, content_versions!inner(entry_id, title)")
        .in("media_id", ids)
    : { data: [] };
  const usage = new Map<string, Set<string>>();
  for (const r of (refs ?? []) as unknown as { media_id: string; content_versions: { title: string } }[]) {
    const set = usage.get(r.media_id) ?? new Set<string>();
    set.add(r.content_versions.title);
    usage.set(r.media_id, set);
  }

  // Miniaturas: pública (aprovada) ou assinada por 10 minutos (privada).
  const thumbs = new Map<string, string>();
  const privatePaths: { id: string; path: string }[] = [];
  for (const a of assets) {
    if (a.status === "published") {
      const v = parseVariants(a.public_variants)[0];
      if (v) thumbs.set(a.id, publicObjectUrl(v.path));
    } else {
      const v = parseVariants(a.private_variants)[0];
      if (v) privatePaths.push({ id: a.id, path: v.path });
    }
  }
  if (privatePaths.length) {
    const { data: signed } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrls(privatePaths.map((p) => p.path), 600);
    privatePaths.forEach((p, i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) thumbs.set(p.id, url);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {!showArchived ? <Uploader /> : null}
      <p className="text-sm">
        <a className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4" href={showArchived ? "/admin/midia" : "/admin/midia?arquivadas=1"}>
          {showArchived ? "← Ver imagens ativas" : "Ver arquivadas (com evidência de licença guardada)"}
        </a>
      </p>
      {assets.length === 0 ? (
        <EmptyState>{showArchived ? "Nenhuma imagem arquivada." : "Nenhuma imagem enviada ainda."}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <MediaCard
              key={`${a.id}:${a.revision}:${a.status}`}
              asset={{
                id: a.id,
                status: a.status,
                alt: a.alt ?? "",
                width: a.width,
                height: a.height,
                sizeBytes: a.size_bytes,
                revision: a.revision,
                createdAt: a.created_at,
              }}
              thumbUrl={thumbs.get(a.id) ?? null}
              usedIn={[...(usage.get(a.id) ?? [])]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
