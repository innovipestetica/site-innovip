-- =============================================================================
-- Innovip — Etapa 2: buckets de mídia
--
-- media-private: originais, variantes em rascunho e evidências de
--   autorização/licença. Só administradores (com MFA) leem e escrevem;
--   prévia por URL assinada de curta duração.
-- media-public: SOMENTE cópias aprovadas para o site. Bucket público expõe
--   arquivos por URL independentemente do CMS: nunca guardar nada
--   confidencial aqui. Sem política de SELECT para anon (não dá para listar).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-private', 'media-private', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']),
  ('media-public', 'media-public', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_private_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'media-private' and (select private.is_admin()))
  with check (bucket_id = 'media-private' and (select private.is_admin()));

create policy media_public_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'media-public' and (select private.is_admin()))
  with check (bucket_id = 'media-public' and (select private.is_admin()));
