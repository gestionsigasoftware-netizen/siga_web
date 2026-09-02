# Género/pirámide poblacional, ciclo de vida espiritual, proyección de crecimiento e Impacto Misionero (2026-09-02)

## Contexto

Siguiendo la comparación con "qué mostraría un analista de datos" hecha en
la sesión anterior, el usuario pidió cerrar 4 de las brechas identificadas
(dejando fuera, por ahora, mapa de calor y metas distritales — ver
decisiones abajo).

## 1. Género y pirámide poblacional

- **`supabase/genero_personas.sql`** (nuevo): `alter table personas add
  column if not exists genero text check (genero in ('masculino',
  'femenino'))`. Nullable — las personas ya registradas no tienen este
  dato retroactivamente.
- **`src/pages/FeligresiaAdmin.jsx`**: campo de género en la ficha de
  persona (`PersonFormEditor`), incluido en las consultas de listado,
  ficha individual y exportación CSV. Nuevo gráfico "Pirámide
  poblacional" (barras horizontales espejadas por edad y género,
  masculino a la izquierda en negativo, femenino a la derecha) en la
  pestaña Evolución. Muestra una nota de cobertura ("Basada en N de M
  activas con género registrado") mientras no todo el censo tenga el
  dato.

## 2. Ciclo de vida espiritual (línea de tiempo)

- **`src/pages/FeligresiaAdmin.jsx`**: nuevo componente
  `SpiritualTimeline`, dentro de la ficha de cada persona (solo al
  editar). Junta en una sola línea de tiempo visual: ingreso a la
  congregación, bautismo en agua, sellado con el Espíritu Santo, y cada
  cargo asumido (con su fecha de inicio y, si aplica, de fin). Los datos
  ya existían repartidos en el censo; lo que faltaba era la vista que los
  uniera para lectura rápida.

## 3. Proyección de crecimiento (transparente, no un modelo de ML)

**Decisión explícita con el usuario**: dado que SIGAP es un producto
nuevo sin años de historial real por congregación, un modelo de series de
tiempo (ARIMA, ML) daría una falsa sensación de precisión. Se optó por
una proyección simple y honesta: extrapolar el ritmo neto de altas/bajas
de los últimos 3 meses a 12 meses, dejando explícito en el texto que la
estimación se basa en poco historial.

- **Local** (`src/pages/Dashboard.jsx`): nueva consulta a
  `movimientos_membresia` (altas/bajas de los últimos 90 días) para la
  congregación; tarjeta "Proyección a 12 meses" junto a las demás
  tarjetas de Feligresía.
- **Distrital** y **Nacional** (`src/pages/Dashboard.jsx`,
  `DashboardDistrital`/`DashboardNacional`): no requirió nueva consulta
  — `resumen_distrital()`/`resumen_nacional()` ya traían `altas_3m` y
  `bajas_3m` agregados. Nuevo `InsightCard` "Proyección a 12 meses" en
  ambos, con el mismo cálculo a su escala.

## 4. Impacto Misionero

**Decisión explícita con el usuario**: vista disponible en local,
distrital y nacional (no solo uno de los dos niveles).

- **`src/pages/ImpactoMisionero.jsx`** (nuevo, un solo archivo para los 3
  niveles — se adapta según `rolPrincipal.nivel`, mismo patrón que
  `Dashboard.jsx`): junta Obra Carcelaria, Misión Juvenil y Obra Social
  en una sola lectura de "personas alcanzadas". Métricas: internos
  activos/bautizados, estudiantes activos/bautizados e instituciones
  impactadas, casos de Obra Social activos/resueltos, asistencia a
  cultos carcelarios y ayudas entregadas en los últimos 12 meses, más un
  gráfico de distribución por frente.
- **No se creó ninguna función SQL nueva**: las políticas RLS de
  `obra_carcelaria_internos`, `mision_estudiantes`, `obra_social_casos` y
  tablas relacionadas ya scopeaban correctamente a través de
  `mis_congregaciones()` (que ya incluye la lógica de "todo el país" para
  nacional/super_admin y "todo el distrito" para distrital). La página
  simplemente omite el filtro `.eq('congregacion_id', ...)` cuando el
  nivel no es local, y RLS hace el resto — mismo patrón ya usado en otras
  partes de la sesión.
- Rutas: `/impacto-misionero` (`App.jsx`), entrada en el Sidebar visible
  para local, distrital y nacional/super_admin.

## Explícitamente dejado fuera (decisión del usuario, no un olvido)

- **Mapa de calor geográfico**: se recomendó no construirlo por ahora —
  no hay coordenadas de congregaciones, y la tabla comparativa que ya
  existe responde mejor a la pregunta operativa ("cuál congregación
  necesita atención") que un mapa. Es más un elemento de presentación
  institucional que una herramienta de decisión diaria.
- **Metas distritales con barra de progreso**: el usuario no tiene
  certeza de que los supervisores distritales fijen metas numéricas
  formales en la práctica real de la IPUC. Se deja en pausa junto con el
  informe estadístico nacional pendiente — se retoma si al final resulta
  que sí es parte de la práctica real o del informe.

## Acción requerida del usuario

Ejecutar `supabase/genero_personas.sql` en el SQL Editor de Supabase.
