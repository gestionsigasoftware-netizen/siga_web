# Barrido de claridad UX en el resto de la app + pantalla duplicada eliminada

**Fecha:** 2026-09-24
**Alcance:** Red de Familias, Evangelismo, Suscripciones, Música,
Educación Artística, Educación Teológica, Equipo de trabajo,
Auditoría de Feligresía, Configuración (Preferencias/MFA), Comités
Nacional, Catálogo de distritos, Gestión Pastoral Nacional,
Aprobaciones, Solicitudes internas, Soporte, Reportes, Módulos y
actividades, Corrección/contingencia de asistencia.

## Contexto

Continuación directa del pedido "masivo" del usuario: después de
cerrar Feligresía y corregir el patrón de placeholders repetidos en
11 archivos más, el usuario pidió terminar con el resto de la app que
había quedado pendiente en `docs/pendientes.md`.

## Revisión módulo por módulo

Se leyó el código real (no solo la lista de páginas) de cada uno de
los módulos listados arriba, buscando el mismo tipo de hueco
encontrado en Feligresía: placeholders que repiten la etiqueta,
conceptos internos sin explicar (estados, clasificaciones, códigos) y
formularios sin ninguna pista de qué escribir.

**Resultado: ya estaban bien.** Estos módulos ya tenían, de sesiones
anteriores de este mismo proyecto, subtítulos explicativos bajo cada
sección, InfoTips en los conceptos no obvios (ej. "En gracia" en
Suscripciones, "Acceso web vs. responsabilidad operativa" en Equipo
de trabajo, "Madurez de la sede" en Aprobaciones, "Escalafón
ministerial" en Gestión Pastoral Nacional) y placeholders con ejemplos
reales donde hacía falta. No se encontró ningún hueco real de
claridad en estos módulos -- se confirma que el trabajo de sesiones
anteriores (13 pedidos de censo, auditoría de gráficos, auditoría de
fallos silenciosos, etc.) ya cubrió esta dimensión ahí.

## Hallazgo real: página duplicada y huérfana (`/personas`)

Al revisar `src/App.jsx` para confirmar que no quedara ninguna
pantalla sin revisar, se encontró que la ruta `/personas`
(`src/pages/Personas.jsx`) **no estaba enlazada desde ningún lugar de
la aplicación** -- ni el Sidebar, ni los accesos rápidos del
Dashboard, ni ningún otro componente. Solo existía la ruta.

Comparado con `FeligresiaAdmin.jsx` (pestaña Población, la pantalla
real y mantenida), `Personas.jsx` era una versión mucho más simple y
desactualizada del mismo censo:
- Sin gate de permiso (`canEdit`) -- cualquier persona autenticada con
  congregación veía el formulario de "Registrar persona" activo,
  aunque su perfil solo tuviera lectura (el guardado sí fallaría por
  RLS, `puede_administrar_feligresia()`, pero la UI no lo advertía).
- Sin bautizado/sellado, sin familia, sin estado de membresía
  seleccionable, sin ningún InfoTip.
- Duplicaba exactamente el mismo propósito de Población, con menos
  funciones y sin la capa de validación que sí tiene el formulario
  real.

Mismo patrón que el `src/pages/Reportes.jsx` eliminado el
2026-08-31 (archivo muerto y duplicado, la ruta real usa
`ReportesOptimizado.jsx`). Se eliminó:
- La ruta `<Route path="/personas" ... />` y su `lazy import` en
  `src/App.jsx`.
- El archivo `src/pages/Personas.jsx` completo.

## Verificación

1. `npm run build` sin errores; el chunk `Personas-*.js` ya no
   aparece en `dist/assets/`.
2. Playwright + login real (rol local): `/app` (Dashboard) sigue
   cargando con normalidad; `/personas` ahora muestra la pantalla
   404 real de la app en vez del formulario duplicado. Sin errores de
   consola en ningún punto.

## Estado

Con esto se cierra el pedido "masivo" de revisión de claridad
(tooltips/placeholders/bugs) en toda la aplicación. Cualquier
submódulo nuevo que se agregue de aquí en adelante debe seguir el
mismo criterio: subtítulo explicativo + InfoTip en conceptos no
obvios + placeholders con ejemplo real, no repetir la etiqueta.
