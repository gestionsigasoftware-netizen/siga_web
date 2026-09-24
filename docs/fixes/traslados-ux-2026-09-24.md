# Traslados (Feligresía): 2 bugs reales + claridad

**Fecha:** 2026-09-24
**Módulo:** `src/pages/FeligresiaAdmin.jsx` -- pestaña "Traslados" y `MembershipMovementsPanel` (panel de la ficha de persona)

## Contexto

Continuación de la revisión de hoy (Comités, Seguimiento pastoral):
revisar si un pastor entendería el submódulo de Traslados.

## Bug 1: deep-link `?tab=traslados` no funcionaba

La pestaña "Traslados" **no estaba en la lista blanca** de tabs
válidos por parámetro de URL (`requestedTab`, usada para enlaces
directos desde notificaciones u otros lugares). Cualquier enlace a
`/feligresia?tab=traslados` caía silenciosamente en la pestaña por
defecto ("Población") en vez de abrir Traslados. Se detectó al
verificar el fix con Playwright -- la captura no coincidía con lo
esperado. Corregido agregando `'traslados'` a la lista
(`src/pages/FeligresiaAdmin.jsx:679`).

## Bug 2 (más importante): riesgo real de duplicar movimientos de membresía

Al revisar `MembershipMovementsPanel` (el formulario "Movimientos de
membresía" en la ficha de cada persona) se encontró que **4 de los 7
tipos de movimiento ya se registran automáticamente en otro lugar**:

- `baja_traslado` / `alta_recibimiento`: los crea
  `solicitar_traslado_persona()` / `recibir_traslado_persona()`
  (verificado leyendo `supabase/distrital/traslados_feligresia.sql`
  líneas 84-85 y 121-122) -- es decir, el flujo real de "Trasladar a
  otra congregación" / "Recibir" en la pestaña Traslados.
- `baja_fallecimiento`: lo crea `marcarFallecido()` (línea 1091 de
  este mismo archivo).
- `reactivacion`: lo crea `reconciliarPersona()` (línea 988).

Si un pastor no sabe esto y agrega manualmente uno de estos mismos
tipos en "Movimientos de membresía" para un caso que ya pasó por su
flujo dedicado, **se duplica el registro** en la auditoría de
estadísticas -- un error silencioso, sin ningún aviso. Solo
`alta_bautismo`, `baja_disciplina` y `baja_exclusion` genuinamente
necesitan registrarse a mano aquí (no tienen flujo automático en
ningún lado del código).

Corregido con un `InfoTip` explícito en el título "Movimientos de
membresía" que nombra los 4 tipos ya automáticos y para qué casos sí
sirve el formulario manual.

## Otros cambios (claridad)

- **Pestaña Traslados**: nota al inicio aclarando que solo muestra
  traslados **ya en curso** y dónde iniciar uno nuevo (Población →
  ficha de la persona → "Trasladar a otra congregación") -- antes no
  había ninguna pista de dónde empezar, la pestaña solo mostraba dos
  listas de pendientes.
- **Panel "Trasladar a otra congregación"**: placeholder real en
  "Observaciones" (antes "Observaciones (opcional)", repetía el
  nombre del campo); nota nueva explicando que el traslado queda
  pendiente hasta que la otra congregación lo reciba, y que se puede
  cancelar mientras tanto.
- **"Movimientos de membresía"**: placeholder real en "Observaciones"
  (antes solo "Observaciones").

## Verificación

1. `npm run build` sin errores.
2. Verificación real con login (cuenta de prueba, rol local) vía
   Playwright:
   - `?tab=traslados` ahora carga la pestaña correcta (antes no --
     bug confirmado y corregido, no solo supuesto).
   - Los placeholders nuevos aparecen exactamente con el texto
     esperado, tanto en el panel de traslado como en el de
     movimientos (verificado abriendo la ficha real de una persona y
     entrando a su pestaña "Movimientos").
   - Sin errores de consola ni de página en ningún punto.
