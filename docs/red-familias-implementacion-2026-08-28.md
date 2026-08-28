# Implementacion de Red de Familias

Fecha: 28 de agosto de 2026
Estado: Primera entrega implementada

## Alcance

Red de Familias es un modulo de intervencion DEFAM. Consume `familias` y
`personas` desde Feligresia y no crea un censo paralelo.

La primera entrega incluye:

- Panorama: familias del censo, acompanamientos abiertos, visitas pendientes,
personas vinculadas y familias alcanzadas.
- Acompanamiento: apertura de casos con familia, persona opcional, necesidad,
prioridad, responsable, proximo contacto y nota confidencial.
- Visitas: programacion, motivo, responsable y cierre como realizada.
- Actividades: registro de talleres, escuelas, campanas, conferencias y visitas
grupales con asistentes, familias alcanzadas, objetivo y resultado.

## Tablas

- `red_familias_casos`
- `red_familias_visitas`
- `red_familias_actividades`

Todas tienen `congregacion_id`, indices de consulta y RLS. Las tablas de
personas y familias siguen siendo la fuente de verdad.

## Permisos

- `red_familias.consultar`: lectura del modulo.
- `red_familias.editar`: registrar y actualizar intervenciones.
- El pastor local mantiene compatibilidad mediante el fallback de permisos.
- Las notas confidenciales solo se exponen a usuarios autorizados por RLS.

Los permisos se agregan en `supabase/accesos.sql` y las tablas en
`supabase/red_familias.sql`.

## Despliegue

Para una base existente, ejecutar en SQL Editor:

1. `supabase/accesos.sql`
2. `supabase/red_familias.sql`

`accesos.sql` debe ejecutarse primero para registrar los permisos en los
perfiles existentes. No ejecutar seed de datos de prueba en producción.

Para una base nueva, respetar el orden general documentado en `README.md`.

## Validacion frontend

- Ruta: `/red-familias`.
- Sidebar: debajo de Feligresia.
- Build: `npm run build` correcto.
- Diagnosticos de `RedFamilias.jsx`, `App.jsx` y `Sidebar.jsx`: sin errores.

## Validacion pendiente en Supabase

- Probar lectura y escritura con perfiles pastor, consulta y estadisticas.
- Confirmar aislamiento A/B con JWT reales.
- Verificar que una familia de otra congregacion no pueda asociarse a un caso.
- Confirmar privacidad de `notas_confidenciales`.
- Probar fechas vencidas, doble registro y concurrencia.
- Confirmar notificaciones y reportes DEFAM en la segunda entrega.

## Proxima entrega

- Notificaciones de visitas y proximos contactos.
- Filtros por periodo, responsable, estado y prioridad.
- Reportes DEFAM agregados.
- Acceso contextual al arbol familiar de Feligresia.
- Historial y resultado detallado de acompanamientos.
