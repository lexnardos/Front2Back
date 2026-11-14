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
      'updated_at', v_caso.updated_at
    ),
    'historial', v_historial
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.casos_escalamiento enable row level security;
alter table public.historial_movimientos enable row level security;
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

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on public.secuencias_radicado from anon, authenticated;

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

revoke all on function public.asignar_numero_radicado() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';
