import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest, userAgentFromString } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";
import { getMedia, getRedirect } from "@/lib/cms/public-data";

const TARGET = "https://chat.whatsapp.com/CXMNBJBFNslFEdxLcroT4H?s=cl&p=i&mlu=4&ilr=4";
const noStore = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function campaignValue(request: NextRequest, key: string): string | null {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  return value ? value.slice(0, 120) : null;
}

function referrerHost(request: NextRequest): string | null {
  const value = request.headers.get("referer");
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 253) || null;
  } catch {
    return null;
  }
}

function headerValue(request: NextRequest, key: string, limit: number): string | null {
  const value = request.headers.get(key)?.trim();
  return value ? value.slice(0, limit) : null;
}

function cityValue(request: NextRequest): string | null {
  const value = headerValue(request, "x-vercel-ip-city", 300);
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

function clickedPage(request: NextRequest): string | null {
  const explicit = campaignValue(request, "from");
  if (explicit) return explicit;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.hostname === request.nextUrl.hostname ? `${url.pathname}${url.search}`.slice(0, 500) : null;
  } catch {
    return null;
  }
}

function visitorKey(request: NextRequest): string | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  const ua = request.headers.get("user-agent") || "";
  return createHmac("sha256", serverEnv().SUPABASE_SECRET_KEY).update(`${ip}|${ua}`).digest("hex");
}

function html(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function previewResponse(request: NextRequest, target: string, preview: NonNullable<Awaited<ReturnType<typeof getRedirect>>>) {
  if (!preview.previewTitle) return null;
  const image = await getMedia(preview.previewMediaId);
  const largest = image?.sources.at(-1);
  const imageHeight = largest && image?.width && image.height ? Math.round(largest.width * image.height / image.width) : 630;
  const canonicalUrl = `${request.nextUrl.origin}/grupovip`;
  const sharedUrl = request.nextUrl.toString();
  const imageUrl = largest ? `${canonicalUrl}/preview-image?media=${encodeURIComponent(preview.previewMediaId || "atual")}` : undefined;
  const safeTargetJson = JSON.stringify(target).replaceAll("<", "\\u003c");
  const markup = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(preview.previewTitle)}</title><link rel="canonical" href="${html(canonicalUrl)}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:url" content="${html(sharedUrl)}"><meta property="og:title" content="${html(preview.previewTitle)}">${preview.previewDescription ? `<meta name="description" content="${html(preview.previewDescription)}"><meta property="og:description" content="${html(preview.previewDescription)}">` : ""}${preview.previewSiteName ? `<meta property="og:site_name" content="${html(preview.previewSiteName)}">` : ""}${imageUrl ? `<meta property="og:image" content="${html(imageUrl)}"><meta property="og:image:secure_url" content="${html(imageUrl)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="${largest?.width || 1200}"><meta property="og:image:height" content="${imageHeight}"><meta property="og:image:alt" content="${html(image?.alt || preview.previewTitle)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${html(imageUrl)}">` : ""}<meta name="twitter:title" content="${html(preview.previewTitle)}">${preview.previewDescription ? `<meta name="twitter:description" content="${html(preview.previewDescription)}">` : ""}<script>location.replace(${safeTargetJson})</script></head><body><p>Abrindo o destino… <a href="${html(target)}">Toque aqui se não abrir automaticamente.</a></p></body></html>`;
  return new NextResponse(markup, { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=300", "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest) {
  const redirectConfig = await getRedirect("/grupovip").catch(() => null);
  const target = redirectConfig?.target || TARGET;
  try {
    const supabase = createSupabasePrivilegedClient();
    const ua = userAgentFromString(request.headers.get("user-agent") || undefined);
    const visitor = visitorKey(request);
    const { data: previous } = visitor
      ? await supabase.from("redirect_events").select("id").eq("visitor_key", visitor).limit(1).maybeSingle()
      : { data: null };
    const type = ua.isBot ? "bot" : ua.device.type === "mobile" ? "celular" : ua.device.type === "tablet" ? "tablet" : "computador";
    const { error } = await supabase.from("redirect_events").insert({
      source_path: "/grupovip",
      target_url: target,
      referrer_host: referrerHost(request),
      utm_source: campaignValue(request, "utm_source"),
      utm_medium: campaignValue(request, "utm_medium"),
      utm_campaign: campaignValue(request, "utm_campaign"),
      utm_content: campaignValue(request, "utm_content"),
      utm_term: campaignValue(request, "utm_term"),
      device_type: type,
      operating_system: ua.os.name?.slice(0, 80) || null,
      browser: ua.browser.name?.slice(0, 80) || null,
      browser_language: headerValue(request, "accept-language", 40)?.split(",")[0]?.split(";")[0] || null,
      country_code: headerValue(request, "x-vercel-ip-country", 2),
      region_code: headerValue(request, "x-vercel-ip-country-region", 10),
      city: cityValue(request),
      timezone: headerValue(request, "x-vercel-ip-timezone", 80),
      visitor_key: visitor,
      is_returning: visitor ? Boolean(previous) : null,
      source_detail: campaignValue(request, "origem") || campaignValue(request, "source") || campaignValue(request, "utm_content"),
      clicked_page: clickedPage(request),
    });
    if (error) console.error("[grupovip] falha ao registrar redirecionamento", { code: error.code });
  } catch (error) {
    console.error("[grupovip] registro indisponível", { name: error instanceof Error ? error.name : "unknown" });
  }

  if (redirectConfig) {
    const response = await previewResponse(request, target, redirectConfig);
    if (response) return response;
  }
  return NextResponse.redirect(target, { status: 307, headers: noStore });
}
