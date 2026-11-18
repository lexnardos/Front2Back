-- ============================================================================
-- F2B - Migración: SLA (24h - 72h) + Centro de notificaciones + Realtime
-- Ejecutar completo en el SQL Editor de Supabase.
-- Seguro para ejecutar más de una vez (idempotente).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SLA: fecha límite (72 horas) y primera respuesta del Backoffice
-- ----------------------------------------------------------------------------
alter table public.casos_escalamiento
  add column if not exists sla_deadline timestamptz,
  add column if not exists primera_respuesta_at timestamptz;

alter table public.casos_escalamiento
  alter column sla_deadline set default (now() + interval '72 hours');

update public.casos_escalamiento
set sla_deadline = created_at + interval '72 hours'
where sla_deadline is null;

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

update public.casos_escalamiento c
set primera_respuesta_at = sub.primera_fecha
from (
  select caso_id, min(fecha_movimiento) as primera_fecha
  from public.historial_movimientos
  where estado_nuevo <> 'Pendiente'
  group by caso_id
) sub
where c.id = sub.caso_id
  and c.primera_respuesta_at is null;

-- ----------------------------------------------------------------------------
-- 2. Tabla de notificaciones (persistidas y suscritas vía Realtime)
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.tipo_notificacion as enum ('caso_radicado', 'caso_actualizado');
exception
  when duplicate_object then null;
end $$;

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

create index if not exists notificaciones_usuario_created_idx
  on public.notificaciones (usuario_id, created_at desc);

create index if not exists notificaciones_usuario_leida_idx
  on public.notificaciones (usuario_id, leida);

-- ----------------------------------------------------------------------------
-- 3. Generación automática de eventos
--    INSERT  -> aviso al creador y a todo el Backoffice
--    UPDATE  -> aviso al creador y al responsable cuando cambia el caso
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
-- 4. Seguridad (RLS) y Realtime
-- ----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

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

grant select, update on public.notificaciones to authenticated;

revoke all on function public.notificar_evento_caso() from public, anon, authenticated;
revoke all on function public.registrar_primera_respuesta() from public, anon, authenticated;
revoke all on function public.set_sla_deadline() from public, anon, authenticated;

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

-- ----------------------------------------------------------------------------
-- 5. La consulta pública también expone los datos del SLA
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

notify pgrst, 'reload schema';
