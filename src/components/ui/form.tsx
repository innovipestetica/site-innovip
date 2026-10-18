import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Campo com label persistente, dica e erro associados ao input (a11y). */
export function Field({ label, hint, error, id, className, ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-dica` : undefined;
  const errorId = error ? `${inputId}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-[var(--radius-control)] border bg-surface-raised px-3 text-base text-ink placeholder:text-muted/70 ${
          error ? "border-danger" : "border-line"
        } ${className ?? ""}`}
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type AlertProps = {
  tone: "error" | "success" | "info";
  children: ReactNode;
};

export function Alert({ tone, children }: AlertProps) {
  const styles = {
    error: "border-danger/30 bg-danger-bg text-danger",
    success: "border-success/30 bg-success-bg text-success",
    info: "border-brand-300 bg-brand-50 text-brand-900",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60";

export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-brand-700 px-5 font-semibold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60";
