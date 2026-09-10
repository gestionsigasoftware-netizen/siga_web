# Auditoría y mejoras — Gestión pastoral (rol distrital) (2026-09-10)

El usuario pidió el mismo tipo de auditoría ya hecha en Resumen y el
resto de gráficos, aplicada al módulo "Gestión pastoral"
(`src/pages/PastoralDistrital.jsx`, ruta `/pastoral-distrital`,
exclusivo del rol distrital): si está todo bien, y sugerencias de
mejoras/gráficos/insights/KPIs. Tras presentar los hallazgos, autorizó
implementar todo lo sugerido.

## Diagnóstico

A diferencia de "Resumen" (`Dashboard.jsx`, que sí tiene semáforo,
insights BI y pirámide para el rol distrital), este módulo **no tenía
ni un solo gráfico** y consolidaba ~12 ministerios del distrito
(pastores, congregaciones, Escuela Dominical, Damas Dorcas, Obra
Carcelaria, reinserción, Música, Ed. Artística, Ed. Teológica,
Conquistadores, Obra Social, Misión Juvenil, Red de Familias, Ruta
Evangelística, SEPRI, Informe Trimestral) casi enteramente como
tablas planas ordenadas solo alfabéticamente, sin KPI agregado del
distrito y con muy poca señal visual de riesgo.

## Bugs corregidos

1. **Consultas desperdiciadas en "Continuidad pendiente"**:
   `<ContinuidadPastoral vacantes={congregations.filter(...)} />` creaba
   un array nuevo en cada render del componente padre. El `useEffect`
   del componente (dependiente de `vacantes`) volvía a disparar la RPC
   `resumen_continuidad_congregacion` (una por congregación vacante) en
   **cada interacción de toda la pantalla** -- escribir en el buscador,
   editar una nota de SEPRI, etc. -- no solo cuando la lista de
   vacantes cambiaba de verdad. Corregido con `useMemo` en el padre.
2. **"SEPRI — Solicitudes de eventos" era la única lista sin paginar**
   en todo el archivo (ni siquiera acotada por fecha), mientras el
   resto de listas (incluida la segunda tabla de SEPRI) usan `Pager` a
   50 filas. Se le agregó paginación con el mismo patrón.
3. **Tono de alerta hardcodeado en Ruta Evangelística**: la columna
   "Bautismos (3m)" se pintaba siempre en verde
   (`text-success font-medium`) sin importar el valor, incluso en 0.
   Corregido a condicional.

## Mejoras construidas (KPIs, orden, insights)

Se creó un componente reutilizable, `ResumenComiteDistrital`, y se
usó en las 11 tablas "por congregación" (Escuela Dominical, Damas
Dorcas, Obra Carcelaria, Música, Ed. Artística, Ed. Teológica,
Conquistadores, Obra Social, Misión Juvenil, Red de Familias, Ruta
Evangelística), reemplazando el HTML de tabla repetido a mano en cada
una. Cada instancia declara sus propias métricas (con su propia regla
de tono, ej. "0 integrantes activos = alerta roja" pero
"0 casos abiertos en Obra Social" no es alerta). El componente agrega
automáticamente:

- **Tarjetas KPI** con la suma de las métricas principales sobre TODO
  el distrito (no solo la página visible) -- antes solo la sección de
  Pastores tenía este patrón.
- **Selector de orden** por cualquier métrica de la tabla -- antes
  solo el Informe Trimestral lo tenía; el resto venía fijo por SQL
  (`order by nombre`).
- **Insight de "líder"** ("X lidera con Y ...") sobre la métrica
  ordenada, mismo patrón que ya usan Evangelismo/Conquistadores en sus
  pantallas locales -- antes solo existía el puntito verde del Informe
  Trimestral, sin texto.
- **Tono de alerta por celda**, definido por cada sección según lo que
  realmente importa ahí (ej. 0 integrantes activos, 0 delegados
  hábiles, 0 actividad en 30 días → alerta; casos abiertos altos en Red
  de Familias → alerta ya existente, preservada).

También se agregó contexto de proporción al KPI "Vacantes" de la
cabecera (antes un número crudo, ahora "% del distrito" + tono de
alerta cuando hay al menos una vacante) y una sección "% del total"
implícita al ordenar por métrica.

**Decisión de alcance**: no se agregaron gráficos de Chart.js a las 11
secciones. Este módulo es un centro operativo/CRUD (censo de pastores,
formularios de traslado, aprobación de SEPRI), no una pantalla de
analítica -- ese rol ya lo cumple "Resumen" (Dashboard distrital, con
semáforo/insights/pirámide). Construir 11 gráficos aquí habría
duplicado esa función y sobrecargado una pantalla ya extensa (2312
líneas) sin agregar información que las tarjetas KPI + orden +
insight de texto no cubran ya.

## Verificación

- `npm run build` limpio.
- Lógica del componente nuevo (orden descendente por métrica primaria,
  suma de KPIs sobre el dataset completo, funciones de tono) verificada
  con datos de muestra en un script Node aislado -- confirma que
  ordena, suma y resalta exactamente como se espera.
- **No se pudo probar con clics reales como usuario distrital**: no hay
  credenciales de prueba con ese rol en esta sesión (limitación ya
  documentada en `docs/fixes/informe-trimestral-2026-09-10.md` y
  repetida en el resto de piezas distritales/nacionales de esta
  sesión). El cambio es puramente de frontend (sin tocar esquema ni
  RLS), reutiliza fielmente el mismo patrón de `Pager`/`paginate` ya
  probado en el resto del archivo, y el build no reporta errores.

## Pendiente

Confirmar visualmente esta pantalla con una cuenta distrital real
cuando esté disponible -- mismo pendiente ya anotado para el resto del
módulo distrital.
