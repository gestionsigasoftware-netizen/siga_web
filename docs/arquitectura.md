# Arquitectura

## Frontend

- Entrada: `src/main.jsx`.
- Router y lazy loading: `src/App.jsx`.
- Layout protegido: `src/components/layout/`.
- Pantallas: `src/pages/`.
- Cliente de datos y autenticacion: `src/lib/supabase.js` y `src/hooks/useAuth.js`.
- Resolucion de alcance y rol: `src/hooks/useMiRol.js`.

La aplicacion es una SPA. La ruta `/login` es la primera vista para usuarios sin sesion. La ruta `/` muestra el Dashboard despues de autenticarse. No se requiere Home publico para el sistema administrativo.

## Backend

Supabase proporciona:

- PostgreSQL.
- Supabase Auth.
- RLS para aislamiento por congregacion.
- Funciones y triggers de integridad.
- Realtime para notificaciones.
- Storage, si se habilita para documentos.

El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La clave `service_role` nunca debe llegar al navegador.

## Modelo de alcance

Las tablas operativas guardan `congregacion_id`. Las funciones `mis_congregaciones()` y `mis_distritos()` determinan el alcance del usuario autenticado. Las politicas RLS son la autoridad final; ocultar botones en React no es una medida de seguridad.

El acceso combina:

- Nivel geografico: nacional, distrital o local.
- Perfil funcional: pastor, estadisticas o consulta.
- Permiso concreto: consultar, editar o registrar.

## Alta de usuarios

El administrador no debe crear cuentas desde el panel de Supabase. El flujo
de produccion debe vivir dentro de SIGA: solicitar nombre, correo y perfil,
invitar al usuario mediante una funcion segura del servidor, vincular la
cuenta Auth con `personas.auth_user_id` y crear la asignacion de acceso.

La clave `service_role`, necesaria para invitar cuentas, solo puede existir en
una Edge Function o backend protegido. Nunca debe enviarse al navegador.

## Registros de actividad

`registros_actividad` es el contrato comun para las capturas agregadas de asistencia. Cada registro conserva congregacion, modulo, tipo de actividad, zona, responsable, usuario capturador, fecha, novedades y desglose.

La aplicacion web funciona como administracion, analisis y contingencia. La captura movil normal queda reservada para la PWA futura.

## Modulos

- Feligresia: censo y acompañamiento local.
- Evangelismo: trabajo territorial y conversiones.
- Mision Juvenil: instituciones, estudiantes, grupos REFAM y progreso espiritual.
- Estadisticas y Reportes: consulta de registros agregados.
- Pastoral Distrital: gestion de pastores y destinos distritales.
- Modulos y actividades: catalogos de captura por congregacion, administrados
	por el pastor local.
- Preferencias: configuracion personal y parametros operativos de la
	congregacion.

La identidad visible de una congregacion se administra desde Configuracion
local. El nombre del distrito se obtiene de la relacion `distritos` y se
presenta como referencia de solo lectura.

La pantalla web de correccion de asistencia es una contingencia autorizada,
no el canal normal de captura. La PWA futura debe conservar el contrato de
`registros_actividad`; la funcion `resumen_asistencia_movil` solo expone
resumenes agregados a usuarios con acceso activo a la congregacion.

No duplicar estos flujos en nuevas pantallas sin revisar primero las implementaciones existentes.
