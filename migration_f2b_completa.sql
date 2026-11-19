-- ============================================================================
-- F2B · Migración consolidada (FASE 0 - FASE 5)
-- Ejecutar COMPLETA en el SQL Editor de Supabase.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Tipos
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.rol_usuario as enum ('backoffice', 'agente');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.estado_caso as enum ('Pendiente', 'En Proceso', 'Completado', 'Rechazado');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_notificacion as enum (
    'caso_radicado', 'caso_actualizado', 'caso_devuelto', 'subsanacion_reenviada'
  );
exception when duplicate_object then null;
end $$;

alter type public.estado_caso add value if not exists 'Devuelto';
alter type public.tipo_notificacion add value if not exists 'caso_devuelto';
alter type public.tipo_notificacion add value if not exists 'subsanacion_reenviada';

-- ----------------------------------------------------------------------------
-- 2. Tablas base (crear si no existen)
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
-- 3. Columnas nuevas (SLA, devolución y cierre)
-- ----------------------------------------------------------------------------
alter table public.casos_escalamiento
  add column if not exists sla_deadline timestamptz,
  add column if not exists primera_respuesta_at timestamptz,
  add column if not exists causal_devolucion text,
  add column if not exists observacion_devolucion text,
  add column if not exists sla_pausado_desde timestamptz,
  add column if not exists sla_pausado_acumulado interval not null default interval '0',
  add column if not exists cerrado_en timestamptz;

alter table public.casos_escalamiento
  alter column sla_deadline set default (now() + interval '72 hours');

update public.casos_escalamiento
set sla_deadline = coalesce(sla_deadline, created_at + interval '72 hours')
where sla_deadline is null;

-- ----------------------------------------------------------------------------
-- 4. Notificaciones y auditoría
-- ----------------------------------------------------------------------------
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

create table if not exists public.ticket_historial (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos_escalamiento(id) on delete cascade,
  fecha_evento timestamptz not null default now(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nombre text not null default 'Sistema',
  rol text not null default 'sistema',
  accion text not null,
  estado_anterior public.estado_caso,
  estado_nuevo public.estado_caso,
  paso_registrado text,
  observaciones text,
  duracion_ms bigint,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_casos_numero_radicado_upper
  on public.casos_escalamiento (upper(numero_radicado));
create index if not exists idx_casos_estado on public.casos_escalamiento (estado);
create index if not exists idx_casos_created_at on public.casos_escalamiento (created_at desc);
create index if not exists idx_casos_asignado_a on public.casos_escalamiento (asignado_a);
create index if not exists idx_casos_creado_por_id on public.casos_escalamiento (creado_por_id);
create index if not exists idx_casos_datos_plantilla on public.casos_escalamiento using gin (datos_plantilla);
create index if not exists idx_historial_caso_fecha
  on public.historial_movimientos (caso_id, fecha_movimiento asc);
create index if not exists idx_historial_usuario on public.historial_movimientos (usuario_id);
create index if not exists idx_ticket_historial_caso_fecha
  on public.ticket_historial (caso_id, fecha_evento asc);
create index if not exists notificaciones_usuario_created_idx
  on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_usuario_leida_idx
  on public.notificaciones (usuario_id, leida);

-- ----------------------------------------------------------------------------
-- 5. Funciones de apoyo
-- ----------------------------------------------------------------------------
create or replace function public.es_backoffice()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select u.rol = 'backoffice' from public.usuarios u where u.id = auth.uid()),
    false
  );
$$;

create or replace function public.puede_ver_caso(p_caso_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.casos_escalamiento c
    where c.id = p_caso_id
      and (c.creado_por_id = auth.uid() or c.asignado_a = auth.uid() or public.es_backoffice())
  );
$$;

create or replace function public.puede_gestionar_radicado(p_radicado text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.casos_escalamiento c
    where upper(c.numero_radicado) = upper(trim(p_radicado))
      and (c.creado_por_id = auth.uid() or public.es_backoffice())
  );
$$;

create or replace function public.asignar_numero_radicado()
returns trigger language plpgsql security definer set search_path = public
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
create trigger trg_casos_numero_radicado before insert on public.casos_escalamiento
for each row execute function public.asignar_numero_radicado();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_casos_updated_at on public.casos_escalamiento;
create trigger trg_casos_updated_at before update on public.casos_escalamiento
for each row execute function public.set_updated_at();

create or replace function public.set_sla_deadline()
returns trigger language plpgsql set search_path = public as $$
begin
  new.sla_deadline := new.created_at + interval '72 hours';
  return new;
end;
$$;

drop trigger if exists trg_casos_sla_deadline on public.casos_escalamiento;
create trigger trg_casos_sla_deadline before insert on public.casos_escalamiento
for each row execute function public.set_sla_deadline();

create or replace function public.registrar_primera_respuesta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado_nuevo <> 'Pendiente' then
    update public.casos_escalamiento
    set primera_respuesta_at = coalesce(primera_respuesta_at, new.fecha_movimiento)
    where id = new.caso_id and primera_respuesta_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_historial_primera_respuesta on public.historial_movimientos;
create trigger trg_historial_primera_respuesta after insert on public.historial_movimientos
for each row execute function public.registrar_primera_respuesta();

-- Auditoría inmutable: cada movimiento se copia automáticamente a ticket_historial
create or replace function public.registrar_ticket_historial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_usuario text;
  v_rol text;
  v_accion text;
  v_duracion bigint;
begin
  select coalesce(u.nombre_completo, 'Sistema'), coalesce(u.rol::text, 'sistema')
  into v_usuario, v_rol
  from public.usuarios u where u.id = new.usuario_id;

  v_usuario := coalesce(v_usuario, 'Sistema');
  v_rol := coalesce(v_rol, 'sistema');

  v_accion := case
    when new.estado_anterior is null then 'Creación del caso'
    when new.estado_nuevo = 'Devuelto' then 'Devolución con causal'
    when new.estado_anterior = 'Devuelto' and new.estado_nuevo = 'Pendiente' then 'Subsanación reenviada'
    when new.estado_nuevo in ('Completado', 'Rechazado') then 'Resolución / cierre'
    when new.estado_nuevo = 'En Proceso' and new.estado_anterior = 'Pendiente' then 'Toma de gestión'
    else 'Actualización de gestión'
  end;

  select (extract(epoch from (new.fecha_movimiento - c.created_at)) * 1000)::bigint
  into v_duracion
  from public.casos_escalamiento c where c.id = new.caso_id;

  insert into public.ticket_historial (
    caso_id, fecha_evento, usuario_id, usuario_nombre, rol, accion,
    estado_anterior, estado_nuevo, paso_registrado, observaciones, duracion_ms, metadata
  )
  values (
    new.caso_id, new.fecha_movimiento, new.usuario_id, v_usuario, v_rol, v_accion,
    new.estado_anterior, new.estado_nuevo, new.paso_registrado, new.comentario, v_duracion,
    jsonb_build_object('origen', 'historial_movimientos', 'historial_id', new.id)
  );

  if new.estado_nuevo in ('Completado', 'Rechazado') then
    update public.casos_escalamiento
    set cerrado_en = coalesce(cerrado_en, new.fecha_movimiento)
    where id = new.caso_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_historial_auditoria on public.historial_movimientos;
create trigger trg_historial_auditoria after insert on public.historial_movimientos
for each row execute function public.registrar_ticket_historial();

-- ----------------------------------------------------------------------------
-- 6. Notificaciones automáticas (incluye devolución roja y reenvío)
-- ----------------------------------------------------------------------------
create or replace function public.notificar_evento_caso()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_destino uuid;
  v_titulo text;
  v_mensaje text;
begin
  if tg_op = 'INSERT' then
    if new.creado_por_id is not null then
      insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
      values (
        new.creado_por_id, new.id, new.numero_radicado, 'caso_radicado',
        'Escalamiento enviado',
        format('Tu solicitud %s fue escalada al Backoffice. Tiempo estimado de respuesta: 24 a 72 horas hábiles.', new.numero_radicado)
      );
    end if;
    for v_destino in
      select u.id from public.usuarios u where u.rol = 'backoffice' and u.id <> v_actor
    loop
      insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
      values (
        v_destino, new.id, new.numero_radicado, 'caso_radicado', 'Nuevo caso en la bandeja',
        format('%s · %s fue radicado y está pendiente de revisión.', new.numero_radicado, new.tipologia)
      );
    end loop;
    return new;
  end if;

  if old.estado = new.estado
    and old.paso_actual = new.paso_actual
    and old.asignado_a is not distinct from new.asignado_a
    and old.causal_devolucion is not distinct from new.causal_devolucion then
    return new;
  end if;

  if new.estado = 'Devuelto' and old.estado is distinct from 'Devuelto' then
    if new.creado_por_id is not null then
      insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
      values (
        new.creado_por_id, new.id, new.numero_radicado, 'caso_devuelto',
        'Caso devuelto: requiere corrección',
        format('El caso %s fue devuelto. Causal: %s. Observación: %s',
          new.numero_radicado,
          coalesce(new.causal_devolucion, 'No indicada'),
          coalesce(new.observacion_devolucion, 'Sin observación'))
      );
    end if;
    return new;
  end if;

  if old.estado = 'Devuelto' and new.estado is distinct from 'Devuelto' then
    for v_destino in select u.id from public.usuarios u where u.rol = 'backoffice'
    loop
      insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
      values (
        v_destino, new.id, new.numero_radicado, 'subsanacion_reenviada',
        'Subsanación recibida',
        format('El caso %s fue corregido y reenviado por el Frontoffice.', new.numero_radicado)
      );
    end loop;
  end if;

  v_titulo := 'Respuesta del Backoffice';
  v_mensaje := format('El caso %s cambió a "%s" (%s).', new.numero_radicado, new.estado, new.paso_actual);

  if new.creado_por_id is not null and new.creado_por_id <> v_actor then
    insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
    values (new.creado_por_id, new.id, new.numero_radicado, 'caso_actualizado', v_titulo, v_mensaje);
  end if;

  if new.asignado_a is not null
    and new.asignado_a <> v_actor
    and new.asignado_a is distinct from new.creado_por_id then
    insert into public.notificaciones (usuario_id, caso_id, numero_radicado, tipo, titulo, mensaje)
    values (new.asignado_a, new.id, new.numero_radicado, 'caso_actualizado', v_titulo, v_mensaje);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_casos_notificar on public.casos_escalamiento;
create trigger trg_casos_notificar after insert or update on public.casos_escalamiento
for each row execute function public.notificar_evento_caso();

-- ----------------------------------------------------------------------------
-- 7. RPCs de negocio
-- ----------------------------------------------------------------------------
create or replace function public.crear_caso_escalamiento(
  p_tipologia text,
  p_datos_plantilla jsonb,
  p_paso_actual text default 'Radicado'
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public
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
  select u.nombre_completo into v_nombre from public.usuarios u where u.id = auth.uid();
  if v_nombre is null then
    raise exception 'Tu usuario no tiene perfil en F2B. Contacta al administrador.' using errcode = '42501';
  end if;

  insert into public.casos_escalamiento (tipologia, datos_plantilla, estado, paso_actual, creado_por, creado_por_id)
  values (trim(p_tipologia), p_datos_plantilla, 'Pendiente',
          coalesce(nullif(trim(p_paso_actual), ''), 'Radicado'), v_nombre, auth.uid())
  returning * into v_caso;

  insert into public.historial_movimientos (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values (v_caso.id, null, 'Pendiente', v_caso.paso_actual, 'Escalamiento creado desde Frontoffice.', auth.uid());
  return v_caso;
end;
$$;

create or replace function public.actualizar_caso_escalamiento(
  p_caso_id uuid,
  p_estado public.estado_caso,
  p_paso_actual text,
  p_comentario text default null,
  p_asignado_a uuid default null
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public
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
    select 1 from public.usuarios u where u.id = p_asignado_a and u.rol = 'backoffice'
  ) then
    raise exception 'El usuario asignado debe tener rol Backoffice.' using errcode = '22023';
  end if;

  select * into v_caso from public.casos_escalamiento where id = p_caso_id for update;
  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;
  v_estado_anterior := v_caso.estado;

  update public.casos_escalamiento
  set estado = p_estado,
      paso_actual = coalesce(nullif(trim(p_paso_actual), ''), v_caso.paso_actual),
      asignado_a = p_asignado_a,
      cerrado_en = case when p_estado in ('Completado', 'Rechazado') then coalesce(v_caso.cerrado_en, now()) else null end,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values (v_caso.id, v_estado_anterior, p_estado, v_caso.paso_actual,
          nullif(trim(p_comentario), ''), auth.uid());
  return v_caso;
end;
$$;

-- FASE 2: devolución con causal y pausa del SLA
create or replace function public.devolver_caso(
  p_caso_id uuid,
  p_causal text,
  p_observacion text
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_estado_anterior public.estado_caso;
  v_paso text;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los analistas de Backoffice pueden devolver casos.' using errcode = '42501';
  end if;
  if p_causal is null or length(trim(p_causal)) = 0 then
    raise exception 'La causal de devolución es obligatoria.' using errcode = '22023';
  end if;
  if p_observacion is null or length(trim(p_observacion)) = 0 then
    raise exception 'La observación de devolución es obligatoria.' using errcode = '22023';
  end if;

  select * into v_caso from public.casos_escalamiento where id = p_caso_id for update;
  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;
  v_estado_anterior := v_caso.estado;
  v_paso := 'Esperando subsanación del Frontoffice';

  update public.casos_escalamiento
  set estado = 'Devuelto',
      paso_actual = v_paso,
      causal_devolucion = trim(p_causal),
      observacion_devolucion = trim(p_observacion),
      sla_pausado_desde = coalesce(v_caso.sla_pausado_desde, now()),
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values (v_caso.id, v_estado_anterior, 'Devuelto', v_paso,
          format('Causal: %s. Observación: %s', trim(p_causal), trim(p_observacion)), auth.uid());
  return v_caso;
end;
$$;

-- FASE 2: subsanación y reanudación del SLA
create or replace function public.reenviar_caso(
  p_caso_id uuid,
  p_datos_plantilla jsonb default null,
  p_comentario text default null
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_pausa interval;
begin
  select * into v_caso from public.casos_escalamiento where id = p_caso_id for update;
  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;
  if v_caso.creado_por_id is distinct from auth.uid() and not public.es_backoffice() then
    raise exception 'Solo el creador del caso puede corregir y reenviar.' using errcode = '42501';
  end if;
  if v_caso.estado <> 'Devuelto' then
    raise exception 'El caso no está devuelto y no puede reenviarse.' using errcode = '22023';
  end if;
  if p_datos_plantilla is not null and jsonb_typeof(p_datos_plantilla) <> 'object' then
    raise exception 'Los datos de la plantilla deben ser un objeto JSON.' using errcode = '22023';
  end if;

  v_pausa := v_caso.sla_pausado_acumulado;
  if v_caso.sla_pausado_desde is not null then
    v_pausa := v_pausa + (now() - v_caso.sla_pausado_desde);
  end if;

  update public.casos_escalamiento
  set datos_plantilla = coalesce(p_datos_plantilla, v_caso.datos_plantilla),
      estado = 'Pendiente',
      paso_actual = 'Subsanación reenviada a Backoffice',
      sla_pausado_desde = null,
      sla_pausado_acumulado = v_pausa,
      sla_deadline = v_caso.created_at + interval '72 hours' + v_pausa,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values (v_caso.id, 'Devuelto', 'Pendiente', v_caso.paso_actual,
          nullif(trim(coalesce(p_comentario, '')), ''), auth.uid());
  return v_caso;
end;
$$;

-- FASE 1: guardar URLs de evidencias en el radicado
create or replace function public.guardar_evidencias(
  p_radicado text,
  p_evidencias jsonb
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para adjuntar evidencias.' using errcode = '42501';
  end if;
  if p_evidencias is null or jsonb_typeof(p_evidencias) <> 'array' then
    raise exception 'Las evidencias deben ser una lista.' using errcode = '22023';
  end if;
  select * into v_caso from public.casos_escalamiento
  where upper(numero_radicado) = upper(trim(p_radicado)) for update;
  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;
  if v_caso.creado_por_id is distinct from auth.uid() and not public.es_backoffice() then
    raise exception 'No tienes permiso para modificar las evidencias de este caso.' using errcode = '42501';
  end if;

  update public.casos_escalamiento
  set datos_plantilla = jsonb_set(v_caso.datos_plantilla, '{evidencias}', p_evidencias, true),
      updated_at = now()
  where id = v_caso.id
  returning * into v_caso;
  return v_caso;
end;
$$;

create or replace function public.consultar_radicado(p_radicado text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_caso public.casos_escalamiento;
  v_historial jsonb;
begin
  if p_radicado is null or length(trim(p_radicado)) = 0 then
    return null;
  end if;
  select * into v_caso from public.casos_escalamiento
  where upper(numero_radicado) = upper(trim(p_radicado)) limit 1;
  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'fecha_movimiento', h.fecha_evento,
        'usuario', h.usuario_nombre,
        'rol', h.rol,
        'accion', h.accion,
        'estado_anterior', h.estado_anterior,
        'estado_nuevo', h.estado_nuevo,
        'paso_registrado', h.paso_registrado,
        'comentario', h.observaciones,
        'duracion_ms', h.duracion_ms
      ) order by h.fecha_evento asc
    ), '[]'::jsonb
  )
  into v_historial
  from public.ticket_historial h
  where h.caso_id = v_caso.id;

  return jsonb_build_object(
    'caso', jsonb_build_object(
      'id', v_caso.id,
      'numero_radicado', v_caso.numero_radicado,
      'tipologia', v_caso.tipologia,
      'estado', v_caso.estado,
      'paso_actual', v_caso.paso_actual,
      'creado_por', v_caso.creado_por,
      'creado_por_id', v_caso.creado_por_id,
      'created_at', v_caso.created_at,
      'updated_at', v_caso.updated_at,
      'sla_deadline', v_caso.sla_deadline,
      'primera_respuesta_at', v_caso.primera_respuesta_at,
      'sla_pausado_desde', v_caso.sla_pausado_desde,
      'causal_devolucion', v_caso.causal_devolucion,
      'observacion_devolucion', v_caso.observacion_devolucion,
      'cerrado_en', v_caso.cerrado_en,
      'datos_plantilla', v_caso.datos_plantilla,
      'evidencias', coalesce(v_caso.datos_plantilla -> 'evidencias', '[]'::jsonb)
    ),
    'historial', v_historial
  );
end;
$$;

-- FASE 5: buscador global (cuenta/MIN, cédula, OT/radicado y asesor)
create or replace function public.buscar_casos(p_termino text, p_limite integer default 25)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_termino text := lower(trim(coalesce(p_termino, '')));
  v_resultado jsonb;
begin
  if length(v_termino) < 2 then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'id', c.id,
      'numero_radicado', c.numero_radicado,
      'tipologia', c.tipologia,
      'estado', c.estado,
      'creado_por', c.creado_por,
      'created_at', c.created_at
    ) as item
    from public.casos_escalamiento c
    where (c.creado_por_id = auth.uid() or c.asignado_a = auth.uid() or public.es_backoffice())
      and (
        lower(c.numero_radicado) like '%' || v_termino || '%'
        or lower(c.creado_por) like '%' || v_termino || '%'
        or lower(c.tipologia) like '%' || v_termino || '%'
        or exists (
          select 1 from jsonb_each_text(c.datos_plantilla) kv
          where lower(kv.value) like '%' || v_termino || '%'
        )
      )
    order by c.created_at desc
    limit least(coalesce(p_limite, 25), 50)
  ) q;
  return coalesce(v_resultado, '[]'::jsonb);
end;
$$;

create or replace function public.actualizar_perfil_backoffice(
  p_nombre_completo text,
  p_avatar_url text default null
)
returns public.usuarios language plpgsql security definer set search_path = public
as $$
declare
  v_perfil public.usuarios;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los usuarios de Backoffice pueden actualizar su perfil.' using errcode = '42501';
  end if;
  if p_nombre_completo is null or length(trim(p_nombre_completo)) = 0
     or length(trim(p_nombre_completo)) > 160 then
    raise exception 'El nombre completo debe tener entre 1 y 160 caracteres.' using errcode = '22023';
  end if;
  update public.usuarios
  set nombre_completo = trim(p_nombre_completo),
      avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url)
  where id = auth.uid()
  returning * into v_perfil;
  if not found then
    raise exception 'No se encontró el perfil del usuario.' using errcode = 'P0002';
  end if;
  return v_perfil;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nombre_completo, correo, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    new.email, 'agente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 8. Storage: evidencias por radicado
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias-casos', 'evidencias-casos', true, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "evidencias_select_public" on storage.objects;
create policy "evidencias_select_public" on storage.objects
for select to public using (bucket_id = 'evidencias-casos');

drop policy if exists "evidencias_insert_propias" on storage.objects;
create policy "evidencias_insert_propias" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'evidencias-casos'
  and public.puede_gestionar_radicado((storage.foldername(name))[1])
);

drop policy if exists "evidencias_delete_propias" on storage.objects;
create policy "evidencias_delete_propias" on storage.objects
for delete to authenticated
using (
  bucket_id = 'evidencias-casos'
  and public.puede_gestionar_radicado((storage.foldername(name))[1])
);

-- ----------------------------------------------------------------------------
-- 9. RLS y permisos
-- ----------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.casos_escalamiento enable row level security;
alter table public.historial_movimientos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.ticket_historial enable row level security;
alter table public.secuencias_radicado enable row level security;

drop policy if exists "usuarios_select_propio_o_backoffice" on public.usuarios;
create policy "usuarios_select_propio_o_backoffice" on public.usuarios
for select to authenticated using (id = auth.uid() or public.es_backoffice());

drop policy if exists "casos_select_autorizado" on public.casos_escalamiento;
create policy "casos_select_autorizado" on public.casos_escalamiento
for select to authenticated
using (creado_por_id = auth.uid() or asignado_a = auth.uid() or public.es_backoffice());

drop policy if exists "casos_insert_autenticado" on public.casos_escalamiento;
create policy "casos_insert_autenticado" on public.casos_escalamiento
for insert to authenticated with check (auth.uid() is not null and creado_por_id = auth.uid());

drop policy if exists "casos_update_backoffice" on public.casos_escalamiento;
create policy "casos_update_backoffice" on public.casos_escalamiento
for update to authenticated using (public.es_backoffice()) with check (public.es_backoffice());

drop policy if exists "historial_select_autorizado" on public.historial_movimientos;
create policy "historial_select_autorizado" on public.historial_movimientos
for select to authenticated using (public.puede_ver_caso(caso_id));

drop policy if exists "historial_insert_propio" on public.historial_movimientos;
create policy "historial_insert_propio" on public.historial_movimientos
for insert to authenticated
with check (usuario_id = auth.uid() and public.puede_ver_caso(caso_id));

drop policy if exists "notificaciones_select_propias" on public.notificaciones;
create policy "notificaciones_select_propias" on public.notificaciones
for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "notificaciones_update_propias" on public.notificaciones;
create policy "notificaciones_update_propias" on public.notificaciones
for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "ticket_historial_select_autorizado" on public.ticket_historial;
create policy "ticket_historial_select_autorizado" on public.ticket_historial
for select to authenticated using (public.puede_ver_caso(caso_id));

revoke all on public.secuencias_radicado from anon, authenticated;
grant select, update on public.notificaciones to authenticated;
grant select on public.ticket_historial to authenticated;

revoke all on function public.es_backoffice() from public;
grant execute on function public.es_backoffice() to authenticated;
revoke all on function public.puede_ver_caso(uuid) from public;
grant execute on function public.puede_ver_caso(uuid) to authenticated;
revoke all on function public.puede_gestionar_radicado(text) from public;
grant execute on function public.puede_gestionar_radicado(text) to authenticated;
revoke all on function public.crear_caso_escalamiento(text, jsonb, text) from public;
grant execute on function public.crear_caso_escalamiento(text, jsonb, text) to authenticated;
revoke all on function public.actualizar_caso_escalamiento(uuid, public.estado_caso, text, text, uuid) from public;
grant execute on function public.actualizar_caso_escalamiento(uuid, public.estado_caso, text, text, uuid) to authenticated;
revoke all on function public.devolver_caso(uuid, text, text) from public;
grant execute on function public.devolver_caso(uuid, text, text) to authenticated;
revoke all on function public.reenviar_caso(uuid, jsonb, text) from public;
grant execute on function public.reenviar_caso(uuid, jsonb, text) to authenticated;
revoke all on function public.guardar_evidencias(text, jsonb) from public;
grant execute on function public.guardar_evidencias(text, jsonb) to authenticated;
revoke all on function public.consultar_radicado(text) from public;
grant execute on function public.consultar_radicado(text) to anon, authenticated;
revoke all on function public.buscar_casos(text, integer) from public;
grant execute on function public.buscar_casos(text, integer) to authenticated;
revoke all on function public.actualizar_perfil_backoffice(text, text) from public;
grant execute on function public.actualizar_perfil_backoffice(text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'notificaciones'
    ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'casos_escalamiento'
    ) then
    alter publication supabase_realtime add table public.casos_escalamiento;
  end if;
end $$;

notify pgrst, 'reload schema';
