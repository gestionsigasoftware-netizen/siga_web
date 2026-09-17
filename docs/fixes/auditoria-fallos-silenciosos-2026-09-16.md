# Auditoría de fallos silenciosos y rendimiento en toda la web — 2026-09-16

## Contexto

El usuario pidió una auditoría completa de bugs en toda la aplicación,
con énfasis en: consultas de Supabase que no cargan bien los datos,
"cosas que corren de manera silenciosa", y "bucles" o cosas
innecesarias que afecten el rendimiento y la disponibilidad.

Se auditaron los 47 archivos de `src/pages/`, los 5 hooks compartidos
y los componentes de layout con 4 agentes en paralelo (más una
revisión manual propia de hooks/lib compartidos), cada uno buscando el
mismo catálogo de patrones de bug ya confirmados esta sesión:
`event.currentTarget` usado después de un `await`, consultas sin
filtrar por congregación confiando solo en RLS, llamadas a Supabase
sin `await`, fallos silenciosos (`catch`/`if (error)` que no avisan al
usuario), y loops de `useEffect` con dependencias inestables.

## Resultado

Los hooks compartidos (`useMiRol`, `usePreferencias`, `useIdleLogout`,
`useAuth`, `useUndoDelete`) y los componentes de layout/públicos están
limpios -- ya habían sido revisados en sesiones anteriores (MFA, botón
cerrar sesión, flash de permisos). El resto de la app tenía **13
fallos silenciosos reales** (mismo patrón en todos: un `error` de
Supabase se descarta sin `setError` ni `console.error`, así que un
fallo real se ve exactamente igual que "no hay datos"), más 1 bug de
caché y 1 problema de rendimiento. Corregidos:

- **`src/pages/FeligresiaAdmin.jsx`** (`FamilyTree`): `addMember`,
  `addRelation`, `addAmigoMember`, `removeAmigoMember` ahora muestran
  el error si el insert/delete falla (antes el botón "no hacía nada"
  sin ninguna pista).
- **`src/pages/PastoralDistrital.jsx`**: el informe trimestral
  distrital y `ContinuidadPastoral` (checklist de congregaciones
  vacantes) ahora avisan si el RPC falla, en vez de mostrar "sin
  datos" o quedarse en "Cargando..." para siempre.
- **`src/pages/GestionPastoralNacional.jsx`**: mismo fix en el informe
  trimestral nacional.
- **`src/pages/RutaFormacion.jsx`**: `refrescarProgreso` y
  `refrescarNotas` (historial de lecciones/notas en ESFOB/Discipulado)
  ahora avisan si fallan.
- **`src/pages/EstacionRefam.jsx`**: `loadRefamGrupoDetail` (el
  contenido principal del panel de un grupo REFAM: participantes y
  reuniones) y `refrescarNotasRefam` ahora avisan si fallan.
- **`src/pages/GestionPastoralNacional.jsx` / `EquipoCongregacion.jsx`**:
  el chequeo de errores de la carga general omitía dos de las siete
  consultas (`zonasResult`, `centrosResult`) -- si esas fallaban, el
  usuario veía "esta congregación no tiene zonas/centros" en vez de un
  error real, y quedaba bloqueado para asignar módulos que piden
  zona/centro sin saber por qué.
- **`src/pages/Suscripciones.jsx`**: la consulta de método de pago
  (Nequi/banco) descartaba su error -- en la pantalla de facturación
  de super_admin, un fallo se veía igual que "no hay método
  configurado".
- **`src/pages/Soporte.jsx`**: las dos ramas de `cargar()` (vista
  admin y vista de usuario normal) ignoraban el error -- si el buzón
  de soporte fallaba, nadie se enteraba.
- **`src/pages/RegistrarAsistencia.jsx`**: la verificación de registro
  duplicado ignoraba su error; si fallaba, el resguardo contra
  duplicados se desactivaba en silencio y el registro se insertaba
  igual sin preguntar.
- **`src/pages/ImpactoMisionero.jsx`**: la clave de caché en memoria
  usaba `nivel:congregacionId`, pero un rol distrital no tiene
  `congregacionId` -- si una misma persona tiene roles distritales en
  más de un distrito y cambia de rol activo sin recargar la página,
  vería los datos cacheados del distrito anterior. Cambiado a usar
  `rolPrincipal.id` (la fila exacta de `roles_sistema`), que identifica
  sin ambigüedad cada rol específico.
- **`src/pages/Personas.jsx`**: la búsqueda disparaba una consulta a
  Supabase en cada tecla escrita, sin ningún control -- cambiado a
  `useDeferredValue`, el mismo patrón ya usado en el buscador de
  `FeligresiaAdmin.jsx`.

## No corregido, solo documentado

- **`src/pages/Feligresia.jsx`**: archivo muerto, no está enrutado en
  `App.jsx` ni se importa desde ningún otro archivo -- es una versión
  vieja y más simple del censo, reemplazada por `FeligresiaAdmin.jsx`.
  No se eliminó porque no se pidió explícitamente; se puede borrar con
  seguridad cuando el usuario lo confirme.
- Los `useEffect` de carga (`load()`) en ~17 módulos de ministerio no
  tienen guard `let active = true` contra condiciones de carrera al
  desmontar/cambiar de pestaña rápido -- es una convención uniforme de
  todo ese grupo de archivos, no un descuido puntual, y su severidad
  real es baja. Se documenta aquí por si se quiere corregir de forma
  centralizada más adelante (ej. un hook compartido de carga), pero no
  se tocó archivo por archivo en esta pieza.

## Verificación

- `npm run build` sin errores tras todos los cambios.
- Playwright con la cuenta real: se navegó a `/feligresia`,
  `/personas`, `/equipo-congregacion`, `/soporte` y `/registrar` --
  cero errores de consola en las cinco. Se confirmó que la pestaña
  Familias de Feligresía (con el `FamilyTree` recién tocado) sigue
  cargando y funcionando con normalidad, y que la búsqueda de
  `Personas.jsx` con el nuevo `useDeferredValue` sigue filtrando sin
  errores.
- Los fixes en `PastoralDistrital.jsx` y `GestionPastoralNacional.jsx`
  no se pudieron probar con clics reales (no existe cuenta distrital/
  nacional de prueba en este entorno) -- se verificaron por lectura
  cuidadosa del código y por el build limpio, siguiendo el mismo
  criterio ya usado en otras piezas de esta sesión para esos roles.
