import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CONSENT_VERSION, safePath } from "@/lib/consent/consent";
import { serverEnv } from "@/lib/env/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

/**
 * Registro das escolhas de cookies (prova do consentimento).
 * Sem dados pessoais: identificador pseudônimo aleatório do cookie,
 * categorias, versão, caminho sem query. O IP só entra num HMAC diário
 * usado como chave do limite de requisições (não é gravado).
 */
const MAX_BODY = 1024;

const bodySchema = z.object({
  id: z.uuid(),
  version: z.literal(CONSENT_VERSION),
  analytics: z.boolean(),
  marketing: z.boolean(),
  path: z.string().max(500),
});

const noStore = { "Cache-Control": "no-store" };

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido"
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403, headers: noStore });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415, headers: noStore });
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413, headers: noStore });

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  }
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413, headers: noStore });

  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  }
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers: noStore });

  const day = new Date().toISOString().slice(0, 10);
  const rateKey = createHmac("sha256", serverEnv().SUPABASE_SECRET_KEY).update(`${clientIp(request)}|${day}`).digest("hex");

  const supabase = createSupabasePrivilegedClient();
  const { data, error } = await supabase.rpc("record_consent", {
    p_subject: parsed.data.id,
    p_version: parsed.data.version,
    p_analytics: parsed.data.analytics,
    p_marketing: parsed.data.marketing,
    p_path: safePath(parsed.data.path),
    p_rate_key: rateKey,
  });
  if (error) {
    console.error("[consent] falha ao registrar", { code: error.code });
    return NextResponse.json({ ok: false }, { status: 500, headers: noStore });
  }
  if (data === false) return NextResponse.json({ ok: false }, { status: 429, headers: noStore });
  return new NextResponse(null, { status: 204, headers: noStore });
}
