import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import { PromotionCard } from "@/components/blocks/render-blocks";
import { formatCents } from "@/lib/cms/format";
import type { PublishedEntry } from "@/lib/cms/public-data";
import { activePromotions, type RenderContext } from "@/lib/cms/render-context";
import { evaluationTarget } from "@/lib/cms/settings";
import { EvaluationLink } from "./evaluation-link";
import { ctaPrimary } from "./page-parts";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/**
 * Situação da oferta calculada NA REQUISIÇÃO (fora do cache): mesmo com a
 * página em cache, CTA ativo só aparece dentro do prazo publicado.
 */
export async function PromotionStatus({
  promo,
  ctx,
  ctaLocation,
}: {
  promo: PublishedEntry;
  ctx: RenderContext;
  ctaLocation: string;
}) {
  const now = await requestNow();
  const p = promo.promotion;
  if (!p?.startsAt || !p.endsAt) return null;
  const starts = Date.parse(p.startsAt);
  const ends = Date.parse(p.endsAt);

  if (now < starts) {
    return (
      <div role="status" className="mx-auto w-full max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
        <p className="font-semibold text-brand-800">Esta oferta começa em {dateFmt.format(starts)} (horário de Brasília).</p>
      </div>
    );
  }

  if (now >= ends) {
    const others = activePromotions(ctx.promotions, now).filter((o) => o.entry.id !== promo.id).slice(0, 3);
    const related = p.treatmentIds.map((id) => ctx.entries.get(id)).filter((e) => !!e);
    return (
      <div className="flex flex-col gap-6">
        <div role="status" className="mx-auto w-full max-w-2xl rounded-[var(--radius-card)] border-t-4 border-gold-700 bg-gold-100 p-5 text-center">
          <p className="text-lg font-bold text-ink">Oferta encerrada</p>
          <p className="mt-1 text-sm text-muted">Esta promoção terminou em {dateFmt.format(ends)}.</p>
        </div>
        {related.length ? (
          <div>
            <h2 className="mb-3 text-center text-xl font-bold text-brand-800">Conheça os tratamentos</h2>
            <ul className="flex flex-wrap justify-center gap-2">
              {related.map((e) => (
                <li key={e!.id}>
                  <Link href={`/tratamentos/${e!.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-brand-50 px-4 font-semibold text-brand-800 hover:bg-brand-100">
                    {e!.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {others.length ? (
          <div>
            <h2 className="mb-3 text-center text-xl font-bold text-brand-800">Promoções vigentes</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((o) => <PromotionCard key={o.entry.id} promotion={o} ctx={ctx} />)}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-6 text-center">
      {p.priceCents !== null ? (
        <p className="text-3xl font-bold text-ink">
          {p.originalPriceCents !== null ? (
            <s className="mr-3 text-lg font-normal text-muted"><span className="sr-only">De </span>{formatCents(p.originalPriceCents)}</s>
          ) : null}
          <span className="sr-only">Por </span>{formatCents(p.priceCents)}
        </p>
      ) : null}
      <p className="text-sm text-muted">Válida até {dateFmt.format(ends)} (horário de Brasília). Consulte as condições.</p>
      <EvaluationLink
        target={evaluationTarget(ctx.settings)}
        className={ctaPrimary}
        location={ctaLocation}
      >
        Quero aproveitar
      </EvaluationLink>
    </div>
  );
}

export function PromotionTerms({ terms }: { terms: string | null | undefined }) {
  if (!terms) return null;
  return (
    <details className="mx-auto w-full max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-800">Condições da oferta</summary>
      <p className="mt-2 whitespace-pre-line text-sm text-ink">{terms}</p>
    </details>
  );
}
