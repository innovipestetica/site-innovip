/**
 * Cadastro de tratamentos em lote, sempre como RASCUNHO (nada é publicado).
 *
 *   npm run tratamentos:importar -- lista.txt            # só simula
 *   npm run tratamentos:importar -- lista.txt --aplicar  # grava
 *
 * Uma linha por tratamento (linhas vazias e começadas com # são ignoradas):
 *
 *   Título | Categorias | Objetivos | Resumo
 *
 * Só o título é obrigatório. Várias categorias/objetivos separados por ";".
 * Os nomes precisam existir em "Categorias e objetivos" (maiúsculas e acentos
 * não importam). Exemplo em scripts/exemplos/tratamentos.txt.
 *
 * - Endereço (slug) gerado do título; se já existir, a linha é pulada.
 * - Conteúdo inicial igual ao do botão "Novo" do painel (blocos padrão).
 * - Tudo ou nada: qualquer erro desfaz a importação inteira.
 *
 * Grava como DONO DO BANCO (DATABASE_URL): a auditoria registra autor nulo,
 * sem se passar por um administrador.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { initialPayload, slugify, validatePayload } from "../src/lib/cms/content-types";
import { newBlockId } from "../src/lib/cms/blocks";

config({ path: ".env.local", quiet: true });

type Row = { line: number; title: string; slug: string; categories: string[]; concerns: string[]; summary?: string };
type Taxonomy = { id: string; name: string; status: string };

const norm = (s: string) => slugify(s);
const list = (s: string | undefined) => (s ?? "").split(";").map((x) => x.trim()).filter(Boolean);

function parse(file: string): Row[] {
  const rows: Row[] = [];
  readFileSync(file, "utf8").split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text || text.startsWith("#")) return;
    const [title = "", cats, concerns, summary] = text.split("|").map((x) => x.trim());
    rows.push({
      line: i + 1,
      title,
      slug: slugify(title),
      categories: list(cats),
      concerns: list(concerns),
      summary: summary || undefined,
    });
  });
  return rows;
}

function resolveNames(names: string[], items: Taxonomy[], kind: string, line: number, errors: string[]): string[] {
  return names.flatMap((name) => {
    const hit = items.find((t) => norm(t.name) === norm(name) && t.status !== "archived");
    if (!hit) {
      errors.push(`linha ${line}: ${kind} "${name}" não existe (ou está arquivada).`);
      return [];
    }
    if (hit.status !== "published") console.warn(`  aviso linha ${line}: ${kind} "${hit.name}" está em rascunho; publique antes de publicar o tratamento.`);
    return [hit.id];
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--aplicar");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Informe o arquivo: npm run tratamentos:importar -- lista.txt [--aplicar]");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente em .env.local.");

  const rows = parse(file);
  if (rows.length === 0) throw new Error("Nenhum tratamento no arquivo.");

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const cats = await db.query<Taxonomy>("select id, name, status from public.categories");
    const concerns = await db.query<Taxonomy>("select id, name, status from public.concerns");
    const existing = await db.query<{ slug: string }>("select slug from public.content_entries where type = 'treatment'");
    const inDb = new Set(existing.rows.map((r) => r.slug));
    const inFile = new Set<string>();

    const errors: string[] = [];
    const plan: { row: Row; payload: unknown; labels: string[] }[] = [];
    const skipped: { row: Row; reason: string }[] = [];
    for (const row of rows) {
      if (!row.title || !row.slug) {
        errors.push(`linha ${row.line}: título vazio.`);
        continue;
      }
      if (inDb.has(row.slug) || inFile.has(row.slug)) {
        skipped.push({ row, reason: inDb.has(row.slug) ? "já existe no painel" : `repete a linha anterior` });
        continue;
      }
      inFile.add(row.slug);
      const payload = initialPayload("treatment", row.title, newBlockId);
      payload.relations.categories = resolveNames(row.categories, cats.rows, "categoria", row.line, errors);
      payload.relations.concerns = resolveNames(row.concerns, concerns.rows, "objetivo", row.line, errors);
      if (row.summary) payload.summary = row.summary;
      const v = validatePayload("treatment", payload);
      if (!v.ok) {
        errors.push(`linha ${row.line}: ${v.issues.map((x) => x.message).join("; ")}`);
        continue;
      }
      const nameOf = (items: Taxonomy[], ids: string[]) => ids.map((id) => items.find((t) => t.id === id)!.name);
      const labels = [...nameOf(cats.rows, payload.relations.categories), ...nameOf(concerns.rows, payload.relations.concerns)];
      plan.push({ row, payload: v.payload, labels });
    }

    for (const { row, reason } of skipped) console.log(`  pulado   /tratamentos/${row.slug} (linha ${row.line}: ${reason})`);
    for (const { row, labels } of plan) {
      console.log(`  ${apply ? "criando " : "criaria "} /tratamentos/${row.slug}  ${row.title}${labels.length ? `  [${labels.join(", ")}]` : ""}`);
    }
    if (errors.length) {
      console.error("\nNada foi gravado. Corrija o arquivo:");
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log(`\nSimulação: ${plan.length} a criar, ${skipped.length} pulado(s). Para gravar, repita com --aplicar.`);
      return;
    }

    await db.query("begin");
    try {
      for (const { row, payload } of plan) {
        const entry = await db.query<{ id: string }>(
          "insert into public.content_entries (type, slug, latest_revision) values ('treatment', $1, 1) returning id",
          [row.slug],
        );
        await db.query("select private.cms_insert_version($1, 'treatment', 1, $2)", [entry.rows[0]!.id, JSON.stringify(payload)]);
      }
      await db.query("commit");
    } catch (e) {
      await db.query("rollback").catch(() => {});
      throw e;
    }
    console.log(`\nPronto: ${plan.length} rascunho(s) criado(s), ${skipped.length} pulado(s). Revise e publique pelo painel.`);
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
