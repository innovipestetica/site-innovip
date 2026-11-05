import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

function cell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  await assertAdmin();
  const { data, error } = await createSupabasePrivilegedClient()
    .from("redirect_events")
    .select("created_at, source_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_type, operating_system, browser, browser_language, country_code, region_code, city, timezone, is_returning, source_detail, clicked_page")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: "Não foi possível exportar os acessos." }, { status: 500 });
  const params = new URL(request.url).searchParams;
  const traffic = params.get("traffic") || "people";
  const device = params.get("device") || "";
  const sourcePath = params.get("source_path") || "";
  const campaign = (params.get("campaign") || "").toLocaleLowerCase("pt-BR");
  const search = (params.get("q") || "").toLocaleLowerCase("pt-BR");
  const from = params.get("from") ? new Date(`${params.get("from")}T00:00:00-03:00`).getTime() : null;
  const to = params.get("to") ? new Date(`${params.get("to")}T23:59:59.999-03:00`).getTime() : null;
  const rows = (data ?? []).filter((e) => {
    if (e.utm_campaign?.startsWith("validacao")) return false;
    if (traffic === "people" && e.device_type === "bot") return false;
    if (traffic === "bots" && e.device_type !== "bot") return false;
    if (device && e.device_type !== device) return false;
    if (sourcePath && e.source_path !== sourcePath) return false;
    if (campaign && !(e.utm_campaign ?? "").toLocaleLowerCase("pt-BR").includes(campaign)) return false;
    const time = new Date(e.created_at).getTime();
    if (from !== null && time < from) return false;
    if (to !== null && time > to) return false;
    if (search) {
      const text = [e.referrer_host, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.source_detail, e.clicked_page, e.city, e.browser].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      if (!text.includes(search)) return false;
    }
    return true;
  });
  const headers = ["data_hora","pagina_acessada","origem","utm_source","utm_medium","utm_campaign","utm_content","utm_term","dispositivo","sistema_operacional","navegador","idioma","pais","estado","cidade","fuso_horario","tipo_visita","origem_detalhada","pagina_do_clique"];
  const csv = [headers.map(cell).join(";"), ...rows.map((e) => [e.created_at,e.source_path,e.referrer_host,e.utm_source,e.utm_medium,e.utm_campaign,e.utm_content,e.utm_term,e.device_type,e.operating_system,e.browser,e.browser_language,e.country_code,e.region_code,e.city,e.timezone,e.is_returning == null ? "nao_identificado" : e.is_returning ? "repetida" : "primeira",e.source_detail,e.clicked_page].map(cell).join(";"))].join("\r\n");
  return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="acessos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
