import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { blocksSchema, CURRENT_SCHEMA_VERSION, type Block, type BlockType } from "./blocks";

export type ContentType = Database["public"]["Enums"]["content_type"];
export type LifecycleStatus = Database["public"]["Enums"]["lifecycle_status"];

type TypeMeta = {
  label: string;
  plural: string;
  /** Segmento da rota do painel: /admin/conteudo/<segment>. */
  segment: string;
  /** Prefixo público (null = sem página própria). */
  publicPrefix: string | null;
  /** Usa blocos? (FAQ, equipe e depoimento são só campos.) */
  usesBlocks: boolean;
  /** Blocos permitidos neste tipo. */
  allowedBlocks: BlockType[];
  /** Começa como noindex (campanhas). */
  defaultNoindex: boolean;
};

const ALL_BLOCKS: BlockType[] = [
  "hero", "rich_text", "image", "cta", "features", "steps", "notice", "faq_list",
  "treatment_list", "category_list", "concern_list", "promotion_list",
  "testimonial_list", "team_list", "gallery", "contact",
];
const ARTICLE_BLOCKS: BlockType[] = ["rich_text", "image", "steps", "notice", "cta", "faq_list", "gallery"];

export const CONTENT_TYPES: Record<ContentType, TypeMeta> = {
  home: { label: "Home", plural: "Home", segment: "home", publicPrefix: "/", usesBlocks: true, allowedBlocks: ALL_BLOCKS, defaultNoindex: false },
  page: { label: "Página", plural: "Páginas", segment: "paginas", publicPrefix: "/", usesBlocks: true, allowedBlocks: ALL_BLOCKS, defaultNoindex: false },
  treatment: { label: "Tratamento", plural: "Tratamentos", segment: "tratamentos", publicPrefix: "/tratamentos/", usesBlocks: true, allowedBlocks: ARTICLE_BLOCKS, defaultNoindex: false },
  technology: { label: "Tecnologia", plural: "Tecnologias", segment: "tecnologias", publicPrefix: null, usesBlocks: true, allowedBlocks: ARTICLE_BLOCKS, defaultNoindex: false },
  promotion: { label: "Promoção", plural: "Promoções", segment: "promocoes", publicPrefix: "/promocoes/", usesBlocks: true, allowedBlocks: ARTICLE_BLOCKS, defaultNoindex: false },
  landing: { label: "Landing page", plural: "Landing pages", segment: "landing-pages", publicPrefix: "/lp/", usesBlocks: true, allowedBlocks: ALL_BLOCKS, defaultNoindex: true },
  blog_post: { label: "Post do blog", plural: "Blog", segment: "blog", publicPrefix: "/blog/", usesBlocks: true, allowedBlocks: ARTICLE_BLOCKS, defaultNoindex: false },
  faq: { label: "Pergunta frequente", plural: "FAQs", segment: "faqs", publicPrefix: null, usesBlocks: false, allowedBlocks: [], defaultNoindex: false },
  team_member: { label: "Profissional", plural: "Equipe", segment: "equipe", publicPrefix: null, usesBlocks: false, allowedBlocks: [], defaultNoindex: false },
  testimonial: { label: "Depoimento", plural: "Depoimentos", segment: "depoimentos", publicPrefix: null, usesBlocks: false, allowedBlocks: [], defaultNoindex: false },
};

export const CONTENT_TYPE_LIST = Object.keys(CONTENT_TYPES) as ContentType[];

export function typeFromSegment(segment: string): ContentType | null {
  return CONTENT_TYPE_LIST.find((t) => CONTENT_TYPES[t].segment === segment) ?? null;
}

export function publicPath(type: ContentType, slug: string): string | null {
  if (type === "home") return "/";
  const prefix = CONTENT_TYPES[type].publicPrefix;
  return prefix ? `${prefix}${slug}` : null;
}

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  unpublished: "Despublicado",
  archived: "Arquivado",
};

// ---------------------------------------------------------------------------
// Validação do payload salvo (servidor). O banco repete as checagens críticas.
// ---------------------------------------------------------------------------
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Informe o endereço.")
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas sem acento, números e hífens.");

/** Converte um título em slug (minúsculo, sem acentos, hífens). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export const seoSchema = z.object({
  title: z.string().trim().max(70).optional(),
  description: z.string().trim().max(170).optional(),
  mediaId: z.uuid().optional(),
  noindex: z.boolean().optional(),
});
export type Seo = z.infer<typeof seoSchema>;

const isoDateTime = z.iso.datetime({ offset: true });

export const detailsSchemas = {
  treatment: z.object({
    requires_evaluation: z.boolean().default(true),
    clinical_reviewer: z.string().trim().max(120).optional(),
    clinical_reviewed_on: z.iso.date().optional(),
  }),
  promotion: z
    .object({
      starts_at: isoDateTime.optional(),
      ends_at: isoDateTime.optional(),
      price_cents: z.number().int().min(0).max(100_000_000).optional(),
      original_price_cents: z.number().int().min(0).max(100_000_000).optional(),
      terms: z.string().trim().max(4000).optional(),
    })
    .refine((d) => !d.starts_at || !d.ends_at || d.ends_at > d.starts_at, {
      message: "O fim precisa ser depois do início.",
      path: ["ends_at"],
    })
    .refine((d) => d.original_price_cents === undefined || d.price_cents !== undefined, {
      message: "Informe o preço promocional junto com o preço original.",
      path: ["price_cents"],
    }),
  landing: z.object({
    campaign_key: z
      .string()
      .trim()
      .max(60)
      .regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "Use minúsculas, números, - ou _.")
      .optional(),
    promotion_entry_id: z.uuid().optional(),
    reduced_navigation: z.boolean().default(true),
  }),
} as const;

export const dataSchemas: Partial<Record<ContentType, z.ZodType>> = {
  faq: z.object({ answer: z.string().trim().max(3000).optional() }),
  team_member: z.object({
    role: z.string().trim().max(120).optional(),
    registration: z.string().trim().max(60).optional(),
    bio: z.string().trim().max(1500).optional(),
    mediaId: z.uuid().optional(),
  }),
  testimonial: z.object({
    quote: z.string().trim().max(1500).optional(),
    author_display: z.string().trim().max(80).optional(),
    authorization_note: z.string().trim().max(500).optional(),
    mediaId: z.uuid().optional(),
  }),
  treatment: z.object({ mediaId: z.uuid().optional() }),
  technology: z.object({ mediaId: z.uuid().optional() }),
  promotion: z.object({ mediaId: z.uuid().optional() }),
  blog_post: z.object({ mediaId: z.uuid().optional() }),
};

export const relationsSchema = z.object({
  categories: z.array(z.uuid()).max(20).default([]),
  concerns: z.array(z.uuid()).max(30).default([]),
  treatments: z.array(z.uuid()).max(30).default([]),
});

export const versionPayloadSchema = z.object({
  schema_version: z.literal(CURRENT_SCHEMA_VERSION),
  title: z.string().trim().min(1, "Informe o título.").max(200),
  summary: z.string().trim().max(500).optional(),
  blocks: blocksSchema,
  seo: seoSchema,
  data: z.record(z.string(), z.unknown()),
  details: z.record(z.string(), z.unknown()),
  relations: relationsSchema,
});
export type VersionPayload = z.infer<typeof versionPayloadSchema>;

/**
 * Valida o payload completo para o tipo. Retorna o payload normalizado ou
 * a lista de problemas (campo → mensagem).
 */
export function validatePayload(
  type: ContentType,
  input: unknown,
): { ok: true; payload: VersionPayload } | { ok: false; issues: { path: string; message: string }[] } {
  const base = versionPayloadSchema.safeParse(input);
  const issues: { path: string; message: string }[] = [];
  if (!base.success) {
    for (const i of base.error.issues) issues.push({ path: i.path.join("."), message: i.message });
    return { ok: false, issues };
  }
  const payload = base.data;

  const allowed = new Set(CONTENT_TYPES[type].allowedBlocks);
  payload.blocks.forEach((b: Block, idx) => {
    if (!allowed.has(b.type)) issues.push({ path: `blocks.${idx}`, message: "Bloco não permitido neste tipo." });
  });

  const dataSchema = dataSchemas[type];
  if (dataSchema) {
    const d = dataSchema.safeParse(payload.data);
    if (!d.success) for (const i of d.error.issues) issues.push({ path: `data.${i.path.join(".")}`, message: i.message });
    else payload.data = d.data as Record<string, unknown>;
  } else {
    payload.data = {};
  }

  if (type === "treatment" || type === "promotion" || type === "landing") {
    const d = detailsSchemas[type].safeParse(payload.details);
    if (!d.success) for (const i of d.error.issues) issues.push({ path: `details.${i.path.join(".")}`, message: i.message });
    else payload.details = d.data as Record<string, unknown>;
  } else {
    payload.details = {};
  }

  if (type !== "treatment") {
    payload.relations.categories = [];
    payload.relations.concerns = [];
  }
  if (type !== "promotion") payload.relations.treatments = [];

  return issues.length ? { ok: false, issues } : { ok: true, payload };
}

/** Payload inicial de um conteúdo novo (com estrutura sugerida por tipo). */
export function initialPayload(type: ContentType, title: string, makeId: () => string): VersionPayload {
  const blocks: Block[] = [];
  if (type === "treatment") {
    blocks.push(
      { id: makeId(), type: "rich_text", heading: "Como funciona", body: [{ t: "p", children: [{ t: "text", text: "Descreva o procedimento (texto sujeito à revisão do responsável habilitado)." }] }] },
      { id: makeId(), type: "rich_text", heading: "Orientações gerais", body: [{ t: "p", children: [{ t: "text", text: "Cuidados antes e depois, conforme orientação profissional." }] }] },
      { id: makeId(), type: "rich_text", heading: "Limitações", body: [{ t: "p", children: [{ t: "text", text: "Informe limitações sem prometer resultados." }] }] },
      { id: makeId(), type: "notice", tone: "important", text: "A indicação depende de avaliação individual com profissional habilitado. Resultados variam de pessoa para pessoa." },
      { id: makeId(), type: "cta", heading: "Quer saber se este tratamento é indicado para você?", action: { kind: "evaluation", label: "Agendar avaliação" } },
    );
  }
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    title,
    blocks,
    seo: CONTENT_TYPES[type].defaultNoindex ? { noindex: true } : {},
    data: {},
    details: type === "treatment" ? { requires_evaluation: true } : type === "landing" ? { reduced_navigation: true } : {},
    relations: { categories: [], concerns: [], treatments: [] },
  };
}
