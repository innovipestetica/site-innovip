alter table public.redirect_events
  drop constraint if exists redirect_events_source_path_check,
  drop constraint if exists redirect_events_target_url_check,
  drop constraint if exists redirect_events_target_url_length;

alter table public.redirect_events
  alter column source_path drop default,
  add constraint redirect_events_source_path_check
    check (source_path ~ '^/[a-z0-9/-]*$' and char_length(source_path) <= 200 and source_path <> '/'),
  add constraint redirect_events_target_url_length
    check (char_length(target_url) <= 2000);

create index if not exists redirect_events_source_created_at_idx
  on public.redirect_events (source_path, created_at desc);
