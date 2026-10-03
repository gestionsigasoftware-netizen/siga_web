# Falso aviso "sesión expiró" al cerrar sesión manualmente — 2026-10-02

## Reporte del usuario

Cada vez que el usuario hacía clic en "Cerrar sesión" (acción manual,
no por inactividad), veía el mensaje "Tu sesión expiró por seguridad.
Inicia sesión de nuevo." en la pantalla de Login -- mensaje que debería
aparecer SOLO cuando el token/sesión muere de forma inesperada, no
cuando el propio usuario cierra sesión a propósito.

## Causa real

`ProtectedRoute.jsx` guarda en un `useRef` (`hadUser`) si alguna vez
hubo un usuario autenticado. Cuando `user` pasa a `null`, si
`hadUser.current` es `true`, redirige a `/login` con
`state: { reason: 'session_expired' }` -- sin distinguir SI esa
pérdida de sesión fue voluntaria (botón "Cerrar sesión") o involuntaria
(token expirado/revocado en segundo plano).

El botón "Cerrar sesión" en `Sidebar.jsx` llamaba `signOut()`
directamente (`onClick={signOut}`), sin navegar antes. Por el orden de
renderizado de React, `ProtectedRoute` reaccionaba al cambio de sesión
(vía `onAuthStateChange`) y ganaba la carrera, redirigiendo con su
propio motivo genérico antes de que el botón pudiera hacer nada más.

**El mismo problema ya había sido resuelto antes para el cierre por
inactividad** (`useIdleLogout.js`, cierre automático tras 1h sin
actividad): ese código ya navega a `/login` con
`state: { reason: 'idle_timeout' }` **antes** de llamar `signOut()`,
justo para ganarle la carrera a `ProtectedRoute`. El cierre manual
simplemente nunca recibió el mismo tratamiento.

## Solución

`Sidebar.jsx`: se agregó `handleSignOut()`, que navega a `/login`
(`replace: true`, sin `state`) **antes** de llamar a `signOut()` --
mismo patrón ya documentado y probado en `useIdleLogout.js`. Al llegar
a `/login` sin ningún `reason` en el estado de navegación, no se
muestra ningún aviso -- exactamente el comportamiento esperado: un
cierre de sesión manual no necesita explicación, solo lleva al login
limpio.

## Verificación

- `npm run build` sin errores.
- Playwright real: login con cuenta de prueba, clic en "Cerrar
  sesión", confirmado que la URL final es `/login` sin ningún aviso
  de "sesión expiró" ni de "inactividad" en el texto de la página,
  cero errores de consola.
- No se tocó `ProtectedRoute.jsx` ni `useIdleLogout.js` -- ambos siguen
  funcionando igual que antes para sus casos reales (token muerto en
  segundo plano, cierre por 1h de inactividad).
