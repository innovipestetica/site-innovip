-- =============================================================================
-- Innovip — mais de um administrador
-- Decisão da clínica (18/10/2026): duas pessoas acessam o painel. Substitui o
-- singleton private.admin_account por private.admin_accounts (uma linha por
-- administrador). Cada um tem login e MFA próprios; a auditoria já registra
-- o autor de cada ação (actor_user_id).
--
-- Compatível com o app já publicado: o código só usa as funções
-- private.is_admin*/public.admin_session_status, que são recriadas aqui.
-- O vínculo existente é preservado (a tabela é alterada, não recriada).
-- =============================================================================


-- 1. Remove o singleton e passa a chave primária para user_id.
alter table private.admin_account drop constraint admin_account_singleton;
alter table private.admin_account drop constraint admin_account_pkey;
alter table private.admin_account drop column singleton;
alter table private.admin_account drop constraint admin_account_user_id_key;
alter table private.admin_account add constraint admin_accounts_pkey primary key (user_id);
alter table private.admin_account rename to admin_accounts;

comment on table private.admin_accounts is
  'Administradores autorizados do painel (um por linha, no máximo 5). Alterar só por operação administrativa segura.';

-- Grants continuam vazios para todos os papéis da aplicação.
revoke all on private.admin_accounts from public, anon, authenticated, service_role;

-- 2. Teto de segurança: no máximo 5 administradores.
create or replace function private.enforce_admin_accounts_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from private.admin_accounts) >= 5 then
    raise exception 'limite de administradores atingido (5)' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_admin_accounts_limit() from public, anon, authenticated, service_role;

create trigger admin_accounts_limit
  before insert on private.admin_accounts
  for each row execute function private.enforce_admin_accounts_limit();

-- 3. Funções de autorização apontando para a nova tabela.
create or replace function private.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_accounts a
    where a.user_id = (select auth.uid())
  );
$$;

-- is_admin() e admin_session_status() chamam is_admin_user(): não mudam.

