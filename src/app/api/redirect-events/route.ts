import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest, userAgentFromString } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

type Body = { sourcePath?: unknown; target?: unknown; query?: unknown; referrer?: unknown };

function limited(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function city(request: NextRequest) {
  const value = request.headers.get("x-vercel-ip-city");
  if (!value) return null;
  try { return decodeURIComponent(value).slice(0, 120); } catch { return value.slice(0, 120); }
}

function visitorKey(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHmac("sha256", serverEnv().SUPABASE_SECRET_KEY).update(`${ip}|${request.headers.get("user-agent") || ""}`).digest("hex");
}

export async function POST(request: NextRequest) {
  let body: Body;
  try { body = await request.json() as Body; } catch { return new NextResponse(null, { status: 400 }); }
  const sourcePath = limited(body.sourcePath, 200);
  const target = limited(body.target, 2000);
  if (!sourcePath?.startsWith("/") || !target) return new NextResponse(null, { status: 400 });

  const supabase = createSupabasePrivilegedClient();
  const { data: configured } = await supabase.from("redirects").select("id").eq("source_path", sourcePath).eq("target_path", target).maybeSingle();
  if (!configured) return new NextResponse(null, { status: 404 });

  const search = new URLSearchParams(limited(body.query, 2000)?.replace(/^\?/, "") || "");
  const ua = userAgentFromString(request.headers.get("user-agent") || undefined);
  const visitor = visitorKey(request);
  const { data: previous } = visitor ? await supabase.from("redirect_events").select("id").eq("visitor_key", visitor).limit(1).maybeSingle() : { data: null };
  const type = ua.isBot ? "bot" : ua.device.type === "mobile" ? "celular" : ua.device.type === "tablet" ? "tablet" : "computador";
  let referrerHost: string | null = null;
  const referrer = limited(body.referrer, 500);
  if (referrer) { try { referrerHost = new URL(referrer).hostname.slice(0, 253); } catch { referrerHost = null; } }
  const { error } = await supabase.from("redirect_events").insert({
    source_path: sourcePath, target_url: target, referrer_host: referrerHost,
    utm_source: limited(search.get("utm_source"), 120), utm_medium: limited(search.get("utm_medium"), 120), utm_campaign: limited(search.get("utm_campaign"), 120), utm_content: limited(search.get("utm_content"), 120), utm_term: limited(search.get("utm_term"), 120),
    device_type: type, operating_system: limited(ua.os.name, 80), browser: limited(ua.browser.name, 80), browser_language: limited(request.headers.get("accept-language")?.split(",")[0]?.split(";")[0], 40),
    country_code: limited(request.headers.get("x-vercel-ip-country"), 2), region_code: limited(request.headers.get("x-vercel-ip-country-region"), 10), city: city(request), timezone: limited(request.headers.get("x-vercel-ip-timezone"), 80),
    visitor_key: visitor, is_returning: visitor ? Boolean(previous) : null, source_detail: limited(search.get("origem") || search.get("source") || search.get("utm_content"), 120), clicked_page: referrer,
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o acesso." }, { status: 500 });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
