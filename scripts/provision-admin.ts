/**
 * Provisiona (ou substitui) o administrador único.
 *
 * Uso: npm run admin:provision -- --email admin@exemplo.com.br [--replace]
 *
 * Pré-requisitos:
 * - O usuário já existe em Authentication → Users (criado pelo dashboard com
 *   "Send invitation" ou "Create new user" + "Auto Confirm"). Este script não
 *   cria senha nem conta: só vincula um usuário existente ao painel.
 * - DATABASE_URL em .env.local (conexão do dono do banco, nunca no Git).
 *
 * Não existe endpoint público de bootstrap: a única forma de virar
 * administrador é esta operação com a credencial do banco.
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const replace = process.argv.includes("--replace");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe --email com um e-mail válido.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente em .env.local.");
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin");

    const user = await db.query<{ id: string; confirmed: boolean }>(
      `select id, email_confirmed_at is not null as confirmed
         from auth.users where lower(email) = $1 and deleted_at is null`,
      [email],
    );
    const found = user.rows[0];
    if (!found) throw new Error("Usuário não encontrado em auth.users. Crie-o no dashboard primeiro.");
    if (!found.confirmed) throw new Error("O e-mail do usuário ainda não foi confirmado.");

    const current = await db.query<{ user_id: string }>(
      "select user_id from private.admin_account for update",
    );
    const existing = current.rows[0];

    if (existing?.user_id === found.id) {
      console.log("Este usuário já é o administrador. Nada a fazer.");
      await db.query("rollback");
      return;
    }
    if (existing && !replace) {
      throw new Error("Já existe um administrador. Use --replace para substituí-lo.");
    }

    await db.query(
      `insert into private.admin_account (singleton, user_id) values (1, $1)
       on conflict (singleton) do update set user_id = excluded.user_id, updated_at = now()`,
      [found.id],
    );
    await db.query(
      `insert into private.audit_logs (actor_user_id, action, resource_type, resource_id)
       values (null, $1, 'admin_account', $2)`,
      [existing ? "admin.replaced" : "admin.provisioned", found.id],
    );

    if (existing) {
      // Encerra as sessões do administrador anterior.
      await db.query("delete from auth.sessions where user_id = $1", [existing.user_id]);
    }

    await db.query("commit");
    console.log(existing ? "Administrador substituído." : "Administrador provisionado.");
    console.log("No primeiro login, o painel pedirá para configurar o MFA (TOTP).");
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao provisionar.");
  process.exit(1);
});
