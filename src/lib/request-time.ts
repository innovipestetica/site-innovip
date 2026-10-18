import "server-only";
import { connection } from "next/server";

/**
 * Instante da REQUISIÇÃO (nunca do build nem do cache). connection() marca o
 * trecho como dinâmico: use dentro de <Suspense> para o resto da página
 * continuar estático/cacheado.
 */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
