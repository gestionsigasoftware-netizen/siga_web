# Rediseño del nivel distrital: consolidado, selector de rol y traslados

Fecha: 31 de agosto de 2026

## Problema

Con la primera cuenta de prueba de rol distrital funcionando, se detectó que
**Resumen (Dashboard), Reportes y Auditoría de Feligresía nunca tuvieron una
vista propia para distrital** — reutilizaban la pantalla local. `mis_congregaciones()`
sí escopa correctamente a "todas las congregaciones de mi distrito" (sin fuga
entre distritos), pero ninguna pantalla armaba una vista comparativa con esos
datos.

Además se encontró que `pastores` (registro pastoral/traslados) no tenía
ninguna relación con `personas`/`roles_sistema` (censo y acceso real de
login) — dos registros paralelos que solo coincidían en nombre. Un traslado
movía el registro pastoral pero nunca el acceso real; el formulario manual
"Registrar pastor" no daba ningún acceso al pastor.

También se pidió un selector de rol para cuentas con más de un rol activo, un
campo de ciudad para congregaciones, un número identificador para cada uno de
los 36 distritos de la IPUC, y mostrar el nombre del usuario logueado.

## Solución construida

### Base de datos (`supabase/gestion_pastoral_distrital_v2.sql`, nuevo, repetible)

- `congregaciones.ciudad` y `distritos.numero` (nuevas columnas).
- `pastores.persona_id` — vincula el registro pastoral con el censo/acceso real.
- `crear_congregacion_con_pastor()`: ahora liga el pastor a su persona y acepta ciudad.
- `registrar_pastor_con_acceso()` (nueva): da de alta un pastor con acceso real
  para una congregación **existente y vacante**, unificando el estándar con
  "Registrar nueva congregación".
- `trasladar_pastor()`: ahora también mueve `personas.congregacion_id` y el
  `roles_sistema` local activo del pastor a la congregación destino, para que
  el acceso de login viaje con el traslado real.
- `resumen_distrital(distrito_id)`: una fila por congregación del distrito
  (personas activas, nuevas en 3 meses, asistencia último mes/anterior,
  pastor a cargo, ciudad, estado) — base de la comparativa distrital.
- Política de escritura en `distritos`: solo nacional/super_admin.

### Selector de rol (`useMiRol.js`, `RoleChooser.jsx`, `Sidebar.jsx`)

Cuentas con más de un rol activo (ej. un pastor que también dirige un
distrito) ven una pantalla de elección al iniciar sesión, y además un
selector "Cambiar de rol" siempre disponible en el Sidebar para cambiar de
contexto sin cerrar sesión. Cuentas con un solo rol no ven ningún cambio.

### Dashboard distrital (`Dashboard.jsx`)

Panel propio para `nivel === 'distrital'`: KPIs del distrito (congregaciones,
feligreses activos, en crecimiento, vacantes de pastor) y una tabla
comparativa por congregación (nombre, ciudad, pastor a cargo, personas
activas, nuevas en 3 meses, asistencia último mes, estado), ordenable.

### Reportes (`ReportesOptimizado.jsx`)

Para nivel no-local se agregó una tabla de asistencia agregada por
congregación del período seleccionado, además del filtro de congregación ya
existente.

### Auditoría de Feligresía

Se quitó del nivel distrital (queda para pastor local, nacional y
super_admin) — es detalle operativo persona por persona, no un consolidado
para decisiones distritales.

### Gestión pastoral (`PastoralDistrital.jsx`)

"Registrar pastor" ahora exige correo y da acceso real (vía
`registrar_pastor_con_acceso` + `invitar-usuario`, mismo patrón que
"Registrar nueva congregación"). Las tarjetas de pastores muestran ciudad,
una etiqueta "Sin acceso vinculado" cuando corresponde, y las estadísticas de
su congregación actual (personas activas / nuevas).

### Catálogo de distritos (`GestionDistritos.jsx`, ruta `/distritos`)

Pantalla nueva, solo para nacional/super_admin: alta/edición de distritos
con número (1-36) y nombre. Se deja vacía a propósito — el usuario carga los
36 distritos reales de la IPUC cuando los tenga a mano.

### Nombre del usuario logueado

`MainLayout.jsx` muestra el nombre real de la persona (de `personas`, vía
`getMisRoles()`) en el encabezado superior, junto a Notificaciones/Perfil.

## Bugs encontrados y corregidos durante la verificación

- `registrar_pastor_con_acceso()`: columna `congregacion_id` ambigua (colisionaba
  con el nombre de salida de la función) — corregido calificando la tabla.
- `trasladar_pastor()`: `fecha_fin = fecha - 1` violaba la restricción
  `fecha_fin >= fecha_inicio` cuando el traslado ocurre el mismo día en que
  empezó la asignación actual — corregido con `greatest(fecha - 1, fecha_inicio)`.
  Bug preexistente, no introducido en esta sesión, encontrado porque esta
  sesión fue la primera vez que la función se ejercitó con datos reales de
  prueba creados el mismo día.

## Validación ejecutada

- `npm run build`: correcto.
- Probado en vivo con la cuenta de prueba dual-rol (local + distrital):
  selector de rol al login, switcher en caliente sin recargar, Dashboard
  distrital con datos reales, tabla comparativa en Reportes, Auditoría
  ausente del menú distrital, `/distritos` bloqueado correctamente para
  distrital, "Registrar pastor" con acceso real verificado end-to-end, y el
  traslado verificado end-to-end incluyendo una consulta directa que
  confirmó que `roles_sistema.congregacion_id` del pastor trasladado cambió
  a la congregación destino con `fecha_fin` en `null`.
- No probado: el catálogo de distritos (`/distritos`) con una cuenta
  nacional/super_admin real — no existe todavía una cuenta de ese nivel para
  probar. Solo se confirmó que un distrital lo tiene bloqueado.

## Pendiente

- Cargar el listado real de los 36 distritos de la IPUC (número + nombre)
  desde `/distritos` una vez el usuario lo tenga a mano.
- Probar `/distritos` con una cuenta nacional/super_admin real.
- Configurar SMTP propio en Supabase Auth (pendiente de antes) — sigue
  bloqueando el envío real de invitaciones a pastores.
