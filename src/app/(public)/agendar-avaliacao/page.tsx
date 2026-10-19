import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicSettings } from "@/lib/cms/public-data";
import { evaluationTarget } from "@/lib/cms/settings";

/**
 * Endereço fixo do agendamento (bio do Instagram, QR codes, campanhas).
 * O agendamento é EXTERNO: redireciona (307, temporário — o destino pode
 * mudar) para o WhatsApp ou link das Configurações públicas. Sem destino, 404.
 * Em cache com a tag "settings": muda junto com as configurações.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ScheduleRedirect() {
  const target = evaluationTarget(await getPublicSettings());
  if (!target) notFound();
  redirect(target.href);
}
