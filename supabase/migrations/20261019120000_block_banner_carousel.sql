-- =============================================================================
-- Innovip — novo bloco "banner_carousel" (carrossel de banners)
-- Amplia a lista fechada de blocos aceitos pelo banco (schema_version 1:
-- só acrescenta um tipo; conteúdos existentes continuam válidos).
-- Precisa bater com src/lib/cms/blocks.ts (teste unitário confere).
-- =============================================================================

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
               'hero', 'banner_carousel', 'rich_text', 'image', 'cta', 'features', 'steps', 'notice',
               'faq_list', 'treatment_list', 'category_list', 'concern_list',
               'promotion_list', 'testimonial_list', 'team_list', 'gallery', 'contact'
             ]))
     );
$$;
