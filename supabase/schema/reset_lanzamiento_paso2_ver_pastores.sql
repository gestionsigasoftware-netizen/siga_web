-- SIGAP - Paso 2: revisar el directorio distrital de pastores antes de
-- decidir que se borra. Esta consulta es SOLO LECTURA, no cambia nada.
--
-- Corre esto y dime (por nombre o por id) cuales filas son reales
-- (ej. Damil Lerma) -- con eso armo el DELETE dirigido solo a las de
-- prueba, sin tocar las reales.

select
  p.id as pastor_id,
  p.nombres,
  p.apellidos,
  p.telefono,
  d.numero as distrito_numero,
  c.nombre as congregacion_asignada,
  ap.cargo,
  ap.fecha_inicio,
  ap.fecha_fin
from pastores p
left join distritos d on d.id = p.distrito_id
left join asignaciones_pastorales ap on ap.pastor_id = p.id and ap.fecha_fin is null
left join congregaciones c on c.id = ap.congregacion_id
order by d.numero, p.apellidos, p.nombres;
