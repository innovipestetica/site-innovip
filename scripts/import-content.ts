/**
 * Importa um pacote de conteúdo (arquivo .ts com `export default`) como
 * RASCUNHO: cria conteúdos novos e grava revisões novas (não publicadas) dos
 * que já existem. Nada vai ao ar; revise e publique pelo painel.
 *
 *   npm run conteudo:importar -- pacote.ts            # só simula
 *   npm run conteudo:importar -- pacote.ts --aplicar  # grava
 *
 * Formato do pacote: veja o tipo `Pack` abaixo. Textos de blocos "rich_text"
 * usam a mesma marcação do painel (## subtítulo, **negrito**, - lista,
 * [link](/caminho)). Listas de tratamentos/FAQs referenciam pelo endereço
 * (slug). Categorias e objetivos são referenciados pelo nome.
 *
 * Tudo ou nada. Grava como DONO DO BANCO (DATABASE_URL): a auditoria registra
 * autor nulo, sem se passar por um administrador.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";
import { initialPayload, validatePayload, type ContentType, type VersionPayload } from "../src/lib/cms/content-types";
import { newBlockId } from "../src/lib/cms/blocks";
import { parseRichText } from "../src/lib/cms/rich-text";

config({ path: ".env.local", quiet: true });

/** Bloco do pacote: igual ao do CMS, mas sem `id`, com `md` no lugar de
 *  `body` e `entrySlugs` no lugar de `entryIds`. `{ keep: "image" }` repete
 *  o próximo bloco desse tipo da versão atual (ex.: imagens já escolhidas). */
type PackBlock = Record<string, unknown> & { type?: string; keep?: string; md?: string; entrySlugs?: string[] };

type PackEntry = {
  type: ContentType;
  slug: string;
  title: string;
  summary?: string;
  blocks?: PackBlock[];
  data?: Record<string, unknown>;
  seo?: { title?: string; description?: string };
  categories?: string[];
  concerns?: string[];
  /** Revisões de conteúdo existente: mantém blocos com imagem do original? */
  keepFromCurrent?: ("banner_carousel" | "hero_media")[];
};

export type Pack = {
  concerns?: { name: string; slug: string; area: "facial" | "corporal"; description?: string }[];
  entries: PackEntry[];
};

type Row = { id: string; type: ContentType; slug: string; latest_revision: number };

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--aplicar");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Informe o pacote: npm run conteudo:importar -- pacote.ts [--aplicar]");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente em .env.local.");
  const pack = ((await import(pathToFileURL(resolve(file)).href)) as { default: Pack }).default;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin");

    // Objetivos novos (rascunho): só os que ainda não existem.
    for (const c of pack.concerns ?? []) {
      const r = await db.query(
        `insert into public.concerns (name, slug, area, description, status)
         values ($1, $2, $3, $4, 'draft') on conflict (slug) do nothing returning id`,
        [c.name, c.slug, c.area, c.description ?? null],
      );
      console.log(`  objetivo ${r.rowCount ? "criado  " : "existente"} ${c.name}`);
    }

    const tax = async (table: "categories" | "concerns") =>
      (await db.query<{ id: string; name: string; status: string }>(`select id, name, status from public.${table}`)).rows;
    const cats = await tax("categories");
    const concerns = await tax("concerns");
    const byName = (items: { id: string; name: string; status: string }[], name: string, kind: string) => {
      const hit = items.find((t) => t.name.toLowerCase() === name.toLowerCase() && t.status !== "archived");
      if (!hit) throw new Error(`${kind} "${name}" não existe.`);
      return hit.id;
    };

    const existing = new Map(
      (await db.query<Row>("select id, type, slug, latest_revision from public.content_entries")).rows.map((r) => [`${r.type}:${r.slug}`, r]),
    );
    const idOf = new Map<string, string>(); // slug → id (tratamentos, FAQs…)
    for (const r of existing.values()) idOf.set(r.slug, r.id);

    // 1ª passada: cria as entradas novas (para os slugs já terem id).
    const pending: { entry: PackEntry; row: Row; isNew: boolean }[] = [];
    for (const entry of pack.entries) {
      const key = `${entry.type}:${entry.slug}`;
      let row = existing.get(key) ?? (entry.type === "home" ? [...existing.values()].find((r) => r.type === "home") : undefined);
      const isNew = !row;
      if (!row) {
        const r = await db.query<{ id: string }>(
          "insert into public.content_entries (type, slug, latest_revision) values ($1, $2, 0) returning id",
          [entry.type, entry.slug],
        );
        row = { id: r.rows[0]!.id, type: entry.type, slug: entry.slug, latest_revision: 0 };
      }
      idOf.set(entry.slug, row.id);
      pending.push({ entry, row, isNew });
    }

    // 2ª passada: monta, valida e grava a versão.
    for (const { entry, row, isNew } of pending) {
      const payload: VersionPayload = initialPayload(entry.type, entry.title, newBlockId);
      payload.summary = entry.summary;
      payload.data = { ...(entry.data ?? {}) };
      if (entry.seo) payload.seo = { ...payload.seo, ...entry.seo };

      let current: VersionPayload | null = null;
      if (!isNew) {
        const cur = await db.query<{ id: string; blocks: VersionPayload["blocks"]; data: Record<string, unknown>; seo: VersionPayload["seo"] }>(
          "select id, blocks, data, seo from public.content_versions where entry_id = $1 and revision = $2",
          [row.id, row.latest_revision],
        );
        current = cur.rows[0] ? ({ ...payload, ...cur.rows[0] } as VersionPayload) : null;
        // Preserva imagem de capa e detalhes já definidos no painel.
        if (current?.data.mediaId && !payload.data.mediaId) payload.data.mediaId = current.data.mediaId;
        if (current) payload.seo = { ...current.seo, ...(entry.seo ?? {}) };
        if (cur.rows[0] && entry.type === "treatment") {
          const d = await db.query<{ requires_evaluation: boolean }>(
            "select requires_evaluation from public.treatment_details where version_id = $1",
            [cur.rows[0].id],
          );
          if (d.rows[0]) payload.details = { ...payload.details, requires_evaluation: d.rows[0].requires_evaluation };
        }
      }

      if (entry.blocks) {
        const used = new Set<unknown>();
        payload.blocks = entry.blocks.map((b) => {
          if (b.keep) {
            const old = current?.blocks.find((x) => x.type === b.keep && !used.has(x));
            if (!old) throw new Error(`${entry.slug}: não há bloco "${b.keep}" na versão atual para manter.`);
            used.add(old);
            return old;
          }
          if (b.type === "banner_carousel" && entry.keepFromCurrent?.includes("banner_carousel")) {
            const old = current?.blocks.find((x) => x.type === "banner_carousel");
            if (!old) throw new Error(`${entry.slug}: não há carrossel atual para manter.`);
            const { slidesText } = b as { slidesText?: { title?: string; text?: string }[] };
            const slides = (old as Extract<typeof old, { type: "banner_carousel" }>).slides.map((s, i) => ({ ...s, ...(slidesText?.[i] ?? {}) }));
            return { ...old, slides };
          }
          const { md, entrySlugs, ...rest } = b;
          const out: Record<string, unknown> = { id: newBlockId(), ...rest };
          if (b.type === "hero" && entry.keepFromCurrent?.includes("hero_media")) {
            const old = current?.blocks.find((x) => x.type === "hero") as { mediaId?: string } | undefined;
            if (old?.mediaId) out.mediaId = old.mediaId;
          }
          if (md !== undefined) out.body = parseRichText(md);
          if (entrySlugs) {
            out.entryIds = entrySlugs.map((s) => {
              const id = idOf.get(s);
              if (!id) throw new Error(`${entry.slug}: "${s}" não existe.`);
              return id;
            });
          }
          return out as VersionPayload["blocks"][number];
        });
      }
      if (entry.type === "treatment") {
        payload.relations.categories = (entry.categories ?? []).map((n) => byName(cats, n, "categoria"));
        payload.relations.concerns = (entry.concerns ?? []).map((n) => byName(concerns, n, "objetivo"));
      }

      const v = validatePayload(entry.type, payload);
      if (!v.ok) throw new Error(`${entry.slug}: ${v.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);

      const revision = row.latest_revision + 1;
      await db.query("select private.cms_insert_version($1, $2, $3, $4)", [row.id, entry.type, revision, JSON.stringify(v.payload)]);
      await db.query("update public.content_entries set latest_revision = $2 where id = $1", [row.id, revision]);
      console.log(`  ${isNew ? "novo     " : "revisão " + revision} ${entry.type.padEnd(10)} ${entry.slug}  ${entry.title}`);
    }

    if (apply) {
      await db.query("commit");
      console.log("\nGravado como rascunho. Revise e publique pelo painel.");
    } else {
      await db.query("rollback");
      console.log("\nSimulação (nada gravado). Para gravar, repita com --aplicar.");
    }
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
