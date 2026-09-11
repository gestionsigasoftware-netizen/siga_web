# Perfil "Comité de Estadísticas" con acceso operativo igual al pastor (2026-09-10)

El usuario pidió que el perfil web "Comité de Estadísticas" quede con
el mismo nivel de trabajo que "Acceso total" -- en sus palabras, es "el
brazo del pastor para operar SIGAP", el comité que en la práctica más
usa el sistema. Se le preguntó explícitamente el alcance (para no
asumir), y eligió: **todo el trabajo operativo (feligresía y familias
en edición, y los 11 módulos especializados), pero sin administrar
usuarios ni configuración de la congregación** -- esos 2 quedan
exclusivos del pastor como resguardo de gobierno.

## Cómo funciona (para no repetir la investigación después)

`tiene_permiso(congregacion_id, permiso)` revisa dos caminos
independientes:
1. La persona tiene un perfil asignado en `asignaciones_acceso` cuyo
   `permisos_perfil` incluye ese permiso exacto.
2. La persona tiene `roles_sistema.rol_local = 'pastor'` en esa
   congregación -- en cuyo caso una lista fija hardcodeada en la propia
   función (repetida y ampliada en 7 archivos SQL a lo largo del
   proyecto) le da automáticamente ~45 permisos, incluidos los de
   TODOS los módulos especializados.

Antes de este cambio, el perfil `estadisticas` solo tenía en
`permisos_perfil`: `feligresia.consultar`, `red_familias.consultar`,
`estadisticas.consultar`, `estadisticas.registrar`,
`reportes.consultar` -- todo el resto (editar feligresía/familias, y
cualquier cosa de Evangelismo, Escuela Dominical, SEPRI, Música, etc.)
solo lo tenía el pastor por el camino 2.

## Corregido

`supabase/schema/fix_perfil_estadisticas_acceso_operativo_total.sql`:
agrega a `permisos_perfil` (perfil `estadisticas`) los permisos que le
faltaban -- `feligresia.editar`, `red_familias.editar`, y los 3
permisos (`consultar`/`editar`/`registrar`) de cada uno de los 11
módulos especializados (Evangelismo, Misión Juvenil, Ruta
Evangelística, Escuela Dominical, Damas Dorcas, Obra Carcelaria,
Música, Educación Artística, Educación Teológica, Conquistadores,
Obra Social, SEPRI). No se tocó `usuarios.administrar`,
`configuracion.administrar` ni `auditoria.consultar` -- esos siguen
siendo exclusivos de `rol_local = 'pastor'`.

**No hizo falta ningún cambio de frontend.** Se verificó que:
- `tiene_permiso()` ya revisa `permisos_perfil` para cualquier perfil
  asignado -- agregar las filas es suficiente, sin tocar la función.
- Cada pantalla de módulo (ej. `EscuelaDominical.jsx`) calcula
  `canEdit` llamando a `tiene_permiso()` por RPC, no comprobando
  `rol_local` directamente -- así que ya reaccionan solas al nuevo
  permiso.
- Las 2 pantallas que sí deben seguir siendo exclusivas del pastor
  (`EquipoCongregacion.jsx` y `Configuracion.jsx`) comprueban
  `rol_local === 'pastor'` directamente en el componente, no
  `tiene_permiso()` -- así que quedan bloqueadas para "Comité de
  Estadísticas" tal como se pidió, sin necesitar ningún cambio
  adicional. Lo mismo aplica a `AuditoriaFeligresia.jsx`.

Un colaborador invitado con el perfil "Comité de Estadísticas" recibe
`roles_sistema.rol_local = 'solo_lectura'` (definido en
`invitar-usuario/index.ts`), que basta para iniciar sesión y cargar el
panel local -- el resto del alcance lo da `asignaciones_acceso` +
`permisos_perfil`, no ese campo.

**Pendiente de ejecutar por el usuario**: el archivo SQL de arriba en
el SQL Editor de Supabase.
