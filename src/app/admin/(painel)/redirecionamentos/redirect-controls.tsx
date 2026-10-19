"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, buttonPrimary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { Select, TextInput } from "@/components/admin/editor/fields";
import { addRedirectAction, deleteRedirectAction } from "./actions";
import { alertDialog, confirmDialog } from "@/components/admin/dialog";

export function AddRedirectForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"301" | "302">("301");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    setError(null);
    const res = await addRedirectAction({ source, target, status: Number(status) });
    setPending(false);
    if (!res.ok) return setError(res.message);
    setSource("");
    setTarget("");
    router.refresh();
  }

  return (
    <section aria-labelledby="novo-redirecionamento" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
      <h2 id="novo-redirecionamento" className="text-lg font-semibold text-brand-800">Adicionar manualmente</h2>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
        <TextInput label="De (caminho antigo)" value={source} maxLength={200} placeholder="/pagina-antiga" onChange={(v) => setSource(v ?? "")} />
        <TextInput label="Para (caminho atual)" value={target} maxLength={200} placeholder="/pagina-nova" onChange={(v) => setTarget(v ?? "")} />
        <Select label="Tipo" value={status} options={[{ value: "301", label: "301 (permanente)" }, { value: "302", label: "302 (temporário)" }]}
          onChange={(v) => v && setStatus(v)} />
      </div>
      <button type="button" className={`${buttonPrimary} self-start`} disabled={!hydrated || pending || !source || !target} onClick={add}>
        {pending ? "Adicionando…" : "Adicionar"}
      </button>
    </section>
  );
}

export function DeleteRedirectButton({ id, source }: { id: string; source: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-11 self-start rounded px-3 text-sm font-semibold text-danger hover:bg-danger-bg"
      onClick={async () => {
        if (!(await confirmDialog(`Remover o redirecionamento de ${source}? Links antigos passarão a dar 404.`, { confirmLabel: "Remover", danger: true }))) return;
        setPending(true);
        const res = await deleteRedirectAction(id);
        setPending(false);
        if (!res.ok) await alertDialog(res.message);
        else router.refresh();
      }}
    >
      Remover <span className="sr-only">{source}</span>
    </button>
  );
}
