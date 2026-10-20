"use client";

import { useEffect, useState } from "react";

export type SingleImageSlide = {
  url: string;
  srcSet?: string;
  alt: string;
  width?: number;
  height?: number;
};

export function SingleImageCarousel({
  slides,
  autoplay = true,
  intervalSeconds = 5,
  className,
}: {
  slides: SingleImageSlide[];
  autoplay?: boolean;
  intervalSeconds?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, intervalSeconds, paused, slides.length]);

  if (!slides.length) return null;
  const slide = slides[index] ?? slides[0]!;
  const move = (direction: number) => setIndex((current) => (current + direction + slides.length) % slides.length);

  return (
    <div className={className} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.url} srcSet={slide.srcSet} sizes="(max-width: 760px) calc(100vw - 40px), 520px" alt={slide.alt}
        width={slide.width} height={slide.height} loading="lazy" decoding="async" />
      {slides.length > 1 ? (
        <>
          <button type="button" aria-label="Imagem anterior" onClick={() => move(-1)}>‹</button>
          <button type="button" aria-label="Próxima imagem" onClick={() => move(1)}>›</button>
          <div role="group" aria-label="Escolher imagem">
            {slides.map((item, itemIndex) => (
              <button key={`${item.url}-${itemIndex}`} type="button" aria-label={`Ver imagem ${itemIndex + 1}`}
                aria-current={itemIndex === index ? "true" : undefined} onClick={() => setIndex(itemIndex)} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
