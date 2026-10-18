-- =============================================================================
-- Innovip — Etapa 2: view de listagem do painel
-- security_invoker = true: a view respeita o RLS de quem consulta (não abre
-- nada além do que as tabelas já permitem). Sem grant para anon.
-- =============================================================================

create view public.cms_entry_list
with (security_invoker = true)
as
select
  e.id,
  e.type,
  e.slug,
  e.lifecycle_status,
  e.latest_revision,
  e.sort_order,
  e.published_at,
  e.first_published_at,
  e.created_at,
  e.updated_at,
  e.published_version_id,
  v.id as latest_version_id,
  v.title,
  v.summary,
  v.created_at as latest_saved_at,
  pv.revision as published_revision
from public.content_entries e
join public.content_versions v
  on v.entry_id = e.id and v.revision = e.latest_revision
left join public.content_versions pv
  on pv.id = e.published_version_id;

revoke all on public.cms_entry_list from public, anon;
grant select on public.cms_entry_list to authenticated;
