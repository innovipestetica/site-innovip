alter table public.redirects
  drop constraint redirects_target_path_check;

alter table public.redirects
  add constraint redirects_target_path_check check (
    char_length(target_path) <= 1000
    and (target_path ~ '^/[a-z0-9/-]*$' or target_path ~ '^https://[^[:space:]]+$')
  ),
  add column preview_title text check (char_length(preview_title) <= 120),
  add column preview_description text check (char_length(preview_description) <= 240),
  add column preview_site_name text check (char_length(preview_site_name) <= 80),
  add column preview_media_id uuid references public.media_assets(id) on delete set null;

insert into public.redirects (source_path, target_path, status_code)
values ('/grupovip', 'https://chat.whatsapp.com/CXMNBJBFNslFEdxLcroT4H?s=cl&p=i&mlu=4&ilr=4', 302)
on conflict (source_path) do nothing;

grant select (preview_title, preview_description, preview_site_name, preview_media_id)
  on public.redirects to anon;
