-- SIGA - Catalogo de "caracter" de culto (Ensenanza, Alabanza, Evangelismo,
-- Especial...), administrado desde la web (Modulos.jsx) y elegido al
-- capturar la asistencia desde la PWA -- para que el mismo tipo de culto
-- recurrente ("Culto Martes") pueda variar de caracter semana a semana sin
-- tener que editar el tipo de culto en si.
--
-- Ejecutar despues de schema.sql, migracion_produccion.sql y
-- rls_cargo_pwa.sql (depende de mis_congregaciones_via_cargo(), definida
-- ahi, para que un capturador solo-cargo pueda leer el catalogo). Repetible.

create table if not exists caracteres_culto (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, nombre)
);

alter table caracteres_culto enable row level security;

-- Administracion (crear/editar/desactivar): igual alcance amplio que ya
-- tienen los catalogos existentes (modulos, tipos_actividad, categorias) --
-- pastor/distrital/nacional/super_admin de esa congregacion.
drop policy if exists caracteres_culto_scope on caracteres_culto;
create policy caracteres_culto_scope on caracteres_culto
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

-- Lectura para quien solo tiene un cargo (capturador PWA sin rol de
-- pastor) -- necesita poder VER el catalogo para elegir un caracter al
-- capturar, aunque no pueda crear ni editar ninguno.
drop policy if exists caracteres_culto_select_via_cargo on caracteres_culto;
create policy caracteres_culto_select_via_cargo on caracteres_culto for select to authenticated
using (congregacion_id in (select mis_congregaciones_via_cargo()));

create index if not exists caracteres_culto_congregacion_idx on caracteres_culto (congregacion_id, activo);

-- El caracter elegido queda en el registro de asistencia (no en el tipo de
-- culto): el mismo "Culto Martes" puede ser "Ensenanza" una semana y
-- "Alabanza" otra sin tocar el tipo de culto en si.
alter table registros_actividad add column if not exists caracter_id uuid references caracteres_culto(id) on delete set null;
