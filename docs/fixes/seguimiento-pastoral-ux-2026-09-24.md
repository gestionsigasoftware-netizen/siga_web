# Seguimiento pastoral (Feligresía): bug real de filtros + claridad

**Fecha:** 2026-09-24
**Módulo:** `src/pages/FeligresiaAdmin.jsx` -- pestaña "Seguimiento pastoral" (`PastoralAgendaFilter`, `PastoralSection`, `PastoralFollowupPanel`)

## Contexto

Continuación del trabajo de hoy en Comités: el usuario pidió revisar
si un pastor que entra a Seguimiento pastoral entendería qué hace ese
submódulo.

## Bug real encontrado (no solo de redacción)

Los selects "Filtrar alertas por tipo" y "Filtrar alertas por
prioridad" estaban **visualmente** dentro de la tarjeta "Agenda de
acompañamiento", pero sus valores (`alertType`/`alertPriority`) solo
se usaban para filtrar `filteredAlerts`, que alimenta la tarjeta
**separada** "Alertas pendientes" más abajo. Un pastor que cambiara
esos filtros esperando que afectaran la Agenda no vería ningún cambio
ahí -- el efecto real ocurría en otra sección, sin relación visual
aparente. Corregido moviendo los dos selects a la cabecera de
"Alertas pendientes", donde sí aplican (confirmado con una prueba real
que verifica el `<section>` padre de cada select).

## Confusión de fondo: dos listas parecidas, sin explicar su origen

"Agenda de acompañamiento" y "Alertas pendientes" muestran tarjetas
muy similares (persona + acción + botones), pero son conceptualmente
distintas:
- **Agenda de acompañamiento** = seguimientos que el pastor registró
  a mano (desde la ficha de una persona).
- **Alertas pendientes** = SIGAP las genera solo, sin que nadie las
  agende, al detectar una situación (revisado en
  `fix_alertas_pastorales_gracia_ingreso.sql`: "Persona sin familia
  registrada", "Persona pendiente de bautismo", "Persona sin
  asistencia reciente", "Comité sin integrantes" -- textos ya claros
  en sí mismos, el problema era que no se explicaba de dónde salían).

Ninguna de las dos aclaraba esto, ni que **atender una alerta la
registra también en la Agenda** (confirmado leyendo
`saveAlertAttention`: inserta en `seguimientos_pastorales` Y cierra la
alerta). Se agregaron `InfoTip` explicando ambas cosas.

## Otros cambios

- `PastoralAgendaFilter` ("Agenda pastoral", lo primero que se ve en
  la pestaña): `InfoTip` que orienta sobre todo el submódulo antes de
  ver las dos secciones.
- El `InfoTip` que explicaba "Atender" vs "Confirmar contacto hoy"
  solo aparecía en alertas de tipo asistencia (repetido en cada
  tarjeta) -- se movió uno solo, junto al título "Alertas pendientes",
  aplicable a los 5 tipos de alerta.
- Diálogo "Atender alerta pastoral": placeholder real en "Acción
  realizada" y "Notas" (antes vacíos); "Notas" pasó a `textarea` (era
  un `<input>` de una sola línea); `InfoTip` en "Próximo contacto"
  explicando que al llenarlo el seguimiento queda pendiente, y vacío
  queda completado de una vez (verificado en el código real, no
  supuesto).
- `PastoralFollowupPanel` (panel de seguimiento manual desde la ficha
  de una persona): mismos placeholders reales (antes repetían el
  nombre del campo, ej. placeholder="Acción realizada" en el campo
  "Acción realizada" -- no ayudaba en nada), `InfoTip` en "Tipo de
  situación" (aclara que 'General' es la opción catch-all) y en
  "Próximo contacto" (misma explicación que arriba), y en el título
  del panel explicando qué hace y a dónde va lo que se registra.

## Verificación

1. `npm run build` sin errores.
2. Verificación real con login (cuenta de prueba, rol local) vía
   Playwright, con datos reales (1 seguimiento en agenda, 5 alertas
   reales): confirmado por DOM que los selects de tipo/prioridad ahora
   son hijos de la sección "Alertas pendientes", no de "Agenda de
   acompañamiento" -- el bug real quedó corregido, no solo maquillado.
   Captura de pantalla confirma el layout completo, los nuevos
   subtítulos y los íconos de `InfoTip`, sin errores de consola.
