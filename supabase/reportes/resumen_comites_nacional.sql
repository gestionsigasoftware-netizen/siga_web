-- SIGA - Consolidado nacional de los 10 comites reales de la IPUC, por
-- distrito. Ejecutar despues de resumen_mision_juvenil_red_familias.sql.
-- Es repetible.
--
-- Problema que resuelve: los 9 (ahora 10) resumen_X_distrital() solo se
-- veian en Pastoral Distrital, sobre el distrito propio de quien entra.
-- Nacional no tenia ninguna vista de "cuantos ninos en Escuela Dominical
-- hay en todo el pais" ni de ningun otro comite — solo poblacion general
-- e Impacto Misionero (que cubre apenas 3 de los 10).
--
-- Una fila por distrito (36 filas), con el numero principal de cada
-- comite — mismo nivel de detalle que la comparativa de poblacion del
-- Dashboard Nacional, no el detalle operativo completo (eso sigue siendo
-- responsabilidad de Pastoral Distrital).

drop function if exists resumen_comites_nacional();
create function resumen_comites_nacional()
returns table (
  distrito_id uuid,
  numero integer,
  nombre text,
  escuela_dominical_ninos bigint,
  damas_dorcas_beneficiarias bigint,
  obra_carcelaria_internos bigint,
  musica_integrantes bigint,
  artistica_integrantes bigint,
  teologica_integrantes bigint,
  conquistadores_miembros bigint,
  obra_social_casos bigint,
  mision_juvenil_estudiantes bigint,
  red_familias_casos bigint
)
language sql stable security invoker set search_path = public as $$
  select
    d.id,
    d.numero,
    d.nombre,
    coalesce((select count(*) from escuela_dominical_ninos n join congregaciones c on c.id = n.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and n.estado = 'activo'), 0),
    coalesce((select count(*) from damas_dorcas_beneficiarias b join congregaciones c on c.id = b.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and b.estado = 'activa'), 0),
    coalesce((select count(*) from obra_carcelaria_internos i join congregaciones c on c.id = i.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and i.estado = 'activo'), 0),
    coalesce((select count(*) from musica_integrantes m join congregaciones c on c.id = m.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and m.estado = 'activo'), 0),
    coalesce((select count(*) from artistica_integrantes a join congregaciones c on c.id = a.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and a.estado = 'activo'), 0),
    coalesce((select count(*) from teologica_integrantes t join congregaciones c on c.id = t.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and t.estado = 'activo'), 0),
    coalesce((select count(*) from conquistadores_miembros q join congregaciones c on c.id = q.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and q.estado = 'activo'), 0),
    coalesce((select count(*) from obra_social_casos o join congregaciones c on c.id = o.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and o.estado in ('identificada', 'en_apoyo')), 0),
    coalesce((select count(*) from mision_estudiantes e join congregaciones c on c.id = e.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and e.estado <> 'inactivo'), 0),
    coalesce((select count(*) from red_familias_casos r join congregaciones c on c.id = r.congregacion_id where c.distrito_id = d.id and c.id in (select mis_congregaciones()) and r.estado in ('solicitado', 'activo', 'pausado')), 0)
  from distritos d
  where d.id in (select mis_distritos()) or es_super_admin() or es_nacional()
  order by d.numero nulls last, d.nombre;
$$;

revoke all on function resumen_comites_nacional() from public, anon;
grant execute on function resumen_comites_nacional() to authenticated;
