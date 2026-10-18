import { z } from "zod";

/** Formato das variantes gravadas em media_assets.*_variants. */
export const variantSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  path: z.string().regex(/^[a-z0-9/_.-]+$/),
  format: z.enum(["webp", "avif", "jpeg"]),
});
export type Variant = z.infer<typeof variantSchema>;

export function parseVariants(value: unknown): Variant[] {
  const parsed = z.array(variantSchema).safeParse(value);
  return parsed.success ? [...parsed.data].sort((a, b) => a.width - b.width) : [];
}

export const PUBLIC_BUCKET = "media-public";
export const PRIVATE_BUCKET = "media-private";

/** URL pública (CDN do Storage) de um objeto do bucket público. */
export function publicObjectUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}
