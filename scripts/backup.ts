/**
 * Backup lógico do CONTEÚDO do site + arquivos do Storage, e verificação de
 * restauração isolada. Complementa (não substitui) os backups do Supabase.
 *
 *   npm run backup:export                 # cria backups/<data-hora>/
 *   npm run backup:verify -- backups/<pasta>
 *
 * export: tabelas de conteúdo/configuração (public) e vínculo dos
 *   administradores, em JSON, mais todos os objetos dos buckets de mídia.
 *   NÃO exporta registros de consentimento nem auditoria (não são necessários
 *   para reconstruir o site e reduzem exposição de dados).
 * verify: cria um schema TEMPORÁRIO com a mesma estrutura, carrega o JSON,
 *   compara contagens e checksums com o export e confere tamanho de cada
 *   arquivo; no fim, ROLLBACK (nada muda no banco).
 *
 * A pasta backups/ está no .gitignore: contém originais de imagens e dados
 * internos. Guarde-a em local seguro e com acesso restrito.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const TABLES = [
  "categories", "concerns", "media_assets", "media_permissions", "content_entries", "content_versions",
  "version_entry_refs", "version_media_refs", "treatment_details", "treatment_categories", "treatment_concerns",
  "promotion_details", "promotion_treatments", "landing_details", "site_settings_public", "redirects",
] as const;
const BUCKETS = ["media-private", "media-public"] as const;

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ausente em .env.local.`);
  return v;
}

const storage = () =>
  createClient(env("NEXT_PUBLIC_SUPABASE_URL"), process.env.SUPABASE_SECRET_KEY ?? env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;

/** Checksum estável de uma tabela (linhas ordenadas por JSON). */
function checksum(rows: unknown[]): string {
  const lines = rows.map((r) => JSON.stringify(r)).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

async function listAll(bucket: string, prefix = ""): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  const { data, error } = await storage().from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}: ${error.message}`);
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) out.push(...(await listAll(bucket, path))); // pasta
    else out.push({ path, size: Number(item.metadata?.size ?? 0) });
  }
  return out;
}

async function exportBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("backups", stamp);
  mkdirSync(dir, { recursive: true });

  const db = new Client({ connectionString: env("DATABASE_URL") });
  await db.connect();
  const manifest: Record<string, unknown> = { created_at: new Date().toISOString(), tables: {}, files: {} };
  try {
    // Leitura consistente de todas as tabelas.
    await db.query("begin isolation level repeatable read read only");
    const data: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      const rows = (await db.query(`select to_jsonb(t) as r from public.${t} t`)).rows.map((x) => x.r);
      data[t] = rows;
      (manifest.tables as Record<string, unknown>)[t] = { rows: rows.length, sha256: checksum(rows) };
    }
    data.admin_accounts = (await db.query("select to_jsonb(a) as r from private.admin_accounts a")).rows.map((x) => x.r);
    await db.query("commit");
    writeFileSync(join(dir, "db.json"), JSON.stringify(data));
  } finally {
    await db.end();
  }

  for (const bucket of BUCKETS) {
    const files = await listAll(bucket);
    const entries: { path: string; size: number; sha256: string }[] = [];
    for (const f of files) {
      const { data: blob, error } = await storage().from(bucket).download(f.path);
      if (error || !blob) throw new Error(`download ${bucket}/${f.path}: ${error?.message}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const target = join(dir, "storage", bucket, f.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buf);
      entries.push({ path: f.path, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
    }
    (manifest.files as Record<string, unknown>)[bucket] = entries;
  }

  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  const counts = Object.entries(manifest.tables as Record<string, { rows: number }>).map(([t, v]) => `${t}=${v.rows}`).join(", ");
  const files = BUCKETS.map((b) => `${b}=${((manifest.files as Record<string, unknown[]>)[b] ?? []).length}`).join(", ");
  console.log(`Backup em ${dir}\nTabelas: ${counts}\nArquivos: ${files}`);
}

async function verifyBackup(dir: string) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const data = JSON.parse(readFileSync(join(dir, "db.json"), "utf8")) as Record<string, unknown[]>;
  const problems: string[] = [];

  // 1) Arquivos: existem e batem tamanho e hash.
  let fileCount = 0;
  for (const bucket of BUCKETS) {
    for (const f of manifest.files[bucket] as { path: string; size: number; sha256: string }[]) {
      const p = join(dir, "storage", bucket, f.path);
      try {
        const buf = readFileSync(p);
        if (buf.length !== f.size || createHash("sha256").update(buf).digest("hex") !== f.sha256) problems.push(`arquivo alterado: ${bucket}/${f.path}`);
        fileCount++;
      } catch {
        problems.push(`arquivo ausente: ${bucket}/${f.path}`);
      }
    }
  }

  // 2) Banco: carrega num schema temporário com a mesma estrutura e confere.
  const db = new Client({ connectionString: env("DATABASE_URL") });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("create schema restore_test");
    for (const t of TABLES) {
      await db.query(`create table restore_test.${t} (like public.${t} including defaults including constraints)`);
      // Colunas geradas/identidade são inseridas como vieram no backup.
      const rows = data[t] ?? [];
      if (rows.length) {
        await db.query(
          `insert into restore_test.${t} select * from jsonb_populate_recordset(null::restore_test.${t}, $1::jsonb)`,
          [JSON.stringify(rows)],
        );
      }
      const back = (await db.query(`select to_jsonb(t) as r from restore_test.${t} t`)).rows.map((x) => x.r);
      const expected = manifest.tables[t] as { rows: number; sha256: string };
      if (back.length !== expected.rows) problems.push(`${t}: ${back.length} linhas restauradas, esperado ${expected.rows}`);
      else if (checksum(back) !== expected.sha256) problems.push(`${t}: conteúdo restaurado difere do original`);
    }
    // Integridade referencial do conjunto restaurado (amostra crítica).
    const orphan = await db.query(
      `select count(*)::int n from restore_test.content_entries e
        where e.published_version_id is not null
          and not exists (select 1 from restore_test.content_versions v where v.id = e.published_version_id and v.entry_id = e.id)`,
    );
    if (orphan.rows[0].n) problems.push(`${orphan.rows[0].n} conteúdo(s) com versão publicada ausente`);
    const mediaMissing = (data.media_assets as { private_original_path: string }[]).filter(
      (m) => !(manifest.files["media-private"] as { path: string }[]).some((f) => f.path === m.private_original_path),
    );
    if (mediaMissing.length) problems.push(`${mediaMissing.length} mídia(s) sem arquivo original no backup`);
  } finally {
    await db.query("rollback").catch(() => {});
    await db.end();
  }

  const total = Object.values(manifest.tables as Record<string, { rows: number }>).reduce((s, v) => s + v.rows, 0);
  if (problems.length) {
    console.error(`FALHOU (${problems.length} problema[s]):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Restauração verificada: ${total} linhas em ${TABLES.length} tabelas e ${fileCount} arquivos íntegros (schema temporário desfeito).`);
}

const [mode, dirArg] = process.argv.slice(2);
(mode === "export"
  ? exportBackup()
  : mode === "verify"
    ? verifyBackup(dirArg ?? (() => {
        const dirs = readdirSync("backups").filter((d) => statSync(join("backups", d)).isDirectory()).sort();
        if (!dirs.length) throw new Error("Nenhum backup em backups/.");
        return join("backups", dirs.at(-1)!);
      })())
    : Promise.reject(new Error("Use: export | verify [pasta]"))
).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
