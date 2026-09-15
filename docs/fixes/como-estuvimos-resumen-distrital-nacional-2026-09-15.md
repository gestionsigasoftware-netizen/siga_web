# "Cómo estuvimos" en Distrital y Nacional — 2026-09-15

## Contexto

Continuación de
[como-estuvimos-resumen-local-2026-09-14.md](como-estuvimos-resumen-local-2026-09-14.md),
que dejó pendiente explícitamente esta pieza: llevar la misma sección
"Cómo estuvimos" a los paneles distrital y nacional. El usuario
confirmó seguir adelante: "si, no hay problema, construyamos lo que
falta."

## Diferencia de alcance frente al rol local (decisión deliberada)

Local tiene un sistema de frecuencia seleccionable (semana/quincena/
mes/...) porque construye sus propios períodos a partir de registros
crudos con fecha. Distrital y nacional **no tienen esa granularidad**:
dependen de `resumen_distrital()`/`resumen_nacional()`, que ya traen
`asistencia_ultimo_mes`/`asistencia_mes_anterior` calculados como
ventana fija mensual. Construir un selector de frecuencia aquí habría
exigido una nueva capa de agregación SQL — se descartó por no ser
necesario: se usa la cadencia mensual fija que ya existe, sin inventar
nada nuevo en la base de datos.

## Construido

`src/pages/Dashboard.jsx`:

- **`DashboardDistrital`**: nuevo bloque de cálculo (`asistenciaMesActual`,
  `asistenciaMesAnteriorTotal`, `variacionMes`, `congregacionesConCrecimiento`,
  `verdictoDistrital`, `rankingCrecimientoDistrital`, `liderDistrital`),
  todo derivado de campos que `resumen_distrital()` ya devuelve — cero
  consultas nuevas. Nueva sección visual justo debajo del hero (mismo
  patrón visual que local: veredicto en una frase, insignia 🏆 opcional
  para la congregación líder del mes, 4 tarjetas: Asistencia del
  distrito, Congregaciones en crecimiento, Altas/Bajas (3 meses) con
  balance neto, Bautismos (3 meses)).
- **`DashboardNacional`**: mismo patrón, agregado por distrito
  (`asistenciaMesActual`, etc., sumando sobre `distritos` en vez de
  `congregaciones`). Insignia de logro nombra al distrito líder
  ("Distrito N · nombre").
- Ambas secciones solo se renderizan si hay al menos una
  congregación/distrito (`congregaciones.length > 0` /
  `distritos.length > 0`), igual que local se guarda con
  `registros.length > 0`.

**Corrección aplicada antes de dar por buena la lógica**: la primera
versión de `variacionPct` (usado para elegir el líder del mes) hacía
`anterior ? variación real : (actual > 0 ? 100 : null)` — es decir,
inventaba un "+100%" cuando el mes anterior estaba en cero. Se corrigió
a `anterior ? variación real : null`, igual que el patrón ya usado en
`variacion`/`variacionPromedio` del rol local: sin base de comparación
real, no se muestra ningún porcentaje (ni se otorga la insignia de
logro) en vez de fabricar un número.

## Verificación

Sin credenciales reales de distrital/nacional disponibles esta sesión
(igual que en piezas anteriores de BI para estos roles), se verificó
así:

1. Consulta directa a `resumen_distrital(p_distrito_id)` y
   `resumen_nacional()` autenticado como el pastor local real de
   Puerto Tejada (RLS los deja ver su propio distrito vía
   `mis_congregaciones()`) — confirmó datos reales: `asistencia_ultimo_mes:
   1403`, `asistencia_mes_anterior: 0`.
2. Con ese caso real de mes-anterior-en-cero, se confirmó en pantalla
   (parche temporal de enrutamiento, revertido antes de este commit)
   que: la tarjeta de asistencia NO muestra ninguna flecha/variación
   (correcto: sin base de comparación), el veredicto dice "Todas las
   congregaciones/distritos crecieron este mes" (hecho real: 1403 > 0),
   y la insignia 🏆 correctamente NO aparece (no hay porcentaje real
   que sustente un "líder").
3. Playwright con la cuenta real: cero errores de consola en ambas
   pantallas.
4. `npm run build` sin errores.

## Pendiente

Ninguno para esta pieza — queda cerrado el alcance dejado abierto en
la nota anterior.
