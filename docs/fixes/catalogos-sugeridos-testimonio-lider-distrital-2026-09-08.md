# Catálogos sugeridos a partir del testimonio de un líder distrital — 2026-09-08

## Contexto

Mismo testimonio real de líder distrital descrito en
`docs/fixes/reconciliacion-apartados-2026-09-08.md`. Comparado contra
el modelo de datos actual, dos catálogos ya configurables por
congregación (`evangelismo_metodologia_id` sobre `tipos_actividad`, y
`categorias_demograficas`) no tenían brecha estructural -- ya tienen
UI de administración completa -- pero sí de **estandarización
nacional**: cada congregación podía terminar nombrando lo mismo de
forma distinta, rompiendo la comparabilidad de reportes.

Se confirmó con el usuario que el catálogo de metodología de
evangelismo NO debe duplicar "carcelario"/"estudiantil" (son Obra
Carcelaria/Misión Juvenil con otro nombre).

## Construido

1. **`supabase/modulos/evangelismo.sql`**: se agregaron 3 modalidades
   sugeridas al seed idempotente existente (mismo patrón que "Culto
   en salón", 2026-09-05): "Evangelismo hospitalario", "Evangelismo
   en medios de comunicación", "Evangelismo en grupos especiales".
2. **`supabase/catalogos/poblaciones_especiales_demograficas.sql`**
   (nuevo): agrega retroactivamente "Población sorda" y "Población
   indígena / étnica" a `categorias_demograficas` de todas las
   congregaciones existentes que aún no tengan una categoría con ese
   nombre. Idempotente.
3. **`supabase/schema/schema.sql`** (`crear_congregacion_demo`): se
   agregaron las mismas dos categorías al seed de congregaciones demo,
   para que el set de referencia quede consistente.

## Hallazgo aparte, fuera de alcance

La función real de alta de congregaciones
(`crear_congregacion_con_pastor`, en
`supabase/distrital/gestion_distrital_congregaciones.sql`) no siembra
**ninguna** categoría demográfica por defecto -- una congregación real
nueva arranca hoy con ese catálogo completamente vacío (a diferencia
de `crear_congregacion_demo`). No se corrigió aquí por ser un alcance
mayor al pedido (sembrar el set base completo en el alta real, no solo
agregar 2 categorías sugeridas). Queda anotado para decidir aparte.

## Acción requerida del usuario

Ejecutar en el SQL Editor de Supabase, en este orden:
1. `supabase/modulos/evangelismo.sql` completo (repetible, ya lo era).
2. `supabase/catalogos/poblaciones_especiales_demograficas.sql` (nuevo).

## Verificación

No se puede probar contra la base real desde este entorno (son
bloques `do $$ ... $$`/DDL, no consultas del cliente) -- pendiente de
que el usuario los ejecute. Una vez ejecutados, verificar que
"Evangelismo hospitalario"/"en medios de comunicación"/"en grupos
especiales" aparezcan en el selector de metodología de
`Evangelismo.jsx`/`Amigos.jsx`, y que "Población sorda"/"Población
indígena / étnica" aparezcan en Configuración y en el selector de
categoría de `Amigos.jsx`.
