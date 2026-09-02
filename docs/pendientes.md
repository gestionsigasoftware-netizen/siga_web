# Pendientes

## Prioridad critica antes de produccion

- Resuelto (2026-09-02): logo real de SIGAP (recreado como SVG, sin fondo
	blanco) integrado en Sidebar, Login e Inicio publico, mas favicon nuevo
	(la app no tenia). Ver `docs/logo-sigap-2026-09-02.md`. No requiere
	accion del usuario.
- Resuelto (2026-09-02): exportacion con membrete real de la IPUC (logo
	y azul institucional tomados de ipuc.org.co, no inventados) en CSV,
	Excel y PDF, unificando los 3 puntos de exportacion que existian en la
	app (Auditoria, Reportes, Feligresia/Comites). Se corrigio un bug real:
	AuditoriaFeligresia.jsx separaba el CSV con ',' en vez de ';', lo que
	rompia las columnas al abrir en Excel con configuracion regional
	Colombia/espanol. Ver `docs/exportacion-membrete-ipuc-2026-09-02.md`.
	No requiere accion del usuario (sin migraciones SQL).
- Resuelto (2026-09-02): auditadas las vistas por nivel (local ->
	distrital -> nacional) comparando los 15 modulos locales contra que
	existia consolidado arriba. Mision Juvenil y Red de Familias no tenian
	NINGUN consolidado distrital (a diferencia de los otros 9 comites) — se
	agrego siguiendo el mismo patron ya probado. Hallazgo mas grande: los
	10 comites (con estos 2 nuevos) no tenian ningun equivalente nacional —
	nacional solo veia poblacion general e Impacto Misionero (3 de 10). Se
	agrego resumen_comites_nacional() + nueva pagina Comites Nacional (36
	distritos x 10 comites). Ver `docs/comites-nacional-2026-09-02.md`.
	**Accion requerida del usuario**: ejecutar
	`supabase/resumen_mision_juvenil_red_familias.sql` y
	`supabase/resumen_comites_nacional.sql`.
- Resuelto (2026-09-02): traslado real de feligreses entre congregaciones
	(antes solo existia una anotacion estadistica que no movia a la persona
	ni preservaba su historial) y "Finalizar asignacion pastoral" para
	vaciar una congregacion cuando el pastor se retira sin ir a otra
	especifica. Ver `docs/traslados-feligres-pastor-2026-09-02.md`. **Accion
	requerida del usuario**: ejecutar `supabase/traslados_feligresia.sql` y
	`supabase/finalizar_asignacion_pastoral.sql`.
- Resuelto (2026-09-02): cerradas las 5 brechas encontradas al auditar si
	distrital/nacional ya actuaban como un software de inteligencia de
	negocios completo: (1) piramide poblacional tambien en distrital y
	nacional (antes solo local); (2) censo de cargos jerarquicos de la
	junta distrital (Supervisor, Secretario, Tesorero, Presbiteros, Veedor)
	+ nueva vista Gestion Pastoral Nacional con el escalafon ministerial de
	los 36 distritos; (3) auditoria de feligresia ahora tambien accesible
	para distrital; (4) embudo del ciclo de vida espiritual (Activos ->
	Bautizados -> Sellados -> Con cargo) con tiempos promedio entre hitos;
	(5) semaforo de salud del distrito/nacional (5 senales existentes
	juntas, sin inventar un score numerico compuesto). Ver
	`docs/brechas-distrital-nacional-2026-09-02.md`. **Accion requerida del
	usuario**: ejecutar `supabase/cargos_distritales.sql` (y
	`genero_personas.sql`/`resumen_nacional.sql` si no se han ejecutado).
- Resuelto (2026-09-02): campo de genero + piramide poblacional, linea de
	tiempo de ciclo de vida espiritual por persona, proyeccion de
	crecimiento a 12 meses (transparente, basada en tendencia de 3 meses,
	no un modelo de ML — no hay historial suficiente todavia) en los 3
	niveles, y nueva vista Impacto Misionero (Obra Carcelaria + Mision
	Juvenil + Obra Social) disponible en local/distrital/nacional. Mapa de
	calor y metas distritales quedaron **explicitamente en pausa** por
	decision del usuario (ver justificacion en el doc). Ver
	`docs/genero-ciclo-vida-proyeccion-impacto-2026-09-02.md`. **Accion
	requerida del usuario**: ejecutar `supabase/genero_personas.sql`.
- Resuelto (2026-09-01): nacional/super_admin no tenian ningun dashboard
	propio — caian al dashboard generico de congregacion local, sin
	congregacion asignada, asi que salia practicamente vacio. Se agrego
	`resumen_nacional()` (agrega por distrito, analogo a
	`resumen_distrital()`) y el componente `DashboardNacional` con los
	mismos 5 insights BI del distrital pero a escala nacional, mas la
	aclaracion de que las cifras son de IPUC Colombia (no de la UPCI
	global). De paso se corrigio que la tabla "Comparativa por
	congregacion" del Dashboard distrital nunca se habia paginado. Ver
	`docs/dashboard-nacional-2026-09-01.md`. **Accion requerida del
	usuario**: ejecutar `supabase/resumen_nacional.sql` en el SQL Editor.
- Resuelto (2026-09-01): no existia ningun camino para corregir el
	distrito de una congregacion despues de creada (por ejemplo,
	congregaciones dadas de alta bajo un distrito de prueba/demo). Se agrego
	`mover_congregacion_distrito(p_congregacion_id, p_distrito_destino)`
	(solo nacional/super_admin), que ademas sincroniza `pastores.distrito_id`
	y la asignacion pastoral activa para que no queden desfasados del
	distrito real de la congregacion. Interfaz nueva en el Catalogo de
	distritos (`GestionDistritos.jsx`): tabla de congregaciones con selector
	de distrito y boton "Mover". **Accion requerida del usuario**: ejecutar
	`supabase/mover_congregacion_distrito.sql` en el SQL Editor.
- Resuelto (2026-09-01): censo de bautizados y sellados con el Espiritu
	Santo como hitos independientes en Escuela Dominical, Damas Dorcas,
	Mision Juvenil y Amigos (Feligresia y Obra Carcelaria ya lo tenian);
	bloqueo real (cliente + trigger de base de datos) de que solo personas
	bautizadas pueden pertenecer a un comite, con sellado adicional
	configurable por cargo. Ver
	`docs/censo-bautizados-sellados-2026-09-01.md`. De paso se corrigio un
	bug real: el formulario "Registrar amigo" en Amigos.jsx siempre fallaba
	por enviar fecha_nacimiento vacia a una columna date.
	Resuelto (2026-09-01): investigacion de la metodologia/estructura real
	de la IPUC hecha (ver `docs/investigacion-metodologia-ipuc-2026-09-01.md`).
	No se encontro el formato exacto del informe estadistico interno (no
	esta publicado, es documentacion interna de la organizacion) pero se
	confirmo la jerarquia nacional/distrital/local, el escalafon ministerial
	ya modelado en SIGAP, y una lista de comites/ministerios reales de la
	IPUC que SIGAP todavia no cubre (Conquistadores Pentecostales, Musica,
	Artistica, Obra Social, Educacion Teologica para membresia general) -
	pendiente de decidir si se construyen a futuro.
- Resuelto (2026-09-01): nuevo modulo Obra Carcelaria completo (asistencia
	interna, delegados/INPEC, seguimiento familiar, reinsercion
	post-penitenciaria cruzando congregaciones, catalogo de centros de
	reclusion por distrito). Ver `docs/obra-carcelaria-2026-09-01.md`.
	**Pendiente**: ampliar el selector de congregacion destino de
	reinsercion a busqueda nacional si se necesita en la practica.
- Resuelto (2026-09-01): hueco de RLS en Escuela Dominical y Damas Dorcas
	— el consolidado distrital devolvia 0 para cualquier congregacion donde
	el distrital no fuera tambien pastor local (no detectado antes porque
	la cuenta de prueba es pastora Y distrital de la misma y unica
	congregacion de su distrito). Ver
	`docs/fix-rls-escuela-dominical-damas-dorcas-2026-09-01.md`. **Accion
	requerida del usuario**: volver a ejecutar
	`supabase/escuela_dominical_damas_dorcas.sql` completo en el SQL Editor
	para aplicar la correccion (el archivo es idempotente).
- Resuelto (2026-08-31): cache de datos entre navegaciones + skeleton de
	carga para los 3 modulos mas usados (Resumen/Dashboard rama local,
	Feligresia, Misiones y Evangelismo). Ver
	`docs/cache-skeleton-2026-08-31.md`. **Pendiente**: replicar el mismo
	patron al resto de ~17 modulos del Sidebar y a la rama distrital del
	Dashboard, que siguen con el "Cargando..." bloqueante de antes.
- Resuelto (2026-08-31): `supabase/gestion_distrital_congregaciones.sql` ya
	esta ejecutada y `invitar-usuario` ya fue redesplegada
	(`npx supabase functions deploy invitar-usuario --project-ref
	yeexyxsysuczsxbnauqf`). Probado de extremo a extremo con una cuenta
	distrital real (rol agregado a la cuenta de prueba existente): alta de
	congregacion + pastor funciona, y la autorizacion distrital para invitar
	tambien funciona. Ver `docs/alta-congregaciones-distrital-2026-08-31.md`.
- **Nuevo pendiente critico**: configurar un proveedor SMTP propio en
	Supabase Auth (Resend/SendGrid/Postmark) antes de produccion real. El
	limite de envio de correo por defecto es muy bajo (modo desarrollo) y
	bloqueo un intento real de invitacion durante la prueba del 2026-08-31
	("email rate limit exceeded"); con ~5.000 congregaciones esto va a fallar
	constantemente si no se configura.
- Resuelto (2026-08-31): rediseno del nivel distrital completo (Dashboard,
	Reportes, Gestion pastoral con acceso real de pastores, traslados que
	mueven el acceso, selector de rol, catalogo de distritos). Ver
	`docs/nivel-distrital-consolidado-2026-08-31.md`. Pendiente: cargar el
	listado real de los 36 distritos de la IPUC desde `/distritos`, y probar
	esa pantalla con una cuenta nacional/super_admin real (no existe todavia).
- Resuelto (2026-09-01): Fase 3 del BI de la IPUC — Escuela Dominical
	(Mision Infantil) y Damas Dorcas, con ficha individual completa y
	consolidado distrital. Cierra las 3 fases del plan BI. Ver
	`docs/bi-fase3-escuela-dominical-damas-dorcas-2026-09-01.md`.
- Resuelto (2026-09-01): Fase 2 del BI de la IPUC — 5 insights en el
	Dashboard distrital (brecha de llenura, eficacia REFAM, embudo Uno
	Mas->REFAM, movimiento de membresia, madurez de la obra), cada uno con
	numero + frase de interpretacion. Ver
	`docs/bi-fase2-insights-2026-09-01.md`. Pendiente: Fase 3 (Escuela
	Dominical/Damas Dorcas).
- Resuelto (2026-09-01): Fase 1 del BI de la IPUC — sellados con el
	Espiritu Santo, estudios REFAM individuales, madurez de sede, movimientos
	de membresia estructurados y clasificacion poblacional de zonas. Ver
	`docs/bi-fase1-datos-base-2026-09-01.md`. Tambien se corrigio un bug
	critico: el rol activo (selector construido el 2026-08-31) se perdia en
	cada recarga completa de pagina y volvia siempre al de mayor prioridad.
	Pendiente: Fase 2 (insights BI) y Fase 3 (Escuela Dominical/Damas Dorcas).
- Resuelto (2026-08-31): licencias ministeriales de la IPUC (Obrero, Licencia
	Local, Licencia General, Ordenacion Ministerial) en Gestion pastoral, con
	historial de ascensos con fecha. Solo el lider distrital puede ascender, un
	nivel a la vez, sin saltos. Ver `supabase/licencias_pastorales.sql`.
- Ejecutar y verificar `supabase/seguridad_produccion.sql`.
- Aplicar en el proyecto Supabase real la correccion de `tiene_permiso()`
	(faltaban `red_familias.consultar` y `red_familias.editar` en la lista de
	permisos implicitos del pastor local; ver
	`docs/auditoria-sidebar-red-familias-2026-08-30.md`) y confirmar que "Modo
	consulta" desaparece para pastores sin perfil adicional asignado.
- Comparar permiso por permiso la lista de `accesos.sql` contra la lista de
	`seguridad_produccion.sql` en `tiene_permiso()`, por si quedo algun otro
	permiso fuera al redefinir la funcion.
- Revisar si la tarjeta "Seguridad" de Preferencias personales debe reflejar
	un estado real (MFA, ultima sesion) en vez de texto estatico siempre en
	verde, una vez se resuelvan los pendientes de seguridad de produccion.
- Confirmar RLS en todas las tablas y vistas expuestas.
- Probar la auditoría con pastor local y niveles superiores, incluyendo filtros,
	paginación, exportación y detalle expandible.
- Configurar HTTPS y dominio en el hosting.
- Activar confirmacion de correo, politica global de contrasenas y proteccion contra abuso en Supabase Auth.
- Activar MFA para administradores.
- Configurar backups/PITR y retencion.
- Configurar monitoreo, alertas y revision de logs.
- Configurar CSP, HSTS y anti-clickjacking.
- Verificar que todos los buckets de Storage sean privados.
- Ejecutar prueba de aislamiento entre dos congregaciones.
- Revisar variables de entorno y confirmar que no existe `service_role` en el bundle.

## Prioridad alta

- Prueba funcional completa de Evangelismo despues de aplicar su migracion correspondiente.
- Prueba funcional completa de Mision Juvenil con instituciones, estudiantes, grupos y filtros.
- Validar los registros provenientes de la PWA cuando ese proyecto vuelva a entrar en alcance.
- Documentar usuarios iniciales, responsables y procedimiento de baja de acceso.
- Probar el ciclo completo de Equipo de trabajo con una persona sin cuenta, una
	cuenta existente, perfil web, responsabilidad operativa y retiro de acceso.
- Revisado (2026-08-31): `Amigos.jsx`, `Evangelismo.jsx` y `MisionJuvenil.jsx`
	no tienen la condicion de carrera de Equipo de trabajo — los tres limpian
	el mensaje de error correctamente en cada carga exitosa. No requiere
	cambio.
- Corregido (2026-08-31): Poblacion (Feligresia) no mostraba ninguna persona
	por un filtro de estado mal declarado. Ver
	`docs/bug-critico-poblacion-2026-08-31.md`. Falta probar la paginacion con
	mas de 50 personas reales (solo se probo con 5, una sola pagina).

## Mejoras funcionales pendientes

### Comités y Feligresía

- Completar búsqueda remota de personas para asignar integrantes de comités.
- Completar edición avanzada de responsable y tipo desde el detalle del
	comité.
- Separar en RLS y UI los permisos específicos de comités.
- Completar tabla accesible y filtros del historial de comités.
- Ejecutar pruebas Supabase de concurrencia, fechas, reemplazos, aislamiento
	entre congregaciones y perfiles.
- Revisar cálculo de responsabilidades próximas a vencer.
- Probar en Supabase que `cargos_comite` (único por comité, admite suplente)
	se aplica correctamente ahora que asignar un integrante guarda su `cargo_id`
	real del catálogo (antes quedaba siempre en null).

### Módulos, Configuración y Seguimiento pastoral (auditoria 2026-08-29)

- Probar con los tres perfiles locales (`pastor`, `estadisticas`, `consulta`)
	que solo `pastor` puede entrar a Módulos y actividades, y que Evangelismo y
	Misión Juvenil ya no se pueden renombrar ni desactivar desde ahí.
- Probar que los enlaces agregados en Configuración hacia Módulos y
	actividades y hacia Evangelismo no dejan huérfano a quien buscaba el
	catálogo anterior.
- Probar la agrupación de alertas por tipo en Seguimiento pastoral con un
	volumen real de datos (no solo la congregación de prueba con 5 personas).

### Amigos en ruta

- Crear insights sobre contacto reciente, sin inferencias negativas sobre las
	personas.
- Administrar etapas y zonas desde una interfaz autorizada.
- Incorporar fecha de nacimiento y estado civil al alta y edición general.
- Ejecutar pruebas Supabase de aislamiento por congregación y zona, permisos y
	sincronización con Evangelismo/PWA.

### Corrección y contingencia de asistencia

- Probar en Supabase el aislamiento entre congregaciones, los permisos de
	`estadisticas.registrar` y `feligresia.editar`, la validación del motivo y la
	confirmación de duplicados.
- Añadir edición o eliminación controlada solo si el procedimiento operativo
	de la congregación lo requiere; por ahora la pantalla conserva el registro
	original y no expone acciones destructivas.

### Ruta Evangelística (avanzado, 2026-08-31)

- Resuelto: las seis estaciones ya tienen pantalla operativa real —
	Diagnóstico de Métodos y grupos REFAM en Evangelismo, compromiso Uno Más y
	atenciones BIS en la ficha de Amigos, ESFOB/Discipulado en `RutaFormacion.jsx`.
	Ver `docs/ruta-evangelistica-avanzada-2026-08-31.md`.
- Confirmar institucionalmente nombres, orden y criterios de salida de las
	seis estaciones de la Ruta Evangelística (decisión de la dirección de la
	IPUC, no de ingeniería).
- Definir si el módulo visible debe renombrarse a Misiones y Evangelismo
	ahora que los seis procesos ya están operativos.
- Probar estas pantallas con perfiles distintos a pastor (`estadisticas`,
	`consulta`) para confirmar que los formularios se ocultan según
	`ruta_evangelistica.editar`/`.registrar`.

### Misión Juvenil (avanzado, 2026-08-31)

- Resuelto: lecciones individuales con asistencia por estudiante y registro
	de líderes ya tienen pantalla propia. Ver
	`docs/ruta-evangelistica-avanzada-2026-08-31.md`.
- Decidir si `mision_grupos.leccion_actual` debe seguir siendo editable a
	mano al crear el grupo, ahora que también se actualiza solo al registrar
	lecciones.
- Carga de documentos y certificados mediante Storage privado.
- Exportacion PDF de reportes, si el negocio la requiere.
- Registro publico controlado de nuevas congregaciones, si el negocio lo requiere.
- La UI para administrar tipos de actividad ya esta disponible en Modulos y
	actividades; queda pendiente ampliar la configuracion solo si el negocio lo requiere.
- Probar en Supabase el umbral de alertas y las reglas de captura configuradas
	por congregacion, especialmente con perfiles estadisticas y consulta.
- PWA movil separada para captura offline y sincronizacion.

## Mantenimiento

- Actualizar esta lista cuando se termine cada tarea.
- No volver a registrar como pendiente una funcion ya implementada.
- Antes de agregar un modulo, revisar `docs/arquitectura.md`, el codigo existente y las migraciones aplicadas.
