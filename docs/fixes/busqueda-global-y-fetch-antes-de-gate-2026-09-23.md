# Búsqueda global y fetch-antes-de-gate: más instancias del mismo patrón multi-rol -- 2026-09-23

Parte de la auditoría sistemática pedida por el usuario tras encontrar
el mismo bug tres veces seguidas hoy (Auditoría, Reportes, Aprobaciones
-- ver esos `docs/fixes/*-multi-rol-2026-09-23.md`). Se agentizó una
revisión de toda la app; esta pieza cubre los hallazgos reales de la
tanda de pantallas administrativas/de búsqueda.

## 1. Búsqueda global (`GlobalSearch.jsx`) -- alta severidad

`src/components/layout/GlobalSearch.jsx` es el buscador del encabezado
(ícono de lupa, siempre visible). Para cualquier rol distinto de
local, buscaba en `congregaciones` sin ningún filtro de distrito:

```js
const { data } = await supabase
  .from('congregaciones')
  .select('id, nombre, ciudad, estado, pastor_nombre, distritos(nombre, numero)')
  .or(`nombre.ilike.%${q}%,ciudad.ilike.%${q}%`)
  .order('nombre')
  .limit(8)
```

Para una cuenta con más de un rol (ej. super_admin que también es
distrital de un distrito específico), viendo la vista de distrital,
buscar cualquier término devolvía congregaciones de **todo el país**
-- nombre de pastor, ciudad, estado incluidos -- justo en el buscador
del encabezado, visible en cualquier pantalla de la app. Es la
instancia de mayor visibilidad encontrada hasta ahora.

**Corrección**: se agregó `.eq('distrito_id', rolPrincipal.distrito_id)`
cuando `rolPrincipal.nivel === 'distrital'`. nacional/super_admin
siguen sin filtro (su alcance legítimo). Verificado en vivo contra
producción real que el filtro no produce error.

## 2. `Suscripciones.jsx` y `ErroresSistema.jsx` -- severidad moderada

Ambas pantallas ya estaban bien *renderizadas* (el `return` bloquea la
UI si `rolPrincipal?.nivel !== 'super_admin'`), pero el `useEffect` que
dispara la carga de datos solo esperaba a que `roleLoading` terminara
-- no verificaba el rol en sí:

```js
useEffect(() => { if (!roleLoading) cargar() }, [roleLoading])
```

Para una cuenta multi-rol (ej. super_admin viendo "como" local) que
navega directo a `/suscripciones` o `/errores-sistema`, la consulta
completa (todas las suscripciones y congregaciones del país en un
caso; mensajes de error, stack traces y `usuario_id` de cualquier
persona del sistema en el otro) igual se ejecutaba y quedaba en el
estado de React / la pestaña de Red del navegador, aunque la pantalla
nunca llegara a mostrarla. No es visible a simple vista, pero sí
inspeccionable con DevTools.

**Corrección**: el efecto ahora solo llama `cargar()` cuando
`rolPrincipal?.nivel === 'super_admin'`; si no, pone `loading` en
`false` directamente (sin esto, la pantalla se hubiera quedado en
"Cargando..." para siempre en vez de mostrar el mensaje de "vista
exclusiva de super_admin", porque `loading` arrancaba en `true` y solo
`cargar()` lo apagaba).

## Revisado y confirmado SIN problema (mismo lote)

- `Soporte.jsx`: la misma variable `esAdmin` (derivada de
  `rolPrincipal.nivel`) controla tanto qué se consulta como qué se
  renderiza -- sin ventana de tiempo entre ambas. Correcto.
- `EquipoCongregacion.jsx`, `Configuracion.jsx`, `Modulos.jsx`,
  `ConfiguracionSistema.jsx`, `Perfil.jsx`, `MainLayout.jsx`: todas
  filtran explícito por `congregacionId`/`usuario_id` propio, o
  bailan (`if (!congregacionId) return`) si el rol activo no tiene uno.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`) que el nuevo filtro de `GlobalSearch.jsx` no
  produce error de PostgREST.
- No verificado con clics reales el caso distrital/super_admin
  multi-rol exacto (no hay cuenta de prueba con esos roles).
