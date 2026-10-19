import type { EvaluationTarget } from "@/lib/cms/settings";

/**
 * Botão/link de "Agendar avaliação" com o destino das Configurações
 * públicas (WhatsApp ou link externo), em nova aba com rel="noopener noreferrer".
 * Sem destino configurado não renderiza nada (nada de link quebrado).
 */
export function EvaluationLink({
  target,
  className,
  location,
  children,
}: {
  target: EvaluationTarget | null;
  className?: string;
  location: string;
  children?: React.ReactNode;
}) {
  if (!target) return null;
  const label = children ?? target.label;
  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-cta="evaluation"
      data-cta-target={target.mode}
      data-cta-location={location}
    >
      {label}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
