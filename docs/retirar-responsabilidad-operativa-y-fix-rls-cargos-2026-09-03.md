# Retirar responsabilidad operativa + hotfix de recursión RLS (2026-09-03)

## Contexto

Trabajando en la alineación de la PWA (`siga-pwa-nacional`) con Obra
Carcelaria, se detectó un hueco de seguridad real: el mecanismo de
"cargo → acceso a la PWA" nunca funcionó de verdad a nivel de RLS para
capturadores sin rol de pastor (ver
`docs/rls_cargo_pwa.sql` y el análisis completo en la conversación — no
se repite aquí). Se corrigió con `supabase/rls_cargo_pwa.sql`.

## Incidente: recursión infinita tras aplicar el fix (resuelto)

Al ejecutar `rls_cargo_pwa.sql`, la policy nueva `cargos_select_propio`
hacía una subconsulta **directa** sobre `asignaciones_cargo` dentro de su
`using`. Pero la policy original `asignaciones_cargo_scope` (de
`migracion_produccion.sql`) hace `JOIN` de vuelta a `cargos` — al
evaluar cualquier policy de `cargos`, Postgres evalúa TODAS las policies
de esa tabla (incluida la nueva), que vuelve a consultar
`asignaciones_cargo`, que vuelve a evaluar las policies de `cargos`... 
ciclo infinito (`42P17 infinite recursion detected in policy for
relation "cargos"`). Esto rompió el acceso de **todas** las cuentas a la
PWA (no solo la de prueba) mientras estuvo activo.

**Corrección**: `supabase/hotfix_recursion_cargos.sql` reemplaza esa
policy para usar una función `security definer`
(`tengo_este_cargo(p_cargo_id)`) en vez de la subconsulta directa —
mismo patrón que ya usaban el resto de las policies nuevas de
`rls_cargo_pwa.sql`, a esta se le pasó por alto. Ya ejecutado y
verificado: el error 500 desapareció y las asignaciones reales volvieron
a leerse correctamente.

**Lección para futuras policies RLS de este proyecto**: cualquier policy
que necesite consultar OTRA tabla con RLS propia debe hacerlo a través de
una función `security definer` (que no reactiva RLS del rol invocador),
nunca con una subconsulta directa en el `using`/`with check` — si esa
otra tabla tiene, a su vez, una policy que consulta de vuelta a la
primera, se genera recursión infinita. Es exactamente el patrón que ya
usa `mis_congregaciones()`, `tiene_permiso()`, etc. en este proyecto.

## Hallazgo que motivó el segundo cambio: no había forma de retirar un cargo

Al probar el fix con la cuenta de prueba (pastor de Puerto Tejada Cauca
Central), se descubrió que esa cuenta tenía **dos** responsabilidades
operativas activas (Ujieres, de una prueba anterior, y Obra Carcelaria,
recién asignada) — y no existía ninguna forma en la web de verlas ni
retirarlas. `EquipoCongregacion.jsx` solo mostraba y permitía retirar el
**perfil de acceso web** (`asignaciones_acceso`, con el botón "Retirar
perfil" ya existente) — nada tocaba `asignaciones_cargo`.

## Corrección: sección "Responsabilidades operativas" en Equipo de trabajo

**`src/pages/EquipoCongregacion.jsx`**:

- `load()` ahora también trae las `asignaciones_cargo` activas de la
  congregación (`cargos!inner(nombre_cargo, modulos!inner(nombre_modulo,
  congregacion_id))`, filtrado por `congregacion_id` del módulo — la
  tabla no tiene esa columna directamente, se filtra por la relación
  anidada), con el nombre de la persona resuelto igual que ya se hace
  para `asignaciones_acceso`.
- Nueva sección **"Responsabilidades operativas"**, debajo de "Perfiles
  activos", mismo patrón visual: persona, módulo asignado, fecha de
  inicio, botón **"Retirar"**.
- `endCargoAssignment(assignment)`: pone `fecha_fin` en la fila de
  `asignaciones_cargo` (igual que `endAssignment` ya hacía para el
  perfil web) — conserva el historial, no borra la fila. La policy RLS
  existente (`asignaciones_cargo_scope`, sin tocar) ya permite este
  UPDATE para quien administra su propia congregación.

## Verificación

`npm run build` corre limpio. Con Playwright y la cuenta de prueba: la
nueva sección mostró correctamente las dos responsabilidades activas de
Jhan Sanchez (Ujieres desde 2026-09-02, Obra Carcelaria desde
2026-09-03) más la de otra persona (Carlos Mina, Ujieres). Se retiró
Ujieres desde la web, se confirmó el mensaje de éxito y que la fila
desapareció de la lista. Se verificó en la PWA (mismo login) que Ujieres
pasó a "Sin acceso asignado" mientras Obra Carcelaria se mantuvo activa
-- exactamente el comportamiento esperado.

## Acción requerida del usuario

Ninguna adicional en base de datos (el hotfix de recursión y el fix de
RLS de cargos ya están aplicados). Falta hacer commit y push de este
cambio del proyecto **web** cuando quieras.
