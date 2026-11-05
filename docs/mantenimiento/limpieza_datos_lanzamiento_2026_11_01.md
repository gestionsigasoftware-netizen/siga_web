# Limpieza de datos de prueba para el lanzamiento — 2026-11-01

## Contexto

Hoy inicia la operación real de SIGAP. El usuario pidió dejar todos
los contadores en cero (sin el ruido de meses de pruebas) sin romper
el acceso de las cuentas que ya pueden entrar al sistema.

**No hay backups configurados todavía** (pospuesto al plan Pro de
Supabase, decisión de negocio ya documentada en
`project_siga_verificacion_produccion_2026_09_10`) — esta operación es
irreversible si algo sale mal. Se recomendó al usuario exportar un
respaldo manual (CSV desde el Table Editor, o backup completo) antes
de correr nada.

## Hallazgo clave antes de tocar nada

Se auditó el esquema completo (116 tablas) antes de proponer
cualquier borrado. `personas` (el censo) **es también el puente entre
cada cuenta de login y su rol** —
`personas.auth_user_id → auth.users`, y `roles_sistema` /
`asignaciones_acceso` cuelgan de `personas.id`. Borrar `personas` a lo
bruto habría roto el acceso de cualquier cuenta real (incluido el
super_admin). Por eso el borrado de `personas` quedó acotado a
`WHERE auth_user_id IS NULL` (solo censo sin login, nunca cuentas
reales).

Segundo hallazgo: `pastores` (directorio del módulo distrital) es una
tabla **aparte** del censo, sin ninguna columna que distinga una fila
real de una de prueba — a diferencia de `personas`, no hay forma de
detectarlo automáticamente. Se dejó fuera del script automático y se
hace en un segundo paso, manual.

## Qué se confirmó con el usuario antes de escribir el script

- Las congregaciones actuales son reales, se quedan.
- En el censo solo hay 2 personas reales: el super_admin y el pastor
  Damil Lerma (el resto son cuentas creadas para probar) — resuelto
  automáticamente por la condición `auth_user_id IS NULL`.
- El directorio `pastores` necesita revisión manual (lista primero,
  usuario confirma cuáles son reales).
- Los centros de reclusión (Obra Carcelaria) son reales, se quedan;
  los internos/delegados de prueba ahí dentro se borran. En SEPRI no
  hay nada real, se borra todo.

## Archivos

- `supabase/schema/reset_lanzamiento_paso1_actividad.sql` — TRUNCATE
  de 85 tablas de actividad/datos de prueba (censo activity, ruta
  evangelística, comités operativos, SEPRI, soporte/sistema), más un
  blindaje (`UPDATE pastores SET persona_id = null ...`) para que el
  DELETE final de `personas` nunca falle por un enlace opcional desde
  `pastores`, y al final `DELETE FROM personas WHERE auth_user_id IS NULL`.
  Las 31 tablas de estructura/catálogos/acceso/negocio NO se tocan.
- `supabase/schema/reset_lanzamiento_paso2_ver_pastores.sql` —
  `SELECT` de solo lectura que lista el directorio `pastores` con su
  distrito y congregación asignada, para que el usuario identifique
  cuáles son reales antes de un DELETE dirigido (paso 3, pendiente de
  la respuesta del usuario, no incluido en este commit).

## Verificación de las 116 tablas

Antes de escribir el script se cruzaron dos listas (preservar/vaciar)
contra los nombres reales de tabla extraídos de todos los `.sql` del
repo: cobertura 100%, cero nombres inventados, cero duplicados. Un
error se encontró y corrigió en el proceso: `historial_cargos` se
había puesto por error en el grupo "directorio distrital de pastores"
(manual) cuando en realidad es historial de cargos del censo normal
(`persona_id references personas(id) on delete cascade` en
`feligresia.sql`) — se corrigió a automático.

## Correción tras el primer intento real (falló en producción)

El usuario corrió el script y Postgres lo rechazó:
`cannot truncate a table referenced in a foreign key constraint —
Table "personas" references "familias"`. La verificación de nombres
de tabla no detecta este tipo de error (dirección de la referencia),
así que se escribió un segundo script que **mapea las 264 foreign
keys reales de todo el esquema** (parseando cada `create table` +
columnas `references`, no solo grepeando texto) y cruza: ¿alguna tabla
que se preserva tiene una columna apuntando a una tabla que se borra?
Postgres rechaza el `TRUNCATE` en ese caso sin importar el `ON DELETE`
configurado (CASCADE/SET NULL/RESTRICT no importan para TRUNCATE,
solo para DELETE).

Encontró 4 casos reales (el que ya había fallado, más 3 que no se
habían detectado a ojo):

- `personas.familia_id → familias` — `personas` no se trunca (solo se
  borra selectivo), así que se agregó
  `UPDATE personas SET familia_id = null ...` antes del TRUNCATE.
- `rangos_edad_comite.comite_id → comites` — esta tabla NO es un
  catálogo global del módulo como se asumió por el nombre; es hija
  directa (`on delete cascade`) de un comité específico. Se movió de
  "preservar" a "borrar".
- `escuela_dominical_lecciones.clase_id → escuela_dominical_clases` —
  mismo error de categorización: es la bitácora de sesiones de una
  clase (fecha, tema, asistentes), no el currículo. Se movió a
  "borrar".
- `mision_lecciones.grupo_id → mision_grupos` — mismo patrón, bitácora
  de sesiones de un grupo, no currículo. Se movió a "borrar".

Se rediseñó además la estructura del script: en vez de 5 bloques
`TRUNCATE` separados por categoría (que podían fallar entre sí si una
tabla de un bloque referenciaba una tabla de otro bloque posterior),
se unificó todo en **una sola sentencia `TRUNCATE table1, table2, ...`**
— Postgres resuelve las dependencias entre tablas incluidas en la
misma sentencia sin importar el orden en que se listen.

Verificado de nuevo con el mapeo completo de FKs tras la corrección:
116 tablas, 28 preservadas + 88 borradas = cobertura 100%, cero
referencias peligrosas restantes.

## Segunda corrección (el `UPDATE` previo no alcanzaba)

El usuario corrió el script corregido y volvió a fallar con el
**mismo error exacto** (`personas` references `familias`), a pesar de
haber agregado `UPDATE personas SET familia_id = null ...` antes del
`TRUNCATE`. Causa real: `TRUNCATE` en Postgres rechaza una tabla si
**existe el constraint** de foreign key apuntando a ella desde una
tabla que no se está truncando -- **sin importar si hay datos que lo
violen**. Poner la columna en `null` no cambia nada porque el
constraint sigue existiendo; `TRUNCATE` no hace el chequeo fila por
fila como sí hace un `DELETE` normal con `ON DELETE SET NULL`.

**Solución correcta**: sacar `familias` de la lista del `TRUNCATE` y
borrarla aparte con un `DELETE FROM familias;` normal, después del
`TRUNCATE` (cuando `familia_miembros` y las demás tablas que
referencian `familias` ya están vacías) y antes del
`DELETE FROM personas ...` final. Un `DELETE` sí respeta
`ON DELETE SET NULL` fila por fila sin la restricción estructural de
`TRUNCATE`. Se verificó con el mismo mapeo de FKs que ninguna otra
tabla del `TRUNCATE` tiene este problema (solo `familias` lo tenía) y
que todo lo demás que referencia a `familias` (`familia_miembros`,
`familia_amigos`, `obra_social_casos`,
`obra_carcelaria_seguimiento_familiar`, `red_familias_casos`,
`red_familias_visitas`) ya está vacío por el `TRUNCATE` antes de
llegar a ese `DELETE`, así que no hay nada que cascadear.

## Tercer hallazgo: Damil Lerma no tiene `auth_user_id` todavía

El script corrigió el `TRUNCATE`, pero al correr `DELETE FROM personas
WHERE auth_user_id IS NULL` Postgres lo rechazó por una violación real
de foreign key: `roles_sistema` todavía referencia una de esas
personas. Como ambas sentencias van dentro del mismo `BEGIN`/`COMMIT`,
**la transacción completa se revirtió sola** — no se borró nada, ni lo
que parecía haber funcionado antes.

Se escribió `reset_lanzamiento_diagnostico_roles_huerfanos.sql`
(solo lectura) para identificar el registro exacto antes de asumir
nada. Resultado: es el pastor **Damil Lerma** (persona real, ya
confirmada por el usuario en una pregunta anterior) — tiene un rol
`local` activo en `roles_sistema` para PUERTO TEJADA CAUCA CENTRAL
desde 2026-09-01, pero **todavía no completó su cuenta de acceso**, así
que su `auth_user_id` sigue en `null`. La regla automática
(`auth_user_id IS NULL` = seguro de borrar) asumía que nadie real
estaría en esa situación, y en este caso sí lo estaba.

Se corrigió el `DELETE FROM personas` para excluir explícitamente ese
`id` (`454d7953-fc79-44da-99eb-b88dd3d3896b`), con el mismo ajuste en
el blindaje de `pastores`. Verificado que el diagnóstico solo devolvió
esa una fila (no hay más casos iguales).

## Paso 1: EJECUTADO CON ÉXITO (2026-11-01)

El usuario corrió `reset_lanzamiento_paso1_actividad.sql` (con las 3
correcciones ya documentadas arriba) y terminó sin errores. Confirmó
login funcionando con cuenta real.

## Paso 2: directorio de pastores revisado

El usuario corrió `reset_lanzamiento_paso2_ver_pastores.sql` (solo
lectura). Resultado: 3 filas en `pastores`.

- **Damil Lerma** (PUERTO TEJADA CAUCA CENTRAL) — real.
- **Carlos Alberto Diaz Gonzalez** (SUCRE CAUCA) — real.
- **Carlos Andres Sanchez Mina** (AGUA BONITA SUAREZ CAUCA) — de
  prueba. El usuario aclaró que **la congregación completa** (no solo
  el pastor) es de prueba ("todo es prueba desde su perfil hasta su
  pastor") -- esto amplió el alcance del paso 3 más allá de solo
  limpiar el directorio distrital.

## Cuarto y quinto hallazgo: borrar una congregación entera no es trivial

Al investigar qué hacía falta para borrar "AGUA BONITA SUAREZ CAUCA"
completa (no solo su fila en `pastores`), se encontraron 2 problemas
más del mismo patrón que `familias`/Damil Lerma -- `congregaciones` es
referenciada por **17 tablas que se preservaron deliberadamente**
(estructura/catálogos/acceso), y varias de ellas tienen relación
`RESTRICT` (sin `ON DELETE`), no `CASCADE`:

- Diagnóstico (`reset_lanzamiento_diagnostico_agua_bonita.sql`, solo
  lectura) mostró que esa congregación todavía tenía: 4 `modulos`, 9
  `categorias_demograficas`, 1 fila en `catalogo_congregaciones_ipuc`,
  **1 `personas` y 1 `roles_sistema`** -- esta última pareja fue la
  sorpresa real.
- Esa persona **sobrevivió al `DELETE` del paso 1** (que solo borra
  personas sin `auth_user_id`), lo que significaba que tenía cuenta de
  login real. Un segundo diagnóstico
  (`reset_lanzamiento_diagnostico_agua_bonita_persona.sql`) confirmó
  que es la misma persona del `pastores` de prueba: **Carlos Andres
  Sanchez Mina, andresanchezw916@gmail.com**, con sesión real (último
  login 2026-09-16).

Se verificó exhaustivamente (mismo método del mapeo de 264 FKs) cuáles
de las 17 tablas son `RESTRICT` vs `CASCADE` antes de escribir nada:
`modulos`, `categorias_demograficas`, `roles_sistema`, `personas`
(`congregacion_id`) son `RESTRICT` -- se borran explícitamente para
esta congregación en el paso 3. `zonas` y `etapas_seguimiento` ya
estaban en 0. `catalogo_congregaciones_ipuc` es nullable sin cascada
-- se desvincula (`UPDATE ... SET congregacion_id = null`) en vez de
borrarse, porque es el catálogo nacional oficial IPUC, no datos de
prueba. El resto (`suscripciones`, `configuracion_congregacion`,
`asignaciones_acceso`, `caracteres_culto`, `tipos_comite`,
`discipulado_lecciones`, `refam_lecciones`, `esfob_lecciones`,
`asignaciones_pastorales`, `personas.congregacion_bautismo_id`) es
`CASCADE` o `SET NULL` -- se resuelve solo al borrar la congregación.

## Paso 3: PENDIENTE DE EJECUTAR (`reset_lanzamiento_paso3_agua_bonita_y_pastor_prueba.sql`)

Orden exacto del script: (1) borra el `pastores` de prueba -- cascada
a `asignaciones_pastorales`/`historial_licencias_pastorales`/
`formacion_pastoral`; (2) borra su `roles_sistema`; (3) borra su
`personas`; (4) borra `modulos` y `categorias_demograficas` de esa
congregación; (5) desvincula (no borra) el catálogo IPUC; (6) borra la
congregación misma, que arrastra en cascada todo lo demás.

**IDs confirmados** (ya en el script, no hace falta volver a
buscarlos): congregación `edbe675d-fbd4-4ad0-a8b6-534994aa5e3f`,
persona `aaae26e0-d554-4e6d-a6e9-adafeeb7a241`, pastor
`a3e518b9-c785-4815-82af-44a3e5a962e2`.

**Importante**: el script NO puede borrar la cuenta de Supabase
Authentication de `andresanchezw916@gmail.com` (`auth_user_id`
`bbc08d2f-f9d0-48f8-818a-3f75cbf1ecb8`) -- eso requiere el panel de
Supabase (Authentication → Users → buscar el correo → Delete user),
paso manual aparte, después de correr el SQL.

## CERRADO (2026-11-05)

El usuario confirmó que `reset_lanzamiento_paso3_agua_bonita_y_pastor_prueba.sql`
corrió sin errores. La congregación de prueba "AGUA BONITA SUAREZ
CAUCA" y su pastor de prueba (Carlos Andres Sanchez Mina) quedaron
eliminados por completo. Las dos congregaciones reales (PUERTO TEJADA
CAUCA CENTRAL con el pastor Damil Lerma, y SUCRE CAUCA con el pastor
Carlos Alberto Diaz Gonzalez) prevalecen intactas, igual que el censo
real (super_admin + Damil Lerma).

**Pendiente, sin bloquear nada**: borrar manualmente la cuenta
`andresanchezw916@gmail.com` desde Authentication → Users en el panel
de Supabase (el script no puede tocar `auth.users` directamente) --
queda como tarea suelta del usuario, no afecta el resto del sistema
mientras tanto.

Con esto, el lanzamiento queda con los datos reales únicamente. El
patrón de "mapear las FKs reales antes de borrar, nunca a ojo" que
salió de este ejercicio motivó directamente el diseño de la política
de eliminación de congregaciones con periodo de gracia -- ver
`docs/funcionalidades/eliminacion_congregacion_periodo_gracia.md`.
