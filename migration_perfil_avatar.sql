-- ============================================================================
-- F2B - Migración incremental: perfil de Backoffice con avatar
-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- ============================================================================

alter table public.usuarios
  add column if not exists avatar_url text;

create or replace function public.actualizar_perfil_backoffice(
  p_nombre_completo text,
  p_avatar_url text default null
)
returns public.usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.usuarios;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los usuarios de Backoffice pueden actualizar su perfil.' using errcode = '42501';
  end if;

  if p_nombre_completo is null or length(trim(p_nombre_completo)) = 0 then
    raise exception 'El nombre completo es obligatorio.' using errcode = '22023';
  end if;

  if length(trim(p_nombre_completo)) > 160 then
    raise exception 'El nombre completo no puede superar los 160 caracteres.' using errcode = '22023';
  end if;

  update public.usuarios
  set
    nombre_completo = trim(p_nombre_completo),
    avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url)
  where id = auth.uid()
  returning * into v_perfil;

  if not found then
    raise exception 'No se encontró el perfil del usuario.' using errcode = 'P0002';
  end if;

  return v_perfil;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

revoke all on function public.actualizar_perfil_backoffice(text, text) from public;
grant execute on function public.actualizar_perfil_backoffice(text, text) to authenticated;

notify pgrst, 'reload schema';
