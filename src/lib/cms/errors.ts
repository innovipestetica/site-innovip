import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | {
      ok: false;
      kind: "conflict" | "invalid" | "forbidden" | "not_found" | "duplicate" | "error";
      message: string;
      problems?: string[];
      issues?: { path: string; message: string }[];
      latestRevision?: number;
    };

/**
 * Traduz erros do banco (RPCs cms_* e constraints) em mensagens para o
 * painel. Nunca devolve SQL, stack ou dados internos.
 */
export function mapDbError(error: PostgrestError | null | undefined): Extract<ActionResult, { ok: false }> {
  if (!error) return { ok: false, kind: "error", message: "Falha desconhecida." };

  switch (error.code) {
    case "PT409": {
      let latestRevision: number | undefined;
      try {
        latestRevision = JSON.parse(error.details ?? "{}").latest_revision;
      } catch {
        // detalhe ausente
      }
      return {
        ok: false,
        kind: "conflict",
        message:
          "Outra edição foi salva antes desta (em outra aba ou por outra pessoa). Suas alterações não foram perdidas: copie o que precisar e recarregue para ver a versão mais nova.",
        latestRevision,
      };
    }
    case "PT422": {
      let problems: string[] | undefined;
      try {
        const parsed = JSON.parse(error.details ?? "null");
        if (Array.isArray(parsed)) problems = parsed.filter((p): p is string => typeof p === "string");
      } catch {
        // detalhe não é lista
      }
      return { ok: false, kind: "invalid", message: error.message, problems };
    }
    case "PT403":
    case "42501":
      return { ok: false, kind: "forbidden", message: "Sua sessão não tem permissão. Entre de novo com a verificação em duas etapas." };
    case "PT404":
      return { ok: false, kind: "not_found", message: "Conteúdo não encontrado." };
    case "23505":
      return { ok: false, kind: "duplicate", message: "Já existe um item com este endereço (slug)." };
    case "23503":
      return { ok: false, kind: "invalid", message: "Há uma referência a item inexistente ou em uso." };
    case "23514":
      return { ok: false, kind: "invalid", message: "Algum campo está fora do formato permitido." };
    case "22P02":
      return { ok: false, kind: "invalid", message: "Algum identificador está em formato inválido." };
    default:
      console.error("[cms] erro de banco", { code: error.code });
      return { ok: false, kind: "error", message: "Não foi possível concluir. Tente novamente." };
  }
}
