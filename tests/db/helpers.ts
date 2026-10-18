import { randomUUID } from "node:crypto";
import { Client, type PoolClient } from "pg";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export type Role = "anon" | "authenticated" | "service_role";

export type TestUser = { id: string; email: string };

/**
 * Abre uma transação como dono do banco, executa `fn` e SEMPRE dá ROLLBACK.
 * Nada do que os testes criam (usuários, admin) fica no banco.
 */
export async function inRollbackTransaction(
  fn: (db: Client) => Promise<void>,
): Promise<void> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin");
    await fn(db);
  } finally {
    await db.query("rollback");
    await db.end();
  }
}

export async function createAuthUser(db: Client | PoolClient): Promise<TestUser> {
  const id = randomUUID();
  const email = `rls-test-${id}@example.invalid`;
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now())`,
    [id, email],
  );
  return { id, email };
}

/**
 * Torna `user` administrador (só dentro da transação). Limpa a lista antes
 * para os testes não dependerem dos administradores reais do projeto.
 */
export async function makeAdmin(db: Client, user: TestUser, { reset = true } = {}): Promise<void> {
  if (reset) await db.query("delete from private.admin_accounts");
  await db.query("insert into private.admin_accounts (user_id) values ($1)", [user.id]);
}

/**
 * Troca para um papel real do PostgREST com as claims do JWT, como o
 * Supabase faz em cada requisição. Usa savepoint para permitir esperar erros.
 */
export async function asRole<T>(
  db: Client,
  role: Role,
  claims: Record<string, unknown> | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query("savepoint as_role");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims ?? { role }),
    ]);
    await db.query(`set local role ${role}`);
    const result = await fn();
    await db.query("reset role");
    await db.query("release savepoint as_role");
    return result;
  } catch (error) {
    await db.query("rollback to savepoint as_role");
    await db.query("reset role");
    throw error;
  }
}

export function userClaims(user: TestUser, aal: "aal1" | "aal2") {
  return {
    sub: user.id,
    role: "authenticated",
    aud: "authenticated",
    email: user.email,
    aal,
  };
}
