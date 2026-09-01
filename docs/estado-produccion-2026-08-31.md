# Estado de producción de SIGA

Fecha: 31 de agosto de 2026

## Qué es este documento

Consolida la auditoría módulo por módulo del Sidebar hecha entre el
28-08-2026 y hoy (ver los documentos `docs/auditoria-sidebar-*.md`).
Responde una pregunta concreta: **¿qué tan lista está la aplicación que ya
existe para que un usuario final la use sin trabarse?**

**Actualización 2026-08-31 (tarde):** lo que esta misma auditoría marcó como
"seguimiento relacional fino" (Métodos, Uno Más, BIS, REFAM) y las 3 piezas
avanzadas de Misión Juvenil (lecciones, asistencia individual, líderes) ya se
construyeron a pedido del usuario. Ver
`docs/ruta-evangelistica-avanzada-2026-08-31.md` para el detalle completo. La
tabla de la sección "Ruta Evangelística" más abajo queda como registro
histórico de cómo estaba antes de esa construcción.

No cubre construir lo que sigue pendiente por diseño (la PWA móvil,
exportación PDF, registro público de congregación) — eso sigue fuera de
alcance por decisión del usuario.

**Corrección sobre una afirmación anterior:** en esta misma sesión se dijo
primero que la Ruta Evangelística "no estaba aplicada ni construida" y luego
que "faltaban 4 pantallas" (Métodos, Uno Más, BIS, REFAM). Ambas afirmaciones
eran incorrectas y el usuario las cuestionó con razón. Verificado a fondo en
el código: **las seis estaciones ya tenían una vía operativa real** en ese
momento — ver el detalle exacto en la sección "Ruta Evangelística" más abajo
(hoy, además, ya tienen también el seguimiento fino).

## Corregido en esta auditoría (código, ya en el repositorio)

| Módulo | Problema encontrado | Corrección |
| --- | --- | --- |
| Módulos y actividades | Cualquier perfil local (no solo pastor) podía administrar módulos; Evangelismo/Misión Juvenil se podían renombrar o desactivar por error | Gate de permiso `pastor`; módulos de sistema protegidos |
| Configuración local | Catálogos de "Módulos" y "Zonas de Evangelismo" duplicaban, con menos funciones, lo que ya hacían sus pantallas dueñas | Catálogos eliminados, con enlace a la pantalla real |
| Comités (Feligresía) | Asignar cargo usaba una lista fija en el código, nunca conectada al catálogo real `cargos_comite`: toda asignación quedaba con `cargo_id = null` | Selector conectado al catálogo real; agrupación por cargo real; botón "Editar" (ya existía en código, sin botón) expuesto |
| Seguimiento pastoral | "Reabrir" fallaba si el seguimiento se cerró sin próxima fecha (caso común) | Pide la fecha antes de reabrir |
| Seguimiento pastoral (UI) | Alertas sin color por prioridad real, sin conteo, sin agrupar | Badge de prioridad real, conteo total, agrupación por tipo |
| Equipo de trabajo | Condición de carrera dejaba pegado "sin congregación asignada" aunque la carga posterior fuera exitosa | Se limpia el mensaje al iniciar una carga válida |
| Red de Familias | `tiene_permiso()` en `seguridad_produccion.sql` no incluía `red_familias.*` en la lista de permisos implícitos del pastor → todo pastor sin perfil adicional veía "Modo consulta" | Corregido en el repo; **requiere que el usuario ejecute el `create or replace function` corregido en su Supabase real** (ver `docs/auditoria-sidebar-red-familias-2026-08-30.md`) |
| Preferencias personales | El formato de fecha se guardaba pero no lo usaba nada más en la app (8 archivos con fecha fija a `es-CO`) | Implementado de verdad (`src/lib/dateFormat.js` + `src/hooks/usePreferencias.js`), aplicado en los 6 sitios donde el orden día/mes era ambiguo |
| Corrección / contingencia de asistencia | El aviso de "registro duplicado" solo comparaba contra los últimos 10 registros de toda la congregación, no contra la fecha/módulo/actividad real → fallaba en congregaciones con más de un módulo activo | Se reemplazó por una consulta puntual a la fecha/módulo/tipo/zona exactos antes de guardar |
| Corrección / contingencia de asistencia | Cambiar de módulo no limpiaba el tipo de actividad seleccionado; podía quedar un `tipo_actividad_id` de otro módulo | Se limpia al cambiar de módulo |
| Aprobaciones | Sin verificación de rol dentro de la pantalla (dependía solo de que el Sidebar ocultara el enlace); RLS ya protegía los datos pero era inconsistente con el resto de la app | Gate de rol agregado, igual que en el resto de pantallas administrativas |
| Amigos en ruta | `moveRouteProcess` llamaba `setNotice(...)` sin que ese estado existiera — cada traslado de estación exitoso dejaba **toda la pantalla trabada en "Guardando..."** hasta recargar | Se agregó el estado `notice` faltante y su renderizado |
| Feligresía · Población | El filtro de estado usaba una variable `status` nunca declarada, que en el navegador resolvía silenciosamente a `window.status` (`""`) sin lanzar error — la consulta siempre filtraba `estado_membresia = ''`, así que la lista, el conteo y la exportación CSV de Población **siempre mostraban cero personas**, sin importar cuántas hubiera | Ver `docs/bug-critico-poblacion-2026-08-31.md` — variable de filtro propia declarada y corregida en las 6 referencias rotas; se eliminó además un bloque de código duplicado y huérfano |

## Revisado, sin problemas encontrados

Auditoría de Feligresía, Evangelismo, Misión Juvenil, Pastoral Distrital,
Reportes, Amigos en ruta (incluye el motor de avance entre estaciones de la
Ruta Evangelística), ESFOB/EFOB, Discipulado, Misiones y Evangelismo (hub),
Dashboard.

**Corrección:** Feligresía (Población, Familias, Evolución) se había listado
aquí como revisado sin problemas — resultó incorrecto. Población tenía el
bug crítico descrito arriba; solo se detectó porque el usuario lo reportó en
uso real, no durante la revisión de código. Familias y Evolución no
mostraron el mismo patrón al revisarlas de nuevo, pero esta corrección queda
anotada para no repetir una afirmación de "sin problemas" sin haber probado
la pantalla con datos reales, tal como pide
`docs/feedback_verificar_docs_contra_codigo` (memoria del proyecto).

## Ruta Evangelística: estado histórico (antes de la construcción avanzada de esta misma tarde)

La migración `ruta_evangelistica.sql` sí está aplicada (`ruta_estaciones`
tiene sus 6 filas). Estado estación por estación **en el momento en que se
escribió esta sección** (ya superado, ver actualización arriba):

| Estación | Vía operativa real en ese momento | Qué faltaba entonces |
| --- | --- | --- |
| Métodos | `Evangelismo.jsx` (zonas, metodologías, conversiones) — es literalmente su pantalla, no un sustituto | Diagnóstico estructurado (`ruta_diagnosticos`, 0 filas, sin UI) → **construido hoy mismo** |
| Uno Más | Registrar un amigo nuevo en `Amigos.jsx` (`?station=uno_mas`) — es la acción real de esta estación | Compromiso de quién ora/contacta (`uno_mas_compromisos`, 0 filas, sin UI) → **construido hoy mismo** |
| BIS | `Amigos.jsx` (`?station=bis`) oculta "crear amigo" y muestra el aviso correcto: trabajar sobre la ficha existente para bienvenida/seguimiento/integración | Detalle estructurado de la atención (`bis_atenciones`, 0 filas, sin UI) → **construido hoy mismo** |
| REFAM | Existe como tipo de actividad sembrado bajo Evangelismo (`supabase/seed_datos_prueba.sql`); se puede registrar asistencia agregada a una reunión REFAM desde Corrección/contingencia | Seguimiento por grupo/participante/anfitrión (`refam_grupos`, `refam_participantes`, `refam_reuniones`, 0 filas, sin UI) → **construido hoy mismo** |
| ESFOB/EFOB | Pantalla dedicada completa (`RutaFormacion.jsx`) | — |
| Discipulado | Pantalla dedicada completa (`RutaFormacion.jsx`) | — |

El motor genérico de avance entre estaciones (`ruta_estaciones` +
`ruta_procesos`, en `Amigos.jsx`) también es real y funciona, validando el
orden de las estaciones.

El bug de `tiene_permiso()` en Red de Familias (ver tabla arriba) se
confirmó real contra la cuenta de producción del usuario, no solo en teoría.

## No depende de código — requiere acción del usuario

Esta lista ya vivía en `docs/pendientes.md → Prioridad crítica antes de
producción` y sigue vigente; ninguna de estas la puedo ejecutar yo (no tengo
`service_role` ni acceso a Supabase Dashboard/hosting):

- Ejecutar el `create or replace function tiene_permiso(...)` corregido (Red
  de Familias) — instrucciones exactas en
  `docs/auditoria-sidebar-red-familias-2026-08-30.md`.
- Desplegar y probar la Edge Function `invitar-usuario`.
- Ejecutar y verificar `supabase/seguridad_produccion.sql` completo si aún no
  se aplicó en su totalidad.
- HTTPS/dominio, confirmación de correo, política de contraseñas, MFA,
  backups/PITR, monitoreo, CSP/HSTS, buckets privados, prueba de aislamiento
  entre congregaciones, revisión de variables de entorno.

## Fuera de alcance por decisión explícita (no son bugs)

- PWA móvil de captura offline.
- Exportación PDF de reportes.
- Registro público de nueva congregación.

## Validación ejecutada en toda la auditoría

- `npm run build` correcto después de cada cambio.
- Verificación visual con Playwright y la cuenta de producción real del
  usuario para: Seguimiento pastoral (antes/después del fix de alertas),
  Equipo de trabajo (reproduciendo la condición de carrera), Red de Familias
  ("Modo consulta" confirmado con RPC real), Preferencias personales
  (formato de fecha cambiando una fecha real de 28/08/2026 a 08/28/2026).

## Conclusión honesta

El código de los módulos ya construidos queda considerablemente más sólido:
los bugs reales encontrados (permisos desconectados, condiciones de carrera,
duplicados mal detectados, catálogos huérfanos) están corregidos y
verificados, no solo supuestos. Pero "software 100% listo para producción"
no depende solo de código — todavía falta que el usuario aplique la lista de
"Prioridad crítica" de `docs/pendientes.md`, empezando por el fix de
`tiene_permiso()` que ya está esperando en su SQL Editor.
