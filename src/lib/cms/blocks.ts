import { z } from "zod";
import { richTextSchema, safeHrefSchema } from "./rich-text";

/**
 * Biblioteca FECHADA de blocos do CMS — schema_version 1.
 *
 * - Nenhum bloco aceita HTML, JavaScript ou scripts.
 * - Referências seguem a convenção do banco: entryId/entryIds para
 *   conteúdos e mediaId/mediaIds para mídias. O banco extrai esses campos e
 *   grava com FK (ver private.cms_extract_ids).
 * - BLOCK_TYPES precisa bater com private.cms_blocks_are_valid (teste
 *   unitário confere a migração).
 * - Mudança incompatível de formato = nova schema_version + migração dos
 *   conteúdos salvos.
 */
export const CURRENT_SCHEMA_VERSION = 1;

const uuid = z.uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const blockId = z.string().regex(/^[a-z0-9]{6,24}$/);

/** Ação de um botão: sem telefone ou URL fixos dentro do bloco. */
export const ctaActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("evaluation"), label: shortText(40) }), // destino nas Configurações públicas
  z.object({ kind: z.literal("whatsapp"), label: shortText(40) }), // número das configurações
  z.object({ kind: z.literal("link"), label: shortText(40), href: safeHrefSchema }),
]);
export type CtaAction = z.infer<typeof ctaActionSchema>;

/** Link opcional ao clicar numa imagem (mesmas regras dos links dos botões). */
const imageLink = safeHrefSchema.optional();

const listItem = z.object({ title: shortText(80), text: optionalText(400) });

export const blockSchemas = {
  hero: z.object({
    heading: shortText(120),
    subheading: optionalText(300),
    mediaId: uuid.optional(),
    imageLink,
    primary: ctaActionSchema.optional(),
    secondary: ctaActionSchema.optional(),
  }),
  /**
   * Carrossel de banners. Acessibilidade (WCAG 2.2.2): passagem automática
   * com botão de pausa, pausa em hover/foco/aba oculta e desligada com
   * "reduzir movimento". Imagem do celular em `mobile.mediaId` (o banco
   * extrai e valida qualquer chave mediaId).
   */
  banner_carousel: z.object({
    label: optionalText(80),
    slides: z
      .array(
        z.object({
          key: blockId,
          mediaId: uuid,
          mobile: z.object({ mediaId: uuid.optional() }).optional(),
          title: optionalText(120),
          text: optionalText(240),
          action: ctaActionSchema.optional(),
          link: imageLink,
        }),
      )
      .min(1)
      .max(8),
    autoplay: z.boolean().default(true),
    intervalSeconds: z.union([z.literal(5), z.literal(6), z.literal(8), z.literal(10)]).default(6),
  }),
  rich_text: z.object({
    heading: optionalText(120),
    body: richTextSchema.min(1),
  }),
  image: z.object({
    mediaId: uuid,
    caption: optionalText(200),
    link: imageLink,
  }),
  cta: z.object({
    heading: shortText(120),
    text: optionalText(300),
    action: ctaActionSchema,
  }),
  features: z.object({
    heading: optionalText(120),
    items: z.array(listItem).min(1).max(12),
  }),
  steps: z.object({
    heading: optionalText(120),
    items: z.array(listItem).min(1).max(12),
  }),
  notice: z.object({
    tone: z.enum(["info", "important"]),
    text: shortText(500),
  }),
  faq_list: z.object({
    heading: optionalText(120),
    entryIds: z.array(uuid).min(1).max(30),
  }),
  treatment_list: z.object({
    heading: optionalText(120),
    entryIds: z.array(uuid).min(1).max(24),
  }),
  category_list: z.object({
    heading: optionalText(120),
  }),
  concern_list: z.object({
    heading: optionalText(120),
    area: z.enum(["facial", "corporal"]).optional(),
  }),
  promotion_list: z.object({
    heading: optionalText(120),
    limit: z.number().int().min(1).max(12).default(6),
  }),
  testimonial_list: z.object({
    heading: optionalText(120),
    entryIds: z.array(uuid).min(1).max(12),
  }),
  team_list: z.object({
    heading: optionalText(120),
    entryIds: z.array(uuid).min(1).max(24),
  }),
  gallery: z.object({
    heading: optionalText(120),
    mediaIds: z.array(uuid).min(1).max(24),
    /** Link por imagem: chave = id da imagem. */
    links: z.record(uuid, safeHrefSchema).optional(),
  }),
  contact: z.object({
    heading: optionalText(120),
    showMap: z.boolean().default(true),
    showForm: z.boolean().default(true),
  }),
} as const;

export type BlockType = keyof typeof blockSchemas;
export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export type Block = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]> & { id: string; type: K };
}[BlockType];

type BlockVariant = z.ZodObject<{ id: typeof blockId; type: z.ZodLiteral<BlockType> }>;

export const blockSchema = z.discriminatedUnion(
  "type",
  BLOCK_TYPES.map((type) =>
    blockSchemas[type].extend({ id: blockId, type: z.literal(type) }),
  ) as unknown as [BlockVariant, ...BlockVariant[]],
) as unknown as z.ZodType<Block>;

export const blocksSchema = z.array(blockSchema).max(60);

/** Rótulos e ajuda exibidos no editor do painel. */
export const BLOCK_META: Record<BlockType, { label: string; help: string }> = {
  hero: { label: "Destaque (hero)", help: "Título principal, subtítulo, imagem e botões." },
  banner_carousel: {
    label: "Carrossel de banners",
    help: "Vários banners que passam sozinhos (com pausa) ou pelas setas. Não coloque texto importante só dentro da imagem e não deixe informação essencial apenas no carrossel.",
  },
  rich_text: { label: "Texto", help: "Parágrafos, subtítulos, listas e links." },
  image: { label: "Imagem", help: "Uma imagem da biblioteca de Mídia." },
  cta: { label: "Chamada para ação", help: "Convite com um botão (avaliação, WhatsApp ou link)." },
  features: { label: "Diferenciais", help: "Itens curtos e verificáveis." },
  steps: { label: "Passo a passo", help: "Como funciona, em etapas." },
  notice: { label: "Aviso", help: "Ex.: necessidade de avaliação individual." },
  faq_list: { label: "Perguntas frequentes", help: "Escolha FAQs publicadas." },
  treatment_list: { label: "Tratamentos em destaque", help: "Escolha tratamentos publicados." },
  category_list: { label: "Categorias", help: "Lista as categorias publicadas." },
  concern_list: { label: "O que você deseja tratar?", help: "Lista os objetivos publicados." },
  promotion_list: { label: "Promoções vigentes", help: "Mostra só promoções dentro do prazo." },
  testimonial_list: { label: "Depoimentos", help: "Somente depoimentos com autorização registrada." },
  team_list: { label: "Equipe", help: "Escolha profissionais publicados." },
  gallery: { label: "Galeria", help: "Várias imagens da biblioteca de Mídia." },
  contact: { label: "Contato", help: "Canais, mapa (com consentimento) e formulário." },
};

/** Gera id curto para um bloco novo. */
export function newBlockId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}
