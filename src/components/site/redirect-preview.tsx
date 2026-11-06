"use client";

import { useEffect } from "react";

export function RedirectPreview({ target, sourcePath }: { target: string; sourcePath: string }) {
  useEffect(() => {
    const payload = JSON.stringify({
      sourcePath,
      target,
      query: window.location.search,
      referrer: document.referrer || null,
    });
    navigator.sendBeacon("/api/redirect-events", new Blob([payload], { type: "application/json" }));
    window.location.replace(target);
  }, [sourcePath, target]);
  return (
    <main id="conteudo" className="grid min-h-[50vh] place-items-center px-4 text-center">
      <div><p className="font-semibold text-brand-800">Abrindo o destino…</p><p className="mt-2 text-sm text-muted">Se não abrir automaticamente, <a className="underline" href={target}>toque aqui</a>.</p></div>
    </main>
  );
}
