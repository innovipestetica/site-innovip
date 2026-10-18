import "server-only";
import { z } from "zod";

/**
 * Variáveis exclusivas do servidor, lidas em runtime (não entram no bundle).
 * O import de "server-only" faz o build falhar se este módulo for importado
 * por um Client Component.
 */
const serverEnvSchema = z.object({
  // Nome atual (sb_secret_...) ou legado (service_role). Ignora RLS: só servidor.
  SUPABASE_SECRET_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY:
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    // Lista só os nomes dos campos: nunca os valores.
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de servidor ausentes ou inválidas: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
