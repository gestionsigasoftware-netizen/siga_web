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
- Preferencias personales: notificaciones, alertas y formato regional de
	fecha; el formato de fecha ahora se aplica de verdad en toda la app
	(auditoría, notificaciones, historial de comités y de Amigos, Dashboard),
	no solo en la propia pantalla de preferencias.
- Configuracion de congregacion y catalogos operativos.
- Edicion del nombre de la congregacion desde Configuracion local; el distrito
	se muestra como referencia de solo lectura en el Sidebar.

### Acceso y administracion

- Modelo multi-tenant por `congregacion_id`.
- Niveles `super_admin`, `nacional`, `distrital` y `local`.
- Perfiles `pastor`, `estadisticas` y `consulta`.
- Asignacion de perfiles desde Equipo Congregacion.
- Aprobaciones, auditoria y gestion pastoral distrital.
- Equipo de trabajo permite seleccionar una persona, asignar perfiles de
	acceso, agregar una responsabilidad operativa, enviar o vincular su cuenta y
	retirar perfiles conservando el historial.
- La pantalla limita los listados a la congregacion activa, evita asignaciones
	duplicadas y comunica errores con mensajes orientados al usuario.
- Equipo de trabajo ya no deja pegado el aviso "sin congregacion asignada"
	cuando el rol del usuario aun no habia terminado de resolverse al entrar
	directo a la pantalla.

### Feligresia

- Poblacion y estados pastorales.
- Familias, parentescos y bautismo.
- Comites, membresias y cargos historicos.
- Seguimiento pastoral con agenda.
- Alertas persistentes.
- Importacion y exportacion CSV/XLSX.
- Auditoria paginada y filtrable.
- Auditoria disponible para niveles distrital, nacional, super_admin y pastor
	local autorizado; conserva el detalle anterior y posterior de cada cambio.
- Comites: la asignacion de cargo usa el catalogo real `cargos_comite` (antes
	quedaba desconectada); los integrantes se agrupan por cargo real y se puede
	editar o reemplazar un integrante conservando el historial.
- Seguimiento pastoral: agenda, alertas automaticas y reapertura de
	seguimientos cerrados sin proxima fecha, pidiendo la fecha antes de reabrir.
	Las alertas muestran conteo total, badge de prioridad real (alta/media) y
	se agrupan por tipo cuando se repiten.

### Captura y analitica

- Motor generico de registros de actividad.
- Catalogo de modulos y tipos de actividad administrable por el pastor local.
- Actividades personalizadas conservando el nombre real del culto.
- Correccion o contingencia desde la web con motivo obligatorio.
- Dashboard, reportes, filtros, graficos y exportacion existente.
- Funcion SQL `resumen_asistencia_movil` para resumen agregado por fecha,
	protegida por acceso activo a la congregacion.
- Funcion SQL `resumen_dashboard` para evitar descargar historicos completos
	al navegador y conservar conteos agregados por fecha.
- Seed de datos de demostracion repetible para poblar los modulos web actuales
	en una congregacion demo.
- La PWA movil queda preparada para alimentar `registros_actividad`, pero esta
	fuera del alcance actual.
- `RegistrarAsistencia.jsx` funciona exclusivamente como correccion o
	contingencia: exige motivo, fecha, responsable cuando corresponde, zona para
	modulos extramurales y confirma posibles duplicados.
- Los registros recientes de correccion se consultan limitados a la
	congregacion activa y sus politicas de escritura son coherentes con los
	permisos de estadisticas y pastor.

### Evangelismo

- Dashboard con lugares, capturas, asistencia, amigos en ruta, conversiones y tasa de conversion.
- Filtros por periodo, zona y metodologia.
- Graficos de asistencia y conversiones.
- Tabla institucional y alertas operativas.
- Alta y edicion de zonas con responsable.
- Metodologias y relacion de amigos con metodologia.
- Permisos `evangelismo.consultar`, `evangelismo.editar` y `evangelismo.registrar`.

### Red de Familias / DEFAM

- Ruta protegida `/red-familias` y entrada debajo de Feligresía.
- Panorama de familias, acompañamientos abiertos, visitas pendientes y
	actividades realizadas.
- Tablas `red_familias_casos`, `red_familias_visitas` y
	`red_familias_actividades` con RLS por congregación.
- Permisos `red_familias.consultar` y `red_familias.editar`.
- El módulo consume `familias` y `personas`; no duplica el censo.

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
- Registro de lecciones por grupo con asistencia individual por estudiante, y
	administracion de lideres (alta/baja), ya con pantalla propia.

### Pastoral Distrital

- Registro y traslado de pastores entre congregaciones del distrito, con
	historial de asignaciones.
- Preparación académica y ministerial (2026-08-31): cada pastor puede tener
	varios registros de formación (título, curso, diplomado, especialización,
	maestría, doctorado, seminario bíblico u otro) con institución y fecha.
	Los obreros (sin ninguna licencia) muestran además la fecha de su tarjeta
	de predicador. Ver `supabase/formacion_pastoral.sql`.
- Licencias ministeriales de la IPUC (2026-08-31): cada pastor tiene un
	escalafon secuencial (Obrero -> Licencia Local -> Licencia General ->
	Ordenacion Ministerial), visible como insignia en su ficha y con historial
	de ascensos con fecha. Solo el lider distrital puede ascender a un pastor,
	un nivel a la vez.
- Alta de congregaciones nuevas desde el rol distrital (2026-08-31): un
	lider distrital puede crear una congregacion de su distrito y dejar
	invitado a su primer pastor local, todo desde la interfaz web. Migracion
	ejecutada y Edge Function redesplegada; probado de extremo a extremo con
	una cuenta distrital real. Pendiente critico de infraestructura:
	configurar SMTP propio en Supabase Auth antes de produccion (el limite de
	envio de correo por defecto bloquea las invitaciones reales). Ver
	`docs/alta-congregaciones-distrital-2026-08-31.md`.
- Rediseno del nivel distrital (2026-08-31): Resumen, Reportes y Gestion
	pastoral ahora tienen una vista consolidada real por distrito (comparativa
	por congregacion), en vez de reutilizar la vista local. Auditoria de
	Feligresia se quito del menu distrital. Pastores ahora quedan ligados a su
	persona/acceso real (antes eran dos registros paralelos) y los traslados
	mueven ese acceso con ellos. Selector de rol (pantalla de login + switcher
	en el Sidebar) para cuentas con mas de un rol activo. Nuevo catalogo de
	distritos con numero identificador (`/distritos`, solo nacional/super_admin,
	vacio hasta que se carguen los 36 distritos reales de la IPUC). Nombre del
	usuario logueado visible en el encabezado. Ver
	`docs/nivel-distrital-consolidado-2026-08-31.md`.
- Pendiente: panel de monitoreo agregado por congregacion del distrito
	(graficos e insights), y ampliar el modelo de datos de pastores (salario,
	tiempo de servicio, cargos distritales) — requiere definir con el usuario
	las reglas de privacidad de datos sensibles antes de construirlo.

### Ruta Evangelistica

- Definidos los seis procesos institucionales: Metodos, Uno Mas, BIS, REFAM,
	ESFOB/EFOB y Discipulado.
- Migracion `supabase/ruta_evangelistica.sql` aplicada. Las seis estaciones
	tienen pantalla operativa: Metodos (diagnostico territorial en
	Evangelismo), Uno Mas y BIS (compromiso y atenciones dentro de la ficha de
	Amigos en ruta), REFAM (grupos, participantes y reuniones en Evangelismo),
	ESFOB/EFOB y Discipulado (pantalla dedicada `RutaFormacion.jsx`).
- El motor generico de avance entre estaciones (`ruta_estaciones` +
	`ruta_procesos`) sigue viviendo en Amigos en ruta; las pantallas nuevas
	capturan el detalle una vez la persona ya esta en la estacion, sin duplicar
	el mecanismo de traslado.

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
- `supabase/ruta_evangelistica.sql`
- `supabase/actividad_personalizada.sql`
- `supabase/estadisticas_movil.sql`
- `supabase/seguridad_produccion.sql`

El estado de ejecucion de cada migracion debe confirmarse en el SQL Editor del proyecto Supabase. `mision_juvenil.sql` fue ejecutada segun el estado de trabajo actual; `seguridad_produccion.sql` debe ejecutarse antes de produccion si aun no se ha aplicado.
