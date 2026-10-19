"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlowIcon, type FlowIconName } from "./flow-icons";

type Item = { key: string; icon: FlowIconName; title: string; text?: string; /** "Etapa 01" já resolvido (null = sem etiqueta). */ label: string | null };
type Segment = { d: string; arrow: string };

const LG_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3",
  6: "lg:grid-cols-3",
};

/**
 * "Fluxo do atendimento": cartões com ícone sobre a borda e uma linha dourada
 * contínua (curvas Bézier) ligando as etapas, com setas e números.
 * - A linha é calculada pelas posições reais dos ícones/cartões (ResizeObserver):
 *   na mesma linha, um arco por cima dos cartões; quando a próxima etapa está
 *   abaixo, uma curva pelo espaço entre as fileiras. Nunca passa sobre texto.
 * - Entrada: título, cartões em sequência e linha desenhada progressivamente
 *   (Intersection Observer). Sem animação com "reduzir movimento" e sem JS
 *   (tudo aparece pronto).
 */
export function CareFlow({ eyebrow, heading, headingId, items }: { eyebrow?: string; heading?: string; headingId: string; items: Item[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // "armed": escondido aguardando entrar na tela; "shown": animado/visível.
  const [phase, setPhase] = useState<"static" | "armed" | "shown">("static");

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const origin = list.getBoundingClientRect();
    const cards = [...list.querySelectorAll<HTMLElement>("[data-flow-card]")];
    const icons = [...list.querySelectorAll<HTMLElement>("[data-flow-icon]")];
    const pts = icons.map((el, i) => {
      const r = el.getBoundingClientRect();
      const c = cards[i]!.getBoundingClientRect();
      return {
        x: r.left - origin.left + r.width / 2,
        y: r.top - origin.top + r.height / 2,
        r: r.width / 2,
        bottom: c.bottom - origin.top,
      };
    });
    const segs: Segment[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      let d: string;
      let end: { x: number; y: number };
      let tangent: { x: number; y: number };
      if (Math.abs(a.y - b.y) < 8 && b.x > a.x) {
        // Mesma fileira: arco por cima, do ícone atual ao próximo.
        const sx = a.x + a.r + 6;
        const ex = b.x - b.r - 10;
        const lift = Math.min(46, (ex - sx) * 0.35 + 18);
        const c1 = { x: sx + (ex - sx) * 0.3, y: a.y - lift };
        const c2 = { x: ex - (ex - sx) * 0.3, y: b.y - lift };
        d = `M ${sx} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${ex} ${b.y}`;
        end = { x: ex, y: b.y };
        tangent = { x: ex - c2.x, y: b.y - c2.y };
      } else {
        // Próxima etapa abaixo: sai do pé do cartão e chega por cima do ícone.
        const sy = a.bottom + 6;
        const ey = b.y - b.r - 10;
        const mid = (sy + ey) / 2;
        d = `M ${a.x} ${sy} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${ey}`;
        end = { x: b.x, y: ey };
        tangent = { x: 0, y: 1 };
      }
      const len = Math.hypot(tangent.x, tangent.y) || 1;
      const ux = tangent.x / len;
      const uy = tangent.y / len;
      // Seta: duas pernas de 7px a ±32° da direção da curva.
      const leg = (ang: number) => {
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        return { x: end.x - 7 * (ux * cos - uy * sin), y: end.y - 7 * (ux * sin + uy * cos) };
      };
      const l = leg(0.56);
      const r = leg(-0.56);
      segs.push({ d, arrow: `M ${l.x} ${l.y} L ${end.x} ${end.y} L ${r.x} ${r.y}` });
    }
    setSegments(segs);
    setBox({ w: origin.width, h: origin.height });
  }, []);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure, items.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) return; // já visível: sem esconder
    setPhase("armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = phase === "armed";
  // Transição só na entrada (esconder antes de aparecer é instantâneo).
  const animate = phase === "shown";
  const reveal = (delay: number) => ({
    className: `${animate ? "transition-[opacity,transform] duration-700 ease-out" : ""} ${hidden ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"}`,
    style: animate ? { transitionDelay: `${delay}ms` } : undefined,
  });
  const lineDelay = (i: number) => 450 + i * 350;

  return (
    <div ref={rootRef}>
      <div className={`mb-16 text-center ${reveal(0).className}`} style={reveal(0).style}>
        {eyebrow ? <p className="blk-accent text-xs font-semibold tracking-[0.2em] text-gold-700 uppercase">{eyebrow}</p> : null}
        {heading ? <h2 id={headingId} className="mt-2 text-3xl font-bold text-brand-800 sm:text-4xl">{heading}</h2> : null}
        <span aria-hidden="true" className="blk-accent-bg mx-auto mt-4 block h-0.5 w-14 rounded-full bg-gold-500" />
      </div>

      <div className="relative">
        <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 overflow-visible"
          width={box.w} height={box.h} viewBox={`0 0 ${box.w || 1} ${box.h || 1}`}>
          {segments.map((s, i) => (
            <g key={i} className="[color:var(--blk-accent,var(--color-gold-500))]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d={s.d} strokeWidth={2} pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: hidden ? 1 : 0,
                  transition: animate ? `stroke-dashoffset 600ms ease-in-out ${lineDelay(i)}ms` : undefined,
                }} />
              <path d={s.arrow} strokeWidth={2}
                style={{ opacity: hidden ? 0 : 1, transition: animate ? `opacity 200ms ease-out ${lineDelay(i) + 550}ms` : undefined }} />
            </g>
          ))}
        </svg>

        <ol ref={listRef} className={`relative grid grid-cols-1 gap-x-12 gap-y-20 pt-8 md:grid-cols-2 md:gap-y-28 lg:gap-y-20 ${LG_COLS[items.length] ?? "lg:grid-cols-4"}`}>
          {items.map((it, i) => (
            <li key={it.key} className={`flex ${reveal(150 + i * 150).className}`} style={reveal(150 + i * 150).style}>
              <div data-flow-card
                className="blk-card group relative flex w-full flex-col items-center rounded-[var(--radius-card)] border border-line bg-surface-raised px-6 pt-14 pb-8 text-center shadow-sm transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-[5px] hover:shadow-xl motion-reduce:hover:translate-y-0">
                <div data-flow-icon
                  className="absolute -top-9 left-1/2 flex size-[4.5rem] -translate-x-1/2 items-center justify-center rounded-full border-2 border-gold-300 bg-brand-50 text-brand-800 shadow-sm transition-[background-color,border-color,transform] duration-300 group-hover:scale-105 group-hover:border-gold-500 group-hover:bg-gold-100">
                  <FlowIcon name={it.icon} className="size-8" />
                  <span aria-hidden="true"
                    className="blk-accent-bg absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-gold-700 text-xs font-bold text-white ring-2 ring-surface">
                    {i + 1}
                  </span>
                </div>
                {it.label ? (
                  <p className="blk-accent text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">{it.label}</p>
                ) : null}
                <h3 className="mt-2 text-xl font-bold text-brand-800">{it.title}</h3>
                {it.text ? <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{it.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
