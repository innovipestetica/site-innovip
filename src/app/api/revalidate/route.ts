import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { TAG } from "@/lib/cms/cache-tags";

/**
 * Invalida o cache público quando o conteúdo muda FORA do painel (scripts
 * de manutenção, SQL direto). O painel já invalida sozinho ao publicar.
 *
 *   POST /api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 *
 * Sem segredo configurado, o endpoint fica desativado (404).
 */
function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 32) return new NextResponse(null, { status: 404 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  // expire: 0 — o próximo acesso busca dados novos (sem servir o antigo).
  for (const tag of Object.values(TAG)) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ ok: true, tags: Object.values(TAG) }, { headers: { "Cache-Control": "no-store" } });
}
