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

Antes de escribir el script final se cruzaron dos listas (31 a
preservar, 85 a vaciar) contra los nombres reales de tabla extraídos
de todos los archivos `.sql` del repo, confirmando: cobertura 100%
(ninguna tabla sin categorizar), cero nombres de tabla inventados, cero
duplicados. Un error real se encontró y corrigió en el proceso:
`historial_cargos` se había puesto por error en el grupo "directorio
distrital de pastores" (manual) cuando en realidad es historial de
cargos del censo normal (`persona_id references personas(id) on
delete cascade` en `feligresia.sql`) — se corrigió a automático.

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
