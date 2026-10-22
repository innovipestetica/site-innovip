import { Fragment, Suspense, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { requestNow } from "@/lib/request-time";
import { stepLabelText, type Block, type CtaAction } from "@/lib/cms/blocks";
import { blockStyleAttrs } from "@/lib/cms/block-style";
import { publicPath } from "@/lib/cms/content-types";
import { formatCents } from "@/lib/cms/format";
import { activePromotions, type RenderContext, type RenderEntry, type RenderMedia } from "@/lib/cms/render-context";
import { evaluationTarget, phoneHref, whatsappHref } from "@/lib/cms/settings";
import { EvaluationLink } from "@/components/site/evaluation-link";
import { RichText } from "./rich-text";
import { BannerCarousel } from "./banner-carousel";
import { CardCarousel } from "./card-carousel";
import { CareFlow } from "./care-flow";
import { YoutubeVideo } from "./youtube-video";

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

/**
 * Imagem clicável (link opcional definido no painel). O nome do link vem do
 * texto alternativo da imagem; externos abrem em nova aba e avisam o leitor de tela.
 */
function ImageLink({ href, children, className = "" }: { href?: string; children: ReactNode; className?: string }) {
  if (!href) return <>{children}</>;
  const cls = `block rounded-[var(--radius-card)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700 ${className}`;
  return href.startsWith("https://") ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer" data-image-link="">
      {children}<span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : href.startsWith("/") ? (
    <Link href={href} className={cls} data-image-link="">{children}</Link>
  ) : (
    <a href={href} className={cls} data-image-link="">{children}</a>
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

function CtaButton({ action, ctx, variant = "primary", location }: { action: CtaAction; ctx: RenderContext; variant?: "primary" | "secondary" | "onDark"; location?: string }) {
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
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer" data-cta={action.kind} data-cta-target={target} data-cta-location={location}>
      {action.label}<span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : (
    <Link href={href} className={cls} data-cta={action.kind} data-cta-target={target} data-cta-location={location}>{action.label}</Link>
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
    <li className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-4 text-center">
      {href ? <Link href={href} className="block">{body}</Link> : body}
    </li>
  );
}

/**
 * `pageHasTitle`: a página já tem o título principal (h1) acima dos blocos
 * (tratamento, promoção, post). Aí um Destaque no início usa h2, para não
 * haver dois h1.
 */
export function RenderBlocks({ blocks, ctx, pageHasTitle = false }: { blocks: Block[]; ctx: RenderContext; pageHasTitle?: boolean }) {
  return (
    <>
      {blocks.map((block, idx) => {
        const content = <RenderBlock block={block} ctx={ctx} first={idx === 0} pageHasTitle={pageHasTitle} />;
        // Cores escolhidas no painel: invólucro com variáveis CSS (globals.css).
        const styled = blockStyleAttrs(block.style);
        const media = block.backdrop?.mediaId ? ctx.media.get(block.backdrop.mediaId) : undefined;
        const image = media?.sources.at(-1)?.url;
        const backdropStyle: CSSProperties | undefined = image ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${block.backdrop!.overlay / 100}), rgba(0,0,0,${block.backdrop!.overlay / 100})), url("${image}")`,
          backgroundPosition: block.backdrop!.position,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          minHeight: block.backdrop!.minHeight ? `${block.backdrop!.minHeight}px` : undefined,
        } : undefined;
        if (!styled && !backdropStyle) return <Fragment key={block.id}>{content}</Fragment>;
        return (
          <div
            key={block.id}
            {...styled}
            className={`${styled?.className ?? ""}${backdropStyle ? " blk-backdrop" : ""}`.trim()}
            style={{ ...(styled?.style ?? {}), ...(backdropStyle ?? {}) }}
          >
            {content}
          </div>
        );
      })}
    </>
  );
}

function RenderBlock({ block: b, ctx, first, pageHasTitle }: { block: Block; ctx: RenderContext; first: boolean; pageHasTitle: boolean }) {
  const headingId = `bloco-${b.id}`;
  switch (b.type) {
    case "hero": {
      const media = b.mediaId ? ctx.media.get(b.mediaId) : undefined;
      const Title = first && !pageHasTitle ? "h1" : "h2";
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
            {media ? (
              <div className="w-full max-w-4xl">
                <ImageLink href={b.imageLink}><Picture media={media} sizes="(min-width: 1024px) 896px, 100vw" priority={first} /></ImageLink>
              </div>
            ) : null}
            {b.mediaId && !media ? <PreviewNote ctx={ctx}>imagem ainda não disponível.</PreviewNote> : null}
          </div>
        </section>
      );
    }
    case "banner_carousel": {
      // Só banners com imagem aprovada (no site); na prévia, avisa o que falta.
      const slides = b.slides.flatMap((slide, i) => {
        const desktop = ctx.media.get(slide.mediaId);
        if (!desktop) return [];
        const mobile = slide.mobile?.mediaId ? ctx.media.get(slide.mobile.mediaId) : undefined;
        return [<BannerSlide key={slide.key} desktop={desktop} mobile={mobile} slide={slide} ctx={ctx} priority={first && i === 0} />];
      });
      const missing = b.slides.length - slides.length;
      return (
        <>
          {missing ? <PreviewNote ctx={ctx}>{missing} banner(s) com imagem fora do site ficam ocultos.</PreviewNote> : null}
          {slides.length ? (
            <div className="mx-auto w-full max-w-6xl px-0 pb-6 sm:px-4 sm:pt-4">
              <BannerCarousel
                slides={slides}
                label={b.label || "Destaques"}
                autoplay={b.autoplay}
                intervalSeconds={b.intervalSeconds}
              />
            </div>
          ) : null}
        </>
      );
    }
    case "rich_text":
      if (b.youtubeUrl) {
        return (
          <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
            <Heading text={b.heading} id={headingId} />
            <YoutubeVideo url={b.youtubeUrl} title={b.heading} aspect={b.youtubeAspect} />
          </section>
        );
      }
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
          <ImageLink href={b.link}><Picture media={media} sizes="(min-width: 1024px) 1024px, 100vw" priority={first} /></ImageLink>
          {b.caption ? <figcaption className="mt-2 text-center text-sm text-muted">{b.caption}</figcaption> : null}
        </figure>
      );
    }
    case "cta":
      if (b.variant === "discount") {
        const benefits = (b.pricingBenefits || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
        const offerImageId = b.mediaId ?? b.discountImageId;
        const offerImage = offerImageId ? ctx.media.get(offerImageId) : undefined;
        const offerImageSource = offerImage?.sources.at(-1);
        return (
          <section className="bg-[#f7f4ee] px-4 py-16 text-[#101513] sm:py-24">
            <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#0b664f]/15 bg-white shadow-[0_25px_80px_rgba(0,80,60,0.12)] lg:grid lg:grid-cols-[1.65fr_1fr]">
              <div className="relative min-h-[560px] overflow-hidden p-8 sm:p-12 lg:p-16">
                {/* Variantes otimizadas no upload; a imagem usa recorte editorial próprio do bloco. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {offerImageSource ? <img src={offerImageSource.url} alt={offerImage?.alt || ""} className="absolute inset-y-0 right-0 hidden h-full w-[48%] object-cover lg:block" loading="lazy" decoding="async" /> : null}
                <div className="relative z-10 max-w-xl lg:max-w-[55%]">
                  {b.pricingEyebrow ? <p className="flex items-center gap-5 text-xs font-bold uppercase tracking-[0.3em] text-[#08745a] after:h-px after:w-20 after:bg-[#8fa29a]">{b.pricingEyebrow}</p> : null}
                  <h2 className="mt-10 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">{b.heading}</h2>
                  {b.text ? <p className="mt-7 text-base leading-8 text-[#59635f] sm:text-lg">{b.text}</p> : null}
                  {benefits.length ? <ul className="mt-9 space-y-4 text-base sm:text-lg">{benefits.map((benefit) => <li key={benefit} className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#075e49] font-bold text-white">✓</span><span>{benefit}</span></li>)}</ul> : null}
                </div>
              </div>
              <div className="relative flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,#08745a_0%,#043f32_45%,#022c24_100%)] p-8 text-center text-white sm:p-12 lg:p-14">
                {b.discountBadge ? <div className="rounded-full border border-[#d9cfae] px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f7efd4]">{b.discountBadge}</div> : null}
                {b.discountLabel ? <p className="mt-12 flex items-center justify-center gap-5 text-xs font-bold uppercase tracking-[0.3em] text-white/90 before:h-px before:w-10 before:bg-white/60 after:h-px after:w-10 after:bg-white/60">{b.discountLabel}</p> : null}
                {b.discountPercent ? <p className="mt-7 font-serif text-[7rem] font-semibold leading-[0.8] tracking-[-0.08em] text-[#fffdf5] sm:text-[9rem]">{b.discountPercent}</p> : null}
                {b.discountSuffix ? <p className="mt-7 text-2xl font-semibold uppercase tracking-[0.16em] sm:text-3xl">{b.discountSuffix}</p> : null}
                {b.urgency ? <p className="mt-5 text-lg text-[#efe7d0]">{b.urgency}</p> : null}
                <div className="mt-10 [&_a]:!border-white [&_a]:!bg-white [&_a]:!text-[#064d3c] [&_button]:!border-white [&_button]:!bg-white [&_button]:!text-[#064d3c]"><CtaButton action={b.action} ctx={ctx} /></div>
              </div>
            </div>
          </section>
        );
      }
      if (b.variant === "pricing") {
        const benefits = (b.pricingBenefits || b.text || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
        return (
          <section className="bg-[#f7f4ee] px-4 py-16 text-[#101513] sm:py-24">
            <div className="mx-auto max-w-6xl">
              {b.pricingEyebrow ? <div className="mb-10 flex items-center justify-center gap-5 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#245c4d] before:h-px before:w-20 before:bg-[#8fa29a] after:h-px after:w-20 after:bg-[#8fa29a]">{b.pricingEyebrow}</div> : null}
              <div className="grid overflow-hidden rounded-3xl border border-[#008d68]/20 bg-white/70 shadow-[0_25px_80px_rgba(0,80,60,0.10)] md:grid-cols-2">
                <div className="p-8 sm:p-12 lg:p-16">
                  <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">{b.heading}</h2>
                  {benefits.length ? <ul className="mt-8 space-y-4 text-base text-[#4f5c57] sm:text-lg">{benefits.map((benefit) => <li key={benefit} className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#008d68]/10 font-bold text-[#008d68]">✓</span><span>{benefit}</span></li>)}</ul> : null}
                </div>
                <div className="relative border-t border-[#008d68]/15 p-8 sm:p-12 md:border-l md:border-t-0 lg:p-16">
                  {b.oldPrice ? <p className="text-xl text-[#6b7470] line-through sm:text-2xl">{b.oldPrice}</p> : null}
                  {b.price ? <p className="mt-2 text-5xl font-bold leading-none tracking-[-0.05em] text-[#008d68] sm:text-7xl">{b.price}</p> : null}
                  {b.installment ? <p className="mt-4 text-2xl text-[#173c32] sm:text-3xl">{b.installment}</p> : null}
                  {b.urgency ? <p className="mt-7 flex items-center gap-2 text-sm font-medium text-[#31594e]"><span aria-hidden="true">◷</span>{b.urgency}</p> : null}
                  <div className="mt-8"><CtaButton action={b.action} ctx={ctx} /></div>
                </div>
              </div>
            </div>
          </section>
        );
      }
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
            <ol className="card-grid">
              {b.items.map((it, i) => (
                <li key={i} className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  {stepLabelText(b, it, i, false) ? <span className="blk-accent text-sm font-semibold text-gold-700">{stepLabelText(b, it, i, false)}</span> : null}
                  <h3 className="mt-1 font-semibold text-brand-800">{it.title}</h3>
                  {it.text ? <p className="mt-1 text-sm text-muted">{it.text}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="card-grid">
              {b.items.map((it, i) => (
                <li key={i} className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  <h3 className="font-semibold text-brand-800">{it.title}</h3>
                  {it.text ? <p className="mt-1 text-sm text-muted">{it.text}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    case "care_flow":
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <CareFlow eyebrow={b.eyebrow} heading={b.heading} headingId={headingId}
            items={b.items.map((it, i) => ({ ...it, label: stepLabelText(b, it, i) }))} />
        </section>
      );
    case "steps_carousel":
      return (
        <section aria-labelledby={b.heading ? headingId : undefined} className={section}>
          <Heading text={b.heading} id={headingId} />
          <CardCarousel
            label={b.heading || "Passo a passo"}
            itemLabel="Etapa"
            autoplay={b.autoplay}
            intervalSeconds={b.intervalSeconds}
            items={b.items.map((it, i) => {
              const media = it.mediaId ? ctx.media.get(it.mediaId) : undefined;
              return (
                <article key={it.key} className="blk-card flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-raised text-center">
                  {media ? <div className="[&_img]:rounded-none"><Picture media={media} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" /></div> : null}
                  <div className="flex flex-1 flex-col gap-1 p-5">
                    {stepLabelText(b, it, i) ? (
                      <span className="blk-accent text-sm font-semibold tracking-wide text-gold-700 uppercase">{stepLabelText(b, it, i)}</span>
                    ) : null}
                    <h3 className="text-lg font-semibold text-brand-800">{it.title}</h3>
                    {it.text ? <p className="text-sm text-muted">{it.text}</p> : null}
                  </div>
                </article>
              );
            })}
          />
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
          {/* Duas colunas no computador; items-start: abrir uma pergunta não estica a vizinha. */}
          <div className="mx-auto grid max-w-3xl items-start gap-2 lg:max-w-none lg:grid-cols-2 lg:gap-x-6">
            {faqs.map((f) => (
              <details key={f.id} className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
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
          <ul className="card-grid">
            {items.map((e) =>
              b.type === "testimonial_list" ? (
                <li key={e.id} className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
                  <blockquote className="text-ink">“{String(e.data.quote ?? "")}”</blockquote>
                  {e.data.author_display ? <p className="mt-2 text-sm text-muted">— {String(e.data.author_display)}</p> : null}
                </li>
              ) : b.type === "team_list" ? (
                <li key={e.id} className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
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
          {b.layout === "carousel" ? (
            <CardCarousel
              label={b.heading || "Galeria de imagens"}
              itemLabel="Imagem"
              autoplay={b.autoplay}
              intervalSeconds={b.intervalSeconds}
              items={items.map((m) => (
                <ImageLink key={m.id} href={b.links?.[m.id]} className="w-full">
                  <Picture media={m} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
                </ImageLink>
              ))}
            />
          ) : (
            <ul className="card-grid [--card-gap:0.75rem]">
              {items.map((m) => (
                <li key={m.id}>
                  <ImageLink href={b.links?.[m.id]}><Picture media={m} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></ImageLink>
                </li>
              ))}
            </ul>
          )}
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
      <ul className="card-grid">
        {promos.map((p) => <PromotionCard key={p.entry.id} promotion={p} ctx={props.ctx} />)}
      </ul>
    </section>
  );
}

export function PromotionCard({ promotion: p, ctx }: { promotion: RenderContext["promotions"][number]; ctx: RenderContext }) {
  const cover = typeof p.entry.data.mediaId === "string" ? ctx.media.get(p.entry.data.mediaId) : undefined;
  return (
    <li className="blk-card rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-center">
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

type CarouselSlide = Extract<Block, { type: "banner_carousel" }>["slides"][number];

/** Um banner: imagem (com versão de celular) + painel de texto centralizado. */
function BannerSlide({
  desktop,
  mobile,
  slide,
  ctx,
  priority,
}: {
  desktop: RenderMedia;
  mobile?: RenderMedia;
  slide: CarouselSlide;
  ctx: RenderContext;
  priority: boolean;
}) {
  const largest = desktop.sources.at(-1)!;
  const hasText = !!(slide.title || slide.text || slide.action);
  const wholeSlide = slide.link && !slide.action;
  const picture = (
    <picture>
      {mobile ? (
        <source
          media="(max-width: 767px)"
          srcSet={mobile.sources.map((s) => `${s.url} ${s.width}w`).join(", ")}
          sizes="100vw"
          width={mobile.width ?? undefined}
          height={mobile.height ?? undefined}
        />
      ) : null}
      {/* Variantes já otimizadas no upload (dentro de <picture>, o lint não exige next/image). */}
      <img
        src={largest.url}
        srcSet={desktop.sources.map((s) => `${s.url} ${s.width}w`).join(", ")}
        sizes="(min-width: 1152px) 1152px, 100vw"
        alt={desktop.alt}
        width={desktop.width ?? undefined}
        height={desktop.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className="h-auto w-full object-cover sm:rounded-[var(--radius-card)]"
      />
    </picture>
  );
  const content = (
    <>
      {wholeSlide ? picture : <ImageLink href={slide.link}>{picture}</ImageLink>}
      {hasText ? (
        // Computador: painel centralizado sobre a imagem. Celular: sobre a parte
        // de baixo só quando há imagem própria (alta); com a imagem larga, o
        // painel vai abaixo para não cobri-la. Fundo quase opaco = contraste AA.
        <div
          className={`flex justify-center p-3 md:absolute md:inset-0 md:items-center md:p-6 ${
            mobile ? "absolute inset-x-0 bottom-0" : "bg-brand-900"
          }`}
        >
          <div className="w-full max-w-xl rounded-[var(--radius-card)] bg-brand-900/90 p-4 text-center text-white md:p-6">
            {slide.title ? <p className="font-display text-xl font-bold sm:text-3xl">{slide.title}</p> : null}
            {slide.text ? <p className="mt-1 text-sm text-white/90 sm:mt-2 sm:text-base">{slide.text}</p> : null}
            {slide.action ? (
              <div className="mt-3 flex justify-center sm:mt-4">
                <CtaButton action={slide.action} ctx={ctx} variant="onDark" location="banner" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
  // Sem botão, o banner inteiro é o link; com botão, só a imagem (link dentro de link é inválido).
  return wholeSlide ? (
    <ImageLink href={slide.link} className="relative">{content}</ImageLink>
  ) : (
    <div className="relative">{content}</div>
  );
}
