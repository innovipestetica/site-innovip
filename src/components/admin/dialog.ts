/**
 * Confirmações do painel dentro da página (<dialog> modal), no lugar de
 * window.confirm/prompt/alert. Navegadores embutidos (ex.: o painel lateral
 * de apps) bloqueiam essas janelas nativas e respondem "cancelar" sozinhos,
 * o que fazia botões como "Publicar" não fazerem nada.
 *
 * <dialog> com showModal(): foco preso no diálogo, Esc cancela, o foco volta
 * ao botão que abriu.
 */

type Options = { confirmLabel?: string; cancelLabel?: string | null; danger?: boolean; input?: { value: string; label: string } };

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

function open(message: string, opts: Options): Promise<string | null> {
  return new Promise((resolve) => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = document.createElement("dialog");
    dialog.className =
      "w-[min(92vw,28rem)] rounded-[var(--radius-card)] border border-line bg-surface-raised p-5 text-ink shadow-xl backdrop:bg-black/40";
    dialog.setAttribute("aria-label", opts.input ? opts.input.label : "Confirmação");

    const form = document.createElement("form");
    form.method = "dialog";
    form.className = "flex flex-col gap-4";

    const text = document.createElement("p");
    text.className = "whitespace-pre-line text-base";
    text.textContent = message;
    form.append(text);

    let input: HTMLInputElement | null = null;
    if (opts.input) {
      const label = document.createElement("label");
      label.className = "flex flex-col gap-1 text-sm font-semibold";
      label.textContent = opts.input.label;
      input = document.createElement("input");
      input.value = opts.input.value;
      input.className = "min-h-11 rounded-lg border border-line bg-white px-3 text-base font-normal";
      label.append(input);
      form.append(label);
    }

    const row = document.createElement("div");
    row.className = "flex flex-wrap justify-end gap-2";
    if (opts.cancelLabel !== null) {
      const cancel = document.createElement("button");
      cancel.type = "submit";
      cancel.value = "cancel";
      cancel.className = `${btn} border border-line bg-surface text-brand-800 hover:bg-brand-50`;
      cancel.textContent = opts.cancelLabel ?? "Cancelar";
      row.append(cancel);
    }
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.value = "ok";
    ok.className = `${btn} text-white ${opts.danger ? "bg-danger hover:opacity-90" : "bg-brand-700 hover:bg-brand-800"}`;
    ok.textContent = opts.confirmLabel ?? "Confirmar";
    row.append(ok);
    form.append(row);
    dialog.append(form);

    dialog.addEventListener("close", () => {
      const confirmed = dialog.returnValue === "ok";
      dialog.remove();
      opener?.focus?.();
      resolve(confirmed ? (input ? input.value : "ok") : null);
    });
    // Enter no campo de texto confirma.
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        dialog.close("ok");
      }
    });

    document.body.append(dialog);
    dialog.showModal();
    (input ?? ok).focus();
    input?.select();
  });
}

export async function confirmDialog(message: string, opts: Omit<Options, "input"> = {}): Promise<boolean> {
  return (await open(message, opts)) !== null;
}

export function promptDialog(message: string, value: string, label = "Valor"): Promise<string | null> {
  return open(message, { input: { value, label }, confirmLabel: "OK" });
}

export async function alertDialog(message: string): Promise<void> {
  await open(message, { confirmLabel: "OK", cancelLabel: null });
}
