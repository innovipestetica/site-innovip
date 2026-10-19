"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Carrossel de cartões: 3 por vez no computador, 2 no tablet e 1 no celular,
 * avançando um cartão por vez na ordem cadastrada.
 * Acessibilidade (WCAG 2.2.2): passagem automática só com `autoplay`, botão
 * de pausar, pausa em hover/foco/aba oculta e nenhuma passagem automática
 * para quem pede menos movimento. Cartões fora da vista ficam `inert`.
 * Sem JavaScript, aparecem os primeiros cartões (o restante pede JS).
 */
const QUERIES = ["(min-width: 1024px)", "(min-width: 768px)"] as const;

function subscribeMedia(cb: () => void) {
  const mqs = [...QUERIES, "(prefers-reduced-motion: reduce)"].map((q) => window.matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", cb));
  return () => mqs.forEach((m) => m.removeEventListener("change", cb));
}
const perViewSnapshot = () => (window.matchMedia(QUERIES[0]).matches ? 3 : window.matchMedia(QUERIES[1]).matches ? 2 : 1);
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

export function CardCarousel({
  items,
  label,
  autoplay,
  intervalSeconds,
  itemLabel = "Item",
}: {
  items: ReactNode[];
  label: string;
  autoplay: boolean;
  intervalSeconds: number;
  /** Ex.: "Etapa", "Imagem" — usado em "Etapa 2 de 6". */
  itemLabel?: string;
}) {
  const count = items.length;
  const perView = Math.min(useSyncExternalStore(subscribeMedia, perViewSnapshot, () => 3), Math.max(count, 1));
  const reducedMotion = useSyncExternalStore(subscribeMedia, reducedSnapshot, () => true);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => true);
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const touchStart = useRef<number | null>(null);
  const regionId = useId();

  const maxIndex = Math.max(0, count - perView);
  const current = Math.min(index, maxIndex);
  const go = useCallback((i: number) => setIndex(i > maxIndex ? 0 : i < 0 ? maxIndex : i), [maxIndex]);

  const movable = maxIndex > 0;
  const playing = autoplay && movable && !userPaused && !reducedMotion;
  const running = playing && !hovering && !focusWithin && !hidden;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(current + 1), intervalSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [running, current, intervalSeconds, go]);

  if (count === 0) return null;
  const control =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface-raised text-lg text-brand-800 hover:bg-brand-50";

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={(e) => {
        if (!movable) return;
        if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
      }}
      onTouchStart={(e) => { touchStart.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const end = e.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined || !movable) return;
        if (end - start > 50) go(current - 1);
        else if (start - end > 50) go(current + 1);
      }}
    >
      <div className="overflow-hidden py-2">
        {/* div (não ul/li): os itens têm papel "group" de slide, o que quebraria a lista. */}
        <div
          id={regionId}
          aria-live={running ? "off" : "polite"}
          className={`flex transition-transform duration-500 ease-out motion-reduce:transition-none ${movable ? "" : "justify-center"}`}
          style={{ transform: `translateX(-${(current * 100) / perView}%)` }}
        >
          {items.map((item, i) => {
            const visible = i >= current && i < current + perView;
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="item"
                aria-label={`${itemLabel} ${i + 1} de ${count}`}
                aria-hidden={!visible}
                inert={!visible}
                className="flex w-full shrink-0 px-2 md:w-1/2 lg:w-1/3"
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {movable ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {autoplay && !reducedMotion ? (
            <button type="button" className={control} onClick={() => setUserPaused((v) => !v)}
              aria-label={userPaused ? "Continuar a passagem automática" : "Pausar a passagem automática"}>
              <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
            </button>
          ) : null}
          <button type="button" className={control} aria-controls={regionId} aria-label="Anterior" onClick={() => go(current - 1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <ul className="flex items-center">
            {Array.from({ length: maxIndex + 1 }, (_, i) => (
              <li key={i}>
                <button type="button" aria-controls={regionId} onClick={() => go(i)}
                  aria-label={`Mostrar a partir de ${itemLabel.toLowerCase()} ${i + 1}`}
                  aria-current={i === current ? "true" : undefined}
                  className="flex size-11 items-center justify-center">
                  <span aria-hidden="true" className={`block size-2.5 rounded-full ${i === current ? "bg-brand-700" : "bg-brand-300"}`} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={control} aria-controls={regionId} aria-label="Próximo" onClick={() => go(current + 1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
