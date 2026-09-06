-- SIGA - Idea profunda #4: checklist de continuidad pastoral. Ya
-- existia transferir credenciales al finalizar una asignacion pastoral
-- (finalizar_asignacion_pastoral.sql), pero no se transferian los
-- pendientes reales de esa congregacion -- seguimientos pastorales
-- abiertos, casos activos de Red de Familias, cargos obligatorios de
-- comite sin cubrir. El riesgo real de una transicion pastoral no es el
-- acceso al sistema, es que se pierda el hilo de a quien habia que
-- visitar.

drop function if exists resumen_continuidad_congregacion(uuid);
create function resumen_continuidad_congregacion(p_congregacion_id uuid)
returns table (
  seguimientos_pendientes bigint,
  casos_red_familias_activos bigint,
  cargos_obligatorios_vacantes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    coalesce((select count(*) from seguimientos_pastorales where congregacion_id = p_congregacion_id and estado = 'pendiente'), 0),
    coalesce((select count(*) from red_familias_casos where congregacion_id = p_congregacion_id and estado in ('solicitado', 'activo', 'pausado')), 0),
    coalesce((
      select count(*)
      from cargos_comite cc
      where cc.congregacion_id = p_congregacion_id and cc.obligatorio and cc.activo
        and not exists (
          select 1 from comites co
          join membresias_comite mc on mc.comite_id = co.id
          where co.congregacion_id = p_congregacion_id and mc.cargo_id = cc.id and mc.fecha_fin is null
        )
    ), 0);
$$;

revoke all on function resumen_continuidad_congregacion(uuid) from public, anon;
grant execute on function resumen_continuidad_congregacion(uuid) to authenticated;
