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
