# Cierre de brechas distrital/nacional (2026-09-02)

## Contexto

Después de revisar honestamente si los paneles distrital y nacional ya
actúan como un software de inteligencia de negocios completo para su
jerarquía, se identificaron 5 brechas reales (ver conversación). El
usuario pidió cerrarlas todas en esta sesión.

## 1. Pirámide poblacional en los 3 niveles

- **`src/lib/piramide.js`** (nuevo): `construirPiramide()`,
  `piramideChartData()`, `piramideChartOptions()` — compartido entre
  local (`FeligresiaAdmin.jsx`, ya existía), distrital y nacional (nuevo).
- **`DashboardDistrital`**: nueva consulta a `personas` (vía
  `congregaciones!inner(distrito_id)`, sin necesidad de una función SQL
  nueva — RLS ya scopea correctamente) y sección "Pirámide poblacional
  del distrito".
- **`DashboardNacional`**: misma consulta sin filtro de distrito (RLS
  devuelve todo el país para nacional/super_admin) y sección "Pirámide
  poblacional nacional".

## 2. Cargos jerárquicos de la junta distrital + Gestión Pastoral Nacional

- **`supabase/cargos_distritales.sql`** (nuevo): tabla `cargos_distritales`
  (Supervisor, Secretario, Tesorero, Presbítero A, Presbítero B, Veedor,
  Otro), con un índice único que impide dos personas vigentes en el
  mismo cargo del mismo distrito a la vez. **Aclaración importante**:
  esto es un censo organizacional, no cambia el modelo de acceso al
  software (`roles_sistema` sigue con un solo nivel `'distrital'`, como
  ya se había decidido antes).
- **`resumen_pastoral_nacional()`**: análogo a `resumen_nacional()` pero
  para la directiva — pastores por nivel de licencia (escalafón
  ministerial) y cargos distritales ocupados/vacantes, por distrito.
- **`PastoralDistrital.jsx`**: nueva sección "Directiva distrital" —
  asignar/terminar cargos para personas del censo del propio distrito.
- **`src/pages/GestionPastoralNacional.jsx`** (nuevo, ruta
  `/gestion-pastoral-nacional`, nacional/super_admin): escalafón
  ministerial y cargos distritales de los 36 distritos en una tabla.

## 3. Auditoría para distrital

- **`AuditoriaFeligresia.jsx`**: `ADMIN_LEVELS` ahora incluye
  `'distrital'`. No requirió cambios de RLS — `auditoria_feligresia_read`
  ya usaba `mis_congregaciones()`, que ya incluye correctamente el
  alcance de un distrital sobre su propio distrito.

## 4. Ciclo de vida espiritual agregado (embudo + tiempos)

**Decisión de diseño** (confirmada con el usuario): un embudo Activos →
Bautizados → Sellados → Con cargo/comité, con tiempos promedio entre
hitos — mismo lenguaje visual que el ya existente "Embudo Uno Más →
REFAM", cerrando el ciclo completo de consolidación.

- **`src/lib/cicloVida.js`** (nuevo): `construirCicloVida(personas,
  personaIdsConCargo)` — calcula conteos, porcentajes de conversión, y
  días promedio entre ingreso→bautismo y bautismo→sellado.
- **`DashboardDistrital`/`DashboardNacional`**: 2 nuevos `InsightCard`
  ("Ciclo de vida espiritual", "Tiempo de consolidación"), usando los
  mismos datos de `personas` ya cargados para la pirámide más una nueva
  consulta a `membresias_comite` (vigentes) para saber quién tiene cargo
  o participación en un comité.

## 5. Semáforo de salud del distrito/nacional

**Decisión de diseño** (confirmada con el usuario): **no** un score
numérico compuesto (mezclar métricas distintas en un solo número
esconde más de lo que revela). En su lugar, un semáforo con 5 señales
que SIGAP ya mide, juntas en un solo lugar:

1. Vacantes de pastor.
2. Brecha de llenura (bautizados sin sellar > 30%).
3. Movimiento de membresía (altas vs bajas de 3 meses).
4. Actividad congregacional (congregaciones sin ningún registro de
   actividad en 60 días — nueva consulta liviana a
   `registros_actividad`).
5. Directiva distrital (cargos de junta vacantes — usa la tabla nueva
   `cargos_distritales` / `resumen_pastoral_nacional()`).

Implementado como componente `SemaforoRow` en `Dashboard.jsx`, una
sección al inicio de `DashboardDistrital` y `DashboardNacional`.

## Acción requerida del usuario

Ejecutar, en este orden, en el SQL Editor de Supabase:
1. `supabase/genero_personas.sql` (si no se ha ejecutado ya).
2. `supabase/resumen_nacional.sql` (si no se ha ejecutado ya).
3. `supabase/cargos_distritales.sql` (nuevo).
