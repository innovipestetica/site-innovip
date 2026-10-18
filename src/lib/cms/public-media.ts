import "server-only";
import { loadPublicContext, type PublishedEntry } from "./public-data";

/** Contexto público com as capas de uma lista de conteúdos (cards). */
export async function contextForCards(items: PublishedEntry[], extra: unknown = null) {
  return loadPublicContext({ cards: items.map((i) => ({ mediaId: i.data.mediaId })), extra });
}
