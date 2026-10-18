import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { listTaxonomies } from "@/lib/cms/admin-data";
import { AdminMain, PageHeader } from "@/components/admin/ui";
import { TaxonomyManager } from "./taxonomy-manager";

export const metadata: Metadata = { title: "Categorias e objetivos" };

export default function TaxonomiesPage() {
  return (
    <AdminMain>
      <PageHeader
        title="Categorias e objetivos"
        description="Categorias organizam o catálogo (ex.: faciais, corporais). Objetivos respondem “O que você deseja tratar?”. Cadastre só o que a clínica realmente oferece."
      />
      <Suspense fallback={<p className="text-sm text-muted" role="status">Carregando…</p>}>
        <Taxonomies />
      </Suspense>
    </AdminMain>
  );
}

async function Taxonomies() {
  await requireAdmin();
  const { categories, concerns } = await listTaxonomies();
  return (
    <div className="flex flex-col gap-10">
      <TaxonomyManager kind="categories" title="Categorias" items={categories} />
      <TaxonomyManager kind="concerns" title="Objetivos" items={concerns} />
    </div>
  );
}
