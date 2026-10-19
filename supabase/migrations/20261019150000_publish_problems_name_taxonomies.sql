-- =============================================================================
-- Innovip — a recusa de publicação por categoria/objetivo não publicado passa a
-- dizer QUAIS são (ex.: categoria arquivada que continuava marcada).
-- =============================================================================

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
  v_landing public.landing_details;
  v_names text;
begin
  select * into v_version from public.content_versions where id = p_version_id;
  select type into v_type from public.content_entries where id = v_version.entry_id;

  if exists (
    select 1 from public.version_entry_refs r
      join public.content_entries e on e.id = r.target_entry_id
     where r.version_id = p_version_id
       and (e.lifecycle_status <> 'published' or e.published_version_id is null)
  ) then
    v_problems := array_append(v_problems, 'Há referência a conteúdo que não está publicado.'::text);
  end if;

  if exists (
    select 1 from public.version_media_refs r
      join public.media_assets m on m.id = r.media_id
     where r.version_id = p_version_id and m.status <> 'published'
  ) then
    v_problems := array_append(v_problems, 'Há imagem ainda não aprovada para publicação.'::text);
  end if;

  if v_type = 'treatment' then
    select string_agg(n, ', ' order by n) into v_names from (
      select c.name || case when c.status = 'archived' then ' (arquivada)' else ' (rascunho)' end as n
        from public.treatment_categories tc join public.categories c on c.id = tc.category_id
       where tc.version_id = p_version_id and c.status <> 'published'
      union all
      select c.name || case when c.status = 'archived' then ' (arquivado)' else ' (rascunho)' end
        from public.treatment_concerns tc join public.concerns c on c.id = tc.concern_id
       where tc.version_id = p_version_id and c.status <> 'published'
    ) x;
    if v_names is not null then
      v_problems := array_append(v_problems,
        ('Há categoria ou objetivo não publicado marcado: ' || v_names || '. Desmarque ou publique em Categorias e objetivos.')::text);
    end if;
  elsif v_type = 'promotion' then
    select * into v_promo from public.promotion_details where version_id = p_version_id;
    if v_promo.starts_at is null or v_promo.ends_at is null then
      v_problems := array_append(v_problems, 'Promoção sem início e fim definidos.'::text);
    elsif v_promo.ends_at <= now() then
      v_problems := array_append(v_problems, 'Promoção já encerrada.'::text);
    end if;
    if v_promo.terms is null then
      v_problems := array_append(v_problems, 'Promoção sem condições completas.'::text);
    end if;
  elsif v_type = 'landing' then
    select * into v_landing from public.landing_details where version_id = p_version_id;
    if v_landing.promotion_entry_id is not null and not exists (
      select 1 from public.content_entries e
       where e.id = v_landing.promotion_entry_id and e.type = 'promotion'
    ) then
      v_problems := array_append(v_problems, 'A campanha aponta para algo que não é promoção.'::text);
    end if;
  elsif v_type = 'testimonial' then
    if nullif(btrim(v_version.data ->> 'authorization_note'), '') is null then
      v_problems := array_append(v_problems, 'Depoimento sem registro de autorização.'::text);
    end if;
  elsif v_type = 'faq' then
    if nullif(btrim(v_version.data ->> 'answer'), '') is null then
      v_problems := array_append(v_problems, 'Pergunta sem resposta.'::text);
    end if;
  elsif v_type = 'team_member' then
    if nullif(btrim(v_version.data ->> 'role'), '') is null then
      v_problems := array_append(v_problems, 'Profissional sem função informada.'::text);
    end if;
  end if;

  return v_problems;
end;
$$;
