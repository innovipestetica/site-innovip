"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, buttonPrimary, buttonSecondary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { Select, TextArea, TextInput } from "@/components/admin/editor/fields";
import { DEFAULT_WHATSAPP_MESSAGE, type SiteSettings } from "@/lib/cms/settings";
import { saveSettingsAction } from "./actions";

type Pair = { label: string; value: string };
type NavItem = { label: string; href: string };

export function SettingsForm({ revision, initial }: { revision: number; initial: SiteSettings }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [s, setS] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = useMemo(() => JSON.stringify(s) !== saved, [s, saved]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const setAddr = (k: keyof NonNullable<SiteSettings["address"]>, v: string | undefined) =>
    setS((p) => ({ ...p, address: { ...p.address, [k]: v } }));
  const setSocial = (k: keyof NonNullable<SiteSettings["social"]>, v: string | undefined) =>
    setS((p) => ({ ...p, social: { ...p.social, [k]: v } }));

  async function onSave() {
    setPending(true);
    setMessage(null);
    const res = await saveSettingsAction(revision, s);
    setPending(false);
    if (!res.ok) {
      setIssues(Object.fromEntries((res.issues ?? []).map((i) => [i.path, i.message])));
      setMessage({ tone: "error", text: res.message });
      return;
    }
    setIssues({});
    setSaved(JSON.stringify(s));
    setMessage({ tone: "success", text: "Configurações salvas. O site é atualizado em até 1 minuto." });
    router.refresh();
  }

  const card = "flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4";
  const h2 = "text-lg font-semibold text-brand-800";

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className={h2}>Clínica</h2>
        <TextInput label="Nome comercial" value={s.business_name} maxLength={80} error={issues.business_name} onChange={(v) => set("business_name", v)} />
        <TextInput label="Razão social" value={s.legal_name} maxLength={120} onChange={(v) => set("legal_name", v)} />
        <TextInput label="CNPJ" value={s.cnpj} maxLength={18} error={issues.cnpj} onChange={(v) => set("cnpj", v)} />
        <TextInput label="Responsável técnico (como deve aparecer no site)" value={s.responsible_technical} maxLength={160}
          hint="Nome e registro conforme o conselho profissional. Confirme antes de publicar." onChange={(v) => set("responsible_technical", v)} />
      </section>

      <section className={card}>
        <h2 className={h2}>Contato</h2>
        <TextInput label="Telefone" type="tel" value={s.phone} maxLength={13} error={issues.phone}
          hint="Formato internacional só com números: 55 + DDD + número." onChange={(v) => set("phone", v?.replace(/\D/g, ""))} />
        <TextInput label="WhatsApp" type="tel" value={s.whatsapp} maxLength={13} error={issues.whatsapp}
          hint="Formato internacional só com números. Vazio = botões de WhatsApp ocultos." onChange={(v) => set("whatsapp", v?.replace(/\D/g, ""))} />
        <TextInput label="Mensagem inicial do WhatsApp" value={s.whatsapp_message} maxLength={200}
          hint={`Genérica, sem dados pessoais. Padrão: “${DEFAULT_WHATSAPP_MESSAGE}”`} onChange={(v) => set("whatsapp_message", v)} />
        <TextInput label="E-mail" type="email" value={s.email} maxLength={254} error={issues.email} onChange={(v) => set("email", v)} />
      </section>

      <section className={card}>
        <h2 className={h2}>Botão “Agendar avaliação”</h2>
        <p className="text-sm text-muted">
          Vale para todos os botões de agendamento do site (cabeçalho, páginas, promoções e contato) e para o
          endereço fixo <code>/agendar-avaliacao</code> (útil em bio do Instagram e QR codes). Abre em nova aba.
          O WhatsApp sempre usa a mensagem genérica, sem citar tratamentos. Sem destino, os botões ficam ocultos.
        </p>
        <Select
          label="Destino"
          value={s.evaluation_cta?.mode ?? "whatsapp"}
          options={[
            { value: "whatsapp", label: "WhatsApp (número acima)" },
            { value: "link", label: "Link externo (formulário ou plataforma de agendamento)" },
          ]}
          error={issues["evaluation_cta.mode"]}
          onChange={(mode) => mode && set("evaluation_cta", { ...s.evaluation_cta, mode })}
        />
        {s.evaluation_cta?.mode === "whatsapp" && !s.whatsapp ? (
          <p role="status" className="text-sm text-danger">Sem número de WhatsApp: os botões de agendamento ficam ocultos.</p>
        ) : null}
        {s.evaluation_cta?.mode === "link" ? (
          <TextInput label="Link (https://)" value={s.evaluation_cta.url} maxLength={500} placeholder="https://"
            error={issues["evaluation_cta.url"]}
            onChange={(url) => set("evaluation_cta", { ...s.evaluation_cta!, url })} />
        ) : null}
        <TextInput label="Texto do botão (opcional)" value={s.evaluation_cta?.label} maxLength={40} placeholder="Agendar avaliação"
          onChange={(label) => set("evaluation_cta", { mode: s.evaluation_cta?.mode ?? "whatsapp", ...s.evaluation_cta, label })} />
      </section>

      <section className={card}>
        <h2 className={h2}>Endereço e mapa</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextInput label="Logradouro" value={s.address?.street} maxLength={120} onChange={(v) => setAddr("street", v)} />
          <TextInput label="Número" value={s.address?.number} maxLength={20} onChange={(v) => setAddr("number", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Complemento" value={s.address?.complement} maxLength={60} onChange={(v) => setAddr("complement", v)} />
          <TextInput label="Bairro" value={s.address?.district} maxLength={60} onChange={(v) => setAddr("district", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem_10rem]">
          <TextInput label="Cidade" value={s.address?.city} maxLength={60} onChange={(v) => setAddr("city", v)} />
          <TextInput label="UF" value={s.address?.state} maxLength={2} error={issues["address.state"]} onChange={(v) => setAddr("state", v?.toUpperCase())} />
          <TextInput label="CEP" value={s.address?.postal_code} maxLength={9} error={issues["address.postal_code"]} onChange={(v) => setAddr("postal_code", v)} />
        </div>
        <TextInput label="Link do mapa (https)" value={s.map_url} maxLength={500} error={issues.map_url}
          hint="Abre em nova aba; o mapa não é incorporado sem consentimento." onChange={(v) => set("map_url", v)} />
      </section>

      <section className={card}>
        <h2 className={h2}>Horários</h2>
        <PairsEditor
          items={s.hours ?? []}
          labelA="Dias" labelB="Horário" placeholderA="Seg a Sex" placeholderB="9h às 19h"
          onChange={(hours) => set("hours", hours)}
        />
      </section>

      <section className={card}>
        <h2 className={h2}>Redes sociais</h2>
        {(["instagram", "facebook", "tiktok", "youtube"] as const).map((k) => (
          <TextInput key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={s.social?.[k]} maxLength={300}
            error={issues[`social.${k}`]} placeholder="https://" onChange={(v) => setSocial(k, v)} />
        ))}
      </section>

      <section className={card}>
        <h2 className={h2}>Navegação e rodapé</h2>
        <NavEditor items={s.nav ?? []} issues={issues} onChange={(nav) => set("nav", nav)} />
        <TextArea label="Texto do rodapé" value={s.footer_note} maxLength={300} onChange={(v) => set("footer_note", v)} />
      </section>

      <section className={card}>
        <h2 className={h2}>SEO padrão</h2>
        <TextInput label="Título padrão" value={s.seo_default_title} maxLength={70} onChange={(v) => set("seo_default_title", v)} />
        <TextArea label="Descrição padrão" value={s.seo_default_description} maxLength={170} onChange={(v) => set("seo_default_description", v)} />
      </section>

      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-raised p-4">
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <div className="flex items-center gap-3">
          <button type="button" className={buttonPrimary} disabled={!hydrated || pending || !dirty} onClick={onSave}>
            {pending ? "Salvando…" : "Salvar configurações"}
          </button>
          {dirty ? <span role="status" className="text-sm font-semibold text-danger">alterações não salvas</span> : null}
        </div>
      </div>
    </div>
  );
}

function PairsEditor(props: {
  items: Pair[];
  labelA: string;
  labelB: string;
  placeholderA: string;
  placeholderB: string;
  onChange: (items: Pair[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {props.items.map((it, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput label={`${props.labelA} ${i + 1}`} value={it.label} maxLength={40} placeholder={props.placeholderA}
            onChange={(v) => props.onChange(props.items.map((x, j) => (j === i ? { ...x, label: v ?? "" } : x)))} />
          <TextInput label={`${props.labelB} ${i + 1}`} value={it.value} maxLength={60} placeholder={props.placeholderB}
            onChange={(v) => props.onChange(props.items.map((x, j) => (j === i ? { ...x, value: v ?? "" } : x)))} />
          <button type="button" className="min-h-11 rounded px-3 text-sm text-danger hover:bg-danger-bg"
            onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}>Remover</button>
        </div>
      ))}
      <button type="button" className={`${buttonSecondary} self-start`} onClick={() => props.onChange([...props.items, { label: "", value: "" }])}>
        Adicionar linha
      </button>
    </div>
  );
}

function NavEditor(props: { items: NavItem[]; issues: Record<string, string>; onChange: (items: NavItem[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold">Menu principal</legend>
      {props.items.map((it, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput label={`Rótulo ${i + 1}`} value={it.label} maxLength={40}
            onChange={(v) => props.onChange(props.items.map((x, j) => (j === i ? { ...x, label: v ?? "" } : x)))} />
          <TextInput label={`Destino ${i + 1}`} value={it.href} maxLength={500} placeholder="/tratamentos" error={props.issues[`nav.${i}.href`]}
            onChange={(v) => props.onChange(props.items.map((x, j) => (j === i ? { ...x, href: v ?? "" } : x)))} />
          <button type="button" className="min-h-11 rounded px-3 text-sm text-danger hover:bg-danger-bg"
            onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}>Remover</button>
        </div>
      ))}
      <button type="button" className={`${buttonSecondary} self-start`} onClick={() => props.onChange([...props.items, { label: "", href: "/" }])}>
        Adicionar item
      </button>
    </fieldset>
  );
}
