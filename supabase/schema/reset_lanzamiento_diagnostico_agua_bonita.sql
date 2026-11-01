-- SIGAP - Diagnostico de solo lectura: todo lo que depende de la
-- congregacion de prueba "AGUA BONITA SUAREZ CAUCA" en tablas que NO
-- se vaciaron en el paso 1 (porque son estructura/catalogo que se
-- preserva para las congregaciones REALES) -- modulos, categorias
-- demograficas, zonas, etapas de seguimiento, roles_sistema y el
-- catalogo IPUC. Si alguna de estas tiene filas para esta
-- congregacion, un DELETE directo de `congregaciones` fallaria por
-- foreign key (mismo patron que ya paso con `familias` y con el rol
-- huerfano de Damil Lerma).
--
-- Esto es solo lectura, no cambia nada.

with c as (
  select id from congregaciones where nombre = 'AGUA BONITA SUAREZ CAUCA'
)
select 'congregacion_id' as tabla, (select id::text from c) as detalle
union all
select 'modulos', count(*)::text from modulos where congregacion_id in (select id from c)
union all
select 'categorias_demograficas', count(*)::text from categorias_demograficas where congregacion_id in (select id from c)
union all
select 'zonas', count(*)::text from zonas where congregacion_id in (select id from c)
union all
select 'etapas_seguimiento', count(*)::text from etapas_seguimiento where congregacion_id in (select id from c)
union all
select 'catalogo_congregaciones_ipuc', count(*)::text from catalogo_congregaciones_ipuc where congregacion_id in (select id from c)
union all
select 'personas', count(*)::text from personas where congregacion_id in (select id from c)
union all
select 'roles_sistema', count(*)::text from roles_sistema where congregacion_id in (select id from c)
union all
select 'suscripciones', count(*)::text from suscripciones where congregacion_id in (select id from c)
union all
select 'configuracion_congregacion', count(*)::text from configuracion_congregacion where congregacion_id in (select id from c);

-- Si "roles_sistema" sale mayor a 0, correr esto tambien para ver de
-- quien es (igual que se hizo con Damil Lerma):
-- select r.*, p.nombres, p.apellidos, p.auth_user_id
-- from roles_sistema r join personas p on p.id = r.persona_id
-- where r.congregacion_id = (select id from congregaciones where nombre = 'AGUA BONITA SUAREZ CAUCA');
