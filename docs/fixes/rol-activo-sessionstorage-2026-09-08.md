# Rol activo: localStorage → sessionStorage — 2026-09-08

## Contexto

Detectado en la ronda de QA del 2026-09-04: el "rol activo" (para
cuentas con más de un rol -- ej. alguien pastor local Y distrital)
persistía en `localStorage`, mientras que la sesión de autenticación
misma ya se había movido a `sessionStorage` (2026-09-04, para que no
sobreviva el cierre de la pestaña/ventana). Quedaba una inconsistencia:
cerrar el navegador terminaba la sesión, pero al volver a iniciar
sesión el rol activo elegido la última vez seguía ahí.

## Construido

`src/hooks/useMiRol.js`: `leerRolActivoGuardado()` y `elegirRol()`
cambiaron de `localStorage` a `sessionStorage`. Sin otros cambios --
la clave (`siga_rol_activo:${userId}`) y el evento de sincronización
entre componentes (`siga:rol-activo-cambiado`) quedan igual.

Nota: la clave ya estaba correctamente aislada por `userId`, así que
esto nunca fue un riesgo de fuga entre cuentas en un equipo compartido
-- era puramente una inconsistencia de ciclo de vida frente a la
sesión.

## Verificación

`npm run build` sin errores. Verificación funcional: con una cuenta de
varios roles, elegir un rol, cerrar la pestaña, volver a abrir e
iniciar sesión -- antes del fix, el rol elegido seguía ahí; después del
fix, vuelve al de mayor prioridad hasta que se elija de nuevo (dentro
de la misma pestaña, sigue recordándose igual que antes).
