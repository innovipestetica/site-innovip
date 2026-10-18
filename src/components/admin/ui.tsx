import type { ReactNode } from "react";
import { LIFECYCLE_LABEL, type LifecycleStatus } from "@/lib/cms/content-types";

const STATUS_STYLE: Record<LifecycleStatus, string> = {
  published: "bg-success-bg text-success border-success/30",
  draft: "bg-gold-100 text-gold-700 border-gold-300",
  unpublished: "bg-surface text-muted border-line",
  archived: "bg-surface text-muted border-line line-through",
};

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {LIFECYCLE_LABEL[status]}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminMain({ children }: { children: ReactNode }) {
  return <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface-raised p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Data/hora em America/Sao_Paulo (o banco guarda UTC). */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : "—";
}
