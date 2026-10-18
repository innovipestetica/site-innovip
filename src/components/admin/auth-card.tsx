import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Moldura das telas de login, MFA e recuperação de senha. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main
      id="conteudo"
      className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center"
    >
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={88} priority />
          <h1 className="text-xl font-bold text-brand-800">{title}</h1>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
