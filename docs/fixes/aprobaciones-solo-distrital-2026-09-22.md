# Aprobaciones: solo distrital (y super_admin), no nacional -- 2026-09-22

## Pregunta original del usuario

> "estoy revisando sigap en la web y me encuentro, que tanto el rol
> distrital como nacional tienen el mismo módulo de aprobaciones, eso
> quiere decir, que los dos pueden aprobar una congregación que se creó
> nueva, suspenderla o eliminarla?"

## Diagnóstico

Sí. `src/pages/Aprobaciones.jsx` usaba `ALLOWED_LEVELS = ['distrital',
'nacional', 'super_admin']` y la consulta no filtraba por distrito en
el propio código (`select * from congregaciones order by created_at`).
El filtro real vivía solo en RLS:

- `congregaciones_select`: `id in (select mis_congregaciones())` --
  distrital ve solo su distrito, nacional/super_admin ven el país
  entero (`mis_congregaciones()` incluye `where es_super_admin() or
  es_nacional()`).
- `congregaciones_update_distrital` (aprobar/suspender/reactivar):
  `distrito_id in (select mis_distritos()) or es_super_admin() or
  es_nacional()`.
- `anular_congregacion()` (deshacer creación por error): mismo chequeo
  duplicado dentro de la función.

Es decir: para una congregación nueva de cualquier distrito, tanto el
líder distrital de ese distrito como cualquier usuario nacional (o
super_admin) podían aprobarla, suspenderla o anularla. Era
intencional por diseño original (nacional con supervisión total,
igual que en dashboards y reportes), pero el usuario decidió que
**aprobar/suspender/anular congregaciones es una decisión exclusiva
del distrital** -- nacional no debe poder decidir eso, aunque siga
viendo los datos consolidados del país en sus reportes.

De paso se encontró un hueco de trazabilidad real: la columna
`congregaciones.aprobada_por uuid references auth.users(id)` existe en
el esquema desde el inicio, pensada exactamente para registrar quién
aprobó, pero `actualizarEstado()` nunca la llenaba -- solo guardaba
`aprobada_en` (la fecha, no el usuario).

## Corrección

**Frontend:**
- `src/pages/Aprobaciones.jsx`: `ALLOWED_LEVELS = ['distrital',
  'super_admin']` (se quitó `'nacional'`). `actualizarEstado()` ahora
  guarda `aprobada_por: user?.id ?? null` (via `useAuth()`) junto con
  `aprobada_en`.
- `src/components/layout/Sidebar.jsx`: el ítem "Aprobaciones" ya no se
  muestra para `nivel === 'nacional'`.
- `src/pages/Manual.jsx`: se quitó la entrada "Aprobaciones" de la
  sección "Supervisión" del manual de nacional (documentaba un módulo
  que ya no tiene).

**Base de datos** (defensa en profundidad -- aunque el frontend ya
bloquea el acceso, la RLS debe reflejar lo mismo para que no exista un
camino directo vía API/RPC):
- `supabase/schema/schema.sql`: política `congregaciones_update_distrital`
  ya no incluye `es_nacional()`.
- `supabase/distrital/anular_congregacion.sql`: la función ya no
  incluye `es_nacional()` en su chequeo de permisos.
- `supabase/distrital/fix_aprobaciones_solo_distrital.sql` (nuevo):
  migración autocontenida y repetible con ambos cambios, para correr
  en el SQL Editor de Supabase contra producción real -- **pendiente
  de ejecutar**, ver `docs/pendientes.md`.

**Lo que NO se tocó a propósito:** `mis_congregaciones()` y la
política `congregaciones_select` siguen incluyendo a nacional -- esa
es la visibilidad que usan dashboards, reportes y "Visión país", y no
es lo que el usuario pidió cambiar. Solo se quitó la capacidad de
*decidir* el estado de una congregación, no la de *verla*.

## Verificación

- `npm run build` sin errores tras los cambios de frontend.
- No se pudo probar en vivo con clic real de un usuario nacional (no
  hay cuenta de prueba con ese rol) -- verificado por código: el
  guard `ALLOWED_LEVELS.includes(rolPrincipal?.nivel)` en
  `Aprobaciones.jsx` ya no admite `'nacional'`, mismo patrón usado y
  confirmado en otras pantallas con guard de rol.
- **Falta ejecutar el SQL en producción** para que la restricción
  también aplique a nivel de base de datos (RLS), no solo en la
  interfaz.

## Riesgo aceptado, no bloqueante

No hay riesgo de corrupción de datos por la superposición histórica
(quien actuara primero simplemente fijaba el `estado`, sin condición
de carrera dañina). El único hueco real era de trazabilidad
(`aprobada_por` sin llenar), ya corregido.
