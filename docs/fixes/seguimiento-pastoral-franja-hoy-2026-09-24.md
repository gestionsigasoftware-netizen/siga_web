# Seguimiento pastoral: franja "Hoy" con el punto de partida

**Fecha:** 2026-09-24
**Módulo:** `src/pages/FeligresiaAdmin.jsx` -- `PastoralSection` (pestaña Seguimiento pastoral)

## Contexto

Continuación del fix de claridad de hoy mismo (bug de filtros +
InfoTips). Con esos arreglos, un pastor ya entiende qué es cada
sección -- pero seguía sin haber un único punto de partida: tenía que
leer "Agenda de acompañamiento" y "Alertas pendientes" por separado
para saber qué es lo más urgente. Se preguntó si la vista ya bastaba;
se identificó este hueco como la mejora pendiente y el usuario pidió
agregarla.

## Cambio

Nueva franja al inicio de la pestaña (antes de las dos secciones
existentes), calculada con datos que ya se cargaban -- sin ninguna
consulta nueva a Supabase:

- **Alertas de alta prioridad** (`alerts.filter(a => a.prioridad === 'alta')`).
- **Seguimientos vencidos** (`followups` con `estado === 'pendiente'` y
  `proxima_fecha` anterior a hoy).
- **Programados para hoy** (`proxima_fecha === hoy`).

Se calcula sobre las listas **completas**, no sobre lo que el pastor
tenga filtrado en ese momento en "Alertas pendientes" -- debe ser un
punto de referencia estable, no cambiar según el filtro activo.

Dos estados visuales: si hay algo urgente, franja roja con ícono de
alerta y el resumen ("2 alertas de alta prioridad · 1 vencido...");
si no hay nada urgente, franja verde "Estás al día". Siempre visible
(no se oculta cuando todo está en orden), para que sea un lugar fijo y
predecible donde revisar el estado general.

## Verificación

1. `npm run build` sin errores.
2. Verificación real con login (cuenta de prueba, rol local, datos
   reales) vía Playwright: la franja aparece en rojo con "2 alertas de
   alta prioridad" -- coincide con las alertas reales de esa
   congregación. Sin errores de consola.
