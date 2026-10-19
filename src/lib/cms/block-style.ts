import type { CSSProperties } from "react";
import type { BlockStyle } from "./blocks";

/**
 * Cores escolhidas no painel para um bloco. O site aplica por variáveis CSS
 * (ver "Cores por bloco" em globals.css); cada cor só vale se foi escolhida.
 */
export const STYLE_FIELDS: { key: keyof BlockStyle; label: string; hint: string }[] = [
  { key: "background", label: "Fundo do bloco", hint: "Cor atrás de todo o bloco." },
  { key: "card", label: "Fundo dos cartões", hint: "Caixas internas (etapas, diferenciais, tratamentos…)." },
  { key: "heading", label: "Títulos", hint: "Título da seção (e dos cartões, se “Títulos dos cartões” ficar no padrão)." },
  { key: "cardHeading", label: "Títulos dos cartões", hint: "Use quando o fundo dos cartões for bem diferente do fundo do bloco." },
  { key: "text", label: "Textos", hint: "Parágrafos, descrições e listas." },
  { key: "accent", label: "Destaques", hint: "Etiquetas como “Etapa 1”, linhas e detalhes decorativos." },
];

/** Paleta da marca (atalhos no editor). */
export const BRAND_SWATCHES = [
  { hex: "#ffffff", name: "Branco" },
  { hex: "#fbf8f2", name: "Creme claro" },
  { hex: "#f6edda", name: "Creme" },
  { hex: "#eef7f3", name: "Verde claro" },
  { hex: "#e5c88b", name: "Dourado claro" },
  { hex: "#8a6a2a", name: "Dourado" },
  { hex: "#41957d", name: "Verde da logo" },
  { hex: "#2b6b59", name: "Verde" },
  { hex: "#22574a", name: "Verde escuro" },
  { hex: "#183f35", name: "Verde profundo" },
  { hex: "#1e2b27", name: "Quase preto" },
  { hex: "#55625e", name: "Cinza" },
];

const VAR: Record<keyof BlockStyle, string> = {
  background: "--blk-bg",
  card: "--blk-card",
  heading: "--blk-heading",
  cardHeading: "--blk-card-heading",
  text: "--blk-text",
  accent: "--blk-accent",
};

/** Atributos do invólucro do bloco: classe, variáveis e marcadores data-*. */
export function blockStyleAttrs(style: BlockStyle | undefined) {
  if (!style) return null;
  const vars: Record<string, string> = {};
  const data: Record<string, string> = {};
  for (const key of Object.keys(VAR) as (keyof BlockStyle)[]) {
    const value = style[key];
    if (!value) continue;
    vars[VAR[key]] = value;
    data[`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = "";
  }
  if (Object.keys(vars).length === 0) return null;
  return { className: "blk", style: vars as CSSProperties, ...data };
}

// ---------------------------------------------------------------------------
// Contraste WCAG 2.x
// ---------------------------------------------------------------------------
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

const PAGE_BG = "#fbf8f2";
const CARD_BG = "#ffffff";
const DEFAULT_HEADING = "#22574a";
const DEFAULT_TEXT = "#1e2b27";
const DEFAULT_ACCENT = "#8a6a2a";

/**
 * Avisos de leitura (WCAG AA), contra o fundo do bloco e o dos cartões:
 * textos e etiquetas ≥ 4,5:1; título da seção ≥ 3:1 (texto grande); títulos
 * dos cartões ≥ 4,5:1 (são menores).
 */
export function styleWarnings(style: BlockStyle | undefined): string[] {
  if (!style) return [];
  const bg = style.background ?? PAGE_BG;
  const card = style.card ?? CARD_BG;
  const heading = style.heading ?? DEFAULT_HEADING;
  const cardHeading = style.cardHeading ?? heading;
  const text = style.text ?? DEFAULT_TEXT;
  const accent = style.accent ?? DEFAULT_ACCENT;
  const out: string[] = [];
  const check = (fg: string, back: string, min: number, what: string, where: string) => {
    const r = contrastRatio(fg, back);
    if (r < min) out.push(`${what} sobre ${where}: contraste ${r.toFixed(1)}:1 (mínimo ${min}:1). Pode ficar difícil de ler.`);
  };
  if (style.background || style.heading) check(heading, bg, 3, "Títulos", "o fundo do bloco");
  if (style.background || style.text) check(text, bg, 4.5, "Textos", "o fundo do bloco");
  if (style.card || style.heading || style.cardHeading) check(cardHeading, card, 4.5, "Títulos dos cartões", "os cartões");
  if (style.card || style.text) check(text, card, 4.5, "Textos", "os cartões");
  if (style.background || style.accent) check(accent, bg, 4.5, "Destaques (ex.: “Etapa 01”)", "o fundo do bloco");
  if (style.card || style.accent) check(accent, card, 4.5, "Destaques (ex.: “Etapa 01”)", "os cartões");
  return out;
}
