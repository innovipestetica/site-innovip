"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated } from "@/components/ui/use-hydrated";
import { restoreVersionAction } from "../../../actions";

export function RestoreButton(props: {
  entryId: string;
  versionId: string;
  revision: number;
  baseRevision: number;
  editorHref: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!window.confirm(`Criar uma revisão nova com o conteúdo da revisão ${props.revision}?`)) return;
    setPending(true);
    const res = await restoreVersionAction(props.entryId, props.versionId, props.baseRevision);
    setPending(false);
    if (!res.ok) return setError(res.message);
    router.push(props.editorHref);
  }

  return (
    <span className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={!hydrated || pending}
        className="min-h-11 rounded-[var(--radius-control)] border border-brand-700 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
      >
        {pending ? "Restaurando…" : "Restaurar"}
      </button>
      {error ? <span role="alert" className="mt-1 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
