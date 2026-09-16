# Crash en producción: `formatFecha` con objetos Date — 2026-09-16

## Contexto

El usuario reportó (con capturas de Sentry) que `sigap.com.co/app`
estaba cayendo con la pantalla "Algo salió mal" para cuentas reales.
Sentry (issue `JAVASCRIPT-REACT-3`, ID `e19bff01`) mostraba:

```
TypeError: e.includes is not a function
  at Ae (formatFecha, minificado)
```

## Causa

Este mismo día, más temprano, se corrigió un bug de zona horaria en
`formatFecha()` (`src/lib/dateFormat.js`): a las fechas sin hora se
les agrega `T00:00:00` para que no se interpreten como medianoche UTC
(lo que las mostraba un día atrás en Colombia). Ese arreglo llamaba
`value.includes('T')` asumiendo que `value` siempre es un string.

Pero `etiquetaRango()` (`src/pages/Dashboard.jsx:82-89`), usada en el
Resumen local para mostrar el rango de fechas del selector de periodo
("Ritmo de asistencia", "Lectura del periodo", "Evolución..."), le
pasa objetos `Date` ya construidos (`periodos[0].inicio` y
`new Date(fin)` con `.setDate()`), no strings. `Date` no tiene
`.includes()`, así que la primera vez que un usuario abría el
Resumen local después del despliegue del fix de zona horaria, la
página entera reventaba en el render.

## Arreglo

`formatFecha()` ahora acepta también un `Date` ya construido:
si `value instanceof Date`, lo convierte a ISO (`toISOString()`) y se
llama a sí misma recursivamente -- evita duplicar el formateo. Además
se agregó un guard genérico `typeof value !== 'string'` → `'Sin
datos'`, para que cualquier otro tipo inesperado (número, array,
objeto) nunca vuelva a tirar la página completa, ya que esta es una
función compartida usada en 12 archivos.

No se tocó `etiquetaRango()` en sí -- no hacía falta cambiar el
llamador porque el arreglo en la función compartida ya cubre el caso,
y es más seguro que cualquier otro llamador futuro con el mismo
patrón no vuelva a romper la app.

## Verificación

- `npm run build` sin errores.
- Script Node directo importando `formatFecha` con: string sin hora,
  string con hora, `Date` (equivalente al que rompía), `Date`
  desplazado con `.setDate()` (simulando exactamente `etiquetaRango`),
  `null`, `undefined`, número, array, objeto -- todos devuelven el
  resultado esperado o `'Sin datos'`, ninguno revienta.
- Caso puntual: `new Date(2026,8,1)` con `setDate(getDate()-1)` (31 de
  agosto) formatea correctamente a `31/08/2026`, confirmando que el
  round-trip por `toISOString()` no reintroduce el bug de zona
  horaria que se había corregido antes.
