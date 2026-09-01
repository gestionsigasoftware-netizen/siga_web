# Auditoria de modulos del Sidebar: Modulos y actividades, Configuracion, Comites, Seguimiento pastoral

Fecha: 29 de agosto de 2026

## Objetivo

Verificar, modulo por modulo del Sidebar, que cada pantalla cumpla la intencion con la que fue creada y corregir lo que se encuentre sin romper la app ni la coherencia del codigo existente (reutilizar patrones y funciones ya probadas en vez de escribir logica nueva).

## Modulos y actividades (`src/pages/Modulos.jsx`)

Hallazgos:

- No exigia perfil `pastor`: cualquier usuario local (`estadisticas`, `consulta`) podia crear, renombrar y desactivar modulos y tipos de actividad. El Sidebar tampoco lo restringia (`show: nivel === "local"`).
- Los modulos sembrados por otras pantallas (Evangelismo, Mision Juvenil) se listaban igual que un modulo casero. `Evangelismo.jsx` y `MisionJuvenil.jsx` ubican su modulo por coincidencia exacta de nombre (`ilike nombre_modulo = 'Evangelismo'` / `'Mision Juvenil'`); renombrarlo o desactivarlo desde aqui rompe esas pantallas en silencio.

Cambios aplicados:

- Se agrego el mismo gate que ya usa `Configuracion.jsx` (`rol_local !== 'pastor'` bloquea la pantalla) y el Sidebar ahora reutiliza la variable `puedeConfigurar` ya existente en vez de un criterio suelto.
- Se bloquearon "Editar" y "Desactivar" para los modulos identificados como Evangelismo o Mision Juvenil, tanto en la interfaz como dentro de los manejadores (`saveModuleName`, `toggleModule`), para que no se puedan forzar desde la consola del navegador.

## Configuracion local (`src/pages/Configuracion.jsx`)

Hallazgo: dos catalogos duplicaban administracion que ya tenia un dueno mas completo en otra pantalla.

- Catalogo "Modulos": mas debil que `Modulos.jsx` (sin edicion, sin tipos de actividad, sin proteccion de modulos de sistema).
- Catalogo "Zonas de Evangelismo": creaba zonas sin `modulo_id` ni lider, mientras que `Evangelismo.jsx` ya crea la zona vinculada al modulo y con responsable. Una zona creada desde Configuracion quedaba huerfana: `RegistrarAsistencia.jsx` filtra zonas por `modulo_id`, asi que nunca aparecia en ningun formulario de captura.

Cambios aplicados:

- Se eliminaron ambos catalogos de `Configuracion.jsx` (funciones `agregarModulo`/`quitarModulo`/`agregarZona`/`quitarZona` y sus queries) y se reemplazaron por una nota con enlace a la pantalla dueña real (`/modulos`, `/evangelismo`).
- Se conservo la lectura de modulos para el selector "Modulo predeterminado" de preferencias, ahora filtrada a solo modulos activos (antes ofrecia modulos desactivados como opcion).
- Confirmado que `tipos_comite` y `cargos_comite` NO tienen este problema: el submodulo Comites de Feligresia solo los lee (para filtros y el desplegable de tipo), nunca los crea ni edita. Configuracion sigue siendo su unico dueno legitimo.

## Comites (pestaña `comites` en `src/pages/FeligresiaAdmin.jsx`)

Hallazgos:

- La pestaña renderizaba dos formularios de "Crear comite" simultaneos (uno completo via `CommitteeCreateForm`, otro basico suelto en la seccion), ambos llamando al mismo `saveCommittee`.
- Bug funcional real: el formulario de "Asignar integrante" ofrecia una lista de cargos fija en el codigo (`COMMITTEE_ROLES`), nunca conectada a los `id` reales del catalogo `cargos_comite`. Toda asignacion quedaba con `cargo_id = null`, por lo que las reglas configuradas en Configuracion (cargo unico por comite, si admite suplente) nunca se aplicaban en la practica. Como consecuencia, un cargo personalizado (no una de las 7 etiquetas fijas) tampoco aparecia agrupado en las tarjetas de comite.
- La funcion `editCommitteeMember` (reemplazo de integrante con `cargo_id` normalizado, via RPC `reemplazar_membresia_comite`) ya estaba completa y correcta en el codigo, pero no tenia ningun boton que la invocara.

Cambios aplicados:

- Se elimino el formulario de creacion duplicado.
- El selector de cargo al asignar integrante ahora usa el catalogo real `cargos_comite`; si la congregacion aun no configuro cargos, cae a un campo de texto libre con nota para configurarlos en Configuracion.
- Se agrego `committeeMemberGroups()` para agrupar integrantes por el cargo real del catalogo, con un grupo residual para membresias antiguas que no calcen.
- Se expuso el boton "Editar" (junto a "Retirar") en cada integrante, conectado a `editCommitteeMember`.

## Seguimiento pastoral (pestaña `seguimiento` en `src/pages/FeligresiaAdmin.jsx`)

Hallazgo: el boton "Reabrir" del historial fallaba siempre que el seguimiento se cerro sin fecha de proximo contacto (caso comun: notas cerradas al momento sin agendar nada mas). La base de datos exige `proxima_fecha` no nula para `estado = 'pendiente'` (trigger `validar_seguimiento_pastoral` en `feligresia.sql`), pero `updateFollowupStatus` solo cambiaba el estado sin pedir fecha, y Supabase rechazaba el `UPDATE` con una excepcion que el usuario solo veia como "No se pudo actualizar el seguimiento".

Cambio aplicado: al reabrir un seguimiento sin `proxima_fecha`, se pide la fecha en un dialogo (reutilizando `AdminDialog`, el mismo mecanismo que ya usa "Atender alerta") antes de guardar; si ya tenia fecha, se reabre directo como antes.

Vacio ya documentado, no corregido hoy: `docs/criterios-acompanamiento-familiar.md` señala como "pendiente de producto" un estado de acompañamiento a nivel de familia (`sin_revision`, `acompanamiento_solicitado`, etc.); hoy el seguimiento vive solo a nivel de persona.

### Revision visual (UI/UX) de "Alertas pendientes"

Se instalo Playwright (`npm install -D playwright` + `npx playwright install chromium`) para tomar capturas reales contra el servidor de desarrollo, ya que la maquina no tenia navegadores de automatizacion disponibles. Con datos reales de una congregacion de prueba se detecto:

- Todas las alertas usaban el mismo boton rojo "Atender" sin distinguir prioridad alta de media; la unica señal de urgencia era un texto gris pequeño.
- Alertas del mismo tipo (ej. 5 "Persona sin asistencia reciente") se listaban una por una sin agrupar ni contar, lo que no escala en una congregacion real.
- El encabezado "Alertas pendientes" no mostraba cuantas habia.

Cambios aplicados en `PastoralSection` (`src/pages/FeligresiaAdmin.jsx`):

- Se reutilizaron las clases `.alert-priority` / `.alert-priority-high` y el patron de `ALERT_TYPE_LABELS` que ya existian y se usaban en el widget de alertas del Dashboard (`src/pages/Dashboard.jsx`), en vez de inventar un estilo nuevo. Ahora cada alerta muestra una etiqueta de prioridad real (ALTA en rojo, MEDIA en ambar) y el boton "Atender" volvio a azul (color de accion, no de urgencia).
- Las alertas se agrupan por tipo con un contador (`BAUTISMO (1)`, `ASISTENCIA (5)`, `COMITÉ (2)`); un grupo con mas de 3 elementos muestra solo 3 y un enlace "Ver N mas de este tipo".
- El encabezado ahora muestra el total: "Alertas pendientes (8)".

Verificado visualmente con captura de pantalla real (login con cuenta de prueba, navegacion a Feligresia -> Seguimiento pastoral) antes y despues del cambio, no solo con `npm run build`.

## Archivos modificados

- `src/pages/Modulos.jsx`
- `src/components/layout/Sidebar.jsx`
- `src/pages/Configuracion.jsx`
- `src/pages/FeligresiaAdmin.jsx`
- `docs/estado-proyecto.md`
- `docs/pendientes.md`
- `docs/auditoria-sidebar-modulos-2026-08-29.md`

## Validacion ejecutada

- `npm run build`: correcto despues de cada cambio.
- No se modifico ningun archivo SQL, RLS ni migracion; todos los cambios son de frontend.

## Validacion pendiente

- Revision visual (UI/UX) real de Seguimiento pastoral con captura de pantalla — en curso, requiere credenciales de una cuenta de prueba con acceso a Feligresia.
- Probar en Supabase que el catalogo `cargos_comite` aplica correctamente `unico_por_comite` y `admite_suplente` ahora que las asignaciones si guardan `cargo_id`.
- Continuar la auditoria con el resto de modulos del Sidebar.
