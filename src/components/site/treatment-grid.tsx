import Link from "next/link";
import { Picture } from "@/components/blocks/render-blocks";
import type { PublishedEntry } from "@/lib/cms/public-data";
import type { RenderMedia } from "@/lib/cms/render-context";

export function TreatmentGrid({
  items,
  media,
  emptyText = "Nenhum tratamento encontrado.",
}: {
  items: PublishedEntry[];
  media: Map<string, RenderMedia>;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="text-center text-muted" role="status">{emptyText}</p>;
  return (
    <ul className="card-grid [--card-gap:1.25rem]">
      {items.map((t) => {
        const cover = typeof t.data.mediaId === "string" ? media.get(t.data.mediaId) : undefined;
        return (
          <li key={t.id} className="group rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 text-center transition-colors hover:border-brand-300">
            <Link href={`/tratamentos/${t.slug}`} className="flex h-full flex-col">
              {cover ? <Picture media={cover} sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" /> : null}
              <h3 className="mt-3 text-lg font-semibold text-brand-800 group-hover:underline">{t.title}</h3>
              {t.summary ? <p className="mt-1 text-sm text-muted">{t.summary}</p> : null}
              <span className="mt-auto pt-3 text-sm font-semibold text-brand-700">Saiba mais →</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Busca sem diferenciar acentos e maiúsculas. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
