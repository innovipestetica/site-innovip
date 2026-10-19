/**
 * Conteúdo de DEMONSTRAÇÃO para verificar o layout do site.
 *
 *   npm run demo:seed     # cria (falha se já existir)
 *   npm run demo:remove   # remove tudo o que foi criado (inclui imagens)
 *
 * Marcação: títulos com "[DEMONSTRAÇÃO]", endereços com "demo-", imagens com
 * o texto "IMAGEM DE DEMONSTRAÇÃO". Não altera as Configurações públicas
 * (dados reais) e não inventa telefone, endereço, preço real ou credenciais.
 *
 * Grava como DONO DO BANCO (DATABASE_URL): a auditoria registra autor nulo,
 * sem se passar por um administrador. As regras de publicação são
 * conferidas pela mesma função do banco usada pelo painel.
 * Imagens vão ao Storage com a chave secreta (somente neste script local).
 *
 * Nunca rodar em produção com o site no ar.
 */
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { initialPayload, validatePayload, type ContentType, type VersionPayload } from "../src/lib/cms/content-types";
import { newBlockId, type Block } from "../src/lib/cms/blocks";
import { parseRichText } from "../src/lib/cms/rich-text";

config({ path: ".env.local", quiet: true });

const TAG = "[DEMONSTRAÇÃO]";
const PRIVATE_BUCKET = "media-private";
const PUBLIC_BUCKET = "media-public";
const WIDTHS = [480, 960, 1600];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ausente em .env.local.`);
  return v;
}

const storage = () =>
  createClient(env("NEXT_PUBLIC_SUPABASE_URL"), process.env.SUPABASE_SECRET_KEY ?? env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------
async function demoImage(label: string, hue: "verde" | "dourado", width = 1600, height = 1000) {
  const [bg, fg] = hue === "verde" ? ["#2b6b59", "#f6edda"] : ["#e5c88b", "#183f35"];
  const cx = width / 2;
  const cy = height / 2;
  const big = Math.round(Math.min(width, height * 1.6) / 25);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <circle cx="${width * 0.85}" cy="${height * 0.2}" r="${height * 0.26}" fill="${fg}" opacity="0.12"/>
    <circle cx="${width * 0.14}" cy="${height * 0.86}" r="${height * 0.32}" fill="${fg}" opacity="0.10"/>
    <text x="${cx}" y="${cy - big * 0.4}" font-family="Arial, sans-serif" font-size="${big}" font-weight="700" fill="${fg}" text-anchor="middle">IMAGEM DE DEMONSTRAÇÃO</text>
    <text x="${cx}" y="${cy + big}" font-family="Arial, sans-serif" font-size="${Math.round(big * 0.7)}" fill="${fg}" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function createMedia(db: Client, label: string, hue: "verde" | "dourado", size: [number, number] = [1600, 1000]): Promise<string> {
  const id = randomUUID();
  const original = await demoImage(label, hue, size[0], size[1]);
  const st = storage();
  const originalPath = `originals/${id}.jpg`;
  const up = await st.from(PRIVATE_BUCKET).upload(originalPath, original, { contentType: "image/jpeg" });
  if (up.error) throw new Error(`upload original: ${up.error.message}`);
  uploaded.push({ bucket: PRIVATE_BUCKET, path: originalPath });

  const variants: { width: number; height: number; path: string; format: "webp" }[] = [];
  const publicVariants: typeof variants = [];
  for (const w of WIDTHS.filter((x) => x <= size[0])) {
    const { data, info } = await sharp(original).resize({ width: w }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const priv = `variants/${id}/${w}.webp`;
    const pub = `${id}/${w}.webp`;
    for (const [bucket, path] of [[PRIVATE_BUCKET, priv], [PUBLIC_BUCKET, pub]] as const) {
      const r = await st.from(bucket).upload(path, data, { contentType: "image/webp", cacheControl: "31536000" });
      if (r.error) throw new Error(`upload ${bucket}: ${r.error.message}`);
      uploaded.push({ bucket, path });
    }
    variants.push({ width: info.width, height: info.height, path: priv, format: "webp" });
    publicVariants.push({ width: info.width, height: info.height, path: pub, format: "webp" });
  }

  await db.query(
    `insert into public.media_assets (id, status, mime, size_bytes, width, height, alt, private_original_path, private_variants, public_variants)
     values ($1, 'published', 'image/jpeg', $2, $7, $8, $3, $4, $5, $6)`,
    [id, original.length, `${TAG} Imagem ilustrativa: ${label}`, originalPath, JSON.stringify(variants), JSON.stringify(publicVariants), size[0], size[1]],
  );
  await db.query(
    `insert into public.media_permissions (kind, media_id, description, granted_on)
     values ('licenca', $1, $2, current_date)`,
    [id, `${TAG} Imagem gerada pelo script de demonstração (sem direitos de terceiros).`],
  );
  return id;
}

// ---------------------------------------------------------------------------
// Conteúdo
// ---------------------------------------------------------------------------
const p = (text: string) => parseRichText(text);

async function createEntry(
  db: Client,
  type: ContentType,
  slug: string,
  title: string,
  patch: (payload: VersionPayload) => void,
  options: { publish?: boolean } = {},
): Promise<{ id: string; versionId: string }> {
  const payload = initialPayload(type, `${TAG} ${title}`, newBlockId);
  patch(payload);
  const validated = validatePayload(type, payload);
  if (!validated.ok) throw new Error(`${slug}: ${JSON.stringify(validated.issues)}`);

  const entry = await db.query<{ id: string }>(
    "insert into public.content_entries (type, slug, latest_revision) values ($1, $2, 1) returning id",
    [type, slug],
  );
  const id = entry.rows[0]!.id;
  const version = await db.query<{ v: string }>(
    "select private.cms_insert_version($1, $2, 1, $3) as v",
    [id, type, JSON.stringify(validated.payload)],
  );
  const versionId = version.rows[0]!.v;

  if (options.publish !== false) {
    const problems = await db.query<{ p: string[] }>("select private.cms_publish_problems($1) as p", [versionId]);
    if (problems.rows[0]!.p.length) throw new Error(`${slug} não publicável: ${problems.rows[0]!.p.join("; ")}`);
    await db.query(
      `update public.content_entries
          set published_version_id = $2, lifecycle_status = 'published', published_at = now(), first_published_at = now()
        where id = $1`,
      [id, versionId],
    );
  }
  return { id, versionId };
}

const DAY = 86_400_000;

/** Arquivos enviados nesta execução (limpos se a criação falhar). */
const uploaded: { bucket: string; path: string }[] = [];

async function seed(db: Client) {
  const exists = await db.query("select 1 from public.content_entries where slug like 'demo-%' limit 1");
  if (exists.rowCount) throw new Error("Já existe conteúdo de demonstração. Rode npm run demo:remove antes.");
  const homeExists = await db.query("select 1 from public.content_entries where type = 'home' limit 1");
  if (homeExists.rowCount) throw new Error("Já existe uma Home (real). A demonstração não substitui conteúdo real.");

  // Taxonomias
  const tax = async (table: "categories" | "concerns", slug: string, name: string, extra: Record<string, unknown> = {}) => {
    const cols = ["slug", "name", "status", "sort_order", ...Object.keys(extra)];
    const vals = [slug, `${name} (demo)`, "published", 0, ...Object.values(extra)];
    const r = await db.query<{ id: string }>(
      `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      vals,
    );
    return r.rows[0]!.id;
  };
  const catFacial = await tax("categories", "demo-faciais", "Faciais", { description: `${TAG} Categoria de exemplo.` });
  const catCorporal = await tax("categories", "demo-corporais", "Corporais", { description: `${TAG} Categoria de exemplo.` });
  const cManchas = await tax("concerns", "demo-manchas", "Manchas", { area: "facial" });
  const cTextura = await tax("concerns", "demo-textura", "Textura da pele", { area: "facial" });
  const cInchaco = await tax("concerns", "demo-inchaco", "Sensação de inchaço", { area: "corporal" });

  // Imagens
  console.log("Gerando e enviando imagens…");
  const mHero = await createMedia(db, "Destaque da Home", "verde");
  const mLimpeza = await createMedia(db, "Tratamento facial", "dourado");
  const mDrenagem = await createMedia(db, "Tratamento corporal", "verde");
  const mPeeling = await createMedia(db, "Cuidados com a pele", "dourado");
  const mBanner1 = await createMedia(db, "Banner 1 (computador)", "verde", [1600, 584]);
  const mBanner1Mobile = await createMedia(db, "Banner 1 (celular)", "verde", [800, 1000]);
  const mBanner2 = await createMedia(db, "Banner 2", "dourado", [1600, 584]);
  const mBanner3 = await createMedia(db, "Banner 3", "verde", [1600, 584]);

  const reviewed = { requires_evaluation: true };
  const demoBody = "Texto fictício apenas para testar o layout. **Não é informação clínica.** O conteúdo real deve ser escrito e revisado pelo responsável habilitado.";

  console.log("Criando conteúdos…");
  const tLimpeza = await createEntry(db, "treatment", "demo-limpeza-de-pele", "Limpeza de pele", (pl) => {
    pl.summary = `${TAG} Resumo de exemplo de um tratamento facial.`;
    pl.data = { mediaId: mLimpeza };
    pl.details = reviewed;
    pl.relations.categories = [catFacial];
    pl.relations.concerns = [cTextura, cManchas];
    for (const b of pl.blocks) if (b.type === "rich_text") b.body = p(demoBody);
  });
  const tPeeling = await createEntry(db, "treatment", "demo-peeling", "Peeling", (pl) => {
    pl.summary = `${TAG} Resumo de exemplo.`;
    pl.data = { mediaId: mPeeling };
    pl.details = reviewed;
    pl.relations.categories = [catFacial];
    pl.relations.concerns = [cManchas];
    for (const b of pl.blocks) if (b.type === "rich_text") b.body = p(demoBody);
  });
  const tDrenagem = await createEntry(db, "treatment", "demo-drenagem", "Drenagem", (pl) => {
    pl.summary = `${TAG} Resumo de exemplo de um tratamento corporal.`;
    pl.data = { mediaId: mDrenagem };
    pl.details = reviewed;
    pl.relations.categories = [catCorporal];
    pl.relations.concerns = [cInchaco];
    for (const b of pl.blocks) if (b.type === "rich_text") b.body = p(demoBody);
  });

  const faq1 = await createEntry(db, "faq", "demo-faq-avaliacao", "Como funciona a avaliação?", (pl) => {
    pl.data = { answer: `${TAG} Resposta fictícia. Na avaliação, a equipe entende seu objetivo e indica o que faz sentido para você.` };
  });
  const faq2 = await createEntry(db, "faq", "demo-faq-sessoes", "Quantas sessões são necessárias?", (pl) => {
    pl.data = { answer: `${TAG} Resposta fictícia. Depende de avaliação individual; não há número padrão.` };
  });
  const team = await createEntry(db, "team_member", "demo-profissional", "Profissional fictícia", (pl) => {
    pl.data = { role: "Função de exemplo", bio: `${TAG} Apresentação fictícia.` };
  });
  const testimonial = await createEntry(db, "testimonial", "demo-depoimento", "Depoimento de exemplo", (pl) => {
    pl.data = {
      quote: `${TAG} Texto fictício apenas para testar o layout de depoimentos.`,
      author_display: "Pessoa fictícia",
      authorization_note: `${TAG} Sem pessoa real: conteúdo de teste de layout.`,
    };
  });

  const now = Date.now();
  const promoActive = await createEntry(db, "promotion", "demo-promocao-vigente", "Promoção vigente", (pl) => {
    pl.summary = `${TAG} Oferta de exemplo dentro do prazo.`;
    pl.data = { mediaId: mLimpeza };
    pl.details = {
      starts_at: new Date(now - DAY).toISOString(),
      ends_at: new Date(now + 30 * DAY).toISOString(),
      price_cents: 12345,
      original_price_cents: 23456,
      terms: `${TAG} Condições fictícias. Valores de exemplo, não são preços reais da clínica.`,
    };
    pl.relations.treatments = [tLimpeza.id];
  });
  // Publicada dentro do prazo e depois "vencida" (só no script) para testar "oferta encerrada".
  const promoExpired = await createEntry(db, "promotion", "demo-promocao-encerrada", "Promoção encerrada", (pl) => {
    pl.summary = `${TAG} Oferta de exemplo que já terminou.`;
    pl.details = {
      starts_at: new Date(now - DAY).toISOString(),
      ends_at: new Date(now + DAY).toISOString(),
      terms: `${TAG} Condições fictícias.`,
    };
    pl.relations.treatments = [tDrenagem.id];
  });
  await db.query("update public.promotion_details set starts_at = $2, ends_at = $3 where version_id = $1", [
    promoExpired.versionId,
    new Date(now - 20 * DAY).toISOString(),
    new Date(now - 2 * DAY).toISOString(),
  ]);

  await createEntry(db, "landing", "demo-campanha", "Campanha de exemplo", (pl) => {
    pl.summary = `${TAG} Landing page de exemplo (noindex).`;
    pl.details = { campaign_key: "demo_campanha", promotion_entry_id: promoActive.id, reduced_navigation: true };
    pl.blocks = [
      { id: newBlockId(), type: "features", heading: "Por que avaliar antes", items: [
        { title: "Avaliação individual", text: `${TAG} Texto de exemplo.` },
        { title: "Equipe habilitada", text: `${TAG} Texto de exemplo.` },
      ] },
      { id: newBlockId(), type: "faq_list", entryIds: [faq1.id, faq2.id] },
    ];
  });

  await createEntry(db, "blog_post", "demo-post", "Post de exemplo", (pl) => {
    pl.summary = `${TAG} Resumo de um conteúdo educativo de exemplo.`;
    pl.data = { mediaId: mPeeling };
    pl.blocks = [{ id: newBlockId(), type: "rich_text", body: p(`## Subtítulo de exemplo\n\n${demoBody}\n\n- Item de lista\n- Outro item`) }];
  });

  await createEntry(db, "page", "demo-sobre", "Sobre a clínica", (pl) => {
    pl.summary = `${TAG} Página institucional de exemplo.`;
    pl.blocks = [
      { id: newBlockId(), type: "rich_text", heading: "Nossa história", body: p(demoBody) },
      { id: newBlockId(), type: "team_list", heading: "Equipe", entryIds: [team.id] },
    ];
  });

  const homeBlocks: Block[] = [
    { id: newBlockId(), type: "banner_carousel", label: "Destaques (demonstração)", autoplay: true, intervalSeconds: 6, slides: [
      { key: newBlockId(), mediaId: mBanner1, mobile: { mediaId: mBanner1Mobile },
        title: `${TAG} Tecnologia, estética e cuidado`, text: "Texto de exemplo do banner (sujeito a aprovação).",
        action: { kind: "evaluation", label: "Agendar avaliação" } },
      { key: newBlockId(), mediaId: mBanner2, title: `${TAG} Promoção de exemplo`,
        action: { kind: "link", label: "Ver promoções", href: "/promocoes" } },
      { key: newBlockId(), mediaId: mBanner3 },
    ] },
    { id: newBlockId(), type: "hero", heading: `${TAG} Tecnologia, estética e cuidado para valorizar a sua melhor versão.`,
      subheading: "Texto de exemplo do destaque (sugestão da especificação, sujeita a aprovação).", mediaId: mHero,
      primary: { kind: "evaluation", label: "Agendar avaliação" }, secondary: { kind: "link", label: "Conhecer tratamentos", href: "/tratamentos" } },
    { id: newBlockId(), type: "category_list", heading: "Faciais e corporais" },
    { id: newBlockId(), type: "concern_list", heading: "O que você deseja tratar?" },
    { id: newBlockId(), type: "treatment_list", heading: "Tratamentos em destaque", entryIds: [tLimpeza.id, tPeeling.id, tDrenagem.id] },
    { id: newBlockId(), type: "features", heading: "Diferenciais (exemplo)", items: [
      { title: "Avaliação individual", text: `${TAG} Diferencial de exemplo — usar só o que for verificável.` },
      { title: "Ambiente acolhedor", text: `${TAG} Diferencial de exemplo.` },
      { title: "Equipe habilitada", text: `${TAG} Diferencial de exemplo.` },
    ] },
    { id: newBlockId(), type: "promotion_list", heading: "Promoções vigentes", limit: 3 },
    { id: newBlockId(), type: "testimonial_list", heading: "Depoimentos", entryIds: [testimonial.id] },
    { id: newBlockId(), type: "team_list", heading: "Equipe", entryIds: [team.id] },
    { id: newBlockId(), type: "faq_list", entryIds: [faq1.id, faq2.id] },
    { id: newBlockId(), type: "cta", heading: "Pronta para começar?", text: "Solicite uma avaliação; a equipe entra em contato.", action: { kind: "evaluation", label: "Agendar avaliação" } },
    { id: newBlockId(), type: "contact", heading: "Contato", showMap: true, showForm: true },
  ];
  await createEntry(db, "home", "home", "Página inicial", (pl) => {
    pl.blocks = homeBlocks;
  });

  console.log("Conteúdo de demonstração criado e publicado.");
}

// ---------------------------------------------------------------------------
// Remoção
// ---------------------------------------------------------------------------
async function remove(db: Client) {
  const entries = await db.query<{ id: string }>(
    `select e.id from public.content_entries e
      where e.slug like 'demo-%'
         or (e.type = 'home' and exists (
               select 1 from public.content_versions v where v.entry_id = e.id and v.title like '${TAG}%'))`,
  );
  const ids = entries.rows.map((r) => r.id);
  const media = await db.query<{ id: string; private_original_path: string; private_variants: { path: string }[]; public_variants: { path: string }[] }>(
    `select id, private_original_path, private_variants, public_variants from public.media_assets where alt like '${TAG}%'`,
  );

  if (ids.length) {
    // Algum conteúdo REAL aponta para a demonstração? Então não apaga.
    const realRefs = await db.query(
      `select 1 from public.version_entry_refs r join public.content_versions v on v.id = r.version_id
        where r.target_entry_id = any($1) and not (v.entry_id = any($1)) limit 1`,
      [ids],
    );
    if (realRefs.rowCount) throw new Error("Há conteúdo real usando itens de demonstração. Remova essas referências no painel antes.");

    await db.query("update public.content_entries set published_version_id = null, lifecycle_status = 'draft' where id = any($1)", [ids]);
    await db.query("delete from public.content_versions where entry_id = any($1)", [ids]);
    await db.query("delete from public.content_entries where id = any($1)", [ids]);
  }
  await db.query("delete from public.redirects where source_path like '%/demo-%' or target_path like '%/demo-%'");

  const mediaIds = media.rows.map((m) => m.id);
  if (mediaIds.length) {
    await db.query("delete from public.media_permissions where media_id = any($1)", [mediaIds]);
    await db.query("delete from public.media_assets where id = any($1)", [mediaIds]);
  }
  await db.query("delete from public.categories where slug like 'demo-%'");
  await db.query("delete from public.concerns where slug like 'demo-%'");

  // Banco primeiro (transação); depois os arquivos.
  await db.query("commit");
  await db.query("begin");
  const st = storage();
  for (const m of media.rows) {
    await st.from(PRIVATE_BUCKET).remove([m.private_original_path, ...m.private_variants.map((v) => v.path)]);
    await st.from(PUBLIC_BUCKET).remove(m.public_variants.map((v) => v.path));
  }
  console.log(`Removidos: ${ids.length} conteúdo(s), ${mediaIds.length} imagem(ns), taxonomias de demonstração.`);
}

/** Pede ao site em execução para invalidar o cache público (se configurado). */
async function revalidateSite() {
  const secret = process.env.REVALIDATE_SECRET;
  const site = process.env.REVALIDATE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !site) {
    console.log("Defina REVALIDATE_SECRET para atualizar o site na hora; sem ele, o cache expira em até 1 h.");
    return;
  }
  try {
    const base = site.endsWith("/") ? site.slice(0, -1) : site;
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(res.ok ? "Cache do site invalidado." : `Revalidação respondeu ${res.status}; o cache expira em até 1 h.`);
  } catch {
    console.log("Site não está em execução; nada a invalidar agora.");
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "seed" && mode !== "remove") throw new Error("Use: seed | remove");
  const db = new Client({ connectionString: env("DATABASE_URL") });
  await db.connect();
  try {
    await db.query("begin");
    if (mode === "seed") await seed(db);
    else await remove(db);
    await db.query("commit");
    await revalidateSite();
  } catch (error) {
    await db.query("rollback").catch(() => {});
    for (const bucket of [PRIVATE_BUCKET, PUBLIC_BUCKET]) {
      const paths = uploaded.filter((u) => u.bucket === bucket).map((u) => u.path);
      if (paths.length) await storage().from(bucket).remove(paths);
    }
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
