-- SIGA - Comunicacion interna formal entre niveles (local <-> distrital,
-- distrital <-> nacional), en ambos sentidos. Deliberadamente NO es un
-- chat libre: es un ticket con tipo/estado/prioridad y un hilo de
-- respuestas dentro de cada uno -- una institucion jerarquica necesita
-- poder ver "que esta pendiente, que es urgente, que ya se resolvio",
-- algo que un chat sin estructura no permite a la escala de 36 distritos
-- y sus congregaciones.

create table if not exists solicitudes_jerarquicas (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid not null references auth.users(id),
  nivel_origen text not null check (nivel_origen in ('local', 'distrital', 'nacional')),
  nivel_destino text not null check (nivel_destino in ('local', 'distrital', 'nacional')),
  congregacion_id uuid references congregaciones(id), -- la congregacion involucrada, cuando local participa en algun extremo
  distrito_id uuid references distritos(id),           -- el distrito involucrado, cuando distrital participa en algun extremo
  tipo text not null default 'otro' check (tipo in ('administrativa', 'queja', 'sugerencia', 'recurso', 'otro')),
  asunto text not null,
  descripcion text not null,
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'resuelto', 'cerrado')),
  created_at timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (nivel_origen <> nivel_destino)
);

create index if not exists solicitudes_jerarquicas_distrito_idx on solicitudes_jerarquicas (distrito_id, created_at desc);
create index if not exists solicitudes_jerarquicas_congregacion_idx on solicitudes_jerarquicas (congregacion_id, created_at desc);

create table if not exists respuestas_solicitud (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes_jerarquicas(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  mensaje text not null,
  created_at timestamptz not null default now()
);

create index if not exists respuestas_solicitud_solicitud_idx on respuestas_solicitud (solicitud_id, created_at);

alter table solicitudes_jerarquicas enable row level security;
alter table respuestas_solicitud enable row level security;

-- Visible si la creaste, si es de tu congregacion, si es de tu distrito,
-- o si eres nacional/super_admin (mismo criterio de alcance total que ya
-- usa el resto de la app para esos dos niveles).
drop policy if exists solicitudes_select on solicitudes_jerarquicas;
create policy solicitudes_select on solicitudes_jerarquicas
for select to authenticated
using (
  creado_por = auth.uid()
  or (congregacion_id is not null and congregacion_id in (select mis_congregaciones()))
  or (distrito_id is not null and distrito_id in (select mis_distritos()))
  or es_nacional() or es_super_admin()
);

-- Solo se puede crear en las direcciones reales de la jerarquia, y solo
-- sobre la propia congregacion/distrito -- nadie puede enviar "en nombre
-- de" otra congregacion o distrito que no es el suyo.
drop policy if exists solicitudes_insert on solicitudes_jerarquicas;
create policy solicitudes_insert on solicitudes_jerarquicas
for insert to authenticated
with check (
  creado_por = auth.uid()
  and (
    (nivel_origen = 'local' and nivel_destino = 'distrital' and congregacion_id in (select mis_congregaciones()) and distrito_id is not null)
    or (nivel_origen = 'distrital' and nivel_destino = 'nacional' and distrito_id in (select mis_distritos()))
    or (nivel_origen = 'distrital' and nivel_destino = 'local' and distrito_id in (select mis_distritos()) and congregacion_id in (select mis_congregaciones()))
    or (nivel_origen = 'nacional' and nivel_destino = 'distrital' and (es_nacional() or es_super_admin()) and distrito_id is not null)
  )
);

-- Cualquiera que pueda ver la solicitud puede actualizar su estado
-- (marcar en proceso/resuelto/cerrado) -- tanto quien la recibe como
-- quien la envio pueden confirmar que ya se resolvio.
drop policy if exists solicitudes_update on solicitudes_jerarquicas;
create policy solicitudes_update on solicitudes_jerarquicas
for update to authenticated
using (
  creado_por = auth.uid()
  or (congregacion_id is not null and congregacion_id in (select mis_congregaciones()))
  or (distrito_id is not null and distrito_id in (select mis_distritos()))
  or es_nacional() or es_super_admin()
)
with check (true);

drop policy if exists respuestas_select on respuestas_solicitud;
create policy respuestas_select on respuestas_solicitud
for select to authenticated
using (exists (
  select 1 from solicitudes_jerarquicas s
  where s.id = respuestas_solicitud.solicitud_id
    and (
      s.creado_por = auth.uid()
      or (s.congregacion_id is not null and s.congregacion_id in (select mis_congregaciones()))
      or (s.distrito_id is not null and s.distrito_id in (select mis_distritos()))
      or es_nacional() or es_super_admin()
    )
));

drop policy if exists respuestas_insert on respuestas_solicitud;
create policy respuestas_insert on respuestas_solicitud
for insert to authenticated
with check (
  autor_id = auth.uid()
  and exists (
    select 1 from solicitudes_jerarquicas s
    where s.id = respuestas_solicitud.solicitud_id
      and (
        s.creado_por = auth.uid()
        or (s.congregacion_id is not null and s.congregacion_id in (select mis_congregaciones()))
        or (s.distrito_id is not null and s.distrito_id in (select mis_distritos()))
        or es_nacional() or es_super_admin()
      )
  )
);

create or replace function notificar_nueva_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatario record;
begin
  if new.nivel_destino = 'nacional' then
    for destinatario in select persona_id from roles_sistema where nivel in ('nacional', 'super_admin') and fecha_fin is null
    loop
      perform crear_notificacion_usuario((select auth_user_id from personas where id = destinatario.persona_id), 'Nueva solicitud interna', format('%s: %s', new.tipo, new.asunto), 'info', '/solicitudes');
    end loop;
  elsif new.nivel_destino = 'distrital' then
    for destinatario in select persona_id from roles_sistema where nivel = 'distrital' and distrito_id = new.distrito_id and fecha_fin is null
    loop
      perform crear_notificacion_usuario((select auth_user_id from personas where id = destinatario.persona_id), 'Nueva solicitud interna', format('%s: %s', new.tipo, new.asunto), 'info', '/solicitudes');
    end loop;
  elsif new.nivel_destino = 'local' then
    for destinatario in select persona_id from roles_sistema where nivel = 'local' and congregacion_id = new.congregacion_id and fecha_fin is null
    loop
      perform crear_notificacion_usuario((select auth_user_id from personas where id = destinatario.persona_id), 'Nueva solicitud interna', format('%s: %s', new.tipo, new.asunto), 'info', '/solicitudes');
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists solicitudes_notificacion on solicitudes_jerarquicas;
create trigger solicitudes_notificacion
after insert on solicitudes_jerarquicas
for each row execute function notificar_nueva_solicitud();

create or replace function notificar_respuesta_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creado_por uuid;
  v_asunto text;
begin
  select creado_por, asunto into v_creado_por, v_asunto from solicitudes_jerarquicas where id = new.solicitud_id;
  if v_creado_por is not null and v_creado_por <> new.autor_id then
    perform crear_notificacion_usuario(v_creado_por, 'Nueva respuesta', format('Respondieron tu solicitud: %s', v_asunto), 'info', '/solicitudes');
  end if;
  update solicitudes_jerarquicas set actualizado_en = now() where id = new.solicitud_id;
  return new;
end;
$$;

drop trigger if exists respuestas_solicitud_notificacion on respuestas_solicitud;
create trigger respuestas_solicitud_notificacion
after insert on respuestas_solicitud
for each row execute function notificar_respuesta_solicitud();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_jerarquicas'
  ) then
    alter publication supabase_realtime add table solicitudes_jerarquicas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'respuestas_solicitud'
  ) then
    alter publication supabase_realtime add table respuestas_solicitud;
  end if;
end $$;
