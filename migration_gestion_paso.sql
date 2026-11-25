-- ============================================================================
-- F2B · Estandarización del paso "En Gestión" al tomar un caso
-- Ejecutar en el SQL Editor de Supabase después de migration_control_operativo.sql.
-- Idempotente: redefine únicamente tomar_caso_lock.
-- El evento en ticket_historial se sigue generando con el trigger
-- trg_historial_auditoria sobre historial_movimientos.
-- ============================================================================

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
    set estado = 'En Proceso',
        paso_actual = 'En Gestión',
        updated_at = now()
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

grant execute on function public.tomar_caso_lock(uuid) to authenticated;

notify pgrst, 'reload schema';
