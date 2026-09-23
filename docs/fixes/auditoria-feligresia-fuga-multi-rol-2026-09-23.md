# Auditoría de Feligresía mostraba datos de otras congregaciones a una cuenta multi-rol -- 2026-09-23

## Reporte original del usuario

Revisando "Auditoría de Feligresía" con la vista activa en "Congregación:
Puerto Tejada Cauca Central" (rol local), aparecían cambios hechos por
"Carlos Alberto Diaz Gonzalez" -- pastor de **Suárez Cauca**, una
congregación nueva y completamente distinta, no relacionada con Puerto
Tejada. El usuario adjuntó una captura real confirmando el hecho.

## Diagnóstico

Primero se verificó en vivo contra producción con la cuenta de prueba
`pueba691@gmail.com` (rol local puro, sin ningún otro rol, Puerto
Tejada): de 500 filas de `auditoria_feligresia`, 0 pertenecían a otra
congregación. Eso confirmó que la política RLS
`auditoria_feligresia_read` (`congregacion_id in (select
mis_congregaciones())`) funciona bien para una cuenta que **solo**
tiene rol local.

El caso real reportado era distinto: la cuenta del usuario tiene
**más de un rol** (el badge de la captura dice "super admin" y el
panel "Tu acceso" muestra la vista cambiada a Congregación Puerto
Tejada vía el selector "Cambiar de rol"). Ahí está la causa real:

- `mis_congregaciones()` (la función que usa la política RLS) se
  evalúa contra los roles reales de `roles_sistema` de la cuenta
  autenticada -- **no sabe nada de qué "vista" elegiste en el selector
  de rol del frontend**. Si la cuenta tiene un rol `super_admin` en
  `roles_sistema`, `mis_congregaciones()` devuelve TODO el país sin
  importar que la interfaz esté mostrando la vista de Puerto Tejada.
- Todas las demás pantallas del sistema (`FeligresiaAdmin.jsx`,
  `Personas.jsx`, `SaludDatos.jsx`, `Evangelismo.jsx`, etc.) no confían
  solo en RLS: además filtran explícito por
  `rolPrincipal.congregacion_id` / `rolPrincipal.distrito_id` (el rol
  ACTIVO elegido, no el más alto que tenga la cuenta). RLS actúa como
  techo de seguridad, pero el filtro explícito es el que de verdad
  acota la vista al rol elegido.
- `AuditoriaFeligresia.jsx` era la única pantalla que rompía ese
  patrón: hacía `select(...)` sobre `auditoria_feligresia` sin ningún
  `.eq('congregacion_id', ...)` ni `.eq('distrito_id', ...)`,
  confiando 100% en RLS. Por eso una cuenta con un rol superior (aquí
  super_admin) veía el país entero aunque estuviera "viendo como"
  local.

De regalo, se encontró un segundo problema relacionado: la caché en
memoria del módulo (`auditoriaFeligresiaCache`) tampoco incluía el rol
activo en su clave (`entity:action:fromDate:toDate:page`) -- si la
misma sesión de navegador cambiaba de rol sin recargar la página
completa, podía servir resultados cacheados del rol anterior.

## Corrección

`src/pages/AuditoriaFeligresia.jsx`:
- La consulta ahora filtra explícito según `rolPrincipal.nivel`:
  - `local` → `.eq('congregacion_id', rolPrincipal.congregacion_id)`.
  - `distrital` → embed `congregaciones!inner(distrito_id)` +
    `.eq('congregaciones.distrito_id', rolPrincipal.distrito_id)`
    (verificado contra producción real que el embed no genera el error
    de ambigüedad de PostgREST que sí afectó a otra relación de
    `congregaciones` el 2026-09-18 -- aquí `auditoria_feligresia` solo
    tiene una FK a `congregaciones`, sin ambigüedad posible).
  - `nacional` / `super_admin` → sin filtro adicional (ver todo el país
    es su alcance legítimo cuando esa es la vista activa).
- La clave de caché ahora incluye el alcance del rol activo
  (`local:<congregacion_id>` / `distrital:<distrito_id>` / nivel), para
  que un cambio de rol dentro de la misma sesión de navegador no sirva
  resultados de otro alcance desde la caché en memoria.

No hizo falta ningún cambio de RLS ni de SQL -- la política ya era
correcta para el caso de un solo rol; el problema era exclusivamente
que el frontend de esta pantalla no acotaba la vista al rol activo
como sí hace el resto de la app.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`, rol local puro, Puerto Tejada): 0 de 500 filas
  de otra congregación (esto ya estaba bien antes del fix, para una
  cuenta de un solo rol).
- Confirmado en vivo contra producción real que el nuevo query con
  embed `congregaciones!inner(distrito_id)` para el caso distrital no
  produce ningún error de PostgREST.
- **No verificado con clics reales** el caso multi-rol exacto
  reportado (cuenta con super_admin + local Puerto Tejada) porque
  requeriría usar la contraseña real del usuario -- no corresponde que
  Claude la use. El usuario puede confirmar recargando
  `/auditoria-feligresia` con la vista en Puerto Tejada: ya no debería
  aparecer ningún cambio de Carlos Alberto Diaz Gonzalez (pastor de
  Suárez Cauca).

## Alcance del riesgo

Esta fuga solo afectaba a cuentas que tienen **más de un rol** en
`roles_sistema` (ej. alguien que es super_admin y también pastor local
de una congregación, o nacional que también es distrital). Una cuenta
con un único rol nunca estuvo expuesta -- confirmado empíricamente
arriba. Vale la pena revisar si existe algún otro módulo con el mismo
patrón (confiar solo en RLS sin filtro explícito por rol activo); no
se hizo esa auditoría más amplia en esta sesión, solo se corrigió el
módulo reportado.
