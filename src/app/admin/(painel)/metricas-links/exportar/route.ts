import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

function cell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  await assertAdmin();
  const { data, error } = await createSupabasePrivilegedClient()
    .from("redirect_events")
    .select("created_at, source_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_type, operating_system, browser, browser_language, country_code, region_code, city, timezone, is_returning, source_detail, clicked_page")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: "Não foi possível exportar os acessos." }, { status: 500 });
  const rows = (data ?? []).filter((e) => !e.utm_campaign?.startsWith("validacao"));
  const headers = ["data_hora","pagina_acessada","origem","utm_source","utm_medium","utm_campaign","utm_content","utm_term","dispositivo","sistema_operacional","navegador","idioma","pais","estado","cidade","fuso_horario","tipo_visita","origem_detalhada","pagina_do_clique"];
  const csv = [headers.map(cell).join(";"), ...rows.map((e) => [e.created_at,e.source_path,e.referrer_host,e.utm_source,e.utm_medium,e.utm_campaign,e.utm_content,e.utm_term,e.device_type,e.operating_system,e.browser,e.browser_language,e.country_code,e.region_code,e.city,e.timezone,e.is_returning == null ? "nao_identificado" : e.is_returning ? "repetida" : "primeira",e.source_detail,e.clicked_page].map(cell).join(";"))].join("\r\n");
  return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="acessos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
