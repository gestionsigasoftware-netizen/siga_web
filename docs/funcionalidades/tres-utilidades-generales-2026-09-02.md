# Tres utilidades generales: búsqueda global, cumpleaños, deshacer (2026-09-02)

## Contexto

El usuario preguntó qué se podría construir que fuera útil para todos los
niveles. Se propusieron 3 ideas (búsqueda global, recordatorio de
cumpleaños, papelera de recuperación) y se pidió construir las 3.

## 1. Búsqueda global (`src/components/layout/GlobalSearch.jsx`)

Cuadro de búsqueda en el encabezado, visible en cualquier pantalla —
antes cada módulo tenía su propia búsqueda aislada. El alcance cambia
según el nivel (mismo criterio de RLS ya usado en toda la app):

- **Local**: busca en el censo de su propia congregación. Al hacer clic
  en un resultado, navega a `/feligresia?persona=<id>` — se reutilizó el
  deep-link que ya existía para las alertas pastorales del Dashboard
  (`FeligresiaAdmin.jsx` ya lo leía, no hubo que construir nada nuevo ahí).
- **Distrital/nacional/super_admin**: busca congregaciones (nombre o
  ciudad). No existe una pantalla de "detalle de congregación" a la que
  saltar, así que el resultado se muestra completo en el mismo
  desplegable (ciudad, distrito, pastor, estado de aprobación) sin
  necesitar un clic adicional.

## 2. Recordatorio de cumpleaños (`src/pages/Dashboard.jsx`)

Nueva tarjeta "Próximos cumpleaños" en el Dashboard local (30 días,
ignorando el año de nacimiento). Reutiliza el mismo deep-link
`/feligresia?persona=<id>`. Solo visible en nivel local — a nivel
distrital/nacional una lista de cumpleaños de todo el país no es
información pastoral accionable, sería ruido.

## 3. Deshacer en vez de papelera (`src/hooks/useUndoDelete.js`, `src/components/UndoToast.jsx`)

Se auditaron todos los `.delete()` de la app (solo 4 archivos los usan).
Construir una papelera real de varios días para las ~6 tablas distintas
involucradas habría significado diseñar autorización genérica seria por
tabla — mucho riesgo para una sola ronda. Se optó por un patrón más
simple y ya probado en otras apps (Gmail, Trello): el borrado ocurre de
inmediato (no se retrasa — así no depende de que seguir con la pestaña
abierta), y "Deshacer" reinserta la fila exacta capturada antes de
borrar, con un aviso visible 8 segundos.

Aplicado en **`src/pages/Configuracion.jsx`** a los 4 catálogos que ya
usaban `window.confirm()` + borrado directo (categorías demográficas,
etapas de seguimiento, tipos de comité, cargos de comité) — se quitó el
`confirm()` porque "deshacer" ya cubre el mismo riesgo sin la fricción
de una alerta del navegador.

**No se extendió** (por ahora) a los otros 2 lugares con borrado
encontrados en la auditoría — `PastoralDistrital.jsx` (formación
pastoral) y `Amigos.jsx` (registro de amigo) — para no apurar el mismo
patrón sobre datos de naturaleza distinta sin verificarlos con el mismo
cuidado. El hook `useUndoDelete` queda listo para reutilizarse ahí si se
quiere ampliar más adelante.

## Acción requerida del usuario

Ninguna — las 3 son cambios de frontend puro, sin migraciones SQL.
