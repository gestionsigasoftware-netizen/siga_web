-- SIGA - Preparacion academica/ministerial de los pastores y tarjeta de
-- predicador de los obreros (quienes aun no tienen ninguna licencia).
-- Ejecutar despues de pastoral_distrital.sql y licencias_pastorales.sql.
-- Es repetible.

-- Fecha de expedicion de la tarjeta de predicador (obreros sin licencia).
alter table pastores add column if not exists fecha_tarjeta_predicador date;

create table if not exists formacion_pastoral (
  id uuid primary key default gen_random_uuid(),
  pastor_id uuid not null references pastores(id) on delete cascade,
  tipo text not null check (tipo in ('titulo', 'curso', 'diplomado', 'especializacion', 'maestria', 'doctorado', 'seminario_biblico', 'otro')),
  tipo_otro text,
  nombre text not null,
  institucion text,
  fecha date,
  observaciones text,
  registrado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table formacion_pastoral enable row level security;

drop policy if exists formacion_pastoral_distrital on formacion_pastoral;
create policy formacion_pastoral_distrital on formacion_pastoral for all to authenticated
using (exists (select 1 from pastores p where p.id = formacion_pastoral.pastor_id and es_lider_distrital(p.distrito_id)))
with check (exists (select 1 from pastores p where p.id = formacion_pastoral.pastor_id and es_lider_distrital(p.distrito_id)));
