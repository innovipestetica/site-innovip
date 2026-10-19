import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requestNow } from "@/lib/request-time";
import { PromotionCard } from "@/components/blocks/render-blocks";
import { Breadcrumbs } from "@/components/site/page-parts";
import { getPublishedPromotions, loadPublicContext } from "@/lib/cms/public-data";
import { activePromotions, type RenderContext } from "@/lib/cms/render-context";
import { resolveMissing } from "@/lib/cms/resolve-missing";
import { buildMetadata } from "@/lib/seo";
import { evaluationTarget } from "@/lib/cms/settings";
import { EvaluationLink } from "@/components/site/evaluation-link";

export const metadata: Metadata = buildMetadata({
  title: "Promoções",
  description: "Ofertas vigentes da Innovip. Consulte as condições de cada promoção.",
  path: "/promocoes",
});

export default async function PromotionsPage() {
  const promotions = await getPublishedPromotions();
  if (promotions.length === 0) return resolveMissing("/promocoes");
  const ctx = await loadPublicContext(null);

  return (
    <main id="conteudo" className="flex-1">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Promoções", href: "/promocoes" }]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-center text-3xl font-bold text-brand-800 sm:text-5xl">Promoções</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted">Ofertas por tempo determinado. Todas incluem avaliação individual.</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-muted" role="status">Carregando promoções vigentes…</p>}>
            <ActiveList ctx={ctx} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

/** Vigência conferida na hora da requisição: expiradas somem mesmo sem cron. */
async function ActiveList({ ctx }: { ctx: RenderContext }) {
  const active = activePromotions(ctx.promotions, await requestNow());
  if (active.length === 0) {
    return (
      <div role="status" className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-6">
        <p className="font-semibold text-ink">No momento não há promoções vigentes.</p>
        <p className="mt-2 text-sm text-muted">
          Veja os <Link href="/tratamentos" className="font-semibold text-brand-800 underline">tratamentos</Link>
          {evaluationTarget(ctx.settings) ? (
            <>
              {" "}ou{" "}
              <EvaluationLink target={evaluationTarget(ctx.settings)} location="promotions_empty" className="font-semibold text-brand-800 underline">
                solicite uma avaliação
              </EvaluationLink>
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {active.map((p) => <PromotionCard key={p.entry.id} promotion={p} ctx={ctx} />)}
    </ul>
  );
}
