alter table public.redirect_events
  add column utm_content text,
  add column utm_term text,
  add column device_type text,
  add column operating_system text,
  add column browser text,
  add column browser_language text,
  add column country_code text,
  add column region_code text,
  add column city text,
  add column timezone text,
  add column visitor_key text,
  add column is_returning boolean,
  add column source_detail text,
  add column clicked_page text;

alter table public.redirect_events
  add constraint redirect_events_utm_content_length check (char_length(utm_content) <= 120),
  add constraint redirect_events_utm_term_length check (char_length(utm_term) <= 120),
  add constraint redirect_events_device_type_values check (device_type in ('celular', 'tablet', 'computador', 'bot')),
  add constraint redirect_events_operating_system_length check (char_length(operating_system) <= 80),
  add constraint redirect_events_browser_length check (char_length(browser) <= 80),
  add constraint redirect_events_browser_language_length check (char_length(browser_language) <= 40),
  add constraint redirect_events_country_code_length check (char_length(country_code) <= 2),
  add constraint redirect_events_region_code_length check (char_length(region_code) <= 10),
  add constraint redirect_events_city_length check (char_length(city) <= 120),
  add constraint redirect_events_timezone_length check (char_length(timezone) <= 80),
  add constraint redirect_events_visitor_key_format check (visitor_key ~ '^[0-9a-f]{64}$'),
  add constraint redirect_events_source_detail_length check (char_length(source_detail) <= 120),
  add constraint redirect_events_clicked_page_length check (char_length(clicked_page) <= 500);

create index redirect_events_visitor_created_at_idx
  on public.redirect_events (visitor_key, created_at desc)
  where visitor_key is not null;

create index redirect_events_campaign_created_at_idx
  on public.redirect_events (utm_campaign, created_at desc)
  where utm_campaign is not null;
