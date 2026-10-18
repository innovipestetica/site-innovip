-- =============================================================================
-- Innovip — Etapa 1: fundação de segurança
-- - Grants mínimos por padrão no schema public
-- - Schema "private" (não exposto pela API) para dados operacionais
-- - admin_account singleton (no máximo um administrador)
-- - Funções de autorização (is_admin exige MFA/aal2)
-- - audit_logs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Grants mínimos por padrão
-- O Supabase concede tudo a anon/authenticated em objetos novos do public.
-- A partir daqui, cada tabela/função precisa de GRANT explícito.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Schema privado
-- Não está na lista de schemas expostos do PostgREST. "usage" para
-- authenticated serve só para as funções usadas em políticas RLS; nenhuma
-- tabela daqui recebe grant para anon/authenticated.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Administrador único
-- PK constante (singleton = 1) com CHECK: no máximo uma linha.
-- Nenhum papel da aplicação (anon, authenticated, service_role) pode ler ou
-- alterar. Provisionamento só pelo dono do banco (ver docs/admin-provisionamento.md).
-- -----------------------------------------------------------------------------
create table private.admin_account (
  singleton smallint primary key default 1
    constraint admin_account_singleton check (singleton = 1),
  user_id uuid not null unique
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.admin_account is
  'Único administrador autorizado (singleton). Alterar só por operação administrativa segura.';

alter table private.admin_account enable row level security;
revoke all on private.admin_account from public, anon, authenticated, service_role;
-- Sem políticas e sem grants: só o dono da tabela (postgres) opera nela.
-- Sem FORCE RLS de propósito: as funções SECURITY DEFINER abaixo rodam como
-- dono e precisam ler a tabela.

-- -----------------------------------------------------------------------------
-- 4. Funções de autorização
-- SECURITY DEFINER para ler admin_account sem expor a tabela.
-- search_path vazio + nomes qualificados evitam sequestro de objetos.
-- -----------------------------------------------------------------------------

-- O usuário da requisição é o administrador cadastrado? (sem checar MFA)
create or replace function private.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_account a
    where a.user_id = (select auth.uid())
  );
$$;

-- Administrador autorizado COM MFA (aal2). Use esta nas políticas RLS.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
     and private.is_admin_user();
$$;

revoke all on function private.is_admin_user() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin_user() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

-- RPC usada pelo servidor Next.js para decidir o fluxo do painel.
-- Retorna apenas um estado, nunca dados da tabela.
create or replace function public.admin_session_status()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when not private.is_admin_user() then 'not_admin'
    when coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then 'mfa_required'
    else 'ok'
  end;
$$;

revoke all on function public.admin_session_status() from public, anon;
grant execute on function public.admin_session_status() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Auditoria
-- Registra autor, ação e recurso. Nunca conteúdo integral de leads ou segredos.
-- -----------------------------------------------------------------------------
create table private.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null
    constraint audit_logs_action_format
    check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and char_length(action) <= 100),
  resource_type text
    constraint audit_logs_resource_type_len check (char_length(resource_type) <= 60),
  resource_id text
    constraint audit_logs_resource_id_len check (char_length(resource_id) <= 200),
  request_id text
    constraint audit_logs_request_id_len check (char_length(request_id) <= 100),
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on private.audit_logs (created_at desc);
create index audit_logs_actor_idx on private.audit_logs (actor_user_id, created_at desc);

alter table private.audit_logs enable row level security;
revoke all on private.audit_logs from public, anon, authenticated, service_role;

-- Gravação interna (usada por triggers e RPCs das próximas etapas).
create or replace function private.write_audit_log(
  p_action text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_request_id text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.audit_logs (actor_user_id, action, resource_type, resource_id, request_id)
  values ((select auth.uid()), p_action, p_resource_type, p_resource_id, p_request_id);
$$;

revoke all on function private.write_audit_log(text, text, text, text) from public, anon, authenticated;
grant execute on function private.write_audit_log(text, text, text, text) to service_role;

-- RPC para eventos de autenticação do painel (lista fechada de ações).
-- Exige ser o administrador cadastrado; aal1 é aceito porque a inscrição do
-- MFA acontece antes de existir aal2.
create or replace function public.log_admin_auth_event(p_action text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action not in (
    'auth.sign_in',
    'auth.mfa_enrolled',
    'auth.mfa_verified',
    'auth.password_changed',
    'auth.sign_out'
  ) then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  perform private.write_audit_log(p_action, 'auth', null, null);
end;
$$;

revoke all on function public.log_admin_auth_event(text) from public, anon;
grant execute on function public.log_admin_auth_event(text) to authenticated;
