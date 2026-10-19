"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Carrossel de banners acessível (WCAG 2.2.2 — pausar conteúdo em movimento):
 * - passa sozinho só se `autoplay` e se o sistema NÃO pede menos movimento;
 * - botão visível de pausar/continuar; pausa em hover, foco e aba oculta;
 * - setas, indicadores ("Banner 2 de 4"), teclado (← →) e deslizar no toque;
 * - banners fora da tela ficam `inert` e ocultos para leitores de tela;
 * - sem JavaScript, o primeiro banner aparece (HTML do servidor).
 */
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedMotionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

export function BannerCarousel({
  slides,
  label,
  autoplay,
  intervalSeconds,
}: {
  slides: ReactNode[];
  label: string;
  autoplay: boolean;
  intervalSeconds: number;
}) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => true);
  const regionId = useId();
  const touchStart = useRef<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Altura do banner visível (banners com formatos diferentes não deixam espaço vazio).
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  // "Tocando" = configurado para passar, sem pausa do usuário e sem pedido de menos movimento.
  const playing = autoplay && count > 1 && !userPaused && !reducedMotion;
  const running = playing && !hovering && !focusWithin && !hidden;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(index + 1), intervalSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [running, index, intervalSeconds, go]);

  if (count === 0) return null;

  const control =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface-raised text-lg text-brand-800 hover:bg-brand-50";

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={label}
      className="relative w-full"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      }}
      onTouchStart={(e) => { touchStart.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const end = e.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined || count < 2) return;
        if (end - start > 50) go(index - 1);
        else if (start - end > 50) go(index + 1);
      }}
    >
      <div
        className="overflow-hidden transition-[height] duration-500 ease-out motion-reduce:transition-none"
        style={height ? { height } : undefined}
      >
        <div
          id={regionId}
          // Mudanças automáticas não são anunciadas; manuais, sim.
          aria-live={running ? "off" : "polite"}
          className="flex items-start transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              role="group"
              aria-roledescription="banner"
              aria-label={`${i + 1} de ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className="w-full shrink-0"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 ? (
        // Controles abaixo da imagem: não cobrem o texto do banner.
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-3">
          {autoplay && !reducedMotion ? (
            <button
              type="button"
              className={control}
              aria-label={userPaused ? "Continuar a passagem dos banners" : "Pausar a passagem dos banners"}
              onClick={() => setUserPaused((v) => !v)}
            >
              <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
            </button>
          ) : null}
          <button type="button" className={control} aria-controls={regionId} aria-label="Banner anterior" onClick={() => go(index - 1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <ul className="flex items-center">
            {slides.map((_, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-controls={regionId}
                  aria-label={`Mostrar banner ${i + 1} de ${count}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => go(i)}
                  className="flex size-11 items-center justify-center"
                >
                  <span aria-hidden="true" className={`block size-2.5 rounded-full ${i === index ? "bg-brand-700" : "bg-brand-300"}`} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={control} aria-controls={regionId} aria-label="Próximo banner" onClick={() => go(index + 1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
