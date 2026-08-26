# Estado del proyecto

## Resumen

SIGA es una SPA privada para gestion pastoral institucional. Los usuarios autorizados ingresan por autenticacion y consultan los modulos segun su congregacion, nivel y permisos.

Estado del frontend: funcional y con build de produccion validado.

Ultima validacion conocida:

- `npm run build`: correcto.
- `git diff --check`: correcto; solo presenta avisos de conversion LF/CRLF en archivos existentes.
- Diagnosticos de los archivos modificados: sin errores conocidos.

## Funciones terminadas

### Plataforma base

- React 18, Vite, Tailwind CSS y React Router.
- Login, recuperacion y actualizacion de contrasena.
- Rutas protegidas mediante `ProtectedRoute`.
- Dashboard inicial para usuarios autenticados.
- Sidebar responsive con menu por rol y scroll interno.
- Centro de notificaciones.
- Preferencias personales: notificaciones, alertas y formato regional de fecha.
- Configuracion de congregacion y catalogos operativos.

### Acceso y administracion

- Modelo multi-tenant por `congregacion_id`.
- Niveles `super_admin`, `nacional`, `distrital` y `local`.
- Perfiles `pastor`, `estadisticas` y `consulta`.
- Asignacion de perfiles desde Equipo Congregacion.
- Aprobaciones, auditoria y gestion pastoral distrital.

### Feligresia

- Poblacion y estados pastorales.
- Familias, parentescos y bautismo.
- Comites, membresias y cargos historicos.
- Seguimiento pastoral con agenda.
- Alertas persistentes.
- Importacion y exportacion CSV/XLSX.
- Auditoria paginada y filtrable.

### Captura y analitica

- Motor generico de registros de actividad.
- Catalogo de modulos y tipos de actividad administrable por el pastor local.
- Actividades personalizadas conservando el nombre real del culto.
- Correccion o contingencia desde la web con motivo obligatorio.
- Dashboard, reportes, filtros, graficos y exportacion existente.
- Funcion SQL `resumen_asistencia_movil` para resumen agregado por fecha,
	protegida por acceso activo a la congregacion.
- La PWA movil queda preparada para alimentar `registros_actividad`, pero esta
	fuera del alcance actual.

### Evangelismo

- Dashboard con lugares, capturas, asistencia, amigos en ruta, conversiones y tasa de conversion.
- Filtros por periodo, zona y metodologia.
- Graficos de asistencia y conversiones.
- Tabla institucional y alertas operativas.
- Alta y edicion de zonas con responsable.
- Metodologias y relacion de amigos con metodologia.
- Permisos `evangelismo.consultar`, `evangelismo.editar` y `evangelismo.registrar`.

### Mision Juvenil

- Dashboard de instituciones, estudiantes, grupos, asistencia y bautizados.
- Fases institucionales EFES 1 a 3.
- Estados espirituales de estudiantes.
- Filtros por institucion y estado.
- Alta de instituciones, estudiantes y grupos.
- Progreso de lecciones por grupo.
- Permisos `mision_juvenil.consultar`, `mision_juvenil.editar` y `mision_juvenil.registrar`.
- Ruta web y entrada en el Sidebar.
- Tablas SQL para instituciones, estudiantes, grupos, lecciones, asistencia individual y lideres.

## Migraciones existentes

- `supabase/schema.sql`
- `supabase/vistas_dashboard.sql`
- `supabase/migracion_produccion.sql`
- `supabase/accesos.sql`
- `supabase/pastoral_distrital.sql`
- `supabase/notificaciones.sql`
- `supabase/configuracion.sql`
- `supabase/feligresia.sql`
- `supabase/asistencia_web.sql`
- `supabase/evangelismo.sql`
- `supabase/mision_juvenil.sql`
- `supabase/actividad_personalizada.sql`
- `supabase/estadisticas_movil.sql`
- `supabase/seguridad_produccion.sql`

El estado de ejecucion de cada migracion debe confirmarse en el SQL Editor del proyecto Supabase. `mision_juvenil.sql` fue ejecutada segun el estado de trabajo actual; `seguridad_produccion.sql` debe ejecutarse antes de produccion si aun no se ha aplicado.
