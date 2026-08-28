# Ejecucion de mejoras: Resumen

Fecha: 28 de agosto de 2026

## Objetivo

Hacer que el modulo Resumen sea confiable para lectura operativa y toma de decisiones, con indicadores comprensibles, alcance multi-tenant seguro y acciones coherentes con los permisos.

## Cambios aplicados

### Seguridad y alcance

- Las vistas `vw_tendencia_categoria`, `vw_alertas_pastorales` y `vw_resumen_feligresia` usan `security_invoker = true`.
- El Dashboard filtra explicitamente las alertas de una congregacion local.
- Los paneles distritales y nacionales consultan Amigos sin enviar un `congregacion_id` nulo; RLS determina el alcance permitido.
- `vw_resumen_feligresia` cuenta bautizados dentro de la poblacion activa, alineado con el indicador `personas_activas`.

### Estados y permisos

- Se agrego un estado de carga independiente para los datos del Dashboard.
- Los errores de carga permiten reintentar sin recargar toda la aplicacion.
- La accion `Atender` solo aparece cuando el usuario tiene `feligresia.editar`. RLS continua siendo la autoridad final.
- El estado vacio de alertas explica que incluye tendencias y condiciones pastorales del censo.

### Interpretacion

- Los graficos muestran el rango exacto consultado.
- Se cambio la etiqueta ambigua `Asistentes` por `Asistencias registradas`.
- La variacion muestra porcentaje y diferencia absoluta de registros.
- Las alertas de tendencia excluyen el mes calendario actual, que aun puede estar incompleto.

## Archivos modificados

- `src/pages/Dashboard.jsx`
- `supabase/vistas_dashboard.sql`
- `supabase/feligresia.sql`
- `docs/ejecucion-mejoras-resumen-2026-08-28.md`

## Orden de aplicacion SQL

Aplicar en el SQL Editor del proyecto Supabase:

1. `schema.sql`
2. `vistas_dashboard.sql`
3. `accesos.sql`
4. `migracion_produccion.sql`
5. `feligresia.sql`
6. `dashboard_analytics.sql`
7. `configuracion.sql`
8. `notificaciones.sql`

Si ya existen tablas y funciones, las sentencias de estas migraciones son repetibles en el orden indicado.

## Validacion ejecutada

- `npm run build`: correcto.
- Diagnosticos del editor en `Dashboard.jsx`: sin errores conocidos.
- `supabase db lint --local`: no ejecutado correctamente porque no hay PostgreSQL local escuchando en `127.0.0.1:54322`; requiere Docker y `supabase start`.

## Validacion pendiente en Supabase

La seguridad de vistas debe comprobarse con JWT reales, no con el propietario de la base:

- Usuario A solo ve alertas, resumen, Amigos y registros de A.
- Usuario A no ve filas ni detalles de B mediante vistas, RPC, tablas o exportaciones.
- Repetir la prueba con usuario B.
- Repetir con perfiles `consulta`, `estadisticas`, `pastor` y un usuario distrital cuando aplique.
- Confirmar que el usuario sin `feligresia.editar` no ve `Atender` y que un intento directo de escritura es rechazado por RLS.
- Confirmar que una alerta de asistencia del mes actual no aparece hasta que el periodo sea cerrado.

## Pendientes de producto

- Definir si se necesitan personas unicas, ademas de asistencias registradas.
- Definir metas de asistencia y cobertura para comparar resultado contra objetivo.
- Resolver la agregacion de categorias con nombres diferentes entre congregaciones en paneles superiores.
- Añadir tabla alternativa accesible para los graficos y una señal de calidad/completitud de datos.
- Generar ceros explicitos para meses sin registros si se necesita detectar caidas completas.
