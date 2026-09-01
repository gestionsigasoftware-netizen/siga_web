# BI de la IPUC — Fase 3: Escuela Dominical y Damas Dorcas

Fecha: 1 de septiembre de 2026

## Contexto

Última fase del plan BI: dos módulos operativos nuevos con ficha
individual completa (no solo conteo agregado), confirmados por el usuario.
Replican exactamente el patrón ya probado de Misión Juvenil
(`mision_juvenil.sql`/`MisionJuvenil.jsx`): CRUD local, consolidado
distrital aparte. La capa administrativa/de liderazgo de estos ministerios
ya existía (comités con `tipo_id` en Feligresía); lo que faltaba era la
capa operativa (beneficiarios con nombre propio, ficha, asistencia).

## Construido (`supabase/escuela_dominical_damas_dorcas.sql`, nuevo)

### Escuela Dominical (Misión Infantil)

- `escuela_dominical_clases` (nombre, etapa, metodología, maestro líder).
- `escuela_dominical_ninos` (ficha individual: nombres, fecha de
	nacimiento, acudiente, clase asignada).
- `escuela_dominical_lecciones` + `escuela_dominical_asistencia`
	(asistencia individual por lección, igual que Misión Juvenil).
- `escuela_dominical_maestros` (censo de maestros).
- Página nueva `src/pages/EscuelaDominical.jsx`, ruta `/escuela-dominical`,
	nivel local, ícono `Baby`.

### Damas Dorcas

- `damas_dorcas_beneficiarias` (ficha individual de la mujer alcanzada).
- `damas_dorcas_actividades` (visita/social/espiritual/otro) +
	`damas_dorcas_asistencia` (individual por actividad).
- Página nueva `src/pages/DamasDorcas.jsx`, ruta `/damas-dorcas`, nivel
	local, ícono `UserRound` (lucide-react no tiene ningún ícono de
	género/mujer en sus 1641 íconos — decisión de diseño de esa librería,
	confirmada revisando el set completo).
- Nombre correcto del módulo: **Damas Dorcas** (sin el prefijo "Misión").

### Permisos y seguridad

Ambos módulos siguen el patrón exacto de `mision_juvenil.sql` +
`seguridad_produccion.sql`: RLS con `tiene_permiso()` (no solo alcance por
congregación), permisos `escuela_dominical.*` y `damas_dorcas.*` sembrados
para los perfiles pastor/estadísticas/consulta, y agregados al acceso
implícito del pastor local en `tiene_permiso()`.

### Consolidado distrital

`resumen_escuela_dominical_distrital(distrito_id)` y
`resumen_damas_distrital(distrito_id)` — una fila por congregación,
mostradas como nuevas tablas en Gestión pastoral (`PastoralDistrital.jsx`),
junto a la comparativa de congregaciones ya existente.

## Validación ejecutada

- `npm run build`: correcto.
- Playwright con la cuenta de prueba local: clase, niño, maestro y lección
	con asistencia individual en Escuela Dominical; beneficiaria y actividad
	con asistencia individual en Damas Dorcas — todo verificado directamente
	en la base de datos.
- Cambio a distrital: ambas tablas de consolidado muestran los datos reales
	recién creados en Gestión pastoral, sin errores de consola.
- Todos los datos de prueba limpiados al finalizar.

## Actualización: capa avanzada de gráficos e insights

El usuario pidió explícitamente que ambos módulos quedaran "full" en
gráficos, métricas e insights — igual de completos que Misión Juvenil, no
solo el CRUD básico con el que se cerró la fase inicialmente. Se agregó a
`EscuelaDominical.jsx` y `DamasDorcas.jsx`:

- Selector de período (30 días / 6 meses / 12 meses), igual que Misión
	Juvenil.
- Seis/cuatro tarjetas de métrica con barra de progreso y una frase de
	insight cada una (componente `Metric`, mismo patrón visual).
- Gráfico de línea: tendencia de asistencia (Escuela Dominical) o de
	actividades (Damas Dorcas) en el período.
- Gráfico de barras: niños por etapa (Escuela Dominical) o actividades por
	tipo (Damas Dorcas).
- Tabla comparativa de clases por niños y asistencia promedio (Escuela
	Dominical).
- **Alerta real de decisión** en Damas Dorcas: beneficiarias activas sin
	actividad registrada en más de 60 días, con la fecha de su última
	actividad — verificado en vivo que identifica correctamente a la
	beneficiaria inactiva real, no solo un cálculo de ejemplo.
- Nombre correcto confirmado: **Damas Dorcas** (sin "Misión"). Ícono
	`UserRound` (Damas Dorcas) y sin cambios en el de Escuela Dominical
	(`Baby`) — lucide-react no tiene ningún ícono de género en sus 1641
	íconos disponibles, confirmado revisando el set completo.

Validado con datos de prueba reales (2 clases con niños en distintas
etapas y 3 lecciones en fechas distintas; 2 beneficiarias con actividades
en fechas distintas, una sin seguimiento reciente a propósito): todos los
gráficos, tendencias e insights calcularon correctamente, sin errores de
consola, y con estado vacío que no rompe la pantalla. Datos de prueba
limpiados.

## Con esto se cierran las 3 fases del plan BI de la IPUC

Hitos espirituales, membresía dinámica, madurez de sede, insights de
decisión en el Dashboard distrital, y los dos módulos poblacionales
faltantes — todo documentado en `docs/bi-fase1-datos-base-2026-09-01.md`,
`docs/bi-fase2-insights-2026-09-01.md` y este documento.
