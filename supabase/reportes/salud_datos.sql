-- SIGA - Salud de los datos del censo. Idea profunda #1: la piramide,
-- los cumpleanos y la proyeccion de crecimiento (ya construidos esta
-- sesion) solo son tan buenas como los datos que las alimentan. Hoy
-- nadie ve si esos datos estan incompletos. Un consolidado por
-- congregacion (distrital) y por distrito (nacional) del % de personas
-- activas con cada campo clave diligenciado.

drop function if exists resumen_salud_datos_distrital(uuid);
create function resumen_salud_datos_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  total_activos bigint,
  con_fecha_nacimiento bigint,
  con_genero bigint,
  con_telefono bigint,
  con_familia bigint,
  con_fecha_ingreso bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id,
    c.nombre,
    c.ciudad,
    count(p.id) filter (where p.estado_membresia = 'activo'),
    count(p.id) filter (where p.estado_membresia = 'activo' and p.fecha_nacimiento is not null),
    count(p.id) filter (where p.estado_membresia = 'activo' and p.genero is not null),
    count(p.id) filter (where p.estado_membresia = 'activo' and p.telefono is not null and p.telefono <> ''),
    count(p.id) filter (where p.estado_membresia = 'activo' and p.familia_id is not null),
    count(p.id) filter (where p.estado_membresia = 'activo' and p.fecha_ingreso is not null)
  from congregaciones c
  left join personas p on p.congregacion_id = c.id
  where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones())
  group by c.id, c.nombre, c.ciudad
  order by c.nombre;
$$;

revoke all on function resumen_salud_datos_distrital(uuid) from public, anon;
grant execute on function resumen_salud_datos_distrital(uuid) to authenticated;

drop function if exists resumen_salud_datos_nacional();
create function resumen_salud_datos_nacional()
returns table (
  distrito_id uuid,
  numero integer,
  nombre text,
  total_activos bigint,
  con_fecha_nacimiento bigint,
  con_genero bigint,
  con_telefono bigint,
  con_familia bigint,
  con_fecha_ingreso bigint
)
language sql stable security invoker set search_path = public as $$
  select
    d.id,
    d.numero,
    d.nombre,
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo'), 0),
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo' and p.fecha_nacimiento is not null), 0),
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo' and p.genero is not null), 0),
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo' and p.telefono is not null and p.telefono <> ''), 0),
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo' and p.familia_id is not null), 0),
    coalesce((select count(*) from personas p join congregaciones c on c.id = p.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and p.estado_membresia = 'activo' and p.fecha_ingreso is not null), 0)
  from distritos d
  where d.id in (select mis_distritos()) or es_super_admin() or es_nacional()
  order by d.numero nulls last, d.nombre;
$$;

revoke all on function resumen_salud_datos_nacional() from public, anon;
grant execute on function resumen_salud_datos_nacional() to authenticated;
