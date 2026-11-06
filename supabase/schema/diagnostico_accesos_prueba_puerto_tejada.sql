-- SIGAP - Diagnostico de solo lectura: que tan "reales" son los 4
-- accesos de Puerto Tejada que se van a revocar (todos menos
-- super_admin y el pastor Damil Lerma) -- si cuentan como feligreses
-- de verdad en las estadisticas, o son solo accesos vacios. No borra
-- nada.

with a_revisar(persona_id, quien) as (
  values
    ('bd1747fc-5d73-47d1-8e0d-bc45ec09ddea'::uuid, 'Usuario de Pruebas'),
    ('9387b3b4-929c-4e89-91f9-82ec7c09699e'::uuid, 'Carlos Mina (tu cuenta)'),
    ('2c622693-efa1-40b9-a207-4d67a9c4a217'::uuid, 'Jhan Sanchez'),
    ('86eccab6-cd99-45cb-842f-6019d83fa0ec'::uuid, 'Natalia Guacha Noriega')
)
select
  r.quien,
  p.nombres, p.apellidos, p.estado_membresia, p.bautizado, p.fecha_ingreso, p.observaciones_pastorales,
  (select count(*) from roles_sistema where persona_id = r.persona_id and fecha_fin is null) as roles_activos,
  (select count(*) from historial_cargos where persona_id = r.persona_id) as cargos,
  (select count(*) from membresias_comite where persona_id = r.persona_id) as comites,
  (select count(*) from seguimientos_pastorales where persona_id = r.persona_id) as seguimientos,
  (select count(*) from movimientos_membresia where persona_id = r.persona_id) as movimientos,
  (select count(*) from registros_actividad where responsable_persona_id = r.persona_id) as actividades_responsable
from a_revisar r
join personas p on p.id = r.persona_id;
