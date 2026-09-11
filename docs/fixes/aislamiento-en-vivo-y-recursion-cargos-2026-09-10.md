# Prueba de aislamiento en vivo + recursión RLS en cargos (2026-09-10)

## Prueba de aislamiento en vivo

Con dos congregaciones reales del usuario (no datos de prueba
descartables) -- "AGUA BONITA SUAREZ CAUCA" y "PUERTO TEJADA CAUCA
CENTRAL", ambas del mismo distrito pero con pastores distintos e
independientes (sin rol distrital/nacional que las hiciera ver todo) --
se ejecutó la matriz de `docs/arquitectura/matriz-pruebas-rls.md` de
punta a punta:

- Lecturas cruzadas sobre `personas`, `amigos`, `familias`, `comites`,
  `registros_actividad`, `sepri_solicitudes_evento`,
  `solicitudes_jerarquicas`, `vw_alertas_pastorales`,
  `vw_resumen_feligresia`: **0 filas en los 8 casos, en ambas
  direcciones.**
- INSERT directo de una persona en la congregación ajena: **rechazado
  explícitamente** por RLS ("new row violates row-level security
  policy").
- UPDATE dirigido a una fila específica de la congregación ajena: no
  se pudo ni identificar una fila objetivo (el aislamiento de lectura
  ya lo impide), nada que actualizar.
- Sin residuos de prueba en ninguna de las dos congregaciones al
  terminar.

**Aislamiento entre congregaciones: confirmado con datos e identidades
reales, cero fugas.** Cierra el último punto pendiente del checklist
de seguridad de producción de esta ronda
(ver [[project_siga_verificacion_produccion_2026_09_10]]).

## Hallazgo real durante la prueba: recursión RLS en `cargos`/`asignaciones_cargo`

Al probar específicamente el punto crítico corregido antes
(`rotar_asignacion_cargo`), cualquier lectura de `cargos` o
`asignaciones_cargo` -- incluso sin ningún filtro ni join -- fallaba
con **"infinite recursion detected in policy for relation cargos"**.

Causa: `supabase/pwa/rls_cargo_pwa.sql` (que habilitó el acceso de
capturadores PWA por cargo, sin rol de pastor) introdujo una política
`cargos_select_propio` con una subconsulta directa sobre
`asignaciones_cargo`, que a su vez tiene una política
(`asignaciones_cargo_scope`) que hace JOIN de vuelta a `cargos` --
ciclo infinito. **Este problema ya había sido diagnosticado y
corregido en el propio repositorio** (`hotfix_recursion_cargos.sql`,
que envuelve la verificación en una función `security definer` para
romper el ciclo) -- pero **ese archivo nunca se había ejecutado en la
base de datos real**, solo el archivo que introdujo el problema.

**Impacto real, ya en producción antes de este fix**: "Equipo de
trabajo" (`src/pages/EquipoCongregacion.jsx:68`, la pantalla donde un
pastor ve y gestiona quién tiene cada responsabilidad operativa)
fallaba al cargar la lista de asignaciones activas. La misma
recursión afecta el arranque de la PWA para cualquier capturador que
entra únicamente con un cargo (sin rol de pastor) -- ujieres,
evangelistas, delegados de Obra Carcelaria sin acceso web.

**Corregido**: el usuario ejecutó
`supabase/pwa/hotfix_recursion_cargos.sql` (ya existía en el repo, no
requirió código nuevo). Verificado con las mismas 4 consultas que
antes recursaban, incluida la consulta real y exacta de
`EquipoCongregacion.jsx` -- las 4 devuelven datos correctamente ahora.

## Lección para el futuro

Un archivo de "hotfix" separado del archivo principal es fácil de
pasar por alto al ejecutar migraciones -- vale la pena, en piezas
futuras que requieran dos archivos en secuencia inmediata, considerar
fusionarlos en uno solo, o dejar más visible en `docs/pendientes.md`
que un hotfix específico sigue sin confirmarse ejecutado.
