import { NextResponse } from "next/server";
import { createSupabasePrivilegedClient } from "@/lib/supabase/privileged";

const TOKEN = "black-builder-20261020-7f4c91a8";

const blocks = [
  {
    id: "blackhero1", type: "hero", heading: "Seu acesso a uma experiência mais exclusiva.",
    subheading: "Entre para a lista VIP da Innovip e receba novidades e condições especiais em primeira mão.",
    primary: { kind: "link", label: "Entrar para a lista VIP", href: "/agendar-avaliacao" },
  },
  {
    id: "blackbenefits1", type: "features", heading: "Um cuidado pensado para estar mais perto.",
    items: [
      { title: "Acesso antecipado", text: "Saiba primeiro sobre novidades, agendas e experiências da Innovip." },
      { title: "Condições especiais", text: "Receba oportunidades selecionadas, criadas para quem acompanha a clínica de perto." },
      { title: "Atendimento próximo", text: "Converse com a equipe para entender o cuidado mais adequado para o seu momento." },
    ],
  },
  {
    id: "blackstory1", type: "rich_text", heading: "Mais que acesso. Um convite para viver a Innovip.",
    body: [{ t: "p", children: [{ t: "text", text: "A lista VIP aproxima você do universo Innovip: um espaço de cuidado, atenção e escolhas feitas com intenção. Sem promessas exageradas, apenas uma forma mais próxima de acompanhar o que preparamos." }] }],
  },
  {
    id: "blacksteps1", type: "steps", heading: "Três passos para ficar mais perto.", showLabel: true, labelPrefix: "",
    items: [
      { label: "01", title: "Fale com a equipe", text: "Toque no botão e inicie uma conversa pelo canal oficial de atendimento." },
      { label: "02", title: "Entre para a lista", text: "Diga que deseja fazer parte da lista VIP. A equipe confirma sua entrada." },
      { label: "03", title: "Receba em primeira mão", text: "Acompanhe novidades e condições especiais compartilhadas pela Innovip." },
    ],
  },
  {
    id: "blackfaqs1", type: "care_flow", eyebrow: "Perguntas frequentes", heading: "Tudo o que você precisa saber.", showLabel: false,
    items: [
      { key: "faqblack01", icon: "coracao", title: "A lista VIP é gratuita?", text: "Sim. Entrar para a lista não tem custo e não cria compromisso de compra ou contratação." },
      { key: "faqblack02", icon: "telefone", title: "Como entro para a lista?", text: "Basta tocar em um dos botões da página. Você será direcionada ao canal de atendimento já configurado pela Innovip." },
      { key: "faqblack03", icon: "brilho", title: "O que vou receber?", text: "Novidades da clínica, informações sobre experiências e condições especiais quando estiverem disponíveis." },
      { key: "faqblack04", icon: "escudo-check", title: "Posso sair quando quiser?", text: "Sim. É só solicitar a saída pelo mesmo canal de atendimento, a qualquer momento." },
    ],
  },
  {
    id: "blackcta1", type: "cta", heading: "Entre para a lista VIP.",
    text: "Fale com a equipe e seja uma das primeiras pessoas a acompanhar nossas novidades.",
    action: { kind: "link", label: "Quero entrar para a lista", href: "/agendar-avaliacao" },
  },
];

export async function POST(request: Request) {
  if (request.headers.get("x-seed-token") !== TOKEN) return new NextResponse(null, { status: 404 });
  const supabase = createSupabasePrivilegedClient();
  const { data: existing } = await supabase.from("content_entries").select("id").eq("type", "landing").eq("slug", "black").maybeSingle();
  if (existing) return NextResponse.json({ ok: true, id: existing.id, existing: true });

  const { data: entry, error: entryError } = await supabase.from("content_entries")
    .insert({ type: "landing", slug: "black", latest_revision: 1 })
    .select("id").single();
  if (entryError || !entry) return NextResponse.json({ ok: false, step: "entry" }, { status: 500 });

  const { data: version, error: versionError } = await supabase.from("content_versions").insert({
    entry_id: entry.id,
    revision: 1,
    schema_version: 1,
    title: "Lista VIP Black",
    summary: "Landing independente da lista VIP da Innovip.",
    blocks,
    seo: { noindex: true, title: "Lista VIP", description: "Entre para a lista VIP da Innovip e receba novidades e condições especiais." },
    data: { pageBackground: "#ffffff", pageText: "#1e2b27", pageAccent: "#008d68", buttonBackground: "#008d68", buttonText: "#ffffff" },
  }).select("id").single();
  if (versionError || !version) {
    await supabase.from("content_entries").delete().eq("id", entry.id);
    return NextResponse.json({ ok: false, step: "version" }, { status: 500 });
  }

  const { error: detailsError } = await supabase.from("landing_details").insert({ version_id: version.id, reduced_navigation: true });
  if (detailsError) {
    await supabase.from("content_entries").delete().eq("id", entry.id);
    return NextResponse.json({ ok: false, step: "details" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: publishError } = await supabase.from("content_entries").update({
    lifecycle_status: "published", published_version_id: version.id,
    first_published_at: now, published_at: now,
  }).eq("id", entry.id);
  if (publishError) {
    await supabase.from("content_entries").delete().eq("id", entry.id);
    return NextResponse.json({ ok: false, step: "publish" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: entry.id, versionId: version.id });
}
