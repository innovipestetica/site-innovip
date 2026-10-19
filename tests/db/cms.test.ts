import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  asRole,
  createAuthUser,
  hasDatabase,
  inRollbackTransaction,
  makeAdmin,
  userClaims,
  type TestUser,
} from "./helpers";

/**
 * CMS (etapa 2): versionamento, publicação, RLS e grants com papéis reais.
 * Tudo roda em transação com ROLLBACK.
 */

type Created = { entry_id: string; version_id: string; revision: number };

async function setupAdmin(db: Client) {
  const admin = await createAuthUser(db);
  await makeAdmin(db, admin);
  return admin;
}

function asAdmin<T>(db: Client, admin: TestUser, fn: () => Promise<T>) {
  return asRole(db, "authenticated", userClaims(admin, "aal2"), fn);
}

function asAnon<T>(db: Client, fn: () => Promise<T>) {
  return asRole(db, "anon", null, fn);
}

async function create(
  db: Client,
  admin: TestUser,
  type: string,
  slug: string,
  payload: Record<string, unknown>,
): Promise<Created> {
  const res = await asAdmin(db, admin, () =>
    db.query<Created>("select * from public.cms_create_entry($1, $2, $3)", [
      type,
      slug,
      JSON.stringify(payload),
    ]),
  );
  return res.rows[0]!;
}

async function save(db: Client, admin: TestUser, entryId: string, base: number, payload: object) {
  const res = await asAdmin(db, admin, () =>
    db.query<{ version_id: string; revision: number }>(
      "select * from public.cms_save_version($1, $2, $3)",
      [entryId, base, JSON.stringify(payload)],
    ),
  );
  return res.rows[0]!;
}

function publish(db: Client, admin: TestUser, entryId: string, versionId: string) {
  return asAdmin(db, admin, () => db.query("select public.cms_publish($1, $2)", [entryId, versionId]));
}

const REVIEWED = { clinical_reviewer: "Dra. Responsável (teste)", clinical_reviewed_on: "2026-10-01" };

describe.skipIf(!hasDatabase)("CMS: versionamento e publicação", () => {
  it("rascunho não aparece para anônimo; publicação expõe só a versão publicada", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const t = await create(db, admin, "treatment", "limpeza-teste", {
        title: "Limpeza v1",
        details: REVIEWED,
      });

      const before = await asAnon(db, () =>
        db.query("select id from public.content_entries where id = $1", [t.entry_id]),
      );
      expect(before.rowCount).toBe(0);

      await publish(db, admin, t.entry_id, t.version_id);

      // Nova revisão (rascunho) depois de publicar.
      const v2 = await save(db, admin, t.entry_id, 1, { title: "Limpeza v2 (rascunho)", details: REVIEWED });
      expect(v2.revision).toBe(2);

      const anonView = await asAnon(db, () =>
        db.query<{ title: string }>(
          `select v.title from public.content_entries e
             join public.content_versions v on v.id = e.published_version_id
            where e.id = $1`,
          [t.entry_id],
        ),
      );
      expect(anonView.rows).toEqual([{ title: "Limpeza v1" }]);

      const draftDirect = await asAnon(db, () =>
        db.query("select id from public.content_versions where id = $1", [v2.version_id]),
      );
      expect(draftDirect.rowCount).toBe(0);

      // Colunas internas não são expostas ao anônimo.
      await expect(
        asAnon(db, () => db.query("select created_by from public.content_versions")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asAnon(db, () => db.query("select clinical_reviewer from public.treatment_details")),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("salvar com revisão desatualizada gera conflito (PT409)", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const t = await create(db, admin, "page", "sobre-teste", { title: "Sobre" });
      await save(db, admin, t.entry_id, 1, { title: "Aba A" });
      await expect(save(db, admin, t.entry_id, 1, { title: "Aba B" })).rejects.toMatchObject({
        code: "PT409",
      });
    });
  });

  it("tratamento publica sem registro de revisão clínica (exigência removida)", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const t = await create(db, admin, "treatment", "sem-revisao", { title: "Sem revisão" });
      await expect(publish(db, admin, t.entry_id, t.version_id)).resolves.toBeDefined();
    });
  });

  it("categoria arquivada ainda marcada bloqueia a publicação e é citada pelo nome", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const cat = await db.query<{ id: string }>(
        "insert into public.categories (name, slug, status) values ('Antiga (teste)', 'antiga-teste', 'archived') returning id",
      );
      const t = await create(db, admin, "treatment", "com-arquivada", {
        title: "Com arquivada",
        relations: { categories: [cat.rows[0]!.id], concerns: [], treatments: [] },
      });
      await expect(publish(db, admin, t.entry_id, t.version_id)).rejects.toMatchObject({
        code: "PT422",
        detail: expect.stringContaining("Antiga (teste) (arquivada)"),
      });
    });
  });

  it("referência a conteúdo não publicado bloqueia a publicação e a despublicação do alvo", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const target = await create(db, admin, "treatment", "alvo", { title: "Alvo", details: REVIEWED });
      const page = await create(db, admin, "page", "lista", {
        title: "Lista",
        blocks: [{ id: "b1", type: "treatment_list", entryIds: [target.entry_id] }],
      });

      await expect(publish(db, admin, page.entry_id, page.version_id)).rejects.toMatchObject({
        code: "PT422",
        detail: expect.stringContaining("não está publicado"),
      });

      await publish(db, admin, target.entry_id, target.version_id);
      await publish(db, admin, page.entry_id, page.version_id);

      await expect(
        asAdmin(db, admin, () => db.query("select public.cms_unpublish($1)", [target.entry_id])),
      ).rejects.toMatchObject({ code: "PT422" });
    });
  });

  it("referências nos blocos são validadas por FK (id inexistente falha)", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      await expect(
        create(db, admin, "page", "ref-quebrada", {
          title: "Ref",
          blocks: [{ id: "b1", type: "treatment_list", entryIds: ["00000000-0000-0000-0000-000000000000"] }],
        }),
      ).rejects.toThrow(/foreign key/);
    });
  });

  it("bloco fora da biblioteca é recusado pelo banco", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      await expect(
        create(db, admin, "page", "bloco-invalido", {
          title: "X",
          blocks: [{ id: "b1", type: "html", html: "<script>alert(1)</script>" }],
        }),
      ).rejects.toThrow(/content_versions_blocks_check|check constraint/);
    });
  });

  it("promoção: datas coerentes e obrigatórias para publicar", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      await expect(
        create(db, admin, "promotion", "datas-invertidas", {
          title: "P",
          details: { starts_at: "2026-11-10T12:00:00Z", ends_at: "2026-11-01T12:00:00Z" },
        }),
      ).rejects.toThrow(/check constraint/);

      const p = await create(db, admin, "promotion", "sem-datas", { title: "P", details: { terms: "Condições" } });
      await expect(publish(db, admin, p.entry_id, p.version_id)).rejects.toMatchObject({
        detail: expect.stringContaining("início e fim"),
      });

      const ok = await create(db, admin, "promotion", "valida", {
        title: "P ok",
        details: {
          starts_at: "2026-01-01T03:00:00Z",
          ends_at: "2099-01-01T03:00:00Z",
          terms: "Condições completas de teste.",
          price_cents: 19990,
        },
      });
      await publish(db, admin, ok.entry_id, ok.version_id);
      const anon = await asAnon(db, () =>
        db.query<{ price_cents: number }>("select price_cents from public.promotion_details where version_id = $1", [
          ok.version_id,
        ]),
      );
      expect(anon.rows).toEqual([{ price_cents: 19990 }]);
    });
  });

  it("depoimento só publica com registro de autorização", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const d = await create(db, admin, "testimonial", "dep-1", { title: "Dep", data: { quote: "Ótimo" } });
      await expect(publish(db, admin, d.entry_id, d.version_id)).rejects.toMatchObject({
        detail: expect.stringContaining("autorização"),
      });
    });
  });

  it("troca de slug após publicar cria 301 e não deixa ciclo", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const t = await create(db, admin, "treatment", "nome-antigo", { title: "T", details: REVIEWED });
      await publish(db, admin, t.entry_id, t.version_id);

      await asAdmin(db, admin, () => db.query("select public.cms_change_slug($1, 'nome-novo')", [t.entry_id]));
      await asAdmin(db, admin, () => db.query("select public.cms_change_slug($1, 'nome-final')", [t.entry_id]));

      const r = await asAnon(db, () =>
        db.query<{ source_path: string; target_path: string }>(
          "select source_path, target_path from public.redirects where source_path like '/tratamentos/nome-%' order by source_path",
        ),
      );
      // Sem cadeia: os dois caminhos antigos apontam direto para o atual.
      expect(r.rows).toEqual([
        { source_path: "/tratamentos/nome-antigo", target_path: "/tratamentos/nome-final" },
        { source_path: "/tratamentos/nome-novo", target_path: "/tratamentos/nome-final" },
      ]);

      // Voltar ao nome antigo remove o redirecionamento que viraria ciclo.
      await asAdmin(db, admin, () => db.query("select public.cms_change_slug($1, 'nome-antigo')", [t.entry_id]));
      const back = await db.query<{ source_path: string }>(
        "select source_path from public.redirects where target_path = '/tratamentos/nome-antigo' order by 1",
      );
      expect(back.rows.map((x) => x.source_path)).toEqual(["/tratamentos/nome-final", "/tratamentos/nome-novo"]);
    });
  });

  it("restaurar cria revisão nova com o conteúdo antigo; duplicar cria rascunho", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const t = await create(db, admin, "treatment", "restaurar", { title: "Original", details: REVIEWED });
      await save(db, admin, t.entry_id, 1, { title: "Alterado" });

      const restored = await asAdmin(db, admin, () =>
        db.query<{ revision: number; version_id: string }>(
          "select * from public.cms_restore_version($1, $2, 2)",
          [t.entry_id, t.version_id],
        ),
      );
      expect(restored.rows[0]?.revision).toBe(3);
      const v3 = await db.query<{ title: string; clinical_reviewer: string }>(
        `select v.title, d.clinical_reviewer from public.content_versions v
           join public.treatment_details d on d.version_id = v.id where v.id = $1`,
        [restored.rows[0]!.version_id],
      );
      expect(v3.rows[0]).toEqual({ title: "Original", clinical_reviewer: REVIEWED.clinical_reviewer });

      const dup = await asAdmin(db, admin, () =>
        db.query<Created>("select * from public.cms_duplicate_entry($1, 'restaurar-copia')", [t.entry_id]),
      );
      const dupState = await db.query<{ lifecycle_status: string; title: string }>(
        `select e.lifecycle_status, v.title from public.content_entries e
           join public.content_versions v on v.entry_id = e.id where e.id = $1`,
        [dup.rows[0]!.entry_id],
      );
      expect(dupState.rows[0]).toEqual({ lifecycle_status: "draft", title: "Original (cópia)" });
    });
  });

  it("versão publicada precisa pertencer à própria entidade (FK composta)", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const a = await create(db, admin, "page", "pagina-a", { title: "A" });
      const b = await create(db, admin, "page", "pagina-b", { title: "B" });
      await expect(
        db.query("update public.content_entries set published_version_id = $1 where id = $2", [
          b.version_id,
          a.entry_id,
        ]),
      ).rejects.toThrow(/content_entries_published_version_fk/);
    });
  });

  it("arquivar despublica; arquivado não pode ser editado nem publicado", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const p = await create(db, admin, "page", "arquivar", { title: "Arq" });
      await publish(db, admin, p.entry_id, p.version_id);
      await asAdmin(db, admin, () => db.query("select public.cms_archive($1)", [p.entry_id]));

      const anon = await asAnon(db, () =>
        db.query("select id from public.content_entries where id = $1", [p.entry_id]),
      );
      expect(anon.rowCount).toBe(0);
      await expect(save(db, admin, p.entry_id, 1, { title: "x" })).rejects.toMatchObject({ code: "PT422" });
      await expect(publish(db, admin, p.entry_id, p.version_id)).rejects.toMatchObject({ code: "PT422" });
    });
  });

  it("auditoria registra criação, publicação e troca de slug com o autor", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const p = await create(db, admin, "page", "auditada", { title: "Aud" });
      await publish(db, admin, p.entry_id, p.version_id);
      const log = await db.query<{ action: string; actor_user_id: string }>(
        "select action, actor_user_id from private.audit_logs where resource_id = $1 order by id",
        [p.entry_id],
      );
      expect(log.rows).toEqual([
        { action: "cms.content_entries.insert", actor_user_id: admin.id },
        { action: "cms.content.published", actor_user_id: admin.id },
      ]);
    });
  });
});

describe.skipIf(!hasDatabase)("CMS: acesso de quem não é administrador", () => {
  it("usuário autenticado comum e admin sem MFA não escrevem nem leem rascunhos", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const other = await createAuthUser(db);
      const draft = await create(db, admin, "page", "rascunho-secreto", { title: "Secreto" });

      for (const claims of [userClaims(other, "aal2"), userClaims(admin, "aal1")]) {
        await expect(
          asRole(db, "authenticated", claims, () =>
            db.query("select * from public.cms_create_entry('page', 'x', '{\"title\":\"x\"}')"),
          ),
        ).rejects.toMatchObject({ code: "PT403" });

        await expect(
          asRole(db, "authenticated", claims, () =>
            db.query("insert into public.content_entries (type, slug) values ('page', 'direto')"),
          ),
        ).rejects.toThrow(/row-level security/);

        const read = await asRole(db, "authenticated", claims, () =>
          db.query("select id from public.content_versions where entry_id = $1", [draft.entry_id]),
        );
        expect(read.rowCount).toBe(0);
      }
    });
  });

  it("anônimo não lê evidências, referências internas nem caminhos privados de mídia", async () => {
    await inRollbackTransaction(async (db) => {
      for (const sql of [
        "select * from public.media_permissions",
        "select * from public.version_entry_refs",
        "select * from public.version_media_refs",
        "select private_original_path from public.media_assets",
        "select revision from public.site_settings_public",
      ]) {
        await expect(asAnon(db, () => db.query(sql)), sql).rejects.toThrow(/permission denied/);
      }
      await expect(
        asAnon(db, () => db.query("select public.cms_check_publish(gen_random_uuid())")),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("configurações: leitura pública e conflito de revisão no salvamento", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const rev = await db.query<{ revision: number }>("select revision from public.site_settings_public");
      const base = rev.rows[0]!.revision;
      await asAdmin(db, admin, () =>
        db.query("select public.cms_save_settings($1, '{\"business_name\":\"Innovip\"}')", [base]),
      );
      await expect(
        asAdmin(db, admin, () => db.query("select public.cms_save_settings($1, '{}')", [base])),
      ).rejects.toMatchObject({ code: "PT409" });
      const anon = await asAnon(db, () => db.query<{ data: { business_name: string } }>("select data from public.site_settings_public"));
      expect(anon.rows[0]?.data.business_name).toBe("Innovip");
    });
  });

  it("Storage: só admin com MFA lê/grava objetos; anônimo e não-admin não", async () => {
    await inRollbackTransaction(async (db) => {
      const admin = await setupAdmin(db);
      const other = await createAuthUser(db);
      const insert = (bucket: string) =>
        db.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, `originals/${crypto.randomUUID()}.jpg`]);

      for (const bucket of ["media-private", "media-public"]) {
        await expect(asAnon(db, () => insert(bucket)), `anon ${bucket}`).rejects.toThrow(/row-level security|permission denied/);
        await expect(
          asRole(db, "authenticated", userClaims(other, "aal2"), () => insert(bucket)),
          `não-admin ${bucket}`,
        ).rejects.toThrow(/row-level security/);
        await expect(
          asRole(db, "authenticated", userClaims(admin, "aal1"), () => insert(bucket)),
          `admin sem MFA ${bucket}`,
        ).rejects.toThrow(/row-level security/);
        await asAdmin(db, admin, () => insert(bucket));
      }

      const anonSees = await asAnon(db, () =>
        db.query("select name from storage.objects where bucket_id in ('media-private', 'media-public')"),
      );
      expect(anonSees.rowCount).toBe(0); // nem listar o bucket público
    });
  });

  it("view do painel (cms_entry_list) não é acessível ao anônimo", async () => {
    await inRollbackTransaction(async (db) => {
      await expect(asAnon(db, () => db.query("select * from public.cms_entry_list"))).rejects.toThrow(/permission denied/);
    });
  });

  it("buckets: público só para cópias aprovadas; privado sem acesso anônimo", async () => {
    await inRollbackTransaction(async (db) => {
      const buckets = await db.query<{ id: string; public: boolean; file_size_limit: number }>(
        "select id, public, file_size_limit::int as file_size_limit from storage.buckets where id like 'media-%' order by id",
      );
      expect(buckets.rows).toEqual([
        { id: "media-private", public: false, file_size_limit: 10485760 },
        { id: "media-public", public: true, file_size_limit: 10485760 },
      ]);
      const anonPolicies = await db.query(
        `select policyname from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and policyname like 'media_%' and 'anon' = any (roles)`,
      );
      expect(anonPolicies.rowCount).toBe(0);
    });
  });
});
