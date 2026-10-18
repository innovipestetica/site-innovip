-- =============================================================================
-- Innovip — Etapa 2: modelo de conteúdo do CMS
--
-- Entidade estável (content_entries) + versões imutáveis (content_versions).
-- Cada "salvar" cria uma revisão nova; publicar troca o ponteiro
-- published_version_id em transação. Rascunho nunca altera o que está no ar.
--
-- Dados específicos por tipo e relações acompanham a VERSÃO (detalhes e N:N
-- com version_id), para que a publicação congele também classificações.
-- Referências a outros conteúdos e a mídias citadas em blocks/seo/data são
-- extraídas pelo banco (convenção entryId/entryIds/mediaId/mediaIds) e
-- gravadas com FK: nada crítico fica só no JSON.
--
-- Escrita somente via RPCs public.cms_* (SECURITY INVOKER, RLS ativo, exigem
-- private.is_admin(), ou seja, administrador com MFA).
-- Erros com SQLSTATE PTxxx viram HTTP xxx no PostgREST:
--   PT403 proibido, PT404 não encontrado, PT409 conflito, PT422 inválido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.content_type as enum (
  'home', 'page', 'treatment', 'technology', 'promotion', 'landing',
  'blog_post', 'faq', 'team_member', 'testimonial'
);

create type public.lifecycle_status as enum ('draft', 'published', 'unpublished', 'archived');
create type public.editorial_status as enum ('draft', 'published', 'archived');
create type public.media_status as enum ('processing', 'private', 'published', 'archived');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Lista fechada de blocos (schema_version 1). Precisa bater com
-- src/lib/cms/blocks.ts (teste unitário confere).
create or replace function private.cms_blocks_are_valid(p_blocks jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_blocks) = 'array'
     and jsonb_array_length(p_blocks) <= 60
     and not exists (
       select 1
       from jsonb_array_elements(p_blocks) b
       where jsonb_typeof(b) <> 'object'
          or jsonb_typeof(b -> 'id') <> 'string'
          or not (b ->> 'type' = any (array[
               'hero', 'rich_text', 'image', 'cta', 'features', 'steps', 'notice',
               'faq_list', 'treatment_list', 'category_list', 'concern_list',
               'promotion_list', 'testimonial_list', 'team_list', 'gallery', 'contact'
             ]))
     );
$$;

-- Caminho público de cada tipo (null = sem página própria).
create or replace function private.content_path(p_type public.content_type, p_slug text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'home' then '/'
    when 'page' then '/' || p_slug
    when 'treatment' then '/tratamentos/' || p_slug
    when 'promotion' then '/promocoes/' || p_slug
    when 'landing' then '/lp/' || p_slug
    when 'blog_post' then '/blog/' || p_slug
    else null
  end;
$$;

revoke all on function private.touch_updated_at() from public;
revoke all on function private.cms_blocks_are_valid(jsonb) from public;
revoke all on function private.content_path(public.content_type, text) from public;
grant execute on function private.cms_blocks_are_valid(jsonb) to authenticated, service_role;
grant execute on function private.content_path(public.content_type, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Taxonomias (não versionadas; estado editorial próprio)
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (char_length(description) <= 300),
  sort_order integer not null default 0,
  status public.editorial_status not null default 'draft',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "O que você deseja tratar?" — objetivos do visitante.
create table public.concerns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (char_length(description) <= 300),
  area text check (area in ('facial', 'corporal')),
  sort_order integer not null default 0,
  status public.editorial_status not null default 'draft',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_status_order_idx on public.categories (status, sort_order);
create index concerns_status_order_idx on public.concerns (status, sort_order);

-- -----------------------------------------------------------------------------
-- Mídia
-- Original e variantes ficam no bucket privado. Ao aprovar, as variantes
-- são copiadas para o bucket público (public_variants).
-- -----------------------------------------------------------------------------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  status public.media_status not null default 'processing',
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  width integer check (width between 1 and 12000),
  height integer check (height between 1 and 12000),
  alt text check (char_length(alt) <= 250),
  private_original_path text not null unique
    check (private_original_path ~ '^originals/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'),
  private_variants jsonb not null default '[]' check (jsonb_typeof(private_variants) = 'array'),
  public_variants jsonb not null default '[]' check (jsonb_typeof(public_variants) = 'array'),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_published_has_public_variants
    check (status <> 'published' or jsonb_array_length(public_variants) > 0)
);

create index media_assets_status_created_idx on public.media_assets (status, created_at desc);
create unique index media_assets_sha256_idx on public.media_assets (sha256) where sha256 is not null;

-- Evidências privadas de licença/autorização de imagem e depoimento.
create table public.media_permissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('licenca', 'autorizacao_imagem', 'autorizacao_depoimento')),
  media_id uuid references public.media_assets (id) on delete restrict,
  description text not null check (char_length(description) between 1 and 500),
  evidence_path text check (evidence_path ~ '^evidence/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  granted_on date,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or granted_on is null or expires_on >= granted_on)
);

create index media_permissions_media_idx on public.media_permissions (media_id);

-- -----------------------------------------------------------------------------
-- Conteúdo: entidade + versões
-- -----------------------------------------------------------------------------
create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  type public.content_type not null,
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  lifecycle_status public.lifecycle_status not null default 'draft',
  published_version_id uuid,
  latest_revision integer not null default 0 check (latest_revision >= 0),
  sort_order integer not null default 0,
  first_published_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_entries_type_slug_key unique (type, slug),
  constraint content_published_has_version
    check (lifecycle_status <> 'published' or published_version_id is not null)
);

-- Uma única Home.
create unique index content_entries_single_home on public.content_entries (type) where type = 'home';
create index content_entries_type_status_idx on public.content_entries (type, lifecycle_status, sort_order);
create index content_entries_published_version_idx on public.content_entries (published_version_id);
create index content_entries_updated_idx on public.content_entries (updated_at desc);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.content_entries (id) on delete cascade,
  revision integer not null check (revision > 0),
  schema_version smallint not null check (schema_version between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text check (char_length(summary) <= 500),
  blocks jsonb not null default '[]'
    check (private.cms_blocks_are_valid(blocks) and pg_column_size(blocks) <= 524288),
  seo jsonb not null default '{}'
    check (jsonb_typeof(seo) = 'object' and pg_column_size(seo) <= 8192),
  data jsonb not null default '{}'
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_versions_entry_revision_key unique (entry_id, revision),
  constraint content_versions_id_entry_key unique (id, entry_id)
);

create index content_versions_entry_idx on public.content_versions (entry_id, revision desc);

-- A versão publicada pertence à própria entidade (FK composta).
alter table public.content_entries
  add constraint content_entries_published_version_fk
  foreign key (published_version_id, id)
  references public.content_versions (id, entry_id);

-- Referências extraídas dos JSONs da versão.
create table public.version_entry_refs (
  version_id uuid not null references public.content_versions (id) on delete cascade,
  target_entry_id uuid not null references public.content_entries (id) on delete restrict,
  primary key (version_id, target_entry_id)
);
create index version_entry_refs_target_idx on public.version_entry_refs (target_entry_id);

create table public.version_media_refs (
  version_id uuid not null references public.content_versions (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete restrict,
  primary key (version_id, media_id)
);
create index version_media_refs_media_idx on public.version_media_refs (media_id);

-- -----------------------------------------------------------------------------
-- Dados específicos por tipo (ligados à versão)
-- -----------------------------------------------------------------------------
create table public.treatment_details (
  version_id uuid primary key references public.content_versions (id) on delete cascade,
  requires_evaluation boolean not null default true,
  -- Revisão do responsável habilitado (obrigatória para publicar).
  clinical_reviewer text check (char_length(clinical_reviewer) <= 120),
  clinical_reviewed_on date
);

create table public.treatment_categories (
  version_id uuid not null references public.content_versions (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (version_id, category_id)
);
create index treatment_categories_category_idx on public.treatment_categories (category_id);

create table public.treatment_concerns (
  version_id uuid not null references public.content_versions (id) on delete cascade,
  concern_id uuid not null references public.concerns (id) on delete restrict,
  primary key (version_id, concern_id)
);
create index treatment_concerns_concern_idx on public.treatment_concerns (concern_id);

create table public.promotion_details (
  version_id uuid primary key references public.content_versions (id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Valores em centavos de BRL. Só publicar quando fornecidos e aprovados.
  price_cents integer check (price_cents between 0 and 100000000),
  original_price_cents integer check (original_price_cents between 0 and 100000000),
  terms text check (char_length(terms) <= 4000),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (original_price_cents is null or price_cents is not null)
);
create index promotion_details_window_idx on public.promotion_details (starts_at, ends_at);

create table public.promotion_treatments (
  version_id uuid not null references public.content_versions (id) on delete cascade,
  treatment_entry_id uuid not null references public.content_entries (id) on delete restrict,
  primary key (version_id, treatment_entry_id)
);
create index promotion_treatments_treatment_idx on public.promotion_treatments (treatment_entry_id);

create table public.landing_details (
  version_id uuid primary key references public.content_versions (id) on delete cascade,
  campaign_key text check (campaign_key ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and char_length(campaign_key) <= 60),
  promotion_entry_id uuid references public.content_entries (id) on delete restrict,
  reduced_navigation boolean not null default true
);
create index landing_details_promotion_idx on public.landing_details (promotion_entry_id);

-- -----------------------------------------------------------------------------
-- Configurações públicas (uma linha) e redirecionamentos
-- -----------------------------------------------------------------------------
create table public.site_settings_public (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 32768),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.site_settings_public (id, data) values (1, '{}');

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique
    check (source_path ~ '^/[a-z0-9/-]*$' and char_length(source_path) <= 200 and source_path <> '/'),
  target_path text not null
    check (target_path ~ '^/[a-z0-9/-]*$' and char_length(target_path) <= 200),
  status_code smallint not null default 301 check (status_code in (301, 302, 307, 308)),
  created_at timestamptz not null default now(),
  check (source_path <> target_path)
);
create index redirects_target_idx on public.redirects (target_path);

-- Impede ciclos (A→B→…→A) seguindo a cadeia a partir do destino.
create or replace function private.redirects_prevent_loop()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_next text := new.target_path;
  v_hops integer := 0;
begin
  while v_next is not null loop
    if v_next = new.source_path then
      raise exception 'redirecionamento criaria um ciclo' using errcode = 'PT422';
    end if;
    v_hops := v_hops + 1;
    if v_hops > 20 then
      raise exception 'cadeia de redirecionamento longa demais' using errcode = 'PT422';
    end if;
    select r.target_path into v_next
      from public.redirects r
     where r.source_path = v_next and r.id <> new.id;
    if not found then v_next := null; end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.redirects_prevent_loop() from public;

create trigger redirects_prevent_loop
  before insert or update on public.redirects
  for each row execute function private.redirects_prevent_loop();

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create trigger categories_touch before update on public.categories
  for each row execute function private.touch_updated_at();
create trigger concerns_touch before update on public.concerns
  for each row execute function private.touch_updated_at();
create trigger media_assets_touch before update on public.media_assets
  for each row execute function private.touch_updated_at();
create trigger media_permissions_touch before update on public.media_permissions
  for each row execute function private.touch_updated_at();
create trigger content_entries_touch before update on public.content_entries
  for each row execute function private.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings_public
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Auditoria por trigger (autor = auth.uid() da sessão)
-- -----------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_action text;
begin
  v_id := coalesce(
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id') else (to_jsonb(new) ->> 'id') end,
    ''
  );
  v_action := 'cms.' || tg_table_name || '.' || lower(tg_op);

  -- Em content_entries, registra a transição de estado quando houver.
  if tg_table_name = 'content_entries' and tg_op = 'UPDATE' then
    if new.lifecycle_status is distinct from old.lifecycle_status then
      v_action := 'cms.content.' || new.lifecycle_status::text;
    elsif new.published_version_id is distinct from old.published_version_id then
      v_action := 'cms.content.published';
    elsif new.slug is distinct from old.slug then
      v_action := 'cms.content.slug_changed';
    else
      return null; -- salvar rascunho só incrementa latest_revision
    end if;
  end if;

  perform private.write_audit_log(v_action, tg_table_name, v_id, null);
  return null;
end;
$$;
revoke all on function private.audit_row_change() from public, anon, authenticated;

create trigger audit_content_entries after insert or update or delete on public.content_entries
  for each row execute function private.audit_row_change();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function private.audit_row_change();
create trigger audit_concerns after insert or update or delete on public.concerns
  for each row execute function private.audit_row_change();
create trigger audit_media_assets after insert or update or delete on public.media_assets
  for each row execute function private.audit_row_change();
create trigger audit_media_permissions after insert or update or delete on public.media_permissions
  for each row execute function private.audit_row_change();
create trigger audit_site_settings after update on public.site_settings_public
  for each row execute function private.audit_row_change();
create trigger audit_redirects after insert or update or delete on public.redirects
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.concerns enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_permissions enable row level security;
alter table public.content_entries enable row level security;
alter table public.content_versions enable row level security;
alter table public.version_entry_refs enable row level security;
alter table public.version_media_refs enable row level security;
alter table public.treatment_details enable row level security;
alter table public.treatment_categories enable row level security;
alter table public.treatment_concerns enable row level security;
alter table public.promotion_details enable row level security;
alter table public.promotion_treatments enable row level security;
alter table public.landing_details enable row level security;
alter table public.site_settings_public enable row level security;
alter table public.redirects enable row level security;

-- Administrador (com MFA): acesso total às tabelas do CMS.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'concerns', 'media_assets', 'media_permissions',
    'content_entries', 'content_versions', 'version_entry_refs', 'version_media_refs',
    'treatment_details', 'treatment_categories', 'treatment_concerns',
    'promotion_details', 'promotion_treatments', 'landing_details',
    'site_settings_public', 'redirects'
  ] loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated
         using ((select private.is_admin())) with check ((select private.is_admin()))',
      t
    );
  end loop;
end;
$$;

-- Leitura pública: só o que está publicado.
create policy public_read on public.categories for select to anon, authenticated
  using (status = 'published');
create policy public_read on public.concerns for select to anon, authenticated
  using (status = 'published');
create policy public_read on public.media_assets for select to anon, authenticated
  using (status = 'published');
create policy public_read on public.content_entries for select to anon, authenticated
  using (lifecycle_status = 'published' and published_version_id is not null);
create policy public_read on public.content_versions for select to anon, authenticated
  using (exists (
    select 1 from public.content_entries e
     where e.published_version_id = content_versions.id
       and e.lifecycle_status = 'published'
  ));

do $$
declare
  t text;
begin
  foreach t in array array[
    'treatment_details', 'treatment_categories', 'treatment_concerns',
    'promotion_details', 'promotion_treatments', 'landing_details'
  ] loop
    execute format(
      'create policy public_read on public.%I for select to anon, authenticated
         using (exists (
           select 1 from public.content_entries e
            where e.published_version_id = %I.version_id
              and e.lifecycle_status = ''published''
         ))',
      t, t
    );
  end loop;
end;
$$;

create policy public_read on public.site_settings_public for select to anon, authenticated
  using (true);
create policy public_read on public.redirects for select to anon, authenticated
  using (true);
-- media_permissions, version_*_refs: sem leitura pública.

-- -----------------------------------------------------------------------------
-- Grants (explícitos; o default do schema public não concede nada)
-- anon recebe só colunas públicas; authenticated recebe tudo e o RLS decide.
-- -----------------------------------------------------------------------------
grant usage on type public.content_type, public.lifecycle_status,
  public.editorial_status, public.media_status to anon, authenticated;

grant select (id, name, slug, description, sort_order, area)
  on public.concerns to anon;
grant select (id, name, slug, description, sort_order)
  on public.categories to anon;
grant select (id, mime, width, height, alt, public_variants)
  on public.media_assets to anon;
grant select (id, type, slug, lifecycle_status, published_version_id, sort_order,
              first_published_at, published_at, updated_at)
  on public.content_entries to anon;
grant select (id, entry_id, revision, schema_version, title, summary, blocks, seo, data, created_at)
  on public.content_versions to anon;
grant select (version_id, requires_evaluation) on public.treatment_details to anon;
grant select on public.treatment_categories, public.treatment_concerns,
  public.promotion_details, public.promotion_treatments to anon;
grant select (version_id, campaign_key, promotion_entry_id, reduced_navigation)
  on public.landing_details to anon;
grant select (data, updated_at) on public.site_settings_public to anon;
grant select (source_path, target_path, status_code) on public.redirects to anon;

grant select, insert, update, delete on
  public.categories, public.concerns, public.media_assets, public.media_permissions,
  public.content_entries, public.content_versions, public.version_entry_refs,
  public.version_media_refs, public.treatment_details, public.treatment_categories,
  public.treatment_concerns, public.promotion_details, public.promotion_treatments,
  public.landing_details, public.redirects
  to authenticated;
grant select, update on public.site_settings_public to authenticated;

-- -----------------------------------------------------------------------------
-- Funções do CMS (SECURITY INVOKER: o RLS do administrador vale)
-- -----------------------------------------------------------------------------
create or replace function private.cms_require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'operação restrita ao administrador com MFA' using errcode = 'PT403';
  end if;
end;
$$;
revoke all on function private.cms_require_admin() from public;
grant execute on function private.cms_require_admin() to authenticated;

-- Extrai UUIDs de entryId/entryIds ou mediaId/mediaIds em qualquer nível.
create or replace function private.cms_extract_ids(p_doc jsonb, p_key text)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct v::uuid), '{}')
  from (
    select x #>> '{}' as v
      from jsonb_path_query(p_doc, ('lax $.**.' || p_key)::jsonpath) x
     where jsonb_typeof(x) = 'string'
    union all
    select x #>> '{}'
      from jsonb_path_query(p_doc, ('lax $.**.' || p_key || 's[*]')::jsonpath) x
     where jsonb_typeof(x) = 'string'
  ) ids
  where v <> '';
$$;
revoke all on function private.cms_extract_ids(jsonb, text) from public;
grant execute on function private.cms_extract_ids(jsonb, text) to authenticated;

-- Grava detalhes, relações e referências de uma versão a partir do payload.
create or replace function private.cms_write_version_children(
  p_version_id uuid,
  p_type public.content_type,
  p_payload jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_details jsonb := coalesce(p_payload -> 'details', '{}');
  v_rel jsonb := coalesce(p_payload -> 'relations', '{}');
  v_doc jsonb;
begin
  if p_type = 'treatment' then
    insert into public.treatment_details (version_id, requires_evaluation, clinical_reviewer, clinical_reviewed_on)
    values (
      p_version_id,
      coalesce((v_details ->> 'requires_evaluation')::boolean, true),
      nullif(btrim(v_details ->> 'clinical_reviewer'), ''),
      nullif(v_details ->> 'clinical_reviewed_on', '')::date
    );
    insert into public.treatment_categories (version_id, category_id)
      select distinct p_version_id, x::uuid
        from jsonb_array_elements_text(coalesce(v_rel -> 'categories', '[]')) x;
    insert into public.treatment_concerns (version_id, concern_id)
      select distinct p_version_id, x::uuid
        from jsonb_array_elements_text(coalesce(v_rel -> 'concerns', '[]')) x;
  elsif p_type = 'promotion' then
    insert into public.promotion_details (version_id, starts_at, ends_at, price_cents, original_price_cents, terms)
    values (
      p_version_id,
      nullif(v_details ->> 'starts_at', '')::timestamptz,
      nullif(v_details ->> 'ends_at', '')::timestamptz,
      nullif(v_details ->> 'price_cents', '')::integer,
      nullif(v_details ->> 'original_price_cents', '')::integer,
      nullif(btrim(v_details ->> 'terms'), '')
    );
    insert into public.promotion_treatments (version_id, treatment_entry_id)
      select distinct p_version_id, x::uuid
        from jsonb_array_elements_text(coalesce(v_rel -> 'treatments', '[]')) x;
  elsif p_type = 'landing' then
    insert into public.landing_details (version_id, campaign_key, promotion_entry_id, reduced_navigation)
    values (
      p_version_id,
      nullif(btrim(v_details ->> 'campaign_key'), ''),
      nullif(v_details ->> 'promotion_entry_id', '')::uuid,
      coalesce((v_details ->> 'reduced_navigation')::boolean, true)
    );
  end if;

  -- Referências citadas em blocks/seo/data/details + relações de entradas.
  v_doc := jsonb_build_array(p_payload -> 'blocks', p_payload -> 'seo', p_payload -> 'data', v_details);

  insert into public.version_entry_refs (version_id, target_entry_id)
    select distinct p_version_id, r
      from unnest(
        private.cms_extract_ids(v_doc, 'entryId')
        || coalesce(array(select x::uuid from jsonb_array_elements_text(coalesce(v_rel -> 'treatments', '[]')) x), '{}')
        || coalesce(array(select (v_details ->> 'promotion_entry_id')::uuid where nullif(v_details ->> 'promotion_entry_id', '') is not null), '{}')
      ) r;

  insert into public.version_media_refs (version_id, media_id)
    select distinct p_version_id, m
      from unnest(private.cms_extract_ids(v_doc, 'mediaId')) m;
end;
$$;
revoke all on function private.cms_write_version_children(uuid, public.content_type, jsonb) from public;
grant execute on function private.cms_write_version_children(uuid, public.content_type, jsonb) to authenticated;

-- Reconstrói o payload (details/relations) de uma versão existente.
create or replace function private.cms_version_payload(p_version_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', v.schema_version,
    'title', v.title,
    'summary', v.summary,
    'blocks', v.blocks,
    'seo', v.seo,
    'data', v.data,
    'details', coalesce(
      (select to_jsonb(t) - 'version_id' from public.treatment_details t where t.version_id = v.id),
      (select to_jsonb(p) - 'version_id' from public.promotion_details p where p.version_id = v.id),
      (select to_jsonb(l) - 'version_id' from public.landing_details l where l.version_id = v.id),
      '{}'::jsonb
    ),
    'relations', jsonb_build_object(
      'categories', coalesce((select jsonb_agg(category_id) from public.treatment_categories where version_id = v.id), '[]'),
      'concerns', coalesce((select jsonb_agg(concern_id) from public.treatment_concerns where version_id = v.id), '[]'),
      'treatments', coalesce((select jsonb_agg(treatment_entry_id) from public.promotion_treatments where version_id = v.id), '[]')
    )
  )
  from public.content_versions v
  where v.id = p_version_id;
$$;
revoke all on function private.cms_version_payload(uuid) from public;
grant execute on function private.cms_version_payload(uuid) to authenticated;

-- Cria uma revisão nova. Payload:
-- { schema_version, title, summary, blocks, seo, data, details, relations }
create or replace function private.cms_insert_version(
  p_entry_id uuid,
  p_type public.content_type,
  p_revision integer,
  p_payload jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.content_versions (entry_id, revision, schema_version, title, summary, blocks, seo, data)
  values (
    p_entry_id,
    p_revision,
    coalesce((p_payload ->> 'schema_version')::smallint, 1),
    coalesce(p_payload ->> 'title', ''),
    nullif(btrim(p_payload ->> 'summary'), ''),
    coalesce(p_payload -> 'blocks', '[]'),
    coalesce(p_payload -> 'seo', '{}'),
    coalesce(p_payload -> 'data', '{}')
  )
  returning id into v_id;

  perform private.cms_write_version_children(v_id, p_type, p_payload);
  return v_id;
end;
$$;
revoke all on function private.cms_insert_version(uuid, public.content_type, integer, jsonb) from public;
grant execute on function private.cms_insert_version(uuid, public.content_type, integer, jsonb) to authenticated;

-- Criar conteúdo (revisão 1).
create or replace function public.cms_create_entry(
  p_type public.content_type,
  p_slug text,
  p_payload jsonb
)
returns table (entry_id uuid, version_id uuid, revision integer)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry uuid;
  v_version uuid;
begin
  perform private.cms_require_admin();

  insert into public.content_entries (type, slug, latest_revision)
  values (p_type, p_slug, 1)
  returning id into v_entry;

  v_version := private.cms_insert_version(v_entry, p_type, 1, p_payload);
  return query select v_entry, v_version, 1;
end;
$$;

-- Salvar (nova revisão) com detecção de conflito.
create or replace function public.cms_save_version(
  p_entry_id uuid,
  p_base_revision integer,
  p_payload jsonb
)
returns table (version_id uuid, revision integer)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry public.content_entries;
  v_version uuid;
begin
  perform private.cms_require_admin();

  select * into v_entry from public.content_entries where id = p_entry_id for update;
  if not found then
    raise exception 'conteúdo não encontrado' using errcode = 'PT404';
  end if;
  if v_entry.latest_revision <> p_base_revision then
    raise exception 'conflito: outra edição foi salva antes desta'
      using errcode = 'PT409',
            detail = json_build_object('latest_revision', v_entry.latest_revision)::text;
  end if;
  if v_entry.lifecycle_status = 'archived' then
    raise exception 'conteúdo arquivado: restaure antes de editar' using errcode = 'PT422';
  end if;

  v_version := private.cms_insert_version(p_entry_id, v_entry.type, p_base_revision + 1, p_payload);
  update public.content_entries set latest_revision = p_base_revision + 1 where id = p_entry_id;
  return query select v_version, p_base_revision + 1;
end;
$$;

-- Problemas que impedem publicar uma versão (lista vazia = pode publicar).
create or replace function private.cms_publish_problems(p_version_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_version public.content_versions;
  v_type public.content_type;
  v_problems text[] := '{}';
  v_promo public.promotion_details;
  v_treat public.treatment_details;
  v_landing public.landing_details;
begin
  select * into v_version from public.content_versions where id = p_version_id;
  select type into v_type from public.content_entries where id = v_version.entry_id;

  if exists (
    select 1 from public.version_entry_refs r
      join public.content_entries e on e.id = r.target_entry_id
     where r.version_id = p_version_id
       and (e.lifecycle_status <> 'published' or e.published_version_id is null)
  ) then
    v_problems := v_problems || 'Há referência a conteúdo que não está publicado.';
  end if;

  if exists (
    select 1 from public.version_media_refs r
      join public.media_assets m on m.id = r.media_id
     where r.version_id = p_version_id and m.status <> 'published'
  ) then
    v_problems := v_problems || 'Há imagem ainda não aprovada para publicação.';
  end if;

  if v_type = 'treatment' then
    select * into v_treat from public.treatment_details where version_id = p_version_id;
    if v_treat.clinical_reviewer is null or v_treat.clinical_reviewed_on is null then
      v_problems := v_problems || 'Tratamento sem revisão clínica registrada (responsável e data).';
    end if;
    if exists (
      select 1 from public.treatment_categories tc join public.categories c on c.id = tc.category_id
       where tc.version_id = p_version_id and c.status <> 'published'
    ) or exists (
      select 1 from public.treatment_concerns tc join public.concerns c on c.id = tc.concern_id
       where tc.version_id = p_version_id and c.status <> 'published'
    ) then
      v_problems := v_problems || 'Há categoria ou objetivo não publicado.';
    end if;
  elsif v_type = 'promotion' then
    select * into v_promo from public.promotion_details where version_id = p_version_id;
    if v_promo.starts_at is null or v_promo.ends_at is null then
      v_problems := v_problems || 'Promoção sem início e fim definidos.';
    elsif v_promo.ends_at <= now() then
      v_problems := v_problems || 'Promoção já encerrada.';
    end if;
    if v_promo.terms is null then
      v_problems := v_problems || 'Promoção sem condições completas.';
    end if;
  elsif v_type = 'landing' then
    select * into v_landing from public.landing_details where version_id = p_version_id;
    if v_landing.promotion_entry_id is not null and not exists (
      select 1 from public.content_entries e
       where e.id = v_landing.promotion_entry_id and e.type = 'promotion'
    ) then
      v_problems := v_problems || 'A campanha aponta para algo que não é promoção.';
    end if;
  elsif v_type = 'testimonial' then
    if nullif(btrim(v_version.data ->> 'authorization_note'), '') is null then
      v_problems := v_problems || 'Depoimento sem registro de autorização.';
    end if;
  elsif v_type = 'faq' then
    if nullif(btrim(v_version.data ->> 'answer'), '') is null then
      v_problems := v_problems || 'Pergunta sem resposta.';
    end if;
  elsif v_type = 'team_member' then
    if nullif(btrim(v_version.data ->> 'role'), '') is null then
      v_problems := v_problems || 'Profissional sem função informada.';
    end if;
  end if;

  return v_problems;
end;
$$;
revoke all on function private.cms_publish_problems(uuid) from public;
grant execute on function private.cms_publish_problems(uuid) to authenticated;

-- Publicar uma versão (troca o ponteiro em transação).
create or replace function public.cms_publish(p_entry_id uuid, p_version_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entry public.content_entries;
  v_problems text[];
begin
  perform private.cms_require_admin();

  select * into v_entry from public.content_entries where id = p_entry_id for update;
  if not found then
    raise exception 'conteúdo não encontrado' using errcode = 'PT404';
  end if;
  if v_entry.lifecycle_status = 'archived' then
    raise exception 'conteúdo arquivado não pode ser publicado' using errcode = 'PT422';
  end if;
  if not exists (select 1 from public.content_versions where id = p_version_id and entry_id = p_entry_id) then
    raise exception 'versão não pertence a este conteúdo' using errcode = 'PT422';
  end if;

  v_problems := private.cms_publish_problems(p_version_id);
  if cardinality(v_problems) > 0 then
    raise exception 'não é possível publicar'
      using errcode = 'PT422', detail = to_jsonb(v_problems)::text;
  end if;

  update public.content_entries
     set published_version_id = p_version_id,
         lifecycle_status = 'published',
         published_at = now(),
         first_published_at = coalesce(first_published_at, now())
   where id = p_entry_id;
end;
$$;

-- Despublicar (some do site; versões e ponteiro ficam para republicar).
create or replace function public.cms_unpublish(p_entry_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.cms_require_admin();
  if exists (
    select 1 from public.version_entry_refs r
      join public.content_entries e on e.published_version_id = r.version_id
     where r.target_entry_id = p_entry_id
       and e.lifecycle_status = 'published'
       and e.id <> p_entry_id
  ) then
    raise exception 'outros conteúdos publicados dependem deste'
      using errcode = 'PT422',
            detail = (select to_jsonb(array_agg(distinct e.id))::text
                        from public.version_entry_refs r
                        join public.content_entries e on e.published_version_id = r.version_id
                       where r.target_entry_id = p_entry_id and e.lifecycle_status = 'published'
                         and e.id <> p_entry_id);
  end if;
  update public.content_entries
     set lifecycle_status = 'unpublished'
   where id = p_entry_id and lifecycle_status = 'published';
  if not found then
    raise exception 'conteúdo não está publicado' using errcode = 'PT422';
  end if;
end;
$$;

-- Arquivar (preferido a excluir). Despublica antes, se preciso.
create or replace function public.cms_archive(p_entry_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status public.lifecycle_status;
begin
  perform private.cms_require_admin();
  select lifecycle_status into v_status from public.content_entries where id = p_entry_id for update;
  if not found then
    raise exception 'conteúdo não encontrado' using errcode = 'PT404';
  end if;
  if v_status = 'published' then
    perform public.cms_unpublish(p_entry_id);
  end if;
  update public.content_entries set lifecycle_status = 'archived' where id = p_entry_id;
end;
$$;

-- Tirar do arquivo (volta como rascunho/despublicado).
create or replace function public.cms_unarchive(p_entry_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.cms_require_admin();
  update public.content_entries
     set lifecycle_status = case when published_version_id is null then 'draft' else 'unpublished' end::public.lifecycle_status
   where id = p_entry_id and lifecycle_status = 'archived';
  if not found then
    raise exception 'conteúdo não está arquivado' using errcode = 'PT422';
  end if;
end;
$$;

-- Restaurar: cria revisão nova com o conteúdo de uma versão antiga.
create or replace function public.cms_restore_version(
  p_entry_id uuid,
  p_version_id uuid,
  p_base_revision integer
)
returns table (version_id uuid, revision integer)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_payload jsonb;
begin
  perform private.cms_require_admin();
  if not exists (select 1 from public.content_versions where id = p_version_id and entry_id = p_entry_id) then
    raise exception 'versão não pertence a este conteúdo' using errcode = 'PT422';
  end if;
  v_payload := private.cms_version_payload(p_version_id);
  return query select * from public.cms_save_version(p_entry_id, p_base_revision, v_payload);
end;
$$;

-- Duplicar: novo conteúdo em rascunho a partir da última revisão.
create or replace function public.cms_duplicate_entry(p_entry_id uuid, p_new_slug text)
returns table (entry_id uuid, version_id uuid, revision integer)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry public.content_entries;
  v_latest uuid;
  v_payload jsonb;
begin
  perform private.cms_require_admin();
  select * into v_entry from public.content_entries where id = p_entry_id;
  if not found then
    raise exception 'conteúdo não encontrado' using errcode = 'PT404';
  end if;
  if v_entry.type = 'home' then
    raise exception 'a Home não pode ser duplicada' using errcode = 'PT422';
  end if;
  select cv.id into v_latest from public.content_versions cv
   where cv.entry_id = p_entry_id order by cv.revision desc limit 1;
  v_payload := private.cms_version_payload(v_latest);
  v_payload := jsonb_set(v_payload, '{title}', to_jsonb(left((v_payload ->> 'title') || ' (cópia)', 200)));
  return query select * from public.cms_create_entry(v_entry.type, p_new_slug, v_payload);
end;
$$;

-- Trocar o slug. Se já foi publicado, cria 301 do caminho antigo e
-- reaponta redirecionamentos existentes (sem cadeias).
create or replace function public.cms_change_slug(p_entry_id uuid, p_new_slug text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entry public.content_entries;
  v_old_path text;
  v_new_path text;
begin
  perform private.cms_require_admin();
  select * into v_entry from public.content_entries where id = p_entry_id for update;
  if not found then
    raise exception 'conteúdo não encontrado' using errcode = 'PT404';
  end if;
  if v_entry.type = 'home' then
    raise exception 'a Home não tem slug editável' using errcode = 'PT422';
  end if;
  if v_entry.slug = p_new_slug then
    return;
  end if;

  update public.content_entries set slug = p_new_slug where id = p_entry_id;

  v_old_path := private.content_path(v_entry.type, v_entry.slug);
  v_new_path := private.content_path(v_entry.type, p_new_slug);
  if v_entry.first_published_at is not null and v_old_path is not null then
    -- Caminho novo deixa de ser origem de redirecionamento.
    delete from public.redirects where source_path = v_new_path;
    update public.redirects set target_path = v_new_path where target_path = v_old_path;
    insert into public.redirects (source_path, target_path, status_code)
    values (v_old_path, v_new_path, 301)
    on conflict (source_path) do update set target_path = excluded.target_path, status_code = 301;
  end if;
end;
$$;

-- Configurações públicas com detecção de conflito.
create or replace function public.cms_save_settings(p_base_revision integer, p_data jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_rev integer;
begin
  perform private.cms_require_admin();
  update public.site_settings_public
     set data = p_data, revision = revision + 1
   where id = 1 and revision = p_base_revision
  returning revision into v_rev;
  if not found then
    raise exception 'conflito: as configurações foram alteradas em outra aba'
      using errcode = 'PT409';
  end if;
  return v_rev;
end;
$$;

-- Só administradores executam as RPCs do CMS.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.cms_create_entry(public.content_type, text, jsonb)',
    'public.cms_save_version(uuid, integer, jsonb)',
    'public.cms_publish(uuid, uuid)',
    'public.cms_unpublish(uuid)',
    'public.cms_archive(uuid)',
    'public.cms_unarchive(uuid)',
    'public.cms_restore_version(uuid, uuid, integer)',
    'public.cms_duplicate_entry(uuid, text)',
    'public.cms_change_slug(uuid, text)',
    'public.cms_save_settings(integer, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- RPC de leitura para o painel: problemas que impedem publicar.
create or replace function public.cms_check_publish(p_version_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.cms_require_admin();
  return private.cms_publish_problems(p_version_id);
end;
$$;
revoke all on function public.cms_check_publish(uuid) from public, anon;
grant execute on function public.cms_check_publish(uuid) to authenticated;
