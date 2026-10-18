import { describe, expect, it } from "vitest";
import {
  asRole,
  createAuthUser,
  hasDatabase,
  inRollbackTransaction,
  makeAdmin,
  userClaims,
} from "./helpers";

/**
 * Matriz de acesso da etapa 1 (seção 12 da especificação), testada com os
 * papéis reais do Supabase — não com service_role.
 */
describe.skipIf(!hasDatabase)("fundação: admin_account, autorização e grants", () => {
  it("anônimo não acessa o schema privado nem as RPCs do painel", async () => {
    await inRollbackTransaction(async (db) => {
      await expect(
        asRole(db, "anon", null, () => db.query("select * from private.admin_account")),
      ).rejects.toThrow(/permission denied/);

      await expect(
        asRole(db, "anon", null, () => db.query("select public.admin_session_status()")),
      ).rejects.toThrow(/permission denied/);

      await expect(
        asRole(db, "anon", null, () =>
          db.query("select public.log_admin_auth_event('auth.sign_in')"),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("autenticado que não é admin: status not_admin e sem acesso às tabelas", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await createAuthUser(db);
      const other = await createAuthUser(db);
      await makeAdmin(db, admin);

      const status = await asRole(db, "authenticated", userClaims(other, "aal2"), () =>
        db.query<{ s: string }>("select public.admin_session_status() as s"),
      );
      expect(status.rows[0]?.s).toBe("not_admin");

      const isAdmin = await asRole(db, "authenticated", userClaims(other, "aal2"), () =>
        db.query<{ v: boolean }>("select private.is_admin() as v"),
      );
      expect(isAdmin.rows[0]?.v).toBe(false);

      for (const sql of [
        "select * from private.admin_account",
        "select * from private.audit_logs",
        `insert into private.admin_account (singleton, user_id) values (1, '${other.id}')`,
        `update private.admin_account set user_id = '${other.id}'`,
        "delete from private.admin_account",
        "select private.write_audit_log('auth.sign_in')",
      ]) {
        await expect(
          asRole(db, "authenticated", userClaims(other, "aal2"), () => db.query(sql)),
          sql,
        ).rejects.toThrow(/permission denied/);
      }

      await expect(
        asRole(db, "authenticated", userClaims(other, "aal2"), () =>
          db.query("select public.log_admin_auth_event('auth.sign_in')"),
        ),
      ).rejects.toThrow(/forbidden/);
    });
  });

  it("admin sem MFA (aal1) fica em mfa_required e is_admin() = false", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await createAuthUser(db);
      await makeAdmin(db, admin);

      const res = await asRole(db, "authenticated", userClaims(admin, "aal1"), () =>
        db.query<{ s: string; a: boolean; u: boolean }>(
          "select public.admin_session_status() as s, private.is_admin() as a, private.is_admin_user() as u",
        ),
      );
      expect(res.rows[0]).toEqual({ s: "mfa_required", a: false, u: true });
    });
  });

  it("admin com MFA (aal2) fica ok, is_admin() = true e registra auditoria", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await createAuthUser(db);
      await makeAdmin(db, admin);

      const res = await asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
        db.query<{ s: string; a: boolean }>(
          "select public.admin_session_status() as s, private.is_admin() as a",
        ),
      );
      expect(res.rows[0]).toEqual({ s: "ok", a: true });

      await asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
        db.query("select public.log_admin_auth_event('auth.mfa_verified')"),
      );
      const log = await db.query<{ actor_user_id: string; action: string }>(
        "select actor_user_id, action from private.audit_logs order by id desc limit 1",
      );
      expect(log.rows[0]).toEqual({ actor_user_id: admin.id, action: "auth.mfa_verified" });

      await expect(
        asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
          db.query("select public.log_admin_auth_event('content.delete_all')"),
        ),
      ).rejects.toThrow(/invalid action/);

      // Mesmo o admin não lê nem altera a tabela diretamente.
      await expect(
        asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
          db.query("select * from private.admin_account"),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("singleton: no máximo um administrador", async () => {
    await inRollbackTransaction(async (db) => {
      const a = await createAuthUser(db);
      const b = await createAuthUser(db);
      await makeAdmin(db, a);

      await db.query("savepoint dup");
      await expect(
        db.query("insert into private.admin_account (user_id) values ($1)", [b.id]),
      ).rejects.toThrow(/duplicate key|admin_account_pkey/);
      await db.query("rollback to savepoint dup");

      await expect(
        db.query("insert into private.admin_account (singleton, user_id) values (2, $1)", [b.id]),
      ).rejects.toThrow(/admin_account_singleton/);
    });
  });

  it("service_role (chave secreta) também não altera admin_account", async () => {
    await inRollbackTransaction(async (db) => {
      const a = await createAuthUser(db);
      await expect(
        asRole(db, "service_role", { role: "service_role" }, () =>
          db.query("insert into private.admin_account (user_id) values ($1)", [a.id]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("tabelas novas no public nascem sem grants para anon/authenticated", async () => {
    await inRollbackTransaction(async (db) => {
      await db.query("create table public.__grant_probe (id int)");
      const res = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_table_privilege('anon', 'public.__grant_probe', 'select') as anon,
                has_table_privilege('authenticated', 'public.__grant_probe', 'select') as auth`,
      );
      expect(res.rows[0]).toEqual({ anon: false, auth: false });
    });
  });
});

describe.runIf(!hasDatabase)("fundação (sem DATABASE_URL)", () => {
  it.skip("testes de RLS ignorados: defina DATABASE_URL em .env.local", () => {});
});
