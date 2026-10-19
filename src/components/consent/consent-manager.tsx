"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { parseConsent } from "@/lib/consent/consent";
import {
  consentStore,
  currentPageInfo,
  deleteTrackingCookies,
  loadGtm,
  pushEvent,
  pushPageView,
  readConsent,
  updateConsentMode,
  writeConsent,
} from "@/lib/consent/tracking-client";

export const OPEN_CONSENT_EVENT = "innovip:abrir-preferencias";

type Props = {
  gtmId: string;
  siteName: string;
  /** Página pública da política de cookies (se publicada). */
  policyHref: string | null;
};

/**
 * Banner e preferências de cookies + medição condicionada ao consentimento.
 * Só é montado quando o rastreamento está ligado (TRACKING_ENABLED e GTM_ID).
 */
export function ConsentManager({ gtmId, siteName, policyHref }: Props) {
  // Cookie como fonte da verdade (null no servidor = ainda não hidratado).
  const raw = useSyncExternalStore(consentStore.subscribe, consentStore.getSnapshot, consentStore.getServerSnapshot);
  const ready = raw !== null;
  const choice = parseConsent(raw);
  const bannerOpen = ready && !choice;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const titleId = useId();
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  const allowed = !!choice && (choice.analytics || choice.marketing);

  // Escolha permitindo medição: carrega o GTM (efeito externo, sem setState).
  const analytics = choice?.analytics ?? false;
  const marketing = choice?.marketing ?? false;
  useEffect(() => {
    if (analytics || marketing) loadGtm(gtmId, { analytics, marketing });
  }, [gtmId, analytics, marketing]);

  // page_view a cada navegação (inclusive transições no cliente), uma vez por caminho.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !allowed || lastPath.current === pathname) return;
    lastPath.current = pathname;
    // Aguarda o React aplicar o <main data-page-type> da nova página.
    const t = window.setTimeout(() => {
      pushPageView(siteName);
      const page = currentPageInfo();
      if (page.type === "promotion" || page.type === "landing" || page.type === "blog_post") {
        pushEvent("view_content", { content_type: page.type, page_sensitive: page.sensitive });
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [ready, allowed, pathname, siteName]);

  // Cliques em CTAs (delegação): só tipo/posição/destino, nunca texto ou URL.
  useEffect(() => {
    if (!allowed) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (!el) return;
      const page = currentPageInfo();
      const kind = el.dataset.cta ?? "link";
      const location = (el.dataset.ctaLocation ?? "content").slice(0, 40);
      const target = el.dataset.ctaTarget ?? (kind === "whatsapp" ? "whatsapp" : "link");
      if (kind === "whatsapp" || target === "whatsapp") {
        // Clique no WhatsApp é interação, não agendamento nem lead.
        pushEvent("whatsapp_click", { cta_location: location, page_type: page.type, page_sensitive: page.sensitive });
      }
      if (kind !== "whatsapp") {
        pushEvent("cta_click", { cta_type: kind, cta_target: target, cta_location: location, page_type: page.type, page_sensitive: page.sensitive });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [allowed]);

  const save = useCallback(
    (next: { analytics: boolean; marketing: boolean }) => {
      const previous = readConsent();
      const saved = writeConsent(next, previous);
      const revokedAnalytics = !!previous?.analytics && !next.analytics;
      const revokedMarketing = !!previous?.marketing && !next.marketing;

      // Registro (prova do consentimento) — sem dados pessoais.
      void fetch("/api/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: saved.id, version: saved.version, analytics: saved.analytics, marketing: saved.marketing, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {});

      deleteTrackingCookies({ analytics: !next.analytics, marketing: !next.marketing });
      dialogRef.current?.close();

      if (revokedAnalytics || revokedMarketing) {
        // Revogação: nega no Consent Mode e recarrega para descarregar as tags.
        updateConsentMode(next);
        window.location.reload();
        return;
      }
      // Ampliação de consentimento: atualiza sinais (o efeito acima carrega o GTM).
      updateConsentMode(next);
    },
    [],
  );

  const openPreferences = useCallback(() => {
    const current = readConsent();
    setDraft({ analytics: current?.analytics ?? false, marketing: current?.marketing ?? false });
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_CONSENT_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, openPreferences);
  }, [openPreferences]);

  const button =
    "min-h-11 rounded-[var(--radius-control)] px-4 font-semibold";
  const policy = policyHref ? (
    <Link href={policyHref} className="font-semibold text-brand-800 underline underline-offset-4">Política de cookies</Link>
  ) : null;

  return (
    <>
      {bannerOpen ? (
        // Região não modal no rodapé da tela: não bloqueia a navegação nem o teclado.
        <section
          aria-labelledby={`${titleId}-banner`}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface-raised shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-ink">
              <h2 id={`${titleId}-banner`} className="font-semibold text-brand-800">Cookies e privacidade</h2>
              <p className="mt-1">
                Usamos cookies necessários para o site funcionar. Com sua permissão, também usamos cookies de medição
                (analytics) e de marketing. Você pode mudar a escolha a qualquer momento. {policy}
              </p>
            </div>
            {/* Aceitar e rejeitar com o mesmo destaque. */}
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className={`${button} bg-brand-700 text-white hover:bg-brand-800`} onClick={() => save({ analytics: false, marketing: false })}>
                Rejeitar
              </button>
              <button type="button" className={`${button} bg-brand-700 text-white hover:bg-brand-800`} onClick={() => save({ analytics: true, marketing: true })}>
                Aceitar
              </button>
              <button type="button" className={`${button} border border-brand-700 text-brand-800 hover:bg-brand-50`} onClick={openPreferences}>
                Personalizar
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${titleId}-dialog`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/40"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
        >
          <h2 id={`${titleId}-dialog`} className="text-lg font-bold text-brand-800">Preferências de cookies</h2>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Categorias</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 size-5" />
              <span><strong>Necessários</strong> — funcionamento do site e desta escolha. Sempre ativos.</span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-brand-700" checked={draft.analytics}
                onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))} />
              <span><strong>Analytics</strong> — medição de visitas e cliques (Google Analytics), sem dados de contato.</span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-brand-700" checked={draft.marketing}
                onChange={(e) => setDraft((d) => ({ ...d, marketing: e.target.checked }))} />
              <span><strong>Marketing</strong> — medição de campanhas (ex.: Meta). Nunca em páginas sobre tratamentos.</span>
            </label>
          </fieldset>
          {policy ? <p className="text-sm">{policy}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={`${button} border border-line hover:bg-brand-50`} onClick={() => dialogRef.current?.close()}>
              Cancelar
            </button>
            <button type="submit" className={`${button} bg-brand-700 text-white hover:bg-brand-800`}>
              Salvar escolhas
            </button>
          </div>
        </form>
      </dialog>

      {/* Espaço para o banner não cobrir o fim da página. */}
      {bannerOpen ? <div aria-hidden="true" className="h-56 sm:h-28" /> : null}
    </>
  );
}

/** Botão do rodapé para reabrir as preferências (revogação a qualquer momento). */
export function ConsentPreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Preferências de cookies
    </button>
  );
}
