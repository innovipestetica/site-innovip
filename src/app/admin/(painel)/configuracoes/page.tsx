import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getSettings } from "@/lib/cms/admin-data";
import { parseSettings } from "@/lib/cms/settings";
import { AdminMain, PageHeader, formatDateTime } from "@/components/admin/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configurações públicas" };

export default function SettingsPage() {
  return (
    <AdminMain>
      <PageHeader
        title="Configurações públicas"
        description="Somente informações públicas e reais da clínica. Campos vazios ficam ocultos no site. Tokens de integrações nunca vão aqui."
      />
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <Settings />
      </Suspense>
    </AdminMain>
  );
}

async function Settings() {
  await requireAdmin();
  const row = await getSettings();
  return (
    <>
      <p className="mb-4 text-xs text-muted">Última alteração: {formatDateTime(row.updated_at)} · revisão {row.revision}</p>
      <SettingsForm key={row.revision} revision={row.revision} initial={parseSettings(row.data)} />
    </>
  );
}
