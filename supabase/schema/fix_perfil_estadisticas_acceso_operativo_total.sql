-- =============================================================================
-- Ajuste de producto pedido por el usuario (2026-09-10): el perfil web
-- "Comité de Estadísticas" (codigo = 'estadisticas') debe quedar con el
-- mismo nivel de trabajo operativo que "Acceso total" (el pastor) -- según
-- el usuario, en la practica el Comité de Estadísticas es "el brazo del
-- pastor para operar SIGAP": ningún otro comité usa el sistema tanto como
-- ellos, son quienes realmente hacen el trabajo diario en la plataforma.
--
-- Alcance decidido explícitamente con el usuario (no se asumió): TODO el
-- trabajo operativo (feligresía y red de familias en edición, y los 11
-- módulos especializados -- Evangelismo, Misión Juvenil, Ruta
-- Evangelística, Escuela Dominical, Damas Dorcas, Obra Carcelaria,
-- Música, Educación Artística/Teológica, Conquistadores, Obra Social,
-- SEPRI -- más reportes). NO incluye 'usuarios.administrar',
-- 'configuracion.administrar' ni 'auditoria.consultar' -- esos 3 quedan
-- exclusivos del pastor como resguardo de gobierno (quién puede dar/quitar
-- acceso a otros y cambiar la configuración de la congregación).
--
-- No requiere tocar tiene_permiso(): esa función ya revisa
-- `permisos_perfil` para CUALQUIER perfil asignado -- solo hacía falta
-- agregar las filas que faltaban para el perfil 'estadisticas'. Es
-- repetible (on conflict do nothing).
-- =============================================================================

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso
from perfiles_acceso p
cross join (values
  ('feligresia.editar'),
  ('red_familias.editar'),
  ('evangelismo.consultar'), ('evangelismo.editar'), ('evangelismo.registrar'),
  ('mision_juvenil.consultar'), ('mision_juvenil.editar'), ('mision_juvenil.registrar'),
  ('ruta_evangelistica.consultar'), ('ruta_evangelistica.editar'), ('ruta_evangelistica.registrar'),
  ('escuela_dominical.consultar'), ('escuela_dominical.editar'), ('escuela_dominical.registrar'),
  ('damas_dorcas.consultar'), ('damas_dorcas.editar'), ('damas_dorcas.registrar'),
  ('obra_carcelaria.consultar'), ('obra_carcelaria.editar'), ('obra_carcelaria.registrar'),
  ('musica.consultar'), ('musica.editar'), ('musica.registrar'),
  ('artistica.consultar'), ('artistica.editar'), ('artistica.registrar'),
  ('teologica.consultar'), ('teologica.editar'), ('teologica.registrar'),
  ('conquistadores.consultar'), ('conquistadores.editar'), ('conquistadores.registrar'),
  ('obra_social.consultar'), ('obra_social.editar'), ('obra_social.registrar'),
  ('sepri.consultar'), ('sepri.editar'), ('sepri.registrar')
) as x(permiso)
where p.codigo = 'estadisticas'
on conflict do nothing;

update perfiles_acceso
set descripcion = 'Trabaja SIGAP con el mismo alcance operativo que el pastor: feligresía, familias, reportes y todos los módulos especializados. No administra usuarios ni configuración de la congregación.'
where codigo = 'estadisticas';
