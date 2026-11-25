create extension if not exists pgcrypto;

alter table public.casos_escalamiento
  add column if not exists assigned_to_id uuid references public.usuarios(id) on delete set null,
  add column if not exists assigned_to_name text,
  add column if not exists locked_at timestamptz;

update public.casos_escalamiento c
set assigned_to_id = coalesce(c.assigned_to_id, c.asignado_a)
where c.assigned_to_id is null and c.asignado_a is not null;

update public.casos_escalamiento c
set assigned_to_name = u.nombre_completo
from public.usuarios u
where c.assigned_to_id = u.id and c.assigned_to_name is null;

update public.casos_escalamiento
set locked_at = coalesce(locked_at, updated_at)
where locked_at is null
  and assigned_to_id is not null
  and estado::text = 'En Proceso';

create index if not exists idx_casos_lock
  on public.casos_escalamiento (locked_at, assigned_to_id);

alter table public.casos_escalamiento replica identity full;

create table if not exists public.callbacks (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos_escalamiento(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  programado_para timestamptz not null,
  estado text not null default 'pendiente',
  notas text,
  creado_en timestamptz not null default now(),
  completado_en timestamptz
);

alter table public.callbacks drop constraint if exists callbacks_estado_check;
alter table public.callbacks add constraint callbacks_estado_check
  check (estado in ('pendiente', 'pospuesto', 'completado', 'cancelado'));

create index if not exists idx_callbacks_usuario_estado_fecha
  on public.callbacks (usuario_id, estado, programado_para);
create index if not exists idx_callbacks_caso
  on public.callbacks (caso_id);

alter table public.callbacks replica identity full;

create or replace function public.tomar_caso_lock(p_caso_id uuid)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_nombre text;
  v_estado_anterior public.estado_caso;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los analistas de Backoffice pueden tomar casos.' using errcode = '42501';
  end if;

  select u.nombre_completo into v_nombre
  from public.usuarios u
  where u.id = auth.uid();

  if v_nombre is null then
    raise exception 'Tu usuario no tiene perfil en F2B.' using errcode = '42501';
  end if;

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.estado::text in ('Completado', 'Rechazado') then
    raise exception 'El caso ya está cerrado y no puede tomarse.' using errcode = '22023';
  end if;

  if v_caso.locked_at is not null and v_caso.assigned_to_id is distinct from auth.uid() then
    raise exception 'El caso está en gestión por % desde %.',
      coalesce(v_caso.assigned_to_name, 'otro analista'), v_caso.locked_at
      using errcode = '23514';
  end if;

  v_estado_anterior := v_caso.estado;

  if v_caso.locked_at is not null and v_caso.assigned_to_id = auth.uid() then
    update public.casos_escalamiento
    set estado = 'En Proceso', paso_actual = 'En Gestión', updated_at = now()
    where id = p_caso_id
    returning * into v_caso;
    return v_caso;
  end if;

  update public.casos_escalamiento
  set assigned_to_id = auth.uid(),
      assigned_to_name = v_nombre,
      locked_at = now(),
      asignado_a = auth.uid(),
      estado = 'En Proceso',
      paso_actual = 'En Gestión',
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos
    (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values
    (v_caso.id, v_estado_anterior, 'En Proceso', v_caso.paso_actual,
     format('Tomar caso: bloqueo operativo por %s.', v_nombre), auth.uid());

  return v_caso;
end;
$$;

create or replace function public.liberar_caso_lock(p_caso_id uuid)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_nombre text;
  v_nombre_anterior text;
  v_estado_anterior public.estado_caso;
  v_estado_nuevo public.estado_caso;
  v_paso text;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los analistas de Backoffice pueden liberar casos.' using errcode = '42501';
  end if;

  select u.nombre_completo into v_nombre
  from public.usuarios u
  where u.id = auth.uid();

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.locked_at is null then
    return v_caso;
  end if;

  v_nombre_anterior := v_caso.assigned_to_name;
  v_estado_anterior := v_caso.estado;

  v_estado_nuevo := case
    when v_caso.estado::text = 'En Proceso' then 'Pendiente'::public.estado_caso
    else v_caso.estado
  end;
  v_paso := case
    when v_estado_nuevo::text <> v_caso.estado::text then 'Disponible en bandeja'
    else v_caso.paso_actual
  end;

  update public.casos_escalamiento
  set assigned_to_id = null,
      assigned_to_name = null,
      locked_at = null,
      asignado_a = null,
      estado = v_estado_nuevo,
      paso_actual = v_paso,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos
    (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values
    (v_caso.id, v_estado_anterior, v_estado_nuevo, v_paso,
     format('Liberación de bloqueo por %s; bloqueo anterior: %s.',
       coalesce(v_nombre, 'Sistema'), coalesce(v_nombre_anterior, 'N/A')), auth.uid());

  return v_caso;
end;
$$;

create or replace function public.reasignar_caso_lock(
  p_caso_id uuid,
  p_usuario_id uuid
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_nombre_destino text;
  v_nombre_actor text;
  v_estado_anterior public.estado_caso;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los analistas de Backoffice pueden reasignar casos.' using errcode = '42501';
  end if;

  select u.nombre_completo into v_nombre_destino
  from public.usuarios u
  where u.id = p_usuario_id and u.rol::text = 'backoffice';

  if v_nombre_destino is null then
    raise exception 'El analista destino no existe o no pertenece a Backoffice.' using errcode = '22023';
  end if;

  select u.nombre_completo into v_nombre_actor
  from public.usuarios u
  where u.id = auth.uid();

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.estado::text in ('Completado', 'Rechazado') then
    raise exception 'El caso ya está cerrado y no puede reasignarse.' using errcode = '22023';
  end if;

  v_estado_anterior := v_caso.estado;

  update public.casos_escalamiento
  set assigned_to_id = p_usuario_id,
      assigned_to_name = v_nombre_destino,
      locked_at = now(),
      asignado_a = p_usuario_id,
      estado = 'En Proceso',
      paso_actual = 'En gestión por ' || v_nombre_destino,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos
    (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values
    (v_caso.id, v_estado_anterior, 'En Proceso', v_caso.paso_actual,
     format('Reasignación por %s a %s.', coalesce(v_nombre_actor, 'Sistema'), v_nombre_destino), auth.uid());

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
language plpgsql security invoker set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_estado_anterior public.estado_caso;
  v_nombre_asignado text;
begin
  if not public.es_backoffice() then
    raise exception 'Solo los usuarios de Backoffice pueden gestionar casos.' using errcode = '42501';
  end if;
  if p_estado is null then
    raise exception 'El estado es obligatorio.' using errcode = '22023';
  end if;
  if p_asignado_a is not null and not exists (
    select 1 from public.usuarios u where u.id = p_asignado_a and u.rol::text = 'backoffice'
  ) then
    raise exception 'El usuario asignado debe tener rol Backoffice.' using errcode = '22023';
  end if;

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.locked_at is not null and v_caso.assigned_to_id is distinct from auth.uid() then
    raise exception 'El caso está bloqueado por %. Libéralo o reasígnalo antes de responder.',
      coalesce(v_caso.assigned_to_name, 'otro analista')
      using errcode = '23514';
  end if;

  if p_asignado_a is not null then
    select u.nombre_completo into v_nombre_asignado
    from public.usuarios u
    where u.id = p_asignado_a;
  else
    v_nombre_asignado := null;
  end if;

  v_estado_anterior := v_caso.estado;

  update public.casos_escalamiento
  set estado = p_estado,
      paso_actual = coalesce(nullif(trim(p_paso_actual), ''), v_caso.paso_actual),
      asignado_a = p_asignado_a,
      assigned_to_id = p_asignado_a,
      assigned_to_name = v_nombre_asignado,
      locked_at = case
        when p_asignado_a is not null then coalesce(v_caso.locked_at, now())
        else null
      end,
      cerrado_en = case when p_estado::text in ('Completado', 'Rechazado') then coalesce(v_caso.cerrado_en, now()) else null end,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos
    (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values
    (v_caso.id, v_estado_anterior, p_estado, v_caso.paso_actual,
     nullif(trim(p_comentario), ''), auth.uid());

  return v_caso;
end;
$$;

create or replace function public.devolver_caso(
  p_caso_id uuid,
  p_causal text,
  p_observacion text
)
returns public.casos_escalamiento
language plpgsql security invoker set search_path = public as $$
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

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id
  for update;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.locked_at is not null and v_caso.assigned_to_id is distinct from auth.uid() then
    raise exception 'El caso está bloqueado por %. Libéralo o reasígnalo antes de devolverlo.',
      coalesce(v_caso.assigned_to_name, 'otro analista')
      using errcode = '23514';
  end if;

  v_estado_anterior := v_caso.estado;
  v_paso := 'Esperando subsanación del Frontoffice';

  update public.casos_escalamiento
  set estado = 'Devuelto',
      paso_actual = v_paso,
      causal_devolucion = trim(p_causal),
      observacion_devolucion = trim(p_observacion),
      sla_pausado_desde = coalesce(v_caso.sla_pausado_desde, now()),
      assigned_to_id = null,
      assigned_to_name = null,
      locked_at = null,
      asignado_a = null,
      updated_at = now()
  where id = p_caso_id
  returning * into v_caso;

  insert into public.historial_movimientos
    (caso_id, estado_anterior, estado_nuevo, paso_registrado, comentario, usuario_id)
  values
    (v_caso.id, v_estado_anterior, 'Devuelto', v_paso,
     format('Causal: %s. Observación: %s', trim(p_causal), trim(p_observacion)), auth.uid());

  return v_caso;
end;
$$;

create or replace function public.buscar_casos_duplicados(
  p_valor text,
  p_excluir_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_valor text := regexp_replace(lower(coalesce(p_valor, '')), '[^a-z0-9]', '', 'g');
  v_resultado jsonb;
begin
  if length(v_valor) < 4 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'id', c.id,
      'numero_radicado', c.numero_radicado,
      'tipologia', c.tipologia,
      'estado', c.estado::text,
      'paso_actual', c.paso_actual,
      'creado_por', c.creado_por,
      'created_at', c.created_at,
      'campo_coincidente', kv.key,
      'valor_coincidente', kv.value
    ) as item
    from public.casos_escalamiento c
    cross join lateral jsonb_each_text(c.datos_plantilla) kv
    where (p_excluir_id is null or c.id <> p_excluir_id)
      and c.estado::text in ('Pendiente', 'En Proceso', 'Devuelto')
      and c.created_at >= now() - interval '72 hours'
      and lower(kv.key) ~ '(cuenta|min|cedula|documento|identificacion)'
      and regexp_replace(lower(kv.value), '[^a-z0-9]', '', 'g') = v_valor
    order by c.created_at desc
    limit 5
  ) q;

  return coalesce(v_resultado, '[]'::jsonb);
end;
$$;

create or replace function public.programar_callback(
  p_caso_id uuid,
  p_programado_para timestamptz,
  p_notas text default null
)
returns public.callbacks
language plpgsql security definer set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_callback public.callbacks;
  v_actor_nombre text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para programar un recontacto.' using errcode = '42501';
  end if;

  select * into v_caso
  from public.casos_escalamiento
  where id = p_caso_id;

  if not found then
    raise exception 'Caso no encontrado.' using errcode = 'P0002';
  end if;

  if v_caso.creado_por_id is distinct from auth.uid() and not public.es_backoffice() then
    raise exception 'Solo el creador del caso o Backoffice pueden programar el recontacto.' using errcode = '42501';
  end if;

  if v_caso.estado::text not in ('Completado', 'Rechazado') then
    raise exception 'El recontacto solo puede programarse cuando el caso esté resuelto.' using errcode = '22023';
  end if;

  if p_programado_para is null or p_programado_para <= now() + interval '1 minute' then
    raise exception 'Selecciona una fecha y hora futura para el recontacto.' using errcode = '22023';
  end if;

  if v_caso.creado_por_id is null then
    raise exception 'El caso no tiene un agente responsable para el recontacto.' using errcode = '22023';
  end if;

  insert into public.callbacks (caso_id, usuario_id, programado_para, notas)
  values (p_caso_id, v_caso.creado_por_id, p_programado_para, nullif(trim(coalesce(p_notas, '')), ''))
  returning * into v_callback;

  select u.nombre_completo into v_actor_nombre
  from public.usuarios u
  where u.id = auth.uid();

  insert into public.notificaciones
    (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
  values
    (v_caso.creado_por_id, v_caso.id, v_caso.numero_radicado,
     'recordatorio_recontacto', 'agente', 'Recontacto programado',
     format('Recontacto para %s programado el %s. Caso: %s.',
       v_caso.numero_radicado,
       to_char(p_programado_para at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
       coalesce(nullif(trim(coalesce(p_notas, '')), ''), 'Sin notas')));

  insert into public.ticket_historial
    (caso_id, fecha_evento, usuario_id, usuario_nombre, rol, accion,
     estado_anterior, estado_nuevo, paso_registrado, observaciones, metadata)
  values
    (v_caso.id, now(), auth.uid(), coalesce(v_actor_nombre, 'Sistema'),
     case when public.es_backoffice() then 'backoffice' else 'front' end,
     'Recontacto programado', v_caso.estado, v_caso.estado, v_caso.paso_actual,
     format('Programado para %s. %s',
       to_char(p_programado_para at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
       coalesce(nullif(trim(coalesce(p_notas, '')), ''), 'Sin notas')),
     jsonb_build_object('callback_id', v_callback.id, 'programado_para', p_programado_para));

  return v_callback;
end;
$$;

create or replace function public.completar_callback(p_callback_id uuid)
returns public.callbacks
language plpgsql security definer set search_path = public as $$
declare
  v_callback public.callbacks;
  v_caso public.casos_escalamiento;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para registrar el recontacto.' using errcode = '42501';
  end if;

  select * into v_callback
  from public.callbacks
  where id = p_callback_id
  for update;

  if not found then
    raise exception 'Recordatorio no encontrado.' using errcode = 'P0002';
  end if;

  if v_callback.usuario_id is distinct from auth.uid() and not public.es_backoffice() then
    raise exception 'Solo el agente responsable puede marcar el recontacto.' using errcode = '42501';
  end if;

  update public.callbacks
  set estado = 'completado', completado_en = now()
  where id = p_callback_id
    and estado in ('pendiente', 'pospuesto')
  returning * into v_callback;

  if v_callback.id is null then
    return v_callback;
  end if;

  select * into v_caso
  from public.casos_escalamiento
  where id = v_callback.caso_id;

  insert into public.ticket_historial
    (caso_id, fecha_evento, usuario_id, usuario_nombre, rol, accion,
     estado_anterior, estado_nuevo, paso_registrado, observaciones, metadata)
  values
    (v_caso.id, now(), auth.uid(), coalesce((select u.nombre_completo from public.usuarios u where u.id = auth.uid()), 'Sistema'),
     case when public.es_backoffice() then 'backoffice' else 'front' end,
     'Recontacto realizado', v_caso.estado, v_caso.estado, v_caso.paso_actual,
     coalesce(v_callback.notas, 'Llamada de confirmación registrada.'),
     jsonb_build_object('callback_id', v_callback.id));

  return v_callback;
end;
$$;

create or replace function public.posponer_callback(
  p_callback_id uuid,
  p_minutos integer default 15
)
returns public.callbacks
language plpgsql security definer set search_path = public as $$
declare
  v_callback public.callbacks;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para posponer el recontacto.' using errcode = '42501';
  end if;
  if p_minutos is null or p_minutos < 5 or p_minutos > 1440 then
    raise exception 'El tiempo de posposición debe estar entre 5 y 1440 minutos.' using errcode = '22023';
  end if;

  select * into v_callback
  from public.callbacks
  where id = p_callback_id
  for update;

  if not found then
    raise exception 'Recordatorio no encontrado.' using errcode = 'P0002';
  end if;

  if v_callback.usuario_id is distinct from auth.uid() and not public.es_backoffice() then
    raise exception 'Solo el agente responsable puede posponer el recontacto.' using errcode = '42501';
  end if;

  update public.callbacks
  set estado = 'pospuesto',
      programado_para = greatest(now() + interval '1 minute',
                                  programado_para + (p_minutos || ' minutes')::interval)
  where id = p_callback_id
    and estado in ('pendiente', 'pospuesto')
  returning * into v_callback;

  return v_callback;
end;
$$;

create or replace function public.consultar_radicado(p_radicado text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_caso public.casos_escalamiento;
  v_historial jsonb;
  v_callbacks jsonb;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cb.id,
        'programado_para', cb.programado_para,
        'estado', cb.estado,
        'notas', cb.notas,
        'creado_en', cb.creado_en,
        'completado_en', cb.completado_en
      ) order by cb.programado_para desc
    ), '[]'::jsonb
  )
  into v_callbacks
  from public.callbacks cb
  where cb.caso_id = v_caso.id;

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
    'historial', v_historial,
    'callbacks', v_callbacks
  );
end;
$$;

alter table public.callbacks enable row level security;

drop policy if exists "callbacks_select_propias_o_backoffice" on public.callbacks;
create policy "callbacks_select_propias_o_backoffice" on public.callbacks
for select to authenticated using (
  usuario_id = auth.uid() or public.es_backoffice()
);

grant select on public.callbacks to authenticated;
grant execute on function public.tomar_caso_lock(uuid) to authenticated;
grant execute on function public.liberar_caso_lock(uuid) to authenticated;
grant execute on function public.reasignar_caso_lock(uuid, uuid) to authenticated;
grant execute on function public.buscar_casos_duplicados(text, uuid) to authenticated;
grant execute on function public.programar_callback(uuid, timestamptz, text) to authenticated;
grant execute on function public.completar_callback(uuid) to authenticated;
grant execute on function public.posponer_callback(uuid, integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'callbacks'
    ) then
      alter publication supabase_realtime add table public.callbacks;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casos_escalamiento'
    ) then
      alter publication supabase_realtime add table public.casos_escalamiento;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
