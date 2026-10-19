import type { ReactNode } from "react";
import type { FLOW_ICON_KEYS } from "@/lib/cms/blocks";

/**
 * Ícones do bloco "Fluxo do atendimento" (traço, 24×24, cor = currentColor).
 * Lista fechada: o painel só oferece estes nomes.
 */
export const FLOW_ICONS = {
  "calendario-relogio": {
    label: "Calendário com relógio",
    paths: (
      <>
        <path d="M20.5 9V6.5a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H10" />
        <path d="M8 2.5v4M16 2.5v4M3.5 10h7" />
        <circle cx="16.5" cy="16.5" r="5" />
        <path d="M16.5 14.3v2.4l1.6 1" />
      </>
    ),
  },
  "pessoa-conversa": {
    label: "Pessoa e balão de conversa",
    paths: (
      <>
        <circle cx="8" cy="10.5" r="3" />
        <path d="M2.5 20.5a5.5 5.5 0 0 1 11 0" />
        <path d="M14 3h6.5a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-2.8L15 12.8v-2.3h-1a1.5 1.5 0 0 1-1.5-1.5V4.5A1.5 1.5 0 0 1 14 3z" />
        <path d="M15.3 6.8h.01M17.3 6.8h.01M19.3 6.8h.01" />
      </>
    ),
  },
  "documento-mais": {
    label: "Documento com símbolo de adição",
    paths: (
      <>
        <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
        <path d="M14 2.5V8h5.5" />
        <path d="M12 11.5v6M9 14.5h6" />
      </>
    ),
  },
  "maos-coracao": {
    label: "Mãos acolhendo um coração",
    paths: (
      <>
        <path d="M12 12.8c-2.6-1.7-4.2-3.1-4.2-4.8 0-1.5 1.1-2.5 2.4-2.5.8 0 1.4.4 1.8 1 .4-.6 1-1 1.8-1 1.3 0 2.4 1 2.4 2.5 0 1.7-1.6 3.1-4.2 4.8z" />
        <path d="M2.5 12.5l3.6 5.2a3 3 0 0 0 2.5 1.3H11" />
        <path d="M21.5 12.5l-3.6 5.2a3 3 0 0 1-2.5 1.3H13" />
        <path d="M5.4 16.2l1.8-1.4a1.7 1.7 0 0 1 2.2.1l1.8 1.7" />
        <path d="M18.6 16.2l-1.8-1.4a1.7 1.7 0 0 0-2.2.1l-1.8 1.7" />
      </>
    ),
  },
  brilho: {
    label: "Brilho",
    paths: (
      <>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </>
    ),
  },
  "escudo-check": {
    label: "Escudo com confirmação",
    paths: (
      <>
        <path d="M12 2.5l7.5 3v6c0 4.5-3.2 8.3-7.5 10-4.3-1.7-7.5-5.5-7.5-10v-6z" />
        <path d="M8.7 12.2l2.3 2.3 4.4-4.6" />
      </>
    ),
  },
  coracao: {
    label: "Coração",
    paths: <path d="M12 20.5C6 16.6 2.5 13.4 2.5 9.3 2.5 6.3 4.8 4 7.6 4c1.8 0 3.4.9 4.4 2.3C13 4.9 14.6 4 16.4 4c2.8 0 5.1 2.3 5.1 5.3 0 4.1-3.5 7.3-9.5 11.2z" />,
  },
  telefone: {
    label: "Telefone",
    paths: <path d="M21 16.6v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 3.9 2 2 0 0 1 3.1 1.7h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7 9.5a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  },
} as const satisfies Record<(typeof FLOW_ICON_KEYS)[number], { label: string; paths: ReactNode }>;

export type FlowIconName = keyof typeof FLOW_ICONS;
export const FLOW_ICON_NAMES = Object.keys(FLOW_ICONS) as FlowIconName[];

export function FlowIcon({ name, className }: { name: FlowIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={className}>
      {FLOW_ICONS[name].paths}
    </svg>
  );
}
