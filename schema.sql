-- ============================================================================
-- F2B - Front2Back
-- Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecutar completo en el SQL Editor de Supabase o como migración.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.rol_usuario as enum ('backoffice', 'agente');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_notificacion as enum ('caso_radicado', 'caso_actualizado');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.estado_caso as enum ('Pendiente', 'En Proceso', 'Completado', 'Rechazado');
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo varchar(160) not null,
  correo varchar(255) not null unique,
  rol public.rol_usuario not null default 'agente',
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint usuarios_nombre_no_vacio check (length(trim(nombre_completo)) > 0),
  constraint usuarios_correo_no_vacio check (length(trim(correo)) > 0)
);

create table if not exists public.secuencias_radicado (
  anio integer primary key,
  ultimo_consecutivo integer not null default 0,
  constraint secuencias_consecutivo_positivo check (ultimo_consecutivo >= 0)
);

create table if not exists public.casos_escalamiento (
  id uuid primary key default gen_random_uuid(),
  numero_radicado varchar(20) not null unique,
  tipologia varchar(120) not null,
  datos_plantilla jsonb not null default '{}'::jsonb,
  estado public.estado_caso not null default 'Pendiente',
  paso_actual varchar(120) not null default 'Radicado',
  creado_por varchar(160) not null,
  creado_por_id uuid references public.usuarios(id) on delete set null default auth.uid(),
  asignado_a uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sla_deadline timestamptz default (now() + interval '72 hours'),
  primera_respuesta_at timestamptz,
  constraint casos_tipologia_no_vacia check (length(trim(tipologia)) > 0),
  constraint casos_paso_no_vacio check (length(trim(paso_actual)) > 0),
  constraint casos_datos_objeto check (jsonb_typeof(datos_plantilla) = 'object')
);

create table if not exists public.historial_movimientos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos_escalamiento(id) on delete cascade,
  estado_anterior public.estado_caso,
  estado_nuevo public.estado_caso not null,
  paso_registrado varchar(120) not null,
  comentario text,
  usuario_id uuid references public.usuarios(id) on delete set null,
  fecha_movimiento timestamptz not null default now(),
  constraint historial_paso_no_vacio check (length(trim(paso_registrado)) > 0)
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  caso_id uuid not null references public.casos_escalamiento(id) on delete cascade,
  numero_radicado varchar(20) not null,
  tipo public.tipo_notificacion not null,
  titulo varchar(160) not null,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_casos_numero_radicado_upper
  on public.casos_escalamiento (upper(numero_radicado));
create index if not exists idx_casos_estado
  on public.casos_escalamiento (estado);
create index if not exists idx_casos_created_at
  on public.casos_escalamiento (created_at desc);
create index if not exists idx_casos_asignado_a
  on public.casos_escalamiento (asignado_a);
create index if not exists idx_casos_creado_por_id
  on public.casos_escalamiento (creado_por_id);
create index if not exists idx_casos_datos_plantilla
  on public.casos_escalamiento using gin (datos_plantilla);
create index if not exists idx_historial_caso_fecha
  on public.historial_movimientos (caso_id, fecha_movimiento asc);
create index if not exists idx_historial_usuario
  on public.historial_movimientos (usuario_id);
create index if not exists notificaciones_usuario_created_idx
  on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_usuario_leida_idx
  on public.notificaciones (usuario_id, leida);

-- ----------------------------------------------------------------------------
-- Funciones de apoyo
-- ----------------------------------------------------------------------------
create or replace function public.es_backoffice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.rol = 'backoffice' from public.usuarios u where u.id = auth.uid()),
    false
  );
$$;

create or replace function public.puede_ver_caso(p_caso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.casos_escalamiento c
    where c.id = p_caso_id
      and (
        c.creado_por_id = auth.uid()
        or c.asignado_a = auth.uid()
        or public.es_backoffice()
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- Generación consecutiva del radicado: ESC-AAAA-0001
-- ----------------------------------------------------------------------------
create or replace function public.asignar_numero_radicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio integer := extract(year from timezone('America/Bogota', now()))::integer;
  v_consecutivo integer;
begin
  if new.numero_radicado is not null and length(trim(new.numero_radicado)) > 0 then
    return new;
  end if;

  insert into public.secuencias_radicado (anio, ultimo_consecutivo)
  values (v_anio, 1)
  on conflict (anio) do update
    set ultimo_consecutivo = public.secuencias_radicado.ultimo_consecutivo + 1
  returning ultimo_consecutivo into v_consecutivo;

  new.numero_radicado := format('ESC-%s-%s', v_anio, lpad(v_consecutivo::text, 4, '0'));
  return new;
end;
$$;

drop trigger if exists trg_casos_numero_radicado on public.casos_escalamiento;
create trigger trg_casos_numero_radicado
  before insert on public.casos_escalamiento
  for each row
  execute function public.asignar_numero_radicado();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_casos_updated_at on public.casos_escalamiento;
create trigger trg_casos_updated_at
  before update on public.casos_escalamiento
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- SLA: límite de 72 horas y primera respuesta del Backoffice
-- ----------------------------------------------------------------------------
create or replace function public.set_sla_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sla_deadline := new.created_at + interval '72 hours';
  return new;
end;
$$;

drop trigger if exists trg_casos_sla_deadline on public.casos_escalamiento;
create trigger trg_casos_sla_deadline
  before insert on public.casos_escalamiento
  for each row
  execute function public.set_sla_deadline();

create or replace function public.registrar_primera_respuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_nuevo <> 'Pendiente' then
    update public.casos_escalamiento
    set primera_respuesta_at = coalesce(primera_respuesta_at, new.fecha_movimiento)
    where id = new.caso_id
      and primera_respuesta_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_historial_primera_respuesta on public.historial_movimientos;
create trigger trg_historial_primera_respuesta
  after insert on public.historial_movimientos
  for each row
  execute function public.registrar_primera_respuesta();

-- ----------------------------------------------------------------------------
-- Creación automática del perfil al crear un usuario en Supabase Auth
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre_completo, correo, rol)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'agente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RPC: crear un escalamiento y registrar el movimiento inicial
-- ----------------------------------------------------------------------------
create or replace function public.crear_caso_escalamiento(
  p_tipologia text,
  p_datos_plantilla jsonb,
  p_paso_actual text default 'Radicado'
)
returns public.casos_escalamiento
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_nombre text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un escalamiento.' using errcode = '42501';
  end if;

  if p_tipologia is null or length(trim(p_tipologia)) = 0 then
    raise exception 'La tipología es obligatoria.' using errcode = '22023';
  end if;

  if p_datos_plantilla is null or jsonb_typeof(p_datos_plantilla) <> 'object' then
    raise exception 'Los datos de la plantilla deben ser un objeto JSON.' using errcode = '22023';
  end if;

  select u.nombre_completo
  into v_nombre
  from public.usuarios u
  where u.id = auth.uid();

  if v_nombre is null then
    raise exception 'Tu usuario no tiene perfil en F2B. Contacta al administrador.' using errcode = '42501';
  end if;

  insert into public.casos_escalamiento (
    tipologia,
    datos_plantilla,
    estado,
    paso_actual,
    creado_por,
    creado_por_id
  )
  values (
    trim(p_tipologia),
    p_datos_plantilla,
    'Pendiente',
    coalesce(nullif(trim(p_paso_actual), ''), 'Radicado'),
    v_nombre,
    auth.uid()
  )
  returning * into v_caso;

  insert into public.historial_movimientos (
    caso_id,
    estado_anterior,
    estado_nuevo,
    paso_registrado,
    comentario,
    usuario_id
  )
  values (
    v_caso.id,
    null,
    'Pendiente',
    v_caso.paso_actual,
    'Escalamiento creado desde Frontoffice.',
    auth.uid()
  );

  return v_caso;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: actualizar un caso desde Backoffice y registrar el movimiento
-- ----------------------------------------------------------------------------
create or replace function public.actualizar_caso_escalamiento(
  p_caso_id uuid,
  p_estado public.estado_caso,
  p_paso_actual text,
  p_comentario text default null,
  p_asignado_a uuid default null
)
returns public.casos_escalamiento
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_estado_anterior public.estado_caso;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los usuarios de Backoffice pueden gestionar casos.' using errcode = '42501';
  end if;

  if p_estado is null then
    raise exception 'El estado es obligatorio.' using errcode = '22023';
  end if;

  if p_asignado_a is not null and not exists (
    select 1
    from public.usuarios u
    where u.id = p_asignado_a
      and u.rol = 'backoffice'
  ) then
    raise exception 'El usuario asignado debe tener rol Backoffice.' using errcode = '22023';
  end if;

  select *
  into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  v_estado_anterior := v_caso.estado;

  update public.casos_escalamiento
  set
    estado = p_estado,
    paso_actual = coalesce(nullif(trim(p_paso_actual), ''), v_caso.paso_actual),
    asignado_a = p_asignado_a,
    updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos (
    caso_id,
    estado_anterior,
    estado_nuevo,
    paso_registrado,
    comentario,
    usuario_id
  )
  values (
    v_caso.id,
    v_estado_anterior,
    p_estado,
    v_caso.paso_actual,
    nullif(trim(p_comentario), ''),
    auth.uid()
  );

  return v_caso;
end;
$$;

-- ----------------------------------------------------------------------------
-- Notificaciones: eventos de radicación y respuesta del Backoffice
-- ----------------------------------------------------------------------------
create or replace function public.notificar_evento_caso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_destino uuid;
  v_titulo text;
  v_mensaje text;
begin
  if tg_op = 'INSERT' then
    if new.creado_por_id is not null then
      insert into public.notificaciones (
        usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje
      )
      values (
        new.creado_por_id,
        new.id,
        new.numero_radicado,
        'caso_radicado',
        'Escalamiento enviado',
        format(
          'Tu solicitud %s fue escalada al Backoffice. Tiempo estimado de respuesta: 24 a 72 horas hábiles.',
          new.numero_radicado
        )
      );
    end if;

    for v_destino in
      select u.id
      from public.usuarios u
      where u.rol = 'backoffice'
        and u.id <> v_actor
    loop
      insert into public.notificaciones (
        usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje
      )
      values (
        v_destino,
        new.id,
        new.numero_radicado,
        'caso_radicado',
        'Nuevo caso en la bandeja',
        format('%s · %s fue radicado y está pendiente de revisión.', new.numero_radicado, new.tipologia)
      );
    end loop;

    return new;
  end if;

  if old.estado = new.estado
    and old.paso_actual = new.paso_actual
    and old.asignado_a is not distinct from new.asignado_a then
    return new;
  end if;

  v_titulo := 'Respuesta del Backoffice';
  v_mensaje := format(
    'El caso %s cambió a "%s" (%s).',
    new.numero_radicado,
    new.estado,
    new.paso_actual
  );

  if new.creado_por_id is not null and new.creado_por_id <> v_actor then
    insert into public.notificaciones (
      usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje
    )
    values (
      new.creado_por_id, new.id, new.numero_radicado,
      'caso_actualizado', v_titulo, v_mensaje
    );
  end if;

  if new.asignado_a is not null
    and new.asignado_a <> v_actor
    and new.asignado_a is distinct from new.creado_por_id then
    insert into public.notificaciones (
      usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje
    )
    values (
      new.asignado_a, new.id, new.numero_radicado,
      'caso_actualizado', v_titulo, v_mensaje
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_casos_notificar on public.casos_escalamiento;
create trigger trg_casos_notificar
  after insert or update on public.casos_escalamiento
  for each row
  execute function public.notificar_evento_caso();

-- ----------------------------------------------------------------------------
-- RPC: consulta pública por radicado
-- Devuelve estado, historial y observaciones, sin exponer datos sensibles
-- de la plantilla ni correos de usuarios.
-- ----------------------------------------------------------------------------
create or replace function public.consultar_radicado(p_radicado text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_historial jsonb;
begin
  if p_radicado is null or length(trim(p_radicado)) = 0 then
    return null;
  end if;

  select *
  into v_caso
  from public.casos_escalamiento
  where upper(numero_radicado) = upper(trim(p_radicado))
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'estado_anterior', h.estado_anterior,
        'estado_nuevo', h.estado_nuevo,
        'paso_registrado', h.paso_registrado,
        'comentario', h.comentario,
        'fecha_movimiento', h.fecha_movimiento,
        'usuario', coalesce(u.nombre_completo, 'Sistema')
      )
      order by h.fecha_movimiento asc
    ),
    '[]'::jsonb
  )
  into v_historial
  from public.historial_movimientos h
  left join public.usuarios u on u.id = h.usuario_id
  where h.caso_id = v_caso.id;

  return jsonb_build_object(
    'caso', jsonb_build_object(
      'id', v_caso.id,
      'numero_radicado', v_caso.numero_radicado,
      'tipologia', v_caso.tipologia,
      'estado', v_caso.estado,
      'paso_actual', v_caso.paso_actual,
      'creado_por', v_caso.creado_por,
      'created_at', v_caso.created_at,
      'updated_at', v_caso.updated_at,
      'sla_deadline', v_caso.sla_deadline,
      'primera_respuesta_at', v_caso.primera_respuesta_at
    ),
    'historial', v_historial
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: actualizar el perfil del usuario de Backoffice (nombre y avatar)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Storage: avatares de perfil (bucket público, máximo 2 MB)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.casos_escalamiento enable row level security;
alter table public.historial_movimientos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.secuencias_radicado enable row level security;

drop policy if exists "usuarios_select_propio_o_backoffice" on public.usuarios;
create policy "usuarios_select_propio_o_backoffice"
  on public.usuarios
  for select
  to authenticated
  using (id = auth.uid() or public.es_backoffice());

drop policy if exists "casos_select_autorizado" on public.casos_escalamiento;
create policy "casos_select_autorizado"
  on public.casos_escalamiento
  for select
  to authenticated
  using (
    creado_por_id = auth.uid()
    or asignado_a = auth.uid()
    or public.es_backoffice()
  );

drop policy if exists "casos_insert_autenticado" on public.casos_escalamiento;
create policy "casos_insert_autenticado"
  on public.casos_escalamiento
  for insert
  to authenticated
  with check (auth.uid() is not null and creado_por_id = auth.uid());

drop policy if exists "casos_update_backoffice" on public.casos_escalamiento;
create policy "casos_update_backoffice"
  on public.casos_escalamiento
  for update
  to authenticated
  using (public.es_backoffice())
  with check (public.es_backoffice());

drop policy if exists "historial_select_autorizado" on public.historial_movimientos;
create policy "historial_select_autorizado"
  on public.historial_movimientos
  for select
  to authenticated
  using (public.puede_ver_caso(caso_id));

drop policy if exists "historial_insert_propio" on public.historial_movimientos;
create policy "historial_insert_propio"
  on public.historial_movimientos
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and public.puede_ver_caso(caso_id)
  );

drop policy if exists "notificaciones_select_propias" on public.notificaciones;
create policy "notificaciones_select_propias"
  on public.notificaciones
  for select
  to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "notificaciones_update_propias" on public.notificaciones;
create policy "notificaciones_update_propias"
  on public.notificaciones
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on public.secuencias_radicado from anon, authenticated;
grant select, update on public.notificaciones to authenticated;

revoke all on function public.es_backoffice() from public;
grant execute on function public.es_backoffice() to authenticated;

revoke all on function public.puede_ver_caso(uuid) from public;
grant execute on function public.puede_ver_caso(uuid) to authenticated;

revoke all on function public.crear_caso_escalamiento(text, jsonb, text) from public;
grant execute on function public.crear_caso_escalamiento(text, jsonb, text) to authenticated;

revoke all on function public.actualizar_caso_escalamiento(uuid, public.estado_caso, text, text, uuid) from public;
grant execute on function public.actualizar_caso_escalamiento(uuid, public.estado_caso, text, text, uuid) to authenticated;

revoke all on function public.consultar_radicado(text) from public;
grant execute on function public.consultar_radicado(text) to anon, authenticated;

revoke all on function public.actualizar_perfil_backoffice(text, text) from public;
grant execute on function public.actualizar_perfil_backoffice(text, text) to authenticated;

revoke all on function public.asignar_numero_radicado() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_sla_deadline() from public, anon, authenticated;
revoke all on function public.registrar_primera_respuesta() from public, anon, authenticated;
revoke all on function public.notificar_evento_caso() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notificaciones'
    ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

notify pgrst, 'reload schema';
