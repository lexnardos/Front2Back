-- ============================================================================
-- F2B · Reinicio de casos e historial
-- Ejecutar COMPLETO en el SQL Editor de Supabase.
-- Borra casos, historial, notificaciones y callbacks;
-- reinicia la numeración de radicados a ESC-AAAA-0001.
-- Los archivos del bucket evidencias-casos se limpian desde Storage (la API bloquea borrarlos por SQL).
-- Conserva usuarios, roles y avatares.
-- ============================================================================

begin;

-- 1. Tablas dependientes (se borran primero aunque ya tengan ON DELETE CASCADE)
delete from public.callbacks;
delete from public.ticket_historial;
delete from public.historial_movimientos;
delete from public.notificaciones;

-- 2. Casos
delete from public.casos_escalamiento;

-- 3. Consecutivo de radicado para que el próximo sea 0001
delete from public.secuencias_radicado;

commit;

-- Verificación: todo en 0 excepto usuarios conservados
select
  (select count(*) from public.casos_escalamiento)   as casos,
  (select count(*) from public.historial_movimientos) as historial_movimientos,
  (select count(*) from public.ticket_historial)     as ticket_historial,
  (select count(*) from public.notificaciones)       as notificaciones,
  (select count(*) from public.callbacks)            as callbacks,
  (select count(*) from public.usuarios)             as usuarios_conservados;
