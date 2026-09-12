# Resumen de super_admin orientado al negocio — 2026-09-12

## Contexto

El usuario pidió explícitamente: el rol super_admin no trabaja con
los datos pastorales de la IPUC (feligresía, comités, etc. — eso lo
usan local/distrital/nacional), sino con el negocio de SIGAP. Su
"Resumen" debería mostrar analítica del núcleo del negocio:
congregaciones activas/no activas, en mora, próximas a vencer, y
nuevas. Sigue directamente el principio ya establecido en
`feedback_super_admin_vs_nacional` (memoria de proyecto).

## Diagnóstico

`src/pages/Dashboard.jsx` enrutaba a super_admin exactamente al mismo
componente que nacional (`DashboardNacional`): pirámide poblacional,
sellados, comparativa de distritos por feligreses -- ninguna de esas
cifras es relevante para operar el negocio SIGAP.

## Construido

Nuevo componente `DashboardSuperAdmin()` en el mismo archivo
(`src/pages/Dashboard.jsx`), enrutado solo para `nivel === 'super_admin'`
(antes compartía rama con `'nacional'`). Reutiliza `calcularEstadoSuscripcion`
de `src/lib/suscripciones.js` (la misma lógica que ya usa
`Suscripciones.jsx`, nunca guardada, siempre calculada a partir de
fechas) y consulta `congregaciones` + `suscripciones` directamente
(RLS ya cubierto: `mis_congregaciones()` incluye todo para
super_admin, igual que en Suscripciones/Aprobaciones).

Contenido, deliberadamente SIN ninguna cifra pastoral:

- Tiles: congregaciones totales, activas, pendientes de aprobación,
  nuevas (últimos 30 días).
- Estado de suscripciones: al día / en periodo de gracia / bloqueadas
  (en mora) / sin configurar, con gráfico de barras de la
  distribución.
- Ingreso mensual estimado (suma de suscripciones al día, planes
  anuales prorrateados entre 12 -- no cuenta lo que está en gracia o
  bloqueado, para no sobreestimar).
- Tabla "Requieren atención pronto": bloqueadas, en gracia, o que
  vencen dentro de 7 días -- ordenadas por urgencia, con acceso directo
  a Suscripciones.
- Tabla "Nuevas, pendientes de aprobación" (solo si hay alguna), con
  acceso directo a Aprobaciones.

## Ampliación (mismo día) — crecimiento y BI

El usuario pidió, en un segundo mensaje, más profundidad: KPIs de
crecimiento, más gráficos/insights, y una forma de estimar cuántas
congregaciones nuevas hay que ir sumando para crecer -- "cada día
queremos ganar más". También pidió quitar la mención a "IPUC" del
copy del panel (el negocio es SIGAP, no la IPUC).

**Restricción de diseño importante**: SIGAP no guarda snapshots
históricos de MRR ni de cambios de estado de una congregación -- todo
se calcula en vivo a partir del estado actual (mismo patrón que el
resto del BI del repo). Por eso las métricas de crecimiento nuevas
están construidas SOLO a partir de datos que sí son históricos de
verdad (`congregaciones.created_at`), nunca inventando una serie de
tiempo que no existe. Donde una métrica es una aproximación (ej.
"congregaciones activas hace 30 días" asume que si ya existía y hoy
está activa, ya lo estaba entonces), se lo dice explícitamente al
usuario en el propio texto o en un `InfoTip`, para no hacerle creer
que es un historial exacto.

Agregado a `DashboardSuperAdmin`:

- Copy del hero corregido: ya no menciona "IPUC", ahora habla de
  crecer ("Cuánto estamos creciendo, cuánto estamos cobrando, y qué
  necesita tu atención hoy para seguir sumando congregaciones").
- **Congregaciones nuevas por mes** (línea de tendencia, últimos 12
  meses con datos) -- usa `trendDataset`/`chartOptions` de
  `src/lib/chartTheme.js` (los mismos helpers que ya usa
  `RutaFormacion.jsx` para "Discipulados iniciados por mes"), no un
  gráfico hecho a mano.
- **Crecimiento mensual** (%): activas hoy vs. activas hace 30 días.
- **Ingreso promedio por congregación** (ARPA): ingreso mensual
  estimado ÷ congregaciones al día.
- **"Para duplicar en 12 meses"**: cuántas congregaciones nuevas por
  mes hacen falta para duplicar las activas actuales.
- **Simulador de crecimiento**: input controlado (con el promedio
  real de los últimos 3 meses como valor inicial, no un número
  inventado) que proyecta congregaciones y MRR a 3/6/12 meses. Aclara
  explícitamente que no asume abandono (churn) ni cambios de precio.
- **Congregaciones por plan** (mensual/anual) y **por etapa/madurez**
  (Misión Nacional / Lugar de Predicación / Iglesia Local) -- segmentación
  para priorizar acompañamiento comercial, con `distributionDataset`.
- El gráfico de "Distribución de suscripciones" (agregado en la
  primera versión) ahora también usa `distributionDataset`/
  `chartOptions` en vez de una función de gráfico hecha a mano, por
  consistencia con el resto de la app.
- Nueva tarjeta "Suspendidas" mencionada como proxy de abandono (las
  congregaciones anuladas se eliminan por completo de la base --
  `anular_congregacion()` -- así que no quedan registradas en ningún
  lado para medir abandono real; solo las suspendidas, que son
  reversibles, dejan rastro).

## Segunda ampliación (mismo día) — historial real, no aproximado

El usuario preguntó explícitamente si se podía resolver la limitación
que se le explicó ("SIGAP no guarda historial de MRR ni de cambios de
estado"). Sí se puede -- es el patrón estándar de cualquier SaaS:
capturar una "foto" diaria en vez de reconstruir el pasado (lo pasado
no guardado no se puede recuperar, pero desde hoy en adelante sí).

Construido:

- `supabase/schema/negocio_snapshots_diarios.sql` (nuevo): tabla
  `negocio_snapshots_diarios` (una fila por día: congregaciones
  totales/activas/pendientes/suspendidas, estado de suscripciones, MRR
  estimado). RLS exclusiva de `super_admin`, mismo patrón que el resto
  del negocio.
- Función `capturar_snapshot_negocio()` (`security definer`, recalcula
  todo con la misma lógica que ya usa el frontend --
  `estado_suscripcion()`, la misma función SQL detrás de
  `calcularEstadoSuscripcion()` en JS) que inserta o actualiza
  (`on conflict (fecha) do update`) la fila de hoy -- así, si se llama
  más de una vez el mismo día, no duplica.
- Programada con `pg_cron` (`cron.schedule('snapshot-negocio-diario',
  '5 5 * * *', ...)`, 05:05 UTC = 00:05 Bogotá) para correr sola todos
  los días, sin que nadie tenga que acordarse de nada.
- `DashboardSuperAdmin` ahora consulta esta tabla y muestra dos
  gráficos de línea reales ("Congregaciones activas" y "MRR
  estimado" día a día), claramente etiquetados como "Histórico real"
  para distinguirlos de los gráficos de arriba (que son aproximaciones
  a partir de `created_at`). Mientras haya menos de 2 días de datos
  capturados, muestra un estado vacío explicando que el historial se
  está armando.

**Importante para el usuario**: esto no rellena el pasado -- el
historial empieza a existir desde el día en que se ejecute el script.
Los gráficos de tendencia real quedarán vacíos hasta que pasen un par
de días desde que el usuario ejecute el script.

## Verificación

- `npm run build` sin errores.
- Verificado con Playwright que el rol `local`
  (`pueba691@gmail.com`) sigue viendo su propio Resumen sin ningún
  error de consola -- la rama que cambió (`super_admin`) no afecta a
  los demás roles.
- **No verificado visualmente el panel de super_admin en sí** -- no
  hay una cuenta de prueba con ese nivel disponible en este entorno.
  Falta que el usuario lo revise con su cuenta real.
- Repetido tras la ampliación: `npm run build` sin errores, y
  Playwright confirmó de nuevo que el rol `local` sigue sin errores de
  consola después de tocar el mismo archivo por segunda vez.
- Repetido una tercera vez tras agregar el histórico real: `npm run
  build` sin errores, Playwright confirmó login y `/app` sin errores
  de consola para el rol `local` (un primer intento dio timeout de
  red transitorio, un reintento inmediato confirmó que no era un bug
  real).

## Pendiente de ejecutar por el usuario

`supabase/schema/negocio_snapshots_diarios.sql`. Si falla la línea
`create extension if not exists pg_cron` por permisos, habilitar
primero la extensión "pg_cron" desde el dashboard de Supabase
(Database -> Extensions) y volver a ejecutar el script completo.
Opcional, para ver el primer punto del histórico de inmediato en vez
de esperar al día siguiente: ejecutar `select
capturar_snapshot_negocio();` una vez a mano después de correr el
script (con dos días distintos con al menos un `select
capturar_snapshot_negocio();` cada uno, ya aparece la primera línea de
tendencia).
