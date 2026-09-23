# Reportes: dropdown de congregaciones mostraba todo el país -- 2026-09-23

## Reporte original del usuario

Captura real de `/reportes`, vista activa "Congregación: Puerto Tejada
Cauca Central" (rol local): el filtro "Filtrar por congregación"
mostraba "Todas las congregaciones" con la lista completa del país,
cuando debería mostrar solo la suya.

## Diagnóstico

Mismo patrón exacto ya corregido hoy en `AuditoriaFeligresia.jsx`
(ver `docs/fixes/auditoria-feligresia-fuga-multi-rol-2026-09-23.md`):
la cuenta del usuario tiene más de un rol (super_admin + local Puerto
Tejada). `ReportesOptimizado.jsx` poblaba el `<select>` de
congregaciones con:

```js
supabase.from('congregaciones').select('id, nombre').order('nombre')
```

Sin ningún filtro explícito, confiando solo en RLS
(`congregaciones_select`: `id in (select mis_congregaciones())`), que
para esta cuenta devuelve el país entero por ser super_admin, sin
importar que la vista activa fuera local.

**A diferencia de Auditoría, aquí los datos del reporte en sí (KPIs,
gráficos, tabla de detalle) ya estaban bien acotados** -- el resto del
archivo sí pasa `congregacionId` (el de `rolPrincipal`, el rol activo)
tanto al RPC `resumen_reportes` como al filtro de
`registros_actividad`. Lo único expuesto era la LISTA del selector
(nombres de todas las congregaciones del país, visibles a un pastor
local), no las cifras de asistencia de otras congregaciones.

**Gap estructural encontrado de paso, no explotable desde la UI normal
pero sí documentado**: la función `resumen_reportes(p_congregacion_id,
p_desde)` solo acepta un `congregacion_id` opcional -- no un
`distrito_id`. Su única restricción real para nivel distrital/nacional
es `r.congregacion_id in (select mis_congregaciones())` dentro de la
propia función SQL. Para una cuenta de un solo rol esto es correcto,
pero para una cuenta multi-rol viendo "como" distrital, esa función
seguiría permitiendo el alcance más alto real de la cuenta (ej. país
entero si también es nacional/super_admin), igual que le pasaba a
Auditoría. **No se corrigió en esta sesión** porque requeriría cambiar
la firma de la función SQL (otra migración) y no hay cuenta de prueba
distrital multi-rol para verificarlo; queda documentado como pendiente.

## Corrección

`src/pages/ReportesOptimizado.jsx`:
- El `<select>` de congregaciones ahora se arma con un filtro explícito
  según `rolPrincipal.nivel`:
  - `local` → `.eq('id', congregacionId)` (una sola opción: la propia).
  - `distrital` → `.eq('distrito_id', rolPrincipal.distrito_id)`.
  - `nacional` / `super_admin` → sin filtro (alcance legítimo).
- De paso, se añadió el mismo filtro explícito por distrito a la
  consulta de detalle (`registros_actividad`) para el caso distrital,
  usando `congregaciones!inner(distrito_id)` + `.eq(...)` (mismo
  patrón ya usado en `Dashboard.jsx`/`PastoralDistrital.jsx` y en el
  fix de Auditoría de hoy) -- por consistencia, aunque el caso
  reportado era solo local.
- Se agregó `rolPrincipal?.nivel` y `rolPrincipal?.distrito_id` a las
  dependencias del `useCallback` de carga, que antes no las incluía.

Sin cambios de SQL/RLS -- corrección puramente de frontend.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`, rol local, Puerto Tejada): el nuevo query del
  dropdown devuelve únicamente Puerto Tejada Cauca Central.
- Confirmado en vivo que el embed `congregaciones!inner(distrito_id)`
  con filtro por `distrito_id` no produce ningún error de PostgREST.
- No verificado con clics reales el caso distrital (no hay cuenta de
  prueba con ese rol).

## Pendiente relacionado

Extiende el pendiente ya anotado en el fix de Auditoría: revisar
sistemáticamente el resto de pantallas/RPCs que solo confíen en RLS
sin filtro explícito por `rolPrincipal`. Puntualmente,
`resumen_reportes()` necesitaría un `p_distrito_id` propio si se
quiere cerrar del todo el caso distrital multi-rol.
