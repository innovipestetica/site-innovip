import Link from "next/link";
import { getLegalLinks, getNavigation } from "@/lib/cms/navigation";
import { getPublicSettings } from "@/lib/cms/public-data";
import { phoneHref, whatsappHref } from "@/lib/cms/settings";

function formatPhone(digits: string): string {
  // 55 11 99999-9999 → (11) 99999-9999
  const local = digits.replace(/^55/, "");
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** Rodapé: só mostra o que está preenchido nas Configurações públicas. */
export async function SiteFooter({ reduced = false }: { reduced?: boolean }) {
  const [s, nav, legal] = await Promise.all([getPublicSettings(), reduced ? Promise.resolve([]) : getNavigation(), getLegalLinks()]);
  const wa = whatsappHref(s);
  const tel = phoneHref(s);
  const a = s.address;
  const address = a
    ? [a.street && `${a.street}${a.number ? `, ${a.number}` : ""}`, a.complement, a.district, a.city && `${a.city}${a.state ? ` – ${a.state}` : ""}`, a.postal_code && `CEP ${a.postal_code}`]
        .filter(Boolean)
        .join(", ")
    : "";
  const socials = Object.entries(s.social ?? {}).filter(([, url]) => !!url) as [string, string][];
  const name = s.business_name || "Innovip";
  const linkCls = "inline-flex min-h-11 items-center hover:underline";

  return (
    <footer className="mt-auto bg-brand-900 text-white/90">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold text-white">{name}</p>
          {s.footer_note ? <p className="mt-2 text-sm">{s.footer_note}</p> : null}
          {s.responsible_technical ? <p className="mt-2 text-xs text-white/70">Responsável técnico: {s.responsible_technical}</p> : null}
        </div>

        {(wa || tel || s.email || address) ? (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Contato</h2>
            <ul className="mt-2 text-sm">
              {wa ? <li><a href={wa} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" data-cta-location="footer" className={linkCls}>WhatsApp</a></li> : null}
              {tel && s.phone ? <li><a href={tel} className={linkCls}>{formatPhone(s.phone)}</a></li> : null}
              {s.email ? <li><a href={`mailto:${s.email}`} className={`${linkCls} break-all`}>{s.email}</a></li> : null}
              {address ? <li className="mt-1">{address}</li> : null}
              {s.map_url ? <li><a href={s.map_url} target="_blank" rel="noopener noreferrer" className={linkCls}>Ver no mapa</a></li> : null}
            </ul>
          </div>
        ) : null}

        {s.hours?.length ? (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Horários</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {s.hours.map((h, i) => (
                <div key={i} className="contents"><dt className="font-semibold">{h.label}</dt><dd>{h.value}</dd></div>
              ))}
            </dl>
          </div>
        ) : null}

        {(nav.length || socials.length) ? (
          <div>
            {nav.length ? (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Navegação</h2>
                <ul className="mt-2 text-sm">
                  {nav.map((n) => <li key={n.href}><Link href={n.href} className={linkCls}>{n.label}</Link></li>)}
                </ul>
              </>
            ) : null}
            {socials.length ? (
              <ul className="mt-3 flex flex-wrap gap-3 text-sm" aria-label="Redes sociais">
                {socials.map(([net, url]) => (
                  <li key={net}><a href={url} target="_blank" rel="noopener noreferrer" className={`${linkCls} capitalize`}>{net}</a></li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/70">
          <span>
            © {name}
            {s.legal_name ? ` · ${s.legal_name}` : ""}
            {s.cnpj ? ` · CNPJ ${s.cnpj}` : ""}
          </span>
          {legal.length ? (
            <ul className="flex flex-wrap gap-4">
              {legal.map((l) => <li key={l.href}><Link href={l.href} className={linkCls}>{l.label}</Link></li>)}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
