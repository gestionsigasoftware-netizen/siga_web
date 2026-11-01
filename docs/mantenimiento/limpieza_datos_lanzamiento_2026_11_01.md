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
referencias peligrosas restantes (la única real,
`personas.familia_id`, queda blindada explícitamente).

## Pendiente (acción del usuario, fuera de este commit)

1. Respaldo manual antes de correr nada.
2. Correr `reset_lanzamiento_paso1_actividad.sql` en el SQL Editor de
   Supabase.
3. Correr `reset_lanzamiento_paso2_ver_pastores.sql` (solo lectura) y
   decir cuáles filas de `pastores` son reales.
4. Con esa respuesta, se arma el DELETE dirigido del paso 3
   (`pastores`, `asignaciones_pastorales`,
   `historial_licencias_pastorales`, `formacion_pastoral`).
5. Verificar: login con cuenta de prueba sigue funcionando, conteos en
   cero, congregaciones intactas.
