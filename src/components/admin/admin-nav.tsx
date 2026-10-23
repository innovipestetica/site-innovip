"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export const ADMIN_NAV: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Geral", items: [{ href: "/admin", label: "Início" }] },
  {
    group: "Páginas independentes",
    items: [
      { href: "/admin/conteudo/paginas-personalizadas", label: "Páginas personalizadas" },
    ],
  },
  {
    group: "Site",
    items: [
      { href: "/admin/conteudo/home", label: "Home" },
      { href: "/admin/conteudo/paginas", label: "Páginas" },
      { href: "/admin/conteudo/tratamentos", label: "Tratamentos" },
      { href: "/admin/conteudo/tecnologias", label: "Tecnologias" },
      { href: "/admin/taxonomias", label: "Categorias e objetivos" },
      { href: "/admin/conteudo/promocoes", label: "Promoções" },
      { href: "/admin/conteudo/blog", label: "Blog" },
      { href: "/admin/conteudo/faqs", label: "FAQs" },
      { href: "/admin/conteudo/equipe", label: "Equipe" },
      { href: "/admin/conteudo/depoimentos", label: "Depoimentos" },
    ],
  },
  {
    group: "Configuração",
    items: [
      { href: "/admin/midia", label: "Mídia" },
      { href: "/admin/configuracoes", label: "Configurações públicas" },
      { href: "/admin/redirecionamentos", label: "Redirecionamentos" },
      { href: "/admin/metricas-links", label: "Planilha de acessos" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel">
      {ADMIN_NAV.map((section) => (
        <div key={section.group} className="mb-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{section.group}</p>
          <ul>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm ${
                      active ? "bg-brand-50 font-semibold text-brand-900" : "text-ink hover:bg-brand-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Barra lateral fixa no desktop. */
export function AdminSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-surface-raised p-3 lg:block">
      <NavList />
    </aside>
  );
}

/** Menu recolhível no celular: aria-expanded, Escape fecha, foco controlado. */
export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 min-w-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
      >
        {open ? "Fechar menu" : "Menu"}
      </button>
      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 max-h-[80vh] overflow-y-auto border-b border-line bg-surface-raised p-3 shadow-lg"
      >
        <NavList onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
