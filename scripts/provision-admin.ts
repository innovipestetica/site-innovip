/**
 * Adiciona ou remove administradores do painel.
 *
 * Uso:
 *   npm run admin:provision -- --email pessoa@exemplo.com.br
 *   npm run admin:provision -- --email pessoa@exemplo.com.br --remove
 *   npm run admin:provision -- --list
 *
 * Pré-requisitos:
 * - O usuário já existe em Authentication → Users, com e-mail confirmado
 *   (criado pelo dashboard). Este script não cria conta nem senha: só
 *   vincula ou desvincula um usuário existente.
 * - DATABASE_URL em .env.local (conexão do dono do banco, nunca no Git).
 *
 * Não existe endpoint público de bootstrap: só quem tem a credencial do
 * banco consegue tornar alguém administrador. Máximo de 5 (trigger no banco).
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function list(db: Client) {
  const res = await db.query<{ email: string; desde: string; mfa: boolean }>(
    `select u.email, a.created_at::date::text as desde,
            exists (select 1 from auth.mfa_factors f
                     where f.user_id = u.id and f.status = 'verified') as mfa
       from private.admin_accounts a join auth.users u on u.id = a.user_id
      order by a.created_at`,
  );
  if (res.rows.length === 0) console.log("Nenhum administrador cadastrado.");
  for (const r of res.rows) {
    console.log(`- ${r.email} (desde ${r.desde}, MFA ${r.mfa ? "configurado" : "pendente"})`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente em .env.local.");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    if (process.argv.includes("--list")) return await list(db);

    const email = arg("email")?.trim().toLowerCase();
    const remove = process.argv.includes("--remove");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Informe --email com um e-mail válido (ou use --list).");
    }

    await db.query("begin");

    const user = await db.query<{ id: string; confirmed: boolean }>(
      `select id, email_confirmed_at is not null as confirmed
         from auth.users where lower(email) = $1 and deleted_at is null`,
      [email],
    );
    const found = user.rows[0];
    if (!found) throw new Error("Usuário não encontrado em auth.users. Crie-o no dashboard primeiro.");

    // Trava a lista para decisões consistentes (ex.: não remover o último).
    const current = await db.query<{ user_id: string }>(
      "select user_id from private.admin_accounts for update",
    );
    const isAdmin = current.rows.some((r) => r.user_id === found.id);

    if (remove) {
      if (!isAdmin) {
        console.log("Este usuário não é administrador. Nada a fazer.");
        await db.query("rollback");
        return;
      }
      if (current.rows.length === 1) {
        throw new Error("É o último administrador. Adicione outro antes de remover este.");
      }
      await db.query("delete from private.admin_accounts where user_id = $1", [found.id]);
      // Encerra as sessões abertas de quem perdeu o acesso.
      await db.query("delete from auth.sessions where user_id = $1", [found.id]);
      await db.query(
        `insert into private.audit_logs (actor_user_id, action, resource_type, resource_id)
         values (null, 'admin.removed', 'admin_accounts', $1)`,
        [found.id],
      );
      await db.query("commit");
      console.log("Administrador removido e sessões encerradas.");
      return;
    }

    if (!found.confirmed) throw new Error("O e-mail do usuário ainda não foi confirmado.");
    if (isAdmin) {
      console.log("Este usuário já é administrador. Nada a fazer.");
      await db.query("rollback");
      return;
    }

    await db.query("insert into private.admin_accounts (user_id) values ($1)", [found.id]);
    await db.query(
      `insert into private.audit_logs (actor_user_id, action, resource_type, resource_id)
       values (null, 'admin.provisioned', 'admin_accounts', $1)`,
      [found.id],
    );
    await db.query("commit");
    console.log("Administrador adicionado.");
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
