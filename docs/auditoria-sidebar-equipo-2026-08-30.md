# Auditoria de modulos del Sidebar: Equipo de trabajo

Fecha: 30 de agosto de 2026

## Objetivo

Continuar la auditoria modulo por modulo del Sidebar iniciada en
`docs/auditoria-sidebar-modulos-2026-08-29.md`. El usuario reporto en uso real
que "Equipo de trabajo" mostraba "Tu usuario no tiene una congregacion local
asignada." con una cuenta que si tiene congregacion local asignada
(confirmado visualmente: el Sidebar y Feligresia muestran su congregacion sin
problema).

## Hallazgo: condicion de carrera al entrar directo a la pantalla

`src/pages/EquipoCongregacion.jsx` dispara `load()` en un `useEffect` que
depende de `congregacionId`. Cuando la pantalla es la primera que carga el
usuario despues de iniciar sesion (o tras recargar la pagina), `useMiRol()`
todavia no resolvio el rol: `congregacionId` es `undefined` en el primer
render. `load()` entra a la rama `if (!congregacionId)`, fija
`message = "Tu usuario no tiene una congregacion local asignada."` y termina.

Cuando el rol termina de resolverse (uno o dos segundos despues),
`congregacionId` cambia a un valor real, el efecto se vuelve a ejecutar y
`load()` si trae los datos correctamente esta vez — pero el codigo nunca
limpiaba ese mensaje de error del intento anterior. El resultado visible: la
pantalla carga el equipo completo (personas, perfiles, asignaciones) pero con
el banner rojo de error pegado arriba, aunque los datos si estan correctos.

Se reprodujo de forma controlada con Playwright: entrando directo a
`/equipo-congregacion` como primera pantalla tras el login (cache de roles
vacia), se ve primero "Preparando tu espacio..." y luego, una vez resuelto el
rol, antes de la correccion el banner de error quedaba visible aunque los
datos ya estuvieran cargados; despues de la correccion no aparece.

## Cambio aplicado

En `load()`, justo antes de la carga real (cuando `congregacionId` ya es
valido), se limpia el mensaje solo si es exactamente ese texto de error
transitorio (`setMessage((current) => current?.text === '...' ? null :
current)`). No se limpia de forma incondicional para no borrar los mensajes
de exito que otras acciones (invitar usuario, retirar perfil) fijan justo
antes de llamar a `load()`.

## Archivos modificados

- `src/pages/EquipoCongregacion.jsx`
- `docs/estado-proyecto.md`
- `docs/pendientes.md`
- `docs/auditoria-sidebar-equipo-2026-08-30.md`

## Validacion ejecutada

- `npm run build`: correcto.
- Verificacion visual con Playwright: captura a los 400ms (rol sin resolver,
  se ve "Preparando tu espacio...") y a los 2.5s (rol resuelto, equipo cargado
  sin banner de error).

## Validacion pendiente

- Confirmar si el mismo patron de carrera afecta a otras pantallas que
  muestran "Tu usuario no tiene una congregacion local asignada." sin recargar
  el mensaje despues de un `load()` exitoso (`Amigos.jsx`, `Evangelismo.jsx`,
  `MisionJuvenil.jsx`); no se tocaron hoy porque no fueron reportadas y
  requieren revisar cada una para confirmar si tienen el mismo problema o si
  ya limpian el estado de otra forma.
