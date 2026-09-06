-- SIGA - Lista fija de ujieres que prestan el servicio (catalogo propio,
-- NO parte del censo de feligresia -- son nombres para programar quien
-- esta de turno cada culto, no fichas completas de membresia). Se
-- administra desde la web (Modulos.jsx) y se elige al capturar la
-- asistencia de Ujieres desde la PWA, para saber cual de ellos fue el
-- responsable de ese culto especifico (no necesariamente quien tiene el
-- celular en la mano -- puede ser una cuenta compartida entre varios).
--
-- Ejecutar despues de rls_cargo_pwa.sql (depende de
-- mis_congregaciones_via_cargo()). Repetible.

create table if not exists ujieres_congregacion (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, nombre)
);

alter table ujieres_congregacion enable row level security;

-- Administracion (crear/editar/desactivar): mismo alcance que los demas
-- catalogos operativos (modulos, tipos_actividad, caracteres_culto).
drop policy if exists ujieres_congregacion_scope on ujieres_congregacion;
create policy ujieres_congregacion_scope on ujieres_congregacion
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

-- Lectura para un capturador solo-cargo (sin rol de pastor) -- necesita
-- ver la lista para elegir, aunque no pueda crear ni editar ninguno.
drop policy if exists ujieres_congregacion_select_via_cargo on ujieres_congregacion;
create policy ujieres_congregacion_select_via_cargo on ujieres_congregacion for select to authenticated
using (congregacion_id in (select mis_congregaciones_via_cargo()));

create index if not exists ujieres_congregacion_congregacion_idx on ujieres_congregacion (congregacion_id, activo);

-- El ujier responsable elegido queda en el propio registro de asistencia.
alter table registros_actividad add column if not exists ujier_responsable_id uuid references ujieres_congregacion(id) on delete set null;
