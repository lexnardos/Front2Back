create extension if not exists pgcrypto;

do $$
begin
  create type public.rol_usuario as enum ('backoffice', 'agente');
exception when duplicate_object then null;
end $$;

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  caso_id uuid not null references public.casos_escalamiento(id) on delete cascade,
  numero_radicado varchar(20) not null,
  tipo text not null,
  target_role text,
  titulo varchar(160) not null,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notificaciones
  add column if not exists target_role text;

alter table public.notificaciones
  alter column tipo type text using tipo::text;

alter table public.notificaciones
  alter column tipo set not null;

alter table public.notificaciones
  add column if not exists caso_id uuid references public.casos_escalamiento(id) on delete cascade;

alter table public.notificaciones
  add column if not exists numero_radicado varchar(20);

alter table public.notificaciones
  alter column numero_radicado set not null;

create index if not exists notificaciones_usuario_created_idx
  on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_target_role_created_idx
  on public.notificaciones (target_role, created_at desc);
create index if not exists notificaciones_caso_idx
  on public.notificaciones (caso_id);
create index if not exists notificaciones_no_leidas_idx
  on public.notificaciones (usuario_id, leida)
  where leida = false;

alter table public.notificaciones replica identity full;

create or replace function public.es_backoffice()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select u.rol::text = 'backoffice'
      from public.usuarios u
      where u.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.notificar_evento_caso()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_destino uuid;
  v_cuenta text;
  v_sla text;
  v_estado text;
  v_titulo text;
  v_mensaje text;
begin
  v_cuenta := coalesce(
    nullif(trim(coalesce(new.datos_plantilla ->> 'cuenta_min', '')), ''),
    nullif(trim(coalesce(new.datos_plantilla ->> 'cuenta', '')), ''),
    nullif(trim(coalesce(new.datos_plantilla ->> 'numero_cuenta', '')), ''),
    new.numero_radicado
  );
  v_sla := coalesce(
    to_char((new.sla_deadline at time zone 'America/Bogota'), 'YYYY-MM-DD HH24:MI'),
    to_char(((new.created_at + interval '72 hours') at time zone 'America/Bogota'), 'YYYY-MM-DD HH24:MI')
  );

  if tg_op = 'INSERT' then
    if new.creado_por_id is not null then
      insert into public.notificaciones
        (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
      values
        (new.creado_por_id, new.id, new.numero_radicado, 'caso_radicado', 'agente',
         'Escalamiento enviado',
         format('Tu solicitud %s fue escalada al Backoffice. Radicado: %s. SLA estimado: 72 horas hábiles.',
           new.numero_radicado, new.numero_radicado));
    end if;

    for v_destino in
      select u.id
      from public.usuarios u
      where u.rol::text = 'backoffice'
        and u.id <> v_actor
    loop
      insert into public.notificaciones
        (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
      values
        (v_destino, new.id, new.numero_radicado, 'nuevo_escalamiento', 'backoffice',
         format('Nuevo escalamiento %s', new.numero_radicado),
         format('Agente: %s | Tipificación: %s | Cuenta/MIN: %s | Radicado: %s | SLA 72h: %s',
           new.creado_por, new.tipologia, v_cuenta, new.numero_radicado, v_sla));
    end loop;

    return new;
  end if;

  v_estado := new.estado::text;

  if old.estado::text = v_estado
    and old.paso_actual = new.paso_actual
    and old.asignado_a is not distinct from new.asignado_a
    and old.causal_devolucion is not distinct from new.causal_devolucion then
    return new;
  end if;

  if v_estado = 'Devuelto' and old.estado::text is distinct from 'Devuelto' then
    if new.creado_por_id is not null then
      insert into public.notificaciones
        (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
      values
        (new.creado_por_id, new.id, new.numero_radicado, 'caso_devuelto', 'agente',
         'Caso devuelto: requiere corrección',
         format('El caso %s fue devuelto. Causal: %s. Observación: %s',
           new.numero_radicado,
           coalesce(new.causal_devolucion, 'No indicada'),
           coalesce(new.observacion_devolucion, 'Sin observación')));
    end if;
    return new;
  end if;

  if old.estado::text = 'Devuelto' and v_estado is distinct from 'Devuelto' then
    for v_destino in
      select u.id
      from public.usuarios u
      where u.rol::text = 'backoffice'
    loop
      insert into public.notificaciones
        (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
      values
        (v_destino, new.id, new.numero_radicado, 'subsanacion_reenviada', 'backoffice',
         format('Subsanación reenviada %s', new.numero_radicado),
         format('Agente: %s | Tipificación: %s | Cuenta/MIN: %s | Radicado: %s | SLA reactivado 72h: %s',
           new.creado_por, new.tipologia, v_cuenta, new.numero_radicado, v_sla));
    end loop;
    return new;
  end if;

  v_titulo := 'Respuesta del Backoffice';
  v_mensaje := format('El caso %s cambió a "%s" (%s).',
    new.numero_radicado, v_estado, new.paso_actual);

  if new.creado_por_id is not null and new.creado_por_id <> v_actor then
    insert into public.notificaciones
      (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
    values
      (new.creado_por_id, new.id, new.numero_radicado, 'caso_actualizado', 'agente',
       v_titulo, v_mensaje);
  end if;

  if new.asignado_a is not null
    and new.asignado_a <> v_actor
    and new.asignado_a is distinct from new.creado_por_id then
    insert into public.notificaciones
      (usuario_id, caso_id, numero_radicado, tipo, target_role, titulo, mensaje)
    values
      (new.asignado_a, new.id, new.numero_radicado, 'caso_actualizado', 'backoffice',
       v_titulo, v_mensaje);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_casos_notificar on public.casos_escalamiento;
create trigger trg_casos_notificar
after insert or update on public.casos_escalamiento
for each row execute function public.notificar_evento_caso();

alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones_select_propias_o_rol" on public.notificaciones;
create policy "notificaciones_select_propias_o_rol" on public.notificaciones
for select to authenticated
using (
  usuario_id = auth.uid()
  or (target_role = 'backoffice' and public.es_backoffice())
);

drop policy if exists "notificaciones_insert_dirigidas_backoffice" on public.notificaciones;
create policy "notificaciones_insert_dirigidas_backoffice" on public.notificaciones
for insert to authenticated
with check (
  target_role = 'backoffice'
  and exists (
    select 1
    from public.usuarios u
    where u.id = usuario_id
      and u.rol::text = 'backoffice'
  )
);

drop policy if exists "notificaciones_update_propias_o_rol" on public.notificaciones;
create policy "notificaciones_update_propias_o_rol" on public.notificaciones
for update to authenticated
using (
  usuario_id = auth.uid()
  or (target_role = 'backoffice' and public.es_backoffice())
)
with check (
  usuario_id = auth.uid()
  or (target_role = 'backoffice' and public.es_backoffice())
);

grant select, insert, update on public.notificaciones to authenticated;
grant execute on function public.es_backoffice() to authenticated;

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
