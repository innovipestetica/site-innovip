import { NextResponse, type NextRequest } from "next/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

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

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabasePrivilegedClient();
    const { error } = await supabase.from("redirect_events").insert({
      source_path: "/grupovip",
      target_url: TARGET,
      referrer_host: referrerHost(request),
      utm_source: campaignValue(request, "utm_source"),
      utm_medium: campaignValue(request, "utm_medium"),
      utm_campaign: campaignValue(request, "utm_campaign"),
    });
    if (error) console.error("[grupovip] falha ao registrar redirecionamento", { code: error.code });
  } catch (error) {
    console.error("[grupovip] registro indisponível", { name: error instanceof Error ? error.name : "unknown" });
  }

  return NextResponse.redirect(TARGET, { status: 307, headers: noStore });
}
