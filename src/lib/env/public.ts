import { z } from "zod";

/**
 * Variáveis públicas: entram no bundle do navegador no momento do build.
 * Precisam ser referenciadas literalmente (process.env.NEXT_PUBLIC_X) para o
 * Next.js conseguir embuti-las. Nunca coloque segredos aqui.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis públicas ausentes ou inválidas: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

/** URL canônica do site, sem barra final. */
export function siteUrl(): string {
  return publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}
