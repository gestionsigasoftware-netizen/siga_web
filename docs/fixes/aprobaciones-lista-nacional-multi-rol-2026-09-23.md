# Aprobaciones: la lista tambien mostraba todo el pais (mismo bug, tercera instancia) -- 2026-09-23

## Contexto

Mismo día que los otros dos fixes (`AuditoriaFeligresia.jsx` y
`ReportesOptimizado.jsx`), al pedir una auditoría sistemática de este
patrón en toda la app, se revisó `Aprobaciones.jsx` -- que ya se había
tocado hoy mismo para quitarle el acceso a nacional -- y tenía el
mismo problema exacto: la consulta que arma la tabla de congregaciones
no filtraba explícito por el rol activo, solo confiaba en RLS.

```js
const { data, error: loadError } = await supabase
  .from('congregaciones')
  .select('id, nombre, pastor_nombre, estado, madurez, distritos(numero), created_at')
  .order('created_at', { ascending: false })
```

Para una cuenta con más de un rol (ej. super_admin que también es
distrital de un distrito específico), viendo la vista de distrital,
esto mostraba **todas** las congregaciones del país -- nombres de
pastor, estado, madurez -- en vez de solo las de su propio distrito.
Esta pantalla es más sensible que un simple listado porque desde ahí
también se puede aprobar/suspender/anular -- aunque el `UPDATE` real ya
estaba bien protegido por RLS (`congregaciones_update_distrital`:
`distrito_id in (select mis_distritos()) or es_super_admin()`, sin
`es_nacional()` desde el fix de hoy), la sola VISIBILIDAD de
congregaciones ajenas (con datos de pastor) ya era un problema.

## Corrección

`src/pages/Aprobaciones.jsx`:
- La consulta ahora filtra `.eq('distrito_id', rolPrincipal.distrito_id)`
  cuando `rolPrincipal.nivel === 'distrital'`. Para `super_admin`, sin
  filtro (alcance legítimo).
- La clave de caché (`aprobacionesCache`) ahora incluye el alcance del
  rol activo (`distrital:<distrito_id>` o `'todas'`), mismo ajuste que
  ya se hizo en Auditoría.
- El `useEffect` que dispara `load()` ahora espera a que `rolPrincipal`
  esté resuelto (antes corría una sola vez al montar, potencialmente
  antes de que el rol terminara de cargar) y se vuelve a ejecutar si el
  usuario cambia de rol sin recargar la página.

Sin cambios de SQL/RLS -- corrección puramente de frontend (la RLS de
escritura ya había quedado bien acotada en el fix de esta mañana).

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`, rol local, Puerto Tejada) que el query con
  `.eq('distrito_id', ...)` no produce error y devuelve solo la
  congregación esperada.
- No verificado con clics reales el caso distrital multi-rol (no hay
  cuenta de prueba con ese rol).

## Nota

Este es ya el **tercer** módulo con el mismo patrón encontrado el
mismo día -- confirma que vale la pena la auditoría sistemática que
pidió el usuario en vez de esperar a que seguidamente aparezcan de a
uno. Ver `docs/fixes/auditoria-feligresia-fuga-multi-rol-2026-09-23.md`
y `docs/fixes/reportes-dropdown-congregaciones-multi-rol-2026-09-23.md`
para los otros dos, y la memoria
`feedback_rls_no_conoce_vista_activa_multi_rol` para el patrón general.
