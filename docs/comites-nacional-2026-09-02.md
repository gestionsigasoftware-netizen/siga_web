# Consolidado de los 10 comités a nivel distrital y nacional (2026-09-02)

## Contexto

El usuario preguntó si cada nivel (local, distrital, nacional) tiene las
vistas adecuadas para tomar decisiones sobre el trabajo que se hace en
el nivel de abajo. Se auditó el código completo comparando los 15
módulos locales del Sidebar contra qué existe en distrital/nacional, y
se encontraron 3 brechas reales.

## 1. Misión Juvenil — nuevo consolidado distrital

Tenía su propio censo real (estudiantes, instituciones, grupos, líderes)
igual que los otros 9 comités, pero era el único sin ningún consolidado
distrital.

- **`supabase/resumen_mision_juvenil_red_familias.sql`**:
  `resumen_mision_juvenil_distrital(p_distrito_id)` — estudiantes
  activos, bautizados, instituciones impactadas, grupos activos,
  lecciones del último mes, por congregación del distrito.
- **`PastoralDistrital.jsx`**: nueva tabla "Misión Juvenil por
  congregación".

## 2. Red de Familias — nuevo consolidado distrital

Casos de acompañamiento familiar, visitas domiciliarias y actividades —
trabajo pastoral real sin ningún consolidado distrital.

- Misma migración: `resumen_red_familias_distrital(p_distrito_id)` —
  casos activos, casos de prioridad alta, casos cerrados en 3 meses,
  visitas pendientes, actividades del último mes.
- **`PastoralDistrital.jsx`**: nueva tabla "Red de Familias por
  congregación".

## 3. Hallazgo más grande: los 10 comités no tenían equivalente nacional

Los `resumen_X_distrital()` (incluidos los 2 nuevos) solo se veían en
Pastoral Distrital, sobre el distrito propio de quien entra. Nacional no
tenía ninguna forma de ver "cuántos niños en Escuela Dominical hay en
todo el país" ni de ningún otro de los 10 comités — solo población
general e Impacto Misionero (que cubre apenas 3 de los 10: Obra
Carcelaria, Misión Juvenil, Obra Social).

- **`supabase/resumen_comites_nacional.sql`**:
  `resumen_comites_nacional()` — una fila por distrito (36 filas), con
  el número principal de cada uno de los 10 comités. Mismo nivel de
  detalle que la comparativa de población del Dashboard Nacional, no el
  detalle operativo completo (eso lo sigue manejando cada distrital en
  su propia Pastoral Distrital).
- **`src/pages/ComitesNacional.jsx`** (nuevo, ruta `/comites-nacional`,
  nacional/super_admin): tarjetas con el total nacional de cada comité +
  tabla por distrito.

## Explícitamente no cerrado en esta ronda

**Evangelismo/Misiones — detalle territorial (zonas/barrios)**: la
métrica que más importa para decidir (embudo Uno Más → REFAM →
Bautizado) ya estaba consolidada en distrital y nacional desde antes. El
detalle de qué zona/barrio específico rinde mejor es información más
operativa que estratégica — se dejó fuera de esta ronda a propósito.

## Acción requerida del usuario

Ejecutar en el SQL Editor de Supabase, en este orden:
1. `supabase/resumen_mision_juvenil_red_familias.sql`
2. `supabase/resumen_comites_nacional.sql`
