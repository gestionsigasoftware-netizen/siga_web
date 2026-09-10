# Destello de "sin permisos" al cargar el rol — 2026-09-10

## Contexto

El usuario reportó que, justo tras iniciar sesión (o al recargar la
página), por un instante el sidebar se ve con apenas ~6 módulos y la
pantalla de Feligresía se ve como un perfil sin permisos -- le
preocupaba que fuera un problema real de permisos.

## Hallazgo

No es un problema de permisos: es una carrera de carga sin cubrir.

- **`src/components/layout/Sidebar.jsx`**: cada ítem del menú decide
  si se muestra según `rolPrincipal?.nivel` (ej.
  `show: nivel === "local"`). Mientras `useMiRol()` todavía está
  resolviendo el rol (justo tras el login, antes de que
  `getMisRoles()` responda), `rolPrincipal` es `null` -- todos los
  ítems condicionados a un nivel se ocultan y solo quedan los que no
  dependen del rol, dando la apariencia de una cuenta muy restringida.
  El componente ni siquiera usaba el `loading` que `useMiRol()` ya
  expone.
- **`src/pages/FeligresiaAdmin.jsx`**: `canEdit` arrancaba en `false`
  y solo se confirmaba tras una consulta a `tiene_permiso()` (que a su
  vez espera a que `congregacionId` -- derivado del rol -- esté
  disponible). Durante esa ventana, `!canEdit` mostraba el aviso "Modo
  consulta: tu perfil puede revisar la feligresía, pero no
  modificarla" y ocultaba los botones de edición, aunque el usuario sí
  tuviera permiso.

## Construido

- `Sidebar.jsx`: se usa el `loading` que `useMiRol()` ya devolvía
  (antes sin usar) para mostrar un esqueleto de carga (barras con
  `animate-pulse`) en vez del menú real mientras el rol no está
  confirmado -- ahora se lee claramente como "cargando", no como una
  cuenta con pocos módulos.
- `FeligresiaAdmin.jsx`: `canEdit` pasa de `useState(false)` a
  `useState(null)` -- `null` significa "todavía no se sabe" (no
  muestra el aviso de solo-lectura ni la clase `feligresia-read-only`),
  `false` sigue significando "confirmado, sin permiso". Los botones de
  edición (`{canEdit && ...}`) siguen ocultos mientras se confirma
  (comportamiento seguro por defecto), pero ya no aparece el mensaje
  alarmante de "Modo consulta" durante la carga.

## Verificación

`npm run build` sin errores. Verificado con Playwright contra el
servidor de desarrollo real: login real, captura a los ~80ms de
aterrizar en `/app` (la ventana más probable de la carrera) -- el
sidebar muestra el esqueleto de carga, no un menú real reducido; tras
resolver, el sidebar muestra los módulos completos y Feligresía no
muestra ningún aviso de solo-lectura para esta cuenta (pastor local
con permiso de edición).
