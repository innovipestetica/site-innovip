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
describe.skipIf(!hasDatabase)("fundação: admin_accounts, autorização e grants", () => {
  it("anônimo não acessa o schema privado nem as RPCs do painel", async () => {
    await inRollbackTransaction(async (db) => {
      await expect(
        asRole(db, "anon", null, () => db.query("select * from private.admin_accounts")),
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
        "select * from private.admin_accounts",
        "select * from private.audit_logs",
        `insert into private.admin_accounts (user_id) values ('${other.id}')`,
        `update private.admin_accounts set user_id = '${other.id}'`,
        "delete from private.admin_accounts",
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
          db.query("select * from private.admin_accounts"),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("dois administradores: cada um com MFA próprio e auditoria com o próprio autor", async () => {
    await inRollbackTransaction(async (db) => {
      const a = await createAuthUser(db);
      const b = await createAuthUser(db);
      await makeAdmin(db, a);
      await makeAdmin(db, b, { reset: false });

      for (const admin of [a, b]) {
        const ok = await asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
          db.query<{ s: string }>("select public.admin_session_status() as s"),
        );
        expect(ok.rows[0]?.s).toBe("ok");

        const semMfa = await asRole(db, "authenticated", userClaims(admin, "aal1"), () =>
          db.query<{ s: string }>("select public.admin_session_status() as s"),
        );
        expect(semMfa.rows[0]?.s).toBe("mfa_required");

        await asRole(db, "authenticated", userClaims(admin, "aal2"), () =>
          db.query("select public.log_admin_auth_event('auth.sign_in')"),
        );
        const log = await db.query<{ actor_user_id: string }>(
          "select actor_user_id from private.audit_logs order by id desc limit 1",
        );
        expect(log.rows[0]?.actor_user_id).toBe(admin.id);
      }
    });
  });

  it("administrador removido perde o acesso na hora", async () => {
    await inRollbackTransaction(async (db) => {
      const a = await createAuthUser(db);
      const b = await createAuthUser(db);
      await makeAdmin(db, a);
      await makeAdmin(db, b, { reset: false });

      await db.query("delete from private.admin_accounts where user_id = $1", [b.id]);
      const res = await asRole(db, "authenticated", userClaims(b, "aal2"), () =>
        db.query<{ s: string; a: boolean }>(
          "select public.admin_session_status() as s, private.is_admin() as a",
        ),
      );
      expect(res.rows[0]).toEqual({ s: "not_admin", a: false });
    });
  });

  it("sem duplicidade e no máximo 5 administradores", async () => {
    await inRollbackTransaction(async (db) => {
      const users = [];
      for (let i = 0; i < 6; i++) users.push(await createAuthUser(db));
      const [first, , , , , sixth] = users;
      await makeAdmin(db, first!);

      await db.query("savepoint dup");
      await expect(
        db.query("insert into private.admin_accounts (user_id) values ($1)", [first!.id]),
      ).rejects.toThrow(/duplicate key|admin_accounts_pkey/);
      await db.query("rollback to savepoint dup");

      for (const u of users.slice(1, 5)) await makeAdmin(db, u, { reset: false });
      await expect(
        db.query("insert into private.admin_accounts (user_id) values ($1)", [sixth!.id]),
      ).rejects.toThrow(/limite de administradores/);
    });
  });

  it("service_role (chave secreta) também não altera admin_accounts", async () => {
    await inRollbackTransaction(async (db) => {
      const a = await createAuthUser(db);
      await expect(
        asRole(db, "service_role", { role: "service_role" }, () =>
          db.query("insert into private.admin_accounts (user_id) values ($1)", [a.id]),
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
