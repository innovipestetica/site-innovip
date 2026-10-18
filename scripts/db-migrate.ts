/**
 * Aplica as migrações de supabase/migrations/ que ainda não rodaram.
 *
 * Uso:
 *   npm run db:migrate -- --dry-run      # ensaio: roda tudo e dá ROLLBACK
 *   npm run db:migrate                   # aplica (uma transação por arquivo)
 *   npm run db:migrate -- --mark-applied 20261018120000   # registra sem rodar
 *
 * Registra em supabase_migrations.schema_migrations, a mesma tabela da CLI
 * do Supabase (`supabase db push` enxerga o que foi aplicado aqui).
 * Usa DATABASE_URL de .env.local. Nunca aponte para produção sem backup.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });

const DIR = join(process.cwd(), "supabase", "migrations");
const FILE_RE = /^(\d{14})_([a-z0-9_]+)\.sql$/;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente em .env.local.");
  const dryRun = process.argv.includes("--dry-run");
  const markIdx = process.argv.indexOf("--mark-applied");
  const markVersion = markIdx >= 0 ? process.argv[markIdx + 1] : undefined;

  const files = readdirSync(DIR)
    .filter((f) => FILE_RE.test(f))
    .sort();

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("create schema if not exists supabase_migrations");
    await db.query(
      `create table if not exists supabase_migrations.schema_migrations (
         version text not null primary key, statements text[], name text)`,
    );
    const applied = new Set(
      (await db.query<{ version: string }>("select version from supabase_migrations.schema_migrations"))
        .rows.map((r) => r.version),
    );

    if (markVersion) {
      const file = files.find((f) => f.startsWith(`${markVersion}_`));
      if (!file) throw new Error(`Migração ${markVersion} não encontrada.`);
      const [, version, name] = FILE_RE.exec(file)!;
      await db.query(
        "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict do nothing",
        [version, name],
      );
      console.log(`Registrada como aplicada: ${file}`);
      return;
    }

    const pending = files.filter((f) => !applied.has(FILE_RE.exec(f)![1]!));
    if (pending.length === 0) {
      console.log("Nenhuma migração pendente.");
      return;
    }

    if (dryRun) await db.query("begin");
    for (const file of pending) {
      const [, version, name] = FILE_RE.exec(file)!;
      const sql = readFileSync(join(DIR, file), "utf8");
      if (!dryRun) await db.query("begin");
      try {
        await db.query(sql);
        await db.query(
          "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)",
          [version, name],
        );
        if (!dryRun) await db.query("commit");
        console.log(`${dryRun ? "ensaio ok" : "aplicada"}: ${file}`);
      } catch (error) {
        await db.query("rollback").catch(() => {});
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Falhou em ${file}: ${message}`);
      }
    }
    if (dryRun) {
      await db.query("rollback");
      console.log("Ensaio concluído: nada foi alterado (ROLLBACK).");
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na migração.");
  process.exit(1);
});
