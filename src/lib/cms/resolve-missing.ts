import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getRedirect } from "./public-data";

/**
 * Caminho sem conteúdo publicado: aplica o redirecionamento cadastrado
 * (301 → redirecionamento permanente; 302 → temporário) ou devolve 404.
 * Chamado ANTES de qualquer streaming, para o status HTTP ser o correto.
 * Obs.: o Next usa 308/307 (equivalentes permanentes/temporários a 301/302).
 */
export async function resolveMissing(path: string): Promise<never> {
  const normalized = path.toLowerCase().replace(/\/+$/, "") || "/";
  if (/^\/[a-z0-9/-]*$/.test(normalized)) {
    const target = await getRedirect(normalized);
    if (target) {
      if (target.status === 301 || target.status === 308) permanentRedirect(target.target);
      redirect(target.target);
    }
  }
  notFound();
}
