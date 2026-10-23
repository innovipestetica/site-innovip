-- Métrica própria do atalho /grupovip. Não grava IP, cookie ou identificador
-- pessoal; apenas a origem declarada pelo navegador e UTMs da campanha.
create table public.redirect_events (
  id bigint generated always as identity primary key,
  source_path text not null default '/grupovip'
    check (source_path = '/grupovip'),
  target_url text not null
    check (target_url = 'https://chat.whatsapp.com/CXMNBJBFNslFEdxLcroT4H?s=cl&p=i&mlu=4&ilr=4'),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 253),
  utm_source text check (utm_source is null or char_length(utm_source) <= 120),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 120),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 120),
  created_at timestamptz not null default now()
);

create index redirect_events_created_at_idx
  on public.redirect_events (created_at desc);

alter table public.redirect_events enable row level security;

-- A rota pública grava pelo cliente secreto do servidor. Visitantes não têm
-- acesso direto à tabela; o painel lê somente após autenticação de admin + MFA.
revoke all on public.redirect_events from public, anon, authenticated;
grant select, insert on public.redirect_events to service_role;
grant usage, select on sequence public.redirect_events_id_seq to service_role;
