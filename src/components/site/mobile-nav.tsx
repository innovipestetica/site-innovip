"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Item = { label: string; href: string };

type Cta = { href: string; external: boolean; label: string; mode: string };

/**
 * Menu móvel: botão com aria-expanded/aria-controls, Escape fecha e devolve
 * o foco, primeiro link recebe foco ao abrir, fecha ao navegar.
 */
export function MobileNav({ items, cta }: { items: Item[]; cta: Cta }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fecha ao trocar de página.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] px-3 font-semibold text-brand-800 hover:bg-brand-50"
      >
        <span aria-hidden="true" className="mr-2 text-lg leading-none">{open ? "✕" : "☰"}</span>
        {open ? "Fechar" : "Menu"}
      </button>
      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-b border-line bg-surface-raised px-4 pb-4 shadow-lg"
      >
        <nav aria-label="Principal (celular)">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="flex min-h-12 items-center border-b border-line text-base font-semibold text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {cta.external ? (
          <a href={cta.href} target="_blank" rel="noopener noreferrer" data-cta="evaluation" data-cta-target={cta.mode} data-cta-location="mobile_menu"
            className="mt-4 flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 font-semibold text-white">
            {cta.label}<span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <Link href={cta.href} data-cta="evaluation" data-cta-target={cta.mode} data-cta-location="mobile_menu"
            className="mt-4 flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 font-semibold text-white">
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
