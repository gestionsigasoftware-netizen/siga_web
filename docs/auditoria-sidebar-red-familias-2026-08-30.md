# Auditoria de modulos del Sidebar: Red de Familias

Fecha: 30 de agosto de 2026

## Objetivo

Continuar la auditoria modulo por modulo del Sidebar. El usuario reporto que
"Red de Familias" mostraba "Modo consulta" con una cuenta que es pastor local
de su congregacion, y pregunto si ese aviso es informativo o depende del rol.

## Diagnostico

"Modo consulta" en `src/pages/RedFamilias.jsx` depende directamente de la RPC
`tiene_permiso(congregacion_id, 'red_familias.editar')` (no es un texto
decorativo). Se verifico contra la base de datos real del proyecto,
autenticado con la cuenta reportada:

- `roles_sistema`: `nivel = 'local'`, `rol_local = null` (cuenta como pastor
  por la regla `coalesce(rol_local, 'pastor') = 'pastor'` usada en todo el
  sistema).
- `tiene_permiso(congregacion_id, 'red_familias.editar')` devolvia `false`
  para esa cuenta, a pesar de ser pastor.

## Causa raiz

`supabase/seguridad_produccion.sql` redefine `tiene_permiso()` (necesario
para el endurecimiento de seguridad) y, al agregar los permisos implicitos
del pastor para los modulos nuevos (Evangelismo, Mision Juvenil, Ruta
Evangelistica), omitio por error `red_familias.consultar` y
`red_familias.editar` — que si estaban en la lista original de
`accesos.sql`. El proyecto Supabase de esta cuenta ya tiene aplicada esa
migracion de endurecimiento, asi que el pastor local sin una asignacion de
perfil adicional perdio edicion (y potencialmente lectura, ver mas abajo) de
Red de Familias sin que nadie lo haya quitado a proposito.

Feligresia no se vio afectada porque `feligresia.editar` si permanecio en la
lista nueva.

## Impacto en lectura, no solo en edicion

Las politicas RLS de escritura en `supabase/red_familias.sql` combinan
`puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id,
'red_familias.editar')`, y `puede_administrar_feligresia()` verifica el rol de
pastor de forma independiente (no usa la lista de `tiene_permiso`), asi que la
escritura real en base de datos no estaba bloqueada para el pastor — solo la
interfaz ocultaba los formularios por un `canEdit` mal calculado.

Sin embargo, las politicas de lectura (`red_familias_casos_read`, etc.) usan
unicamente `tiene_permiso(congregacion_id, 'red_familias.consultar')`, sin ese
respaldo de `puede_administrar_feligresia`. Con `red_familias.consultar`
tambien ausente de la lista, un pastor local sin asignacion de perfil
adicional pudo haber tenido lectura bloqueada por RLS (no solo la UI), no se
pudo confirmar con certeza en la congregacion de prueba usada porque no tenia
casos/visitas/actividades registrados todavia.

## Cambio aplicado

Se agregaron `red_familias.consultar` y `red_familias.editar` a la lista de
permisos implicitos del pastor dentro de `tiene_permiso()` en
`supabase/seguridad_produccion.sql`.

**Este cambio vive en el repositorio pero no se aplico solo a la base de datos
real** (no hay acceso de `service_role` ni al SQL Editor del proyecto desde
esta sesion). Se le entrego al usuario el bloque `create or replace function
tiene_permiso(...)` corregido para ejecutar directamente en el SQL Editor de
Supabase; es idempotente y no afecta datos existentes.

## Archivos modificados

- `supabase/seguridad_produccion.sql`
- `docs/auditoria-sidebar-red-familias-2026-08-30.md`

## Validacion pendiente

- Confirmar en el proyecto Supabase real, despues de aplicar la funcion
  corregida, que "Modo consulta" desaparece para el pastor reportado.
- Revisar si otros permisos de `accesos.sql` quedaron fuera de la lista de
  `seguridad_produccion.sql` de la misma forma (comparar ambas listas
  permiso por permiso; hoy solo se verifico `red_familias.*`).
- Confirmar si la lectura de Red de Familias estuvo realmente bloqueada por
  RLS para pastores sin perfil adicional, con una congregacion que si tenga
  casos/visitas/actividades registrados.
