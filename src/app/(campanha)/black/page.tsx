import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { pageAttrs } from "@/lib/consent/tracking-config";
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
    title: "Acesso antecipado",
    text: "Saiba primeiro sobre novidades, agendas e experiências da Innovip.",
  },
  {
    icon: "sparkle",
    title: "Condições especiais",
    text: "Receba oportunidades selecionadas, criadas para quem acompanha a clínica de perto.",
  },
  {
    icon: "care",
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

function Icon({ name }: { name: (typeof benefits)[number]["icon"] }) {
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

function CtaLink({ className, location, children }: { className?: string; location: string; children: React.ReactNode }) {
  return (
    <Link
      href="/agendar-avaliacao"
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

export default function VipLandingPage() {
  return (
    <main id="conteudo" className={styles.page} {...pageAttrs("landing")}>
      <section className={styles.hero} aria-labelledby="vip-title">
        <Image
          src="/landing/lista-vip/hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.backgroundImage}
        />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <Link href="/" className={styles.logoLink} aria-label="Innovip — página inicial">
            <Logo size={86} priority className={styles.logo} />
          </Link>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Experiências que começam antes</p>
            <h1 id="vip-title">
              Seu acesso a uma experiência <em>mais exclusiva.</em>
            </h1>
            <p className={styles.heroText}>
              Entre para a lista VIP da Innovip e receba novidades e condições especiais em primeira mão.
            </p>
            <CtaLink className={styles.primaryButton} location="vip_hero">
              Entrar para a lista VIP
            </CtaLink>
          </div>
          <ul className={styles.trustList} aria-label="Diferenciais da lista VIP">
            <li><span aria-hidden="true">✓</span> Entrada gratuita</li>
            <li><span aria-hidden="true">◇</span> Canal oficial</li>
            <li><span aria-hidden="true">○</span> Saia quando quiser</li>
          </ul>
        </div>
      </section>

      <section className={styles.benefits} aria-labelledby="benefits-title">
        <div className={styles.container}>
          <SectionLabel>Benefícios da lista</SectionLabel>
          <h2 id="benefits-title">Um cuidado pensado para estar mais perto.</h2>
          <div className={styles.benefitGrid}>
            {benefits.map((benefit) => (
              <article key={benefit.title}>
                <div className={styles.iconWrap}><Icon name={benefit.icon} /></div>
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
          src="/landing/lista-vip/story.webp"
          alt=""
          fill
          sizes="100vw"
          className={styles.backgroundImage}
        />
        <div className={styles.storyShade} />
        <div className={`${styles.container} ${styles.storyGrid}`}>
          <div>
            <p className={styles.eyebrow}>Uma experiência em outro nível</p>
            <span className={styles.accentRule} aria-hidden="true" />
            <h2 id="story-title">Mais que acesso. Um convite para viver a Innovip.</h2>
          </div>
          <p className={styles.storyText}>
            A lista VIP aproxima você do universo Innovip: um espaço de cuidado, atenção e escolhas feitas com intenção. Sem promessas exageradas, apenas uma forma mais próxima de acompanhar o que preparamos.
          </p>
        </div>
      </section>

      <section className={styles.steps} aria-labelledby="steps-title">
        <div className={styles.container}>
          <SectionLabel>Como funciona</SectionLabel>
          <h2 id="steps-title">Três passos para ficar mais perto.</h2>
          <ol className={styles.stepGrid}>
            {steps.map((step) => (
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

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.faqInner}>
          <SectionLabel light>Perguntas frequentes</SectionLabel>
          <h2 id="faq-title">Tudo o que você precisa saber.</h2>
          <div className={styles.faqList}>
            {faqs.map((faq) => (
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
          <SectionLabel light>Seu próximo passo</SectionLabel>
          <h2>Entre para a <em>lista VIP</em>.</h2>
          <p>Fale com a equipe e seja uma das primeiras pessoas a acompanhar nossas novidades.</p>
          <CtaLink className={styles.primaryButton} location="vip_footer">
            Quero entrar para a lista
          </CtaLink>
          <small>Innovip Clínica de Estética · Atendimento individual e responsável.</small>
        </div>
      </footer>
    </main>
  );
}
