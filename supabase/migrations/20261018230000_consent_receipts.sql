-- =============================================================================
-- Innovip — Etapa 5: registro de consentimento e limite de requisições
--
-- consent_receipts: prova das escolhas de cookies (LGPD), SEM dados pessoais:
-- identificador pseudônimo aleatório (do cookie de consentimento), categorias,
-- versão do aviso, caminho de origem (sem query) e data.
-- rate_limits: contador persistente (não depende da memória da função
-- serverless). A chave é um HMAC diário calculado no servidor — o IP nunca
-- é gravado.
-- Só o servidor (service_role) grava, via public.record_consent.
-- =============================================================================

create table private.consent_receipts (
  id bigint generated always as identity primary key,
  subject_id uuid not null,
  version text not null check (char_length(version) between 1 and 20),
  analytics boolean not null,
  marketing boolean not null,
  origin_path text not null
    check (origin_path ~ '^/[a-z0-9/_-]*$' and char_length(origin_path) <= 200),
  created_at timestamptz not null default now()
);

create index consent_receipts_subject_idx on private.consent_receipts (subject_id, created_at desc);
create index consent_receipts_created_idx on private.consent_receipts (created_at);

alter table private.consent_receipts enable row level security;
revoke all on private.consent_receipts from public, anon, authenticated, service_role;

create table private.rate_limits (
  bucket text not null check (bucket ~ '^[a-z_]+:[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket, window_start)
);

create index rate_limits_window_idx on private.rate_limits (window_start);

alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated, service_role;

-- Conta uma tentativa na janela atual; true = dentro do limite.
create or replace function private.rate_limit_hit(p_bucket text, p_window interval, p_max integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));

  insert into private.rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;

  -- Limpeza barata de janelas antigas.
  delete from private.rate_limits where window_start < now() - interval '1 day';

  return v_hits <= p_max;
end;
$$;

revoke all on function private.rate_limit_hit(text, interval, integer) from public, anon, authenticated, service_role;

-- Grava o recibo (chamado só pelo servidor, após validar a requisição).
-- Retorna false quando o limite de requisições foi atingido.
create or replace function public.record_consent(
  p_subject uuid,
  p_version text,
  p_analytics boolean,
  p_marketing boolean,
  p_path text,
  p_rate_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.rate_limit_hit('consent:' || p_rate_key, interval '10 minutes', 20) then
    return false;
  end if;
  insert into private.consent_receipts (subject_id, version, analytics, marketing, origin_path)
  values (p_subject, p_version, p_analytics, p_marketing, p_path);
  return true;
end;
$$;

revoke all on function public.record_consent(uuid, text, boolean, boolean, text, text) from public, anon, authenticated;
grant execute on function public.record_consent(uuid, text, boolean, boolean, text, text) to service_role;

-- Retenção: apaga recibos mais antigos que o prazo definido pela clínica.
-- (Sem agendador no plano atual: rodar periodicamente; ver docs.)
create or replace function private.purge_consent_receipts(p_older_than interval default interval '5 years')
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with deleted as (
    delete from private.consent_receipts where created_at < now() - p_older_than returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function private.purge_consent_receipts(interval) from public, anon, authenticated, service_role;
