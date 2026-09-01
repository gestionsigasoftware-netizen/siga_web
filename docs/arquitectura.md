# Arquitectura

## Frontend

- Entrada: `src/main.jsx`.
- Router y lazy loading: `src/App.jsx`.
- Layout protegido: `src/components/layout/`.
- Pantallas: `src/pages/`.
- Cliente de datos y autenticacion: `src/lib/supabase.js` y `src/hooks/useAuth.js`.
- Resolucion de alcance y rol: `src/hooks/useMiRol.js`.

La aplicacion es una SPA. La ruta `/` muestra una entrada publica breve, `/login` es el acceso privado y `/app` muestra el Dashboard despues de autenticarse. `/ayuda` contiene respuestas de acceso y `/legal` contiene la base de privacidad y condiciones de uso. No existe registro publico libre.

## Backend

Supabase proporciona:

- PostgreSQL.
- Supabase Auth.
- RLS para aislamiento por congregacion.
- Funciones y triggers de integridad.
- Realtime para notificaciones.
- Storage, si se habilita para documentos.

El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La clave `service_role` nunca debe llegar al navegador.

## Multitenencia y jerarquía de roles

SIGA es multi-tenant para las ~5.000 congregaciones de la IPUC a nivel
nacional, organizadas en 36 distritos. Cada congregación es un tenant
aislado por `congregacion_id`; ninguna congregación debe ver ni mezclar
información de otra, en ningún nivel de la jerarquía. La jerarquía y sus
responsabilidades:

- **Nacional**: visión agregada de todo el país.
- **Distrital**: administra su propio distrito (uno de los 36). Da de alta
	las congregaciones locales de su distrito y su primer pastor —
	aclarado el 2026-08-31: antes no existía ningún camino funcional para
	esto, ver `docs/alta-congregaciones-distrital-2026-08-31.md`. Monitorea
	de forma agregada la información que cada congregación de su distrito
	suministra (vistas, gráficos, insights para toma de decisiones a nivel
	distrital) — esta vista es distinta a la vista local, no la misma
	pantalla reducida. Administra también la gestión pastoral propia del
	distrito: pastores, su asignación y traslado entre congregaciones, y
	(pendiente de construir, ver `docs/pendientes.md`) su información de
	tiempo de servicio, familia, salario, cargos y estadísticas
	distritales — todo lo de carácter pastoral/distrital se maneja desde
	este rol, no desde lo local.
- **Local**: opera el día a día de su propia congregación (censo, comités,
	captura, evangelismo, etc.), sin visibilidad de otras congregaciones ni
	de la información distrital que no le corresponde.

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

- Feligresia: censo ministerial y acompañamiento local. `personas` representa
	el recurso humano de la congregacion: niños, adolescentes, jovenes, adultos
	y personas mayores. Familias, comites, cargos y seguimientos se relacionan
	con este censo.
- Evangelismo: trabajo territorial, conversiones y Ruta Evangelística.
- REFAM (Reunión Familiar y de Amistad) pertenece a Misiones/Evangelismo y
	también puede desarrollarse en Misión Juvenil como estrategia evangelística
	juvenil.
- Mision Juvenil: instituciones, estudiantes, grupos juveniles, REFAM juvenil
	y progreso espiritual.
- La navegación visible agrupa estos flujos bajo **Misiones y Evangelismo**;
	las rutas técnicas `/evangelismo`, `/amigos` y `/mision-juvenil` se conservan
	para compatibilidad.
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

## Intramural vs. extramural y el rol de la PWA

SIGA distingue dos tipos de captura de asistencia, ambos alimentados por la
misma PWA (proyecto aparte, aun sin construir) y por el mismo contrato
`registros_actividad`:

- **Intramural**: lo que ocurre dentro del templo. El modulo sembrado
	`Ujieres` (`alcance = 'interno'`) representa esto — cultos, escuela
	dominical, etc. Los responsables de tomar asistencia en el salon son los
	ujieres; sus tipos de actividad se configuran en Modulos y actividades.
- **Extramural**: trabajo territorial fuera del templo — Evangelismo y
	Mision Juvenil (`alcance = 'extramural'`).

`supabase/evangelismo.sql` documenta esto en el comentario de la tabla:
"Fuente oficial de asistencia de PWA para Ujieres y Evangelismo". El
Dashboard ya refleja esta separacion ("Separa lo que registra Ujieres de lo
que gestiona la ruta pastoral").

**No confundir la asistencia agregada (PWA) con el seguimiento individual
(web):** el conteo de personas por culto o actividad territorial es
agregado y anonimo, capturado por la PWA. El seguimiento con nombre propio
— un Amigo en la Ruta Evangelistica, un estudiante de Mision Juvenil — se
lleva directamente en la web, nunca en la PWA, porque requiere ficha
individual, historial y responsable, no solo un conteo. Una persona
(Amigo o estudiante) solo se traslada de "inconverso" a feligres cuando se
bautiza, mediante el proceso de alta definido por la congregacion
(`incorporar_amigo_bautizado`); nunca automaticamente ni por alcanzar una
estacion de la ruta.

## Comites: mecanismo unico para todo equipo operativo local

`Comites` (dentro de Feligresia) es el lugar unico para crear cualquier
comite o equipo que preste un servicio en la congregacion local, incluido
**Ujieres** — no existe ni debe crearse una pantalla aparte para
administrar ese equipo. Los integrantes de cualquier comite salen de
`Poblacion` (censo de personas bautizadas/activas de la congregacion); no
hay una fuente de personal distinta para comites intramurales. Antes de
proponer un modulo nuevo para administrar un equipo operativo, confirmar
primero que Comites no cubre ya esa necesidad.

## Limite entre Feligresia y trabajo extramural

Feligresia no registra Amigos en ruta, zonas, metodologias de Evangelismo ni
asistencia agregada de los modulos. Esos datos permanecen en sus respectivos
flujos. Un Amigo convertido puede incorporarse al censo mediante un proceso de
alta definido por la congregacion; no se debe mezclar automaticamente ni
duplicar la persona.

La fecha de nacimiento permite caracterizar la poblacion por edad. El estado
civil, parentesco y familia permiten observar estructura de hogares, viudez y
divorcio. Son señales de acompañamiento pastoral, no diagnósticos automáticos
de disfuncionalidad familiar.
