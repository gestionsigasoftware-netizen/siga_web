# Encabezado duplicado en "Evolución mensual · Participación por categoría" — 2026-09-09

## Contexto

El usuario reportó, con una captura del Resumen del Dashboard, que el
título "EVOLUCIÓN MENSUAL / Participación por categoría" aparecía dos
veces seguidas sobre el mismo gráfico.

## Hallazgo

No era un problema de datos ni de la nueva categoría "Población
sorda"/"Población indígena / étnica" agregada el día anterior -- era
un bug real de marcado: en `src/pages/Dashboard.jsx` (línea 1130-1131)
había dos `<div>` de encabezado consecutivos para el mismo gráfico,
uno sin el rango de fechas y otro con él (`Asistencias registradas ·
{etiquetaRango(...)}`). Todo indica que quedó un remanente de una
edición anterior que agregó el rango de fechas sin borrar la versión
vieja del encabezado.

## Construido

Se eliminó el `<div>` duplicado, dejando solo la versión que incluye
el rango de fechas.

## Verificación

`npm run build` sin errores.
