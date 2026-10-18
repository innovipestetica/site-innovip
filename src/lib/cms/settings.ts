import { z } from "zod";
import { safeHrefSchema } from "./rich-text";

/**
 * Configurações PÚBLICAS do site (site_settings_public.data).
 * Só informação pública autorizada. Tokens/segredos de integrações nunca
 * entram aqui (ficam em variáveis de ambiente do servidor).
 * Campos vazios = seção oculta no site (nada é inventado).
 */
const optional = (max: number) => z.string().trim().max(max).optional();

/** Telefone em formato internacional, só dígitos: 55 + DDD + número. */
export const intlPhoneSchema = z
  .string()
  .trim()
  .regex(/^55\d{10,11}$/, "Use o formato internacional só com números: 55 + DDD + número (ex.: 5511999999999).");

const httpsUrl = z
  .url()
  .refine((u) => u.startsWith("https://"), "Use um endereço https://");

export const settingsSchema = z.object({
  business_name: optional(80),
  legal_name: optional(120),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, "CNPJ inválido.")
    .optional(),
  phone: intlPhoneSchema.optional(),
  whatsapp: intlPhoneSchema.optional(),
  whatsapp_message: optional(200),
  email: z.email("E-mail inválido.").max(254).optional(),
  address: z
    .object({
      street: optional(120),
      number: optional(20),
      complement: optional(60),
      district: optional(60),
      city: optional(60),
      state: z.string().trim().regex(/^[A-Z]{2}$/, "UF com 2 letras maiúsculas.").optional(),
      postal_code: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido.").optional(),
    })
    .optional(),
  map_url: httpsUrl.optional(),
  hours: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(60) })).max(10).optional(),
  social: z
    .object({
      instagram: httpsUrl.optional(),
      facebook: httpsUrl.optional(),
      tiktok: httpsUrl.optional(),
      youtube: httpsUrl.optional(),
    })
    .optional(),
  nav: z.array(z.object({ label: z.string().trim().min(1).max(40), href: safeHrefSchema })).max(10).optional(),
  footer_note: optional(300),
  seo_default_title: optional(70),
  seo_default_description: optional(170),
  responsible_technical: optional(160),
  /** Para onde vão TODOS os botões "Agendar avaliação" do site. */
  evaluation_cta: z
    .object({
      mode: z.enum(["whatsapp", "link", "form"]),
      url: httpsUrl.optional(),
      label: optional(40),
    })
    .refine((v) => v.mode !== "link" || !!v.url, { message: "Informe o link (https://).", path: ["url"] })
    .optional(),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

/** Mensagem genérica do WhatsApp: sem UTMs, tokens ou dados pessoais. */
export const DEFAULT_WHATSAPP_MESSAGE = "Olá! Gostaria de mais informações sobre os tratamentos da Innovip.";

export function whatsappHref(settings: SiteSettings): string | null {
  if (!settings.whatsapp) return null;
  const text = encodeURIComponent(settings.whatsapp_message || DEFAULT_WHATSAPP_MESSAGE);
  return `https://wa.me/${settings.whatsapp}?text=${text}`;
}

export function phoneHref(settings: SiteSettings): string | null {
  return settings.phone ? `tel:+${settings.phone}` : null;
}

/** Lê com tolerância: campos inválidos salvos antes de uma mudança de regra são descartados. */
export function parseSettings(data: unknown): SiteSettings {
  const parsed = settingsSchema.safeParse(data ?? {});
  if (parsed.success) return parsed.data;
  const clean: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete clean[key];
  }
  return settingsSchema.safeParse(clean).data ?? {};
}

export const DEFAULT_EVALUATION_LABEL = "Agendar avaliação";

export type EvaluationTarget = {
  href: string;
  /** Abre em nova aba (WhatsApp ou link de outro site). */
  external: boolean;
  mode: "whatsapp" | "link" | "form";
  label: string;
};

/**
 * Destino dos botões "Agendar avaliação", conforme Configurações públicas.
 * Padrão: WhatsApp (se houver número), senão o formulário do site.
 * WhatsApp usa SEMPRE a mensagem genérica: nada de tratamento ou outro
 * interesse (potencialmente dado de saúde) no link.
 * O interesse só vai para o formulário do próprio site.
 */
export function evaluationTarget(
  settings: SiteSettings,
  context: { interest?: string; promotion?: string } = {},
): EvaluationTarget {
  const cfg = settings.evaluation_cta;
  const label = cfg?.label || DEFAULT_EVALUATION_LABEL;
  const mode = cfg?.mode ?? (settings.whatsapp ? "whatsapp" : "form");

  if (mode === "link" && cfg?.url) return { href: cfg.url, external: true, mode, label };
  if (mode === "whatsapp") {
    const wa = whatsappHref(settings);
    if (wa) return { href: wa, external: true, mode, label };
  }
  const params = new URLSearchParams();
  if (context.interest) params.set("interesse", context.interest);
  if (context.promotion) params.set("promocao", context.promotion);
  const qs = params.toString();
  return { href: `/agendar-avaliacao${qs ? `?${qs}` : ""}`, external: false, mode: "form", label };
}
