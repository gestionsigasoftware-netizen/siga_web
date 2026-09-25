# Traducción completa de Dashboard.jsx a inglés/portugués

**Fecha:** 2026-09-25
**Archivos:** `src/pages/Dashboard.jsx`, `src/i18n/locales/{es,en,pt}.json`.

## Contexto

Continuación de la traducción del "chrome" compartido (Sidebar, header,
footer). El usuario pidió avanzar con el contenido propio de cada
pantalla, "todo completo de una vez". Se empezó por `Dashboard.jsx`
por ser la pantalla más grande (2113 líneas) y la más vista (es la
página de aterrizaje después de iniciar sesión, para los 4 roles).

`Dashboard.jsx` no es una sola pantalla sino 4 componentes distintos
según el rol activo (`DashboardDistrital`, `DashboardNacional`,
`DashboardSuperAdmin`, y el `Dashboard` local por defecto), cada uno
con su propio hero, tarjetas de insight, semáforos, tablas
comparativas y frases narrativas generadas dinámicamente a partir de
los datos reales (ej. "3 congregaciones crecieron este mes", "Puerto
Tejada aporta 120 de las 300 asistencias").

## Qué se tradujo

Los 4 paneles completos, en 4 commits separados:

1. **DashboardDistrital**: hero, "Cómo estuvimos este mes", semáforo
   del distrito, insights BI (brecha de llenura, eficacia de REFAM,
   embudo Uno Más → REFAM, movimiento de membresía, madurez de la
   obra, proyección a 12 meses, ciclo de vida espiritual, tiempo de
   consolidación), pirámide poblacional, tabla comparativa por
   congregación.
2. **DashboardNacional**: la misma estructura que distrital, agregada
   por distrito en vez de por congregación.
3. **DashboardSuperAdmin** (panel de negocio, exclusivo de
   `super_admin`): informe de negocio exportable (CSV/Excel/PDF),
   crecimiento, histórico real (congregaciones activas y MRR día a
   día), simulador de proyección, estado de cobros, distribución por
   plan/etapa, tablas de "requieren atención" y "pendientes de
   aprobación".
4. **Dashboard local** (el más grande, rol congregación): hero,
   "Cómo estuvimos", "Necesita tu atención", selector de frecuencia,
   categoría seleccionada, ritmo de asistencia, composición, amigos e
   integración, accesos rápidos, resumen de feligresía, estado vacío,
   evolución mensual, alertas pastorales, riesgo de apartamiento,
   próximos cumpleaños.

## Detalle técnico

- **Namespace `dashboard`** en los 3 locales, con sub-namespaces
  `shared` (frecuencias, tipos de alerta, madurez, estado de
  congregación, plan de suscripción -- reutilizados por los 4 paneles),
  `distrital`, `nacional`, `superAdmin`, `local`.
- **Pluralización real de i18next** (`_one`/`_other`, mismo mecanismo
  para los 3 idiomas ya que inglés y portugués comparten las mismas
  dos formas CLDR) para frases como "3 congregaciones sin pastor
  asignado" / "3 congregations without an assigned pastor" / "3
  congregações sem pastor designado".
- **Frases con verbo condicional** (ej. "aporta" vs. "aportan" según
  si es 1 o más nombres) resueltas con dos claves explícitas
  (`aporteSingular`/`aportePlural`) elegidas en JS, en vez de forzar
  el mecanismo de conteo de i18next donde no aplica.
- Los diccionarios de etiquetas que antes eran objetos JS a nivel de
  módulo (`FRECUENCIA_LABELS`, `ALERT_TYPE_LABELS`, `MADUREZ_LABELS_DASH`,
  `PLAN_LABELS_DASH`, `ESTADO_SUSC_LABEL_DASH`) se eliminaron y se
  reemplazaron por `t('dashboard.shared.<categoria>.<codigo>')` en el
  punto de uso, ya que necesitan el hook `useTranslation()` (no
  disponible a nivel de módulo).

## Qué queda deliberadamente en español (no es texto de interfaz)

- Nombres de categorías de asistencia configuradas por cada
  congregación (dato real capturado por el usuario, no una etiqueta
  fija de SIGAP).
- `MOVIMIENTO_LABELS` (`src/lib/movimientos.js`) y
  `CARGO_DISTRITAL_LABELS` (`src/lib/cargosDistritales.js`) -- archivos
  `lib/` compartidos con otras pantallas, fuera del alcance de esta
  pasada.
- El texto de las alertas pastorales (`a.titulo`, `a.detalle`), que
  viene generado por la vista `vw_alertas_pastorales` en la base de
  datos, no por este componente.

## Verificación

1. `npm run build` sin errores después de cada uno de los 4 bloques.
2. Grep de las constantes eliminadas (`FRECUENCIA_LABELS`,
   `ALERT_TYPE_LABELS`, etc.) para confirmar cero referencias colgantes
   -- el build de Vite no detecta `ReferenceError` en tiempo de
   compilación al no haber TypeScript, así que esto se verificó
   manualmente antes de dar por buena cada sección.
3. Playwright con la cuenta de prueba real (`pueba691@gmail.com`, rol
   local): login real, captura de pantalla completa en inglés y en
   portugués (cambiando `localStorage['sigap:idioma']` + recarga),
   cero errores de consola ni de página, todos los valores
   interpolados (números, nombres, fechas, porcentajes) correctos en
   los 3 idiomas.

## Pendiente

El contenido propio de las ~44 pantallas restantes de la app sigue en
español fijo. Es un trabajo de contenido considerable (algunas
pantallas tienen cientos de textos, varios con lógica de pluralización
similar a la de Dashboard) -- se continúa por grupos de módulos en
próximas sesiones. También sigue pendiente el resto de
`RoleChooser.jsx` y la Fase 3 (PWA).
