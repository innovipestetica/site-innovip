"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Field, buttonPrimary } from "@/components/ui/form";
import { useHydrated } from "@/components/ui/use-hydrated";
import { slugify, type ContentType } from "@/lib/cms/content-types";
import { createEntryAction } from "../../actions";

export function NewEntryForm({
  type,
  segment,
  prefix,
}: {
  type: ContentType;
  segment: string;
  prefix: string | null;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(type === "home" ? "Home" : "");
  const [slug, setSlug] = useState(type === "home" ? "home" : "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    const result = await createEntryAction({ type, title, slug });
    if (!result.ok) {
      setPending(false);
      setFormError(result.message);
      setErrors(Object.fromEntries((result.issues ?? []).map((i) => [i.path, i.message])));
      return;
    }
    router.push(`/admin/conteudo/${segment}/${result.data.id}`);
  }

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface-raised p-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field
        label="Título"
        name="title"
        value={title}
        maxLength={200}
        required
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (!slugTouched && type !== "home") setSlug(slugify(e.target.value));
        }}
      />
      {type !== "home" ? (
        <Field
          label="Endereço (slug)"
          name="slug"
          value={slug}
          maxLength={120}
          required
          hint={prefix ? `Ficará em ${prefix}${slug || "…"}` : "Identificador interno (este tipo não tem página própria)."}
          error={errors.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      ) : null}
      <button type="submit" className={buttonPrimary} disabled={!hydrated || pending}>
        {pending ? "Criando…" : "Criar rascunho"}
      </button>
    </form>
  );
}
