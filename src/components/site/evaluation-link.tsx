import Link from "next/link";
import type { EvaluationTarget } from "@/lib/cms/settings";

/**
 * Botão/link de "Agendar avaliação" com o destino das Configurações
 * públicas (WhatsApp, link externo ou formulário do site).
 * Externo: nova aba com rel="noopener noreferrer".
 */
export function EvaluationLink({
  target,
  className,
  location,
  children,
}: {
  target: EvaluationTarget;
  className?: string;
  location: string;
  children?: React.ReactNode;
}) {
  const label = children ?? target.label;
  const data = { "data-cta": "evaluation", "data-cta-target": target.mode, "data-cta-location": location };
  return target.external ? (
    <a href={target.href} target="_blank" rel="noopener noreferrer" className={className} {...data}>
      {label}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : (
    <Link href={target.href} className={className} {...data}>
      {label}
    </Link>
  );
}
