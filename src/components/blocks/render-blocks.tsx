import { Suspense } from "react";
import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import type { Block, CtaAction } from "@/lib/cms/blocks";
import { publicPath } from "@/lib/cms/content-types";
import { formatCents } from "@/lib/cms/format";
import { activePromotions, type RenderContext, type RenderEntry, type RenderMedia } from "@/lib/cms/render-context";
import { evaluationTarget, phoneHref, whatsappHref } from "@/lib/cms/settings";
import { EvaluationLink } from "@/components/site/evaluation-link";
import { RichText } from "./rich-text";

/**
 * Renderização dos blocos (Server Components, sem JS no cliente).
 * Visual da etapa 2 (funcional/acessível); refinado na etapa 3.
 * Seções sem conteúdo aprovado ficam ocultas no modo público.
 */

const section = "mx-auto w-full max-w-5xl px-4 py-10 sm:py-14";

function PreviewNote({ ctx, children }: { ctx: RenderContext; children: React.ReactNode }) {
  if (ctx.mode !== "preview") return null;
  return (
    <p className="mx-auto my-2 max-w-5xl rounded-lg border border-dashed border-gold-700 bg-gold-100 px-4 py-2 text-sm text-gold-700">
      Prévia: {children}
    </p>
  );
}

export function Picture({ media, sizes, priority }: { media: RenderMedia; sizes: string; priority?: boolean }) {
  const largest = media.sources.at(-1);
  if (!largest) return null;
  return (
    // Variantes já otimizadas no upload; srcset evita baixar mais que o necessário.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={largest.url}
      srcSet={media.sources.map((s) => `${s.url} ${s.width}w`).join(", ")}
      sizes={sizes}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className="h-auto w-full rounded-[var(--radius-card)] object-cover"
    />
  );
}

function ctaHref(action: CtaAction, ctx: RenderContext): string | null {
  switch (action.kind) {
    case "evaluation":
      return evaluationTarget(ctx.settings)?.href ?? null;
    case "whatsapp":
      return whatsappHref(ctx.settings);
    case "link":
      return action.href;
  }
}

function CtaButton({ action, ctx, variant = "primary" }: { action: CtaAction; ctx: RenderContext; variant?: "primary" | "secondary" | "onDark" }) {
  const href = ctaHref(action, ctx);
  if (!href) {
    return <PreviewNote ctx={ctx}>botão “{action.label}” oculto — configure o WhatsApp ou o destino do agendamento em Configurações públicas.</PreviewNote>;
  }
  const cls =
    variant === "primary"
      ? "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800"
      : variant === "onDark"
        ? // Faixa escura: fundo claro para contraste AA (brand-800 sobre surface 7.8:1).
          "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-surface px-6 font-semibold text-brand-800 hover:bg-gold-100"
        : "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-brand-700 px-6 font-semibold text-brand-800 hover:bg-brand-50";
  const external = href.startsWith("https://");
  const target = action.kind === "evaluation" ? evaluationTarget(ctx.settings)?.mode : undefined;
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer" data-cta={action.kind} data-cta-target={target}>
      {action.label}<span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : (
    <Link href={href} className={cls} data-cta={action.kind} data-cta-target={target}>{action.label}</Link>
  );
}

function Heading({ text, id }: { text?: string; id?: string }) {
  if (!text) return null;
  return <h2 id={id} className="mb-8 text-center text-2xl font-bold text-brand-800 sm:text-3xl">{text}</h2>;
}

function resolveEntries(ids: string[], ctx: RenderContext): RenderEntry[] {
  return ids.map((id) => ctx.entries.get(id)).filter((e): e is RenderEntry => !!e && (e.published || ctx.mode === "preview"));
}

export function EntryCard({ entry, ctx }: { entry: RenderEntry; ctx: RenderContext }) {
  const href = publicPath(entry.type, entry.slug);
  const cover = typeof entry.data.mediaId === "string" ? ctx.media.get(entry.data.mediaId) : undefined;
  const body = (
    <>
      {cover ? <Picture media={cover} sizes="(min-width: 1024px) 320px, 100vw" /> : null}
      <h3 className="mt-3 text-lg font-semibold text-brand-800">{entry.title}</h3>
      {entry.summary ? <p className="mt-1 text-sm text-muted">{entry.summary}</p> : null}
      {!entry.published ? <p className="mt-1 text-xs font-semibold text-gold-700">não publicado</p> : null}
    </>
  );
  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 text-center">
      {href ? <Link href={href} className="block">{body}</Link> : body}
    </li>
  );
}

export function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: RenderContext }) {
  return (
    <>
      {blocks.map((block, idx) => (
        <RenderBlock key={block.id} block={block} ctx={ctx} first={idx === 0} />
      ))}
    </>
  );
}

function RenderBlock({ block: b, ctx, first }: { block: Block; ctx: RenderContext; first: boolean }) {
  const headingId = `bloco-${b.id}`;
  switch (b.type) {
    case "hero": {
      const media = b.mediaId ? ctx.media.get(b.mediaId) : undefined;
      const Title = first ? "h1" : "h2";
      return (
        <section className="bg-gold-100/50">
          <div className={`${section} flex flex-col items-center gap-10 text-center`}>
            <div className="mx-auto max-w-3xl">
              <Title className="text-3xl font-bold text-brand-800 sm:text-5xl sm:leading-tight">{b.heading}</Title>
              {b.subheading ? <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{b.subheading}</p> : null}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {b.primary ? <CtaButton action={b.primary} ctx={ctx} /> : null}
                {b.secondary ? <CtaButton action={b.secondary} ctx={ctx} variant="secondary" /> : null}
              </div>
            </div>
            {media ? <div className="w-full max-w-4xl"><Picture media={media} sizes="(min-width: 1024px) 896px, 100vw" priority={first} /></div> : null}
            {b.mediaId && !media ? <PreviewNote ctx={ctx}>imagem ainda não disponível.</PreviewNote> : null}
          </div>
        </section>
      );
    }
    case "rich_text":
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
          <Heading text={b.heading} id={headingId} />
          {/* Coluna centralizada; parágrafos longos alinhados à esquerda para leitura. */}
          <div className="mx-auto max-w-3xl"><RichText doc={b.body} /></div>
        </section>
      );
    case "image": {
      const media = ctx.media.get(b.mediaId);
      if (!media) return <PreviewNote ctx={ctx}>imagem ainda não disponível.</PreviewNote>;
      return (
        <figure className={section}>
          <Picture media={media} sizes="(min-width: 1024px) 1024px, 100vw" priority={first} />
          {b.caption ? <figcaption className="mt-2 text-center text-sm text-muted">{b.caption}</figcaption> : null}
        </figure>
      );
    }
    case "cta":
      return (
        <section className="bg-brand-800 text-white">
          <div className={`${section} flex flex-col items-center gap-4 text-center`}>
            <h2 className="text-2xl font-bold sm:text-3xl">{b.heading}</h2>
            {b.text ? <p className="max-w-2xl text-white/90">{b.text}</p> : null}
            <CtaButton action={b.action} ctx={ctx} variant="onDark" />
          </div>
        </section>
      );
    case "features":
    case "steps":
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
          <Heading text={b.heading} id={headingId} />
          {b.type === "steps" ? (
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {b.items.map((it, i) => (
                <li key={i} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  <span className="text-sm font-semibold text-gold-700">Etapa {i + 1}</span>
                  <h3 className="mt-1 font-semibold text-brand-800">{it.title}</h3>
                  {it.text ? <p className="mt-1 text-sm text-muted">{it.text}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {b.items.map((it, i) => (
                <li key={i} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  <h3 className="font-semibold text-brand-800">{it.title}</h3>
                  {it.text ? <p className="mt-1 text-sm text-muted">{it.text}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    case "notice":
      return (
        <div className={section}>
          <p role="note" className={`mx-auto max-w-3xl rounded-[var(--radius-card)] border-t-4 p-5 text-center ${b.tone === "important" ? "border-gold-700 bg-gold-100" : "border-brand-500 bg-brand-50"}`}>
            {b.text}
          </p>
        </div>
      );
    case "faq_list": {
      const faqs = resolveEntries(b.entryIds, ctx);
      if (faqs.length === 0) return <PreviewNote ctx={ctx}>nenhuma FAQ publicada selecionada.</PreviewNote>;
      return (
        <section aria-labelledby={headingId} className={section}>
          <Heading text={b.heading ?? "Perguntas frequentes"} id={headingId} />
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {faqs.map((f) => (
              <details key={f.id} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-800">{f.title}</summary>
                <p className="mt-2 whitespace-pre-line text-ink">{String(f.data.answer ?? "")}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    case "treatment_list":
    case "team_list":
    case "testimonial_list": {
      const items = resolveEntries(b.entryIds, ctx);
      if (items.length === 0) return <PreviewNote ctx={ctx}>nenhum item publicado selecionado.</PreviewNote>;
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
          <Heading text={b.heading} id={headingId} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) =>
              b.type === "testimonial_list" ? (
                <li key={e.id} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  <blockquote className="text-ink">“{String(e.data.quote ?? "")}”</blockquote>
                  {e.data.author_display ? <p className="mt-2 text-sm text-muted">— {String(e.data.author_display)}</p> : null}
                </li>
              ) : b.type === "team_list" ? (
                <li key={e.id} className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  {typeof e.data.mediaId === "string" && ctx.media.get(e.data.mediaId) ? (
                    <Picture media={ctx.media.get(e.data.mediaId)!} sizes="320px" />
                  ) : null}
                  <h3 className="mt-3 font-semibold text-brand-800">{e.title}</h3>
                  {e.data.role ? <p className="text-sm text-muted">{String(e.data.role)}</p> : null}
                  {e.data.registration ? <p className="text-xs text-muted">{String(e.data.registration)}</p> : null}
                </li>
              ) : (
                <EntryCard key={e.id} entry={e} ctx={ctx} />
              ),
            )}
          </ul>
          {b.type === "testimonial_list" ? (
            <p className="mt-4 text-center text-sm text-muted">Resultados variam de pessoa para pessoa.</p>
          ) : null}
        </section>
      );
    }
    case "category_list":
    case "concern_list": {
      const items = b.type === "category_list"
        ? ctx.categories
        : ctx.concerns.filter((c) => !b.area || c.area === b.area);
      if (items.length === 0) return <PreviewNote ctx={ctx}>nenhum item publicado em Categorias e objetivos.</PreviewNote>;
      const base = b.type === "category_list" ? "/tratamentos/categoria/" : "/tratamentos?objetivo=";
      return (
        <section aria-labelledby={headingId} className={section}>
          <Heading text={b.heading ?? (b.type === "concern_list" ? "O que você deseja tratar?" : "Categorias")} id={headingId} />
          <ul className="flex flex-wrap justify-center gap-3">
            {items.map((t) => (
              <li key={t.id}>
                <Link href={`${base}${t.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-brand-300 bg-surface-raised px-4 font-semibold text-brand-800 hover:bg-brand-50">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "promotion_list":
      return (
        // Vigência calculada na hora da requisição (fora do cache).
        <Suspense fallback={null}>
          <ActivePromotionList heading={b.heading} limit={b.limit} headingId={headingId} ctx={ctx} />
        </Suspense>
      );
    case "gallery": {
      const items = b.mediaIds.map((id) => ctx.media.get(id)).filter((m): m is RenderMedia => !!m);
      if (items.length === 0) return <PreviewNote ctx={ctx}>imagens ainda não disponíveis.</PreviewNote>;
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
          <Heading text={b.heading} id={headingId} />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map((m) => <li key={m.id}><Picture media={m} sizes="(min-width: 768px) 33vw, 50vw" /></li>)}
          </ul>
        </section>
      );
    }
    case "contact": {
      const s = ctx.settings;
      const wa = whatsappHref(s);
      const tel = phoneHref(s);
      const addr = s.address;
      const addressText = addr
        ? [addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ""}`, addr.complement, addr.district, addr.city && `${addr.city}${addr.state ? `/${addr.state}` : ""}`, addr.postal_code]
            .filter(Boolean).join(" · ")
        : "";
      const nothing = !wa && !tel && !addressText && !s.email && !s.hours?.length;
      if (nothing) return <PreviewNote ctx={ctx}>bloco de contato oculto até preencher Configurações públicas.</PreviewNote>;
      return (
        <section aria-labelledby={headingId} className={section}>
          <Heading text={b.heading ?? "Contato"} id={headingId} />
          <div className="grid justify-items-center gap-6 text-center md:grid-cols-2">
            <ul className="flex flex-col items-center gap-3">
              {wa ? <li><a href={wa} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4">WhatsApp</a></li> : null}
              {tel ? <li><a href={tel} className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4">Telefone</a></li> : null}
              {s.email ? <li><a href={`mailto:${s.email}`} className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4">{s.email}</a></li> : null}
              {addressText ? <li className="text-ink">{addressText}</li> : null}
              {b.showMap && s.map_url ? (
                <li><a href={s.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4">Ver no mapa</a></li>
              ) : null}
            </ul>
            {s.hours?.length ? (
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-left text-sm">
                {s.hours.map((h, i) => (
                  <div key={i} className="contents"><dt className="font-semibold">{h.label}</dt><dd>{h.value}</dd></div>
                ))}
              </dl>
            ) : null}
          </div>
          {b.showForm ? (
            <p className="mt-8 text-center">
              <EvaluationLink target={evaluationTarget(s)} location="contact_block"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800">
                Solicitar contato
              </EvaluationLink>
            </p>
          ) : null}
        </section>
      );
    }
  }
}

async function ActivePromotionList(props: { heading?: string; limit: number; headingId: string; ctx: RenderContext }) {
  const promos = activePromotions(props.ctx.promotions, await requestNow()).slice(0, props.limit);
  if (promos.length === 0) return <PreviewNote ctx={props.ctx}>nenhuma promoção vigente agora (seção fica oculta).</PreviewNote>;
  return (
    <section aria-labelledby={props.headingId} className={section}>
      <Heading text={props.heading ?? "Promoções"} id={props.headingId} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((p) => <PromotionCard key={p.entry.id} promotion={p} ctx={props.ctx} />)}
      </ul>
    </section>
  );
}

export function PromotionCard({ promotion: p, ctx }: { promotion: RenderContext["promotions"][number]; ctx: RenderContext }) {
  const cover = typeof p.entry.data.mediaId === "string" ? ctx.media.get(p.entry.data.mediaId) : undefined;
  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
      <Link href={`/promocoes/${p.entry.slug}`} className="block">
        {cover ? <Picture media={cover} sizes="(min-width: 1024px) 320px, 100vw" /> : null}
        <h3 className="mt-3 font-semibold text-brand-800">{p.entry.title}</h3>
        {p.entry.summary ? <p className="mt-1 text-sm text-muted">{p.entry.summary}</p> : null}
        {p.priceCents !== null ? (
          <p className="mt-2 text-lg font-bold text-ink">
            {p.originalPriceCents !== null ? <s className="mr-2 text-sm font-normal text-muted">{formatCents(p.originalPriceCents)}</s> : null}
            {formatCents(p.priceCents)}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted">Consulte as condições.</p>
      </Link>
    </li>
  );
}
