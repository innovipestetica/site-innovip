import { z } from "zod";

/**
 * Texto rico ESTRUTURADO (nunca HTML). Renderizado por componentes React,
 * que escapam todo o texto. Links só com protocolos seguros.
 */

/** https, mailto, tel ou caminho interno ("/..."; nunca "//"). */
export function isSafeHref(href: string): boolean {
  if (href.length > 500) return false;
  if (/^\/(?!\/)[a-z0-9\-/#?=&%._~]*$/i.test(href)) return true;
  if (/^tel:\+?[0-9]{8,15}$/.test(href)) return true;
  if (/^mailto:[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(href)) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const safeHrefSchema = z
  .string()
  .trim()
  .refine(isSafeHref, "Use https://, tel:, mailto: ou um caminho do site começando com /.");

const textLeaf = z.object({
  t: z.literal("text"),
  text: z.string().max(5000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});

const linkLeaf = z.object({
  t: z.literal("link"),
  text: z.string().min(1).max(300),
  href: safeHrefSchema,
});

export const inlineSchema = z.discriminatedUnion("t", [textLeaf, linkLeaf]);
export type InlineNode = z.infer<typeof inlineSchema>;

const inlines = z.array(inlineSchema).max(200);

export const richNodeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("p"), children: inlines }),
  z.object({ t: z.literal("h"), level: z.union([z.literal(2), z.literal(3)]), children: inlines }),
  z.object({
    t: z.literal("ul"),
    items: z.array(inlines).min(1).max(50),
  }),
  z.object({
    t: z.literal("ol"),
    items: z.array(inlines).min(1).max(50),
  }),
]);
export type RichNode = z.infer<typeof richNodeSchema>;

export const richTextSchema = z.array(richNodeSchema).max(200);
export type RichText = z.infer<typeof richTextSchema>;

/**
 * Converte o formato de edição (texto simples com marcações leves) em
 * RichText. Marcações aceitas no editor:
 *   ## Título / ### Subtítulo
 *   - item de lista / 1. item numerado
 *   **negrito**, *itálico*, [texto](https://link)
 * Parágrafos separados por linha em branco.
 */
export function parseRichText(source: string): RichText {
  const blocks = source.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const out: RichText = [];
  for (const raw of blocks) {
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const first = lines[0]!;
    if (/^###\s+/.test(first) && lines.length === 1) {
      out.push({ t: "h", level: 3, children: parseInline(first.replace(/^###\s+/, "")) });
    } else if (/^##\s+/.test(first) && lines.length === 1) {
      out.push({ t: "h", level: 2, children: parseInline(first.replace(/^##\s+/, "")) });
    } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push({ t: "ul", items: lines.map((l) => parseInline(l.replace(/^\s*[-*]\s+/, ""))) });
    } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push({ t: "ol", items: lines.map((l) => parseInline(l.replace(/^\s*\d+[.)]\s+/, ""))) });
    } else {
      out.push({ t: "p", children: parseInline(lines.join(" ")) });
    }
  }
  return out;
}

const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push({ t: "text", text: source.slice(last, idx) });
    if (m[1] !== undefined && m[2] !== undefined) {
      // Link inseguro vira texto simples (nunca um href perigoso).
      if (isSafeHref(m[2])) nodes.push({ t: "link", text: m[1], href: m[2] });
      else nodes.push({ t: "text", text: m[1] });
    } else if (m[3] !== undefined) {
      nodes.push({ t: "text", text: m[3], bold: true });
    } else if (m[4] !== undefined) {
      nodes.push({ t: "text", text: m[4], italic: true });
    }
    last = idx + m[0].length;
  }
  if (last < source.length) nodes.push({ t: "text", text: source.slice(last) });
  return nodes;
}

/** Converte RichText de volta para o formato de edição. */
export function richTextToSource(doc: RichText): string {
  const inline = (nodes: InlineNode[]) =>
    nodes
      .map((n) =>
        n.t === "link"
          ? `[${n.text}](${n.href})`
          : n.bold
            ? `**${n.text}**`
            : n.italic
              ? `*${n.text}*`
              : n.text,
      )
      .join("");
  return doc
    .map((node) => {
      switch (node.t) {
        case "p":
          return inline(node.children);
        case "h":
          return `${node.level === 2 ? "##" : "###"} ${inline(node.children)}`;
        case "ul":
          return node.items.map((i) => `- ${inline(i)}`).join("\n");
        case "ol":
          return node.items.map((i, n) => `${n + 1}. ${inline(i)}`).join("\n");
      }
    })
    .join("\n\n");
}

/** Texto puro (para resumos, SEO e busca). */
export function richTextToPlain(doc: RichText): string {
  const inline = (nodes: InlineNode[]) => nodes.map((n) => n.text).join("");
  return doc
    .map((node) =>
      node.t === "ul" || node.t === "ol" ? node.items.map(inline).join(" ") : inline(node.children),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
