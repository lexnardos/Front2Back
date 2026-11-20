with checks(verificacion, estado) as (
  select 'tipo public.' || nombre,
         case when to_regtype('public.' || nombre) is not null
              then 'OK' else 'FALTA' end
  from unnest(array['rol_usuario', 'estado_caso', 'tipo_notificacion']) as t(nombre)

  union all

  select 'enum estado_caso.Devuelto',
         case when exists (
           select 1
           from pg_enum e
           where e.enumtypid = to_regtype('public.estado_caso')
             and e.enumlabel = 'Devuelto'
         ) then 'OK' else 'FALTA' end

  union all

  select 'tabla public.' || nombre,
         case when to_regclass('public.' || nombre) is not null
              then 'OK' else 'FALTA' end
  from unnest(array[
    'usuarios', 'secuencias_radicado', 'casos_escalamiento',
    'historial_movimientos', 'notificaciones', 'ticket_historial', 'callbacks'
  ]) as t(nombre)

  union all

  select 'columna casos_escalamiento.' || nombre,
         case when exists (
           select 1
           from information_schema.columns c
           where c.table_schema = 'public'
             and c.table_name = 'casos_escalamiento'
             and c.column_name = nombre
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'numero_radicado', 'tipologia', 'datos_plantilla', 'estado', 'paso_actual',
    'creado_por', 'creado_por_id', 'asignado_a', 'sla_deadline',
    'primera_respuesta_at', 'sla_pausado_desde', 'sla_pausado_acumulado',
    'cerrado_en', 'causal_devolucion', 'observacion_devolucion',
    'assigned_to_id', 'assigned_to_name', 'locked_at'
  ]) as t(nombre)

  union all

  select 'columna notificaciones.target_role',
         case when exists (
           select 1
           from information_schema.columns c
           where c.table_schema = 'public'
             and c.table_name = 'notificaciones'
             and c.column_name = 'target_role'
         ) then 'OK' else 'FALTA' end

  union all

  select 'columna callbacks.' || nombre,
         case when exists (
           select 1
           from information_schema.columns c
           where c.table_schema = 'public'
             and c.table_name = 'callbacks'
             and c.column_name = nombre
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'caso_id', 'usuario_id', 'programado_para', 'estado', 'notas',
    'creado_en', 'completado_en'
  ]) as t(nombre)

  union all

  select 'rpc public.' || nombre,
         case when exists (
           select 1
           from pg_proc p
           join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public' and p.proname = nombre
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'es_backoffice', 'puede_ver_caso', 'crear_caso_escalamiento',
    'actualizar_caso_escalamiento', 'consultar_radicado',
    'actualizar_perfil_backoffice', 'devolver_caso', 'reenviar_caso',
    'guardar_evidencias', 'buscar_casos', 'buscar_casos_duplicados',
    'tomar_caso_lock', 'liberar_caso_lock', 'reasignar_caso_lock',
    'programar_callback', 'completar_callback', 'posponer_callback'
  ]) as t(nombre)

  union all

  select 'trigger ' || nombre,
         case when exists (
           select 1 from pg_trigger t
           where t.tgname = nombre and not t.tgisinternal
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'trg_casos_numero_radicado', 'trg_casos_updated_at',
    'trg_casos_sla_deadline', 'trg_historial_primera_respuesta',
    'trg_historial_auditoria', 'trg_casos_notificar', 'on_auth_user_created'
  ]) as t(nombre)

  union all

  select 'rls ' || nombre,
         case when exists (
           select 1
           from pg_class c
           where c.oid = to_regclass('public.' || nombre) and c.relrowsecurity
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'usuarios', 'casos_escalamiento', 'historial_movimientos',
    'notificaciones', 'secuencias_radicado', 'callbacks'
  ]) as t(nombre)

  union all

  select 'bucket storage.' || nombre,
         case when exists (
           select 1 from storage.buckets b where b.id = nombre
         ) then 'OK' else 'FALTA' end
  from unnest(array['avatars', 'evidencias-casos']) as t(nombre)

  union all

  select 'realtime public.' || nombre,
         case when exists (
           select 1
           from pg_publication_tables pt
           where pt.pubname = 'supabase_realtime'
             and pt.schemaname = 'public'
             and pt.tablename = nombre
         ) then 'OK' else 'FALTA' end
  from unnest(array['notificaciones', 'callbacks', 'casos_escalamiento']) as t(nombre)

  union all

  select 'grant select ' || nombre || ' -> authenticated',
         case when exists (
           select 1
           from pg_class c
           join pg_namespace ns on ns.oid = c.relnamespace
           where c.oid = to_regclass('public.' || nombre)
             and exists (
               select 1
               from aclexplode(coalesce(c.relacl, ns.nspacl)) a
               where a.grantee = (select oid from pg_roles where rolname = 'authenticated')
                 and a.privilege_type = 'SELECT'
             )
         ) then 'OK' else 'FALTA' end
  from unnest(array['callbacks', 'notificaciones']) as t(nombre)

  union all

  select 'grant execute ' || nombre || ' -> authenticated',
         case when exists (
           select 1
           from pg_proc p
           join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public'
             and p.proname = nombre
             and exists (
               select 1
               from aclexplode(coalesce(p.proacl, ns.nspacl)) a
               where a.grantee = (select oid from pg_roles where rolname = 'authenticated')
                 and a.privilege_type = 'EXECUTE'
             )
         ) then 'OK' else 'FALTA' end
  from unnest(array[
    'es_backoffice', 'puede_ver_caso', 'crear_caso_escalamiento',
    'actualizar_caso_escalamiento', 'consultar_radicado',
    'actualizar_perfil_backoffice', 'devolver_caso', 'reenviar_caso',
    'guardar_evidencias', 'buscar_casos', 'buscar_casos_duplicados',
    'tomar_caso_lock', 'liberar_caso_lock', 'reasignar_caso_lock',
    'programar_callback', 'completar_callback', 'posponer_callback'
  ]) as t(nombre)
)
, resultado as (
  select verificacion, estado, 0 as orden
  from checks
  union all
  select
    'RESULTADO',
    case
      when count(*) filter (where estado = 'FALTA') = 0
        then 'BASE DE DATOS OK: todos los objetos requeridos estan presentes'
      else 'INCOMPLETA: ejecuta migration_f2b_completa.sql y migration_control_operativo.sql'
    end,
    1
  from checks
)
select verificacion, estado
from resultado
order by orden, estado desc, verificacion;
