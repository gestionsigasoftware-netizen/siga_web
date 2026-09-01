# Corrección: hueco de RLS en Escuela Dominical y Damas Dorcas (2026-09-01)

## Origen

Al diseñar la RLS de Obra Carcelaria se notó que
`supabase/escuela_dominical_damas_dorcas.sql` usaba un patrón de lectura
distinto: solo concedía acceso vía `tiene_permiso()`, sin ningún bypass
para distrital/nacional/super_admin. El usuario pidió confirmar si el
hueco era real y corregirlo de serlo.

## Confirmación (lectura exhaustiva de código, sin adivinar)

- `grep` de `escuela_dominical_clases|escuela_dominical_ninos|damas_dorcas_beneficiarias|damas_dorcas_actividades`
  en todo `supabase/` confirma que **solo** `escuela_dominical_damas_dorcas.sql`
  define políticas para estas tablas — no hay ninguna otra política en el
  proyecto que amplíe el acceso.
- `tiene_permiso(p_congregacion_id, p_permiso)` (definida en ese mismo
  archivo) solo evalúa dos casos: un grant explícito en
  `asignaciones_acceso`, o el pastor local implícito (`roles_sistema.nivel
  = 'local'` **para esa congregación exacta**). Nunca considera
  `nivel = 'distrital'`, `'nacional'` ni `'super_admin'`.
- Las políticas de lectura originales eran:
  `congregacion_id in (select mis_congregaciones()) and tiene_permiso(...)`.
  `mis_congregaciones()` sí incluye todas las congregaciones del distrito
  para un rol distrital (y todas las del país para nacional/super_admin),
  pero como la condición está unida con **and**, ese alcance más amplio no
  sirve de nada si `tiene_permiso()` da `false`.
- `resumen_escuela_dominical_distrital()` y `resumen_damas_distrital()`
  son `security invoker`: corren con los privilegios del que llama, así
  que quedan sujetas a esa misma RLS.

**Conclusión: para cualquier congregación donde el coordinador distrital
(o nacional/super_admin) no sea también pastor local o no tenga un grant
manual en `asignaciones_acceso`, el consolidado distrital de Escuela
Dominical y Damas Dorcas devolvía 0 en todas las columnas, aunque esa
congregación sí tuviera datos reales.** El hueco no se detectó al construir
esos módulos porque la única cuenta de prueba disponible tiene su rol
distrital y su rol local sobre la **misma** congregación (única en su
distrito de prueba) — ese caso particular nunca activa el hueco, porque
la condición del pastor local implícito ya lo cubre.

No fue posible reproducir el síntoma en vivo con la cuenta de prueba
actual (solo administra una congregación en su distrito, y para fabricar
el caso hace falta una segunda congregación con datos reales donde esa
cuenta NO sea pastora — eso requiere insertar datos vía SQL Editor, que
solo el usuario puede ejecutar). La corrección se basa en lectura completa
y determinística del código, no en una prueba en vivo.

## Corrección aplicada

Se agregó a las 8 políticas de lectura (`escuela_dominical_clases_read`,
`_ninos_read`, `_maestros_read`, `_lecciones_read`, `_asistencia_read`,
`damas_dorcas_beneficiarias_read`, `_actividades_read`, `_asistencia_read`)
el mismo bypass ya usado en `obra_carcelaria.sql` y en `amigos_select`
(`schema.sql`):

```sql
or es_super_admin() or es_nacional()
or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
```

**Solo se tocó lectura, no escritura** — un distrital debe poder *ver* el
consolidado de todas las congregaciones de su distrito, pero seguir sin
poder editar los datos de una Escuela Dominical o Damas Dorcas que no es
la suya (esa es tarea del pastor local). Es el mismo criterio ya aplicado
en Obra Carcelaria.

El archivo sigue siendo idempotente (`drop policy if exists` +
`create policy`), así que **hay que volver a ejecutar el archivo completo
`supabase/escuela_dominical_damas_dorcas.sql` en el SQL Editor** para que
la corrección quede aplicada en la base de datos real — no es necesario
ningún script nuevo, es el mismo archivo ya usado antes, con las políticas
de lectura corregidas.

## Impacto

Cambio puramente aditivo (amplía acceso, no lo restringe) — no debería
romper nada de lo que ya funcionaba. Beneficia directamente al Dashboard
distrital y a las tablas "Escuela Dominical por congregación" / "Damas
Dorcas por congregación" en Pastoral Distrital, que en producción real
(distritos con más de una congregación, cada una con su propio pastor)
mostrarán los números reales en vez de ceros.
