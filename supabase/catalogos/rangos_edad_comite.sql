-- SIGA - Catalogo de rangos de edad -> comite(s) sugerido(s), y campo
-- de genero en Amigos (para que la sugerencia tambien aplique a los
-- no convertidos, no solo al censo de Feligresia).
--
-- Parte del rediseno acordado con el usuario (2026-09-07): el sistema
-- debe poder sugerir, a partir de la edad, el genero y (opcionalmente)
-- el estado civil de una persona, que comite(s) le corresponden --
-- por ejemplo, una mujer soltera de 15 a 25 años puede corresponderle
-- a la vez el comite de Señoritas, Adolescentes, Jovenes y Damas
-- Dorcas, segun el plan de trabajo de cada uno en esa congregacion.
-- Por eso un mismo rango puede apuntar a VARIOS comites (no es una
-- relacion uno a uno), y cada congregacion define sus propios rangos
-- -- a diferencia de las estaciones de la Ruta Evangelistica (que son
-- un estandar nacional de la IPUC), estos rangos y su nombre
-- ("Señoritas", "Adolescentes", etc.) son criterio local.
--
-- Esta pieza es solo el catalogo (para administrarlo desde Modulos y
-- actividades) -- todavia no calcula ni muestra ninguna sugerencia en
-- ninguna pantalla, eso es la siguiente pieza.
--
-- Ejecutar despues de feligresia.sql. Repetible.

-- personas.genero ya existe (catalogos/genero_personas.sql); amigos
-- nunca lo tuvo porque se agrego mucho antes de que existiera ese
-- campo. Sin esto, la sugerencia no podria aplicar a nadie que aun no
-- se ha convertido -- justo la mitad del pedido del usuario.
alter table amigos add column if not exists genero text check (genero in ('masculino', 'femenino'));

create table if not exists rangos_edad_comite (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  edad_desde integer not null check (edad_desde >= 0),
  edad_hasta integer check (edad_hasta is null or edad_hasta >= edad_desde),
  genero text check (genero in ('masculino', 'femenino')),
  estado_civil text check (estado_civil in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo')),
  comite_id uuid not null references comites(id) on delete cascade,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- genero/estado_civil nulos = "aplica a cualquiera" -- por eso no van
-- en un unique index estricto; dos filas pueden compartir rango de
-- edad si una es mas especifica (ej. una para "femenino" y otra para
-- null/cualquiera) sin que eso sea un error de captura.

alter table rangos_edad_comite enable row level security;
drop policy if exists rangos_edad_comite_read on rangos_edad_comite;
drop policy if exists rangos_edad_comite_write on rangos_edad_comite;
create policy rangos_edad_comite_read on rangos_edad_comite for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy rangos_edad_comite_write on rangos_edad_comite for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

create index if not exists rangos_edad_comite_congregacion_idx on rangos_edad_comite (congregacion_id, activo);
