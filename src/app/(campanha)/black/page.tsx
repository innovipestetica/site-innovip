import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { pageAttrs } from "@/lib/consent/tracking-config";
import { getPublishedEntry, loadPublicContext } from "@/lib/cms/public-data";
import { richTextToPlain } from "@/lib/cms/rich-text";
import type { Block, CtaAction, FeatureIcon } from "@/lib/cms/blocks";
import { YoutubeVideo } from "@/components/blocks/youtube-video";
import { SingleImageCarousel } from "@/components/blocks/single-image-carousel";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Lista VIP",
  description:
    "Entre para a lista VIP da Innovip e receba novidades, condições especiais e atendimento próximo.",
  alternates: { canonical: "/black" },
};

const benefits = [
  {
    icon: "clock",
    iconMediaId: undefined,
    title: "Acesso antecipado",
    text: "Saiba primeiro sobre novidades, agendas e experiências da Innovip.",
  },
  {
    icon: "sparkle",
    iconMediaId: undefined,
    title: "Condições especiais",
    text: "Receba oportunidades selecionadas, criadas para quem acompanha a clínica de perto.",
  },
  {
    icon: "care",
    iconMediaId: undefined,
    title: "Atendimento próximo",
    text: "Converse com a equipe para entender o cuidado mais adequado para o seu momento.",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Fale com a equipe",
    text: "Toque no botão e inicie uma conversa pelo canal oficial de atendimento.",
  },
  {
    number: "02",
    title: "Entre para a lista",
    text: "Diga que deseja fazer parte da lista VIP. A equipe confirma sua entrada.",
  },
  {
    number: "03",
    title: "Receba em primeira mão",
    text: "Acompanhe novidades e condições especiais compartilhadas pela Innovip.",
  },
] as const;

const faqs = [
  {
    question: "A lista VIP é gratuita?",
    answer:
      "Sim. Entrar para a lista não tem custo e não cria compromisso de compra ou contratação.",
  },
  {
    question: "Como entro para a lista?",
    answer:
      "Basta tocar em um dos botões da página. Você será direcionada ao canal de atendimento já configurado pela Innovip.",
  },
  {
    question: "O que vou receber?",
    answer:
      "Novidades da clínica, informações sobre experiências e condições especiais quando estiverem disponíveis.",
  },
  {
    question: "Posso sair quando quiser?",
    answer:
      "Sim. É só solicitar a saída pelo mesmo canal de atendimento, a qualquer momento.",
  },
] as const;

function Icon({ name }: { name: FeatureIcon }) {
  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (name === "sparkle") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
        <path d="m18.5 15 .6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4Z" />
      </svg>
    );
  }
  if (name === "shield") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.8-2.8 8-7 10-4.2-2-7-5.2-7-10V6l7-3Z" /><path d="m9 12 2 2 4-5" /></svg>;
  }
  if (name === "star") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z" /></svg>;
  }
  if (name === "leaf") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4C11 4 5 8 5 14c0 3 2 5 5 5 6 0 10-6 10-15Z" /><path d="M4 20c3-5 7-8 12-11" /></svg>;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z" />
      <path d="M9.5 11.5h5M12 9v5" />
    </svg>
  );
}

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`${styles.sectionLabel} ${light ? styles.sectionLabelLight : ""}`}>
      <span aria-hidden="true" />
      <p>{children}</p>
      <span aria-hidden="true" />
    </div>
  );
}

/** Marca trechos como {#RRGGBB texto}; o restante continua texto React escapado. */
function ColoredTitle({ text, fallback }: { text?: string; fallback: React.ReactNode }) {
  if (!text) return fallback;
  const parts: React.ReactNode[] = [];
  const pattern = /\{(#[0-9a-f]{6})\s+([^{}]+)\}/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<span key={`${index}-${match[1]}`} style={{ color: match[1] }}>{match[2]}</span>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
}

function CtaLink({ className, location, children, action }: { className?: string; location: string; children: React.ReactNode; action?: CtaAction }) {
  const href = action?.kind === "link" ? action.href : "/agendar-avaliacao";
  return (
    <Link
      href={href}
      className={className}
      data-cta="evaluation"
      data-cta-target="link"
      data-cta-location={location}
    >
      <span>{children}</span>
      <span aria-hidden="true" className={styles.arrow}>↗</span>
    </Link>
  );
}

export default async function VipLandingPage() {
  const editablePage = await getPublishedEntry("landing", "black");
  const pageText = (key: string, fallback: string) => {
    const value = editablePage?.data[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };
  const ctx = editablePage ? await loadPublicContext({
      blocks: editablePage.blocks,
      data: editablePage.data,
    }) : undefined;

  const hero = editablePage?.blocks.find((block) => block.type === "hero");
  const features = editablePage?.blocks.find((block) => block.type === "features");
  const story = editablePage?.blocks.find((block) => block.type === "rich_text");
  const editableSteps = editablePage?.blocks.find((block) => block.type === "steps");
  const editableFaqs = editablePage?.blocks.find((block) => block.type === "care_flow");
  const finalCta = editablePage?.blocks.find((block) => block.type === "cta");
  const videos = editablePage?.blocks.filter(
    (block): block is Extract<Block, { type: "rich_text" }> => block.type === "rich_text" && !!block.youtubeUrl,
  ) ?? [];
  const liveBenefits = features?.type === "features"
    ? features.items.map((item, index) => ({ ...item, icon: item.icon ?? benefits[index]?.icon ?? "care" as const }))
    : benefits;
  const liveSteps = editableSteps?.type === "steps"
    ? editableSteps.items.map((item, index) => ({ number: item.label || String(index + 1).padStart(2, "0"), title: item.title, text: item.text || "" }))
    : steps;
  const liveFaqs = editableFaqs?.type === "care_flow"
    ? editableFaqs.items.map((item) => ({ question: item.title, answer: item.text || "" }))
    : faqs;
  const backgroundUrl = (mediaId: string | undefined, fallback: string) => {
    const media = mediaId && ctx ? ctx.media.get(mediaId) : undefined;
    return media?.sources.at(-1)?.url ?? fallback;
  };
  const heroBackground = backgroundUrl(hero?.backdrop?.mediaId, "/landing/lista-vip/hero.webp");
  const storyBackground = backgroundUrl(story?.backdrop?.mediaId, "/landing/lista-vip/story.webp");
  const storySlides = story?.type === "rich_text"
    ? (story.carouselMediaIds ?? []).flatMap((mediaId) => {
        const media = ctx?.media.get(mediaId);
        const largest = media?.sources.at(-1);
        return media && largest ? [{
          url: largest.url,
          srcSet: media.sources.map((source) => `${source.url} ${source.width}w`).join(", "),
          alt: media.alt,
          width: media.width ?? undefined,
          height: media.height ?? undefined,
        }] : [];
      })
    : [];

  return (
    <main id="conteudo" className={styles.page} {...pageAttrs("landing")}>
      <section className={styles.hero} aria-labelledby="vip-title">
        <Image
          src={heroBackground}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.backgroundImage}
          style={{ objectPosition: hero?.backdrop?.position ?? "center" }}
        />
        <div className={styles.heroShade} style={{ opacity: hero?.backdrop ? hero.backdrop.overlay / 100 : 1 }} />
        <div className={styles.heroInner}>
          <Link href="/" className={styles.logoLink} aria-label="Innovip — página inicial">
            <Logo size={86} priority className={styles.logo} />
          </Link>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{pageText("heroEyebrow", "Experiências que começam antes")}</p>
            <h1 id="vip-title"><ColoredTitle text={hero?.heading} fallback={<>Seu acesso a uma experiência <em>mais exclusiva.</em></>} /></h1>
            <p className={styles.heroText}>
              {hero?.subheading ?? "Entre para a lista VIP da Innovip e receba novidades e condições especiais em primeira mão."}
            </p>
            <CtaLink className={styles.primaryButton} location="vip_hero" action={hero?.primary}>
              {hero?.primary?.label ?? "Entrar para a lista VIP"}
            </CtaLink>
          </div>
          <ul className={styles.trustList} aria-label="Diferenciais da lista VIP">
            <li><span aria-hidden="true">✓</span> {pageText("trustItem1", "Entrada gratuita")}</li>
            <li><span aria-hidden="true">◇</span> {pageText("trustItem2", "Canal oficial")}</li>
            <li><span aria-hidden="true">○</span> {pageText("trustItem3", "Saia quando quiser")}</li>
          </ul>
        </div>
      </section>

      <section className={styles.benefits} aria-labelledby="benefits-title">
        <div className={styles.container}>
          <SectionLabel>{pageText("benefitsLabel", "Benefícios da lista")}</SectionLabel>
          <h2 id="benefits-title"><ColoredTitle text={features?.heading} fallback="Um cuidado pensado para estar mais perto." /></h2>
          <div className={`${styles.benefitGrid} ${liveBenefits.length === 4 ? styles.benefitGridFour : ""}`}>
            {liveBenefits.map((benefit) => (
              <article key={benefit.title}>
                <div className={styles.iconWrap}>
                  {benefit.iconMediaId && ctx?.media.get(benefit.iconMediaId)?.sources.at(-1)?.url ? (
                    <Image src={ctx.media.get(benefit.iconMediaId)!.sources.at(-1)!.url} alt="" width={40} height={40} />
                  ) : <Icon name={benefit.icon} />}
                </div>
                <h3>{benefit.title}</h3>
                <span className={styles.accentRule} aria-hidden="true" />
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.story} aria-labelledby="story-title">
        <Image
          src={storyBackground}
          alt=""
          fill
          sizes="100vw"
          className={styles.backgroundImage}
          style={{ objectPosition: story?.backdrop?.position ?? "center" }}
        />
        <div className={styles.storyShade} style={{ opacity: story?.backdrop ? story.backdrop.overlay / 100 : 1 }} />
        <div className={`${styles.container} ${styles.storyGrid}`}>
          <div>
            <p className={styles.eyebrow}>{pageText("storyEyebrow", "Uma experiência em outro nível")}</p>
            <span className={styles.accentRule} aria-hidden="true" />
            <h2 id="story-title"><ColoredTitle text={story?.heading} fallback="Mais que acesso. Um convite para viver a Innovip." /></h2>
          </div>
          {storySlides.length ? (
            <SingleImageCarousel slides={storySlides} autoplay={story?.carouselAutoplay ?? true}
              intervalSeconds={story?.carouselIntervalSeconds ?? 5} className={styles.storyCarousel} />
          ) : (
            <p className={styles.storyText}>
              {story?.type === "rich_text" ? richTextToPlain(story.body) : "A lista VIP aproxima você do universo Innovip: um espaço de cuidado, atenção e escolhas feitas com intenção. Sem promessas exageradas, apenas uma forma mais próxima de acompanhar o que preparamos."}
            </p>
          )}
        </div>
      </section>

      <section className={styles.steps} aria-labelledby="steps-title">
        <div className={styles.container}>
          <SectionLabel>{pageText("stepsLabel", "Como funciona")}</SectionLabel>
          <h2 id="steps-title"><ColoredTitle text={editableSteps?.heading} fallback="Três passos para ficar mais perto." /></h2>
          <ol className={styles.stepGrid}>
            {liveSteps.map((step) => (
              <li key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <span className={styles.accentRule} aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {videos.map((video) => (
        <section key={video.id} className={styles.videoSection}>
          {video.heading ? <h2><ColoredTitle text={video.heading} fallback={video.heading} /></h2> : null}
          <YoutubeVideo url={video.youtubeUrl!} title={video.heading} aspect={video.youtubeAspect} />
        </section>
      ))}

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.faqInner}>
          <SectionLabel light>{pageText("faqLabel", "Perguntas frequentes")}</SectionLabel>
          <h2 id="faq-title"><ColoredTitle text={editableFaqs?.heading} fallback="Tudo o que você precisa saber." /></h2>
          <div className={styles.faqList}>
            {liveFaqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  <span>{faq.question}</span>
                  <span className={styles.plus} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.finalCta}>
        <div className={styles.finalCtaGlow} />
        <div className={styles.finalCtaInner}>
          <SectionLabel light>{pageText("footerEyebrow", "Seu próximo passo")}</SectionLabel>
          <h2><ColoredTitle text={finalCta?.heading} fallback={<>Entre para a <em>lista VIP</em>.</>} /></h2>
          <p>{finalCta?.text ?? "Fale com a equipe e seja uma das primeiras pessoas a acompanhar nossas novidades."}</p>
          <CtaLink className={styles.primaryButton} location="vip_footer" action={finalCta?.action}>
            {finalCta?.action.label ?? "Quero entrar para a lista"}
          </CtaLink>
          <small>{pageText("footerNote", "Innovip Clínica de Estética · Atendimento individual e responsável.")}</small>
        </div>
      </footer>
    </main>
  );
}
