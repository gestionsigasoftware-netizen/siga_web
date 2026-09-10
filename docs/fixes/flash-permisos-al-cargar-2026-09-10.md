# Destello de "sin permisos" al cargar el rol — 2026-09-10

## Contexto

El usuario reportó que, justo tras iniciar sesión (o al recargar la
página), por un instante el sidebar se ve con apenas ~6 módulos y la
pantalla de Feligresía se ve como un perfil sin permisos -- le
preocupaba que fuera un problema real de permisos. Tras corregir
Feligresía, preguntó si el problema quedaba resuelto también en
distrital/nacional y en el resto de pantallas locales -- se auditaron
las 19 pantallas restantes que usan el mismo patrón de permiso
(`supabase.rpc('tiene_permiso', ...)`) y se corrigió donde hacía falta.

## Hallazgo

No es un problema de permisos: es una carrera de carga sin cubrir, que
resultó ser sistémica.

- **`src/components/layout/Sidebar.jsx`**: cada ítem del menú decide
  si se muestra según `rolPrincipal?.nivel`. Mientras `useMiRol()`
  todavía está resolviendo el rol, `rolPrincipal` es `null` -- todos
  los ítems condicionados a un nivel se ocultan, dando la apariencia
  de una cuenta muy restringida. El componente no usaba el `loading`
  que `useMiRol()` ya exponía. **Este arreglo aplica por igual a los 3
  niveles** (local/distrital/nacional), porque el Sidebar es un único
  componente compartido por todos los roles.
- **19 pantallas de nivel local** (Feligresía, Amigos, Obra Social,
  Obra Carcelaria, Evangelismo, Misión Juvenil, Damas Dorcas, Escuela
  Dominical, Música, Educación Artística/Teológica, SEPRI, Red de
  Familias, Conquistadores, Dashboard, y las 4 estaciones de la Ruta
  Evangelística): cada una tiene su propio `canEdit` (o similar) que
  arrancaba en `useState(false)` y solo se confirmaba tras la consulta
  a `tiene_permiso()`. Durante esa ventana, 13 de ellas mostraban un
  aviso visible tipo "Modo consulta" / "Tienes acceso de consulta..."
  como si el usuario no tuviera permiso, aunque sí lo tuviera.
  - **Pastoral Distrital y Gestión Pastoral Nacional ya estaban bien**
    -- estas dos sí esperaban correctamente `roleLoading` antes de
    decidir si mostrar la pantalla o negar el acceso.
  - **`RegistrarAsistencia.jsx` ya estaba bien** -- usa una bandera de
    carga separada (`loadingPermission`) que bloquea todo el render
    hasta confirmar el permiso, en vez de mostrar un valor por defecto
    falso.

## Construido

Mismo patrón aplicado en las 18 pantallas restantes con el defecto
(`Sidebar.jsx` ya se había corregido antes por separado):
- El estado de permiso pasa de `useState(false)` a `useState(null)`
  (`null` = "todavía no se sabe").
- En las 13 pantallas con aviso visible (`Amigos.jsx` vía clase CSS
  `amigos-read-only`; `ObraSocial.jsx`, `MisionJuvenil.jsx`,
  `ObraCarcelaria.jsx`, `DamasDorcas.jsx`, `EducacionTeologica.jsx`,
  `Musica.jsx`, `EducacionArtistica.jsx`, `EscuelaDominical.jsx`,
  `Sepri.jsx`, `RutaFormacion.jsx`, `RedFamilias.jsx`,
  `Conquistadores.jsx`), el aviso/clase ahora se condiciona a
  `=== false` (confirmado), no a `!valor` (que también es cierto para
  `null`).
- En las 4 pantallas sin aviso visible (`EstacionRefam.jsx`,
  `EstacionUnoMas.jsx`, `EstacionBis.jsx`, `Evangelismo.jsx`) y en
  `Dashboard.jsx` (`canHandleAlerts`), solo se cambió el `useState`
  inicial por consistencia defensiva -- ya solo ocultaban botones, sin
  mensaje alarmante, así que no había nada más que corregir ahí.
- Se revisaron además los formularios que se ocultan con
  `canEdit ? '' : 'hidden'` (en varias de estas mismas pantallas) --
  no son avisos de texto, solo ocultan un formulario, mismo
  comportamiento seguro con `null` que antes, no necesitaban cambio.

## Verificación

`npm run build` sin errores. Verificado con Playwright contra el
servidor real: login real con la cuenta de prueba (pastor local con
permiso de edición) y navegación a Amigos, Red de Familias, Obra
Social y Misión Juvenil -- cero avisos de "modo consulta"/"acceso de
consulta" visibles, sin errores de consola.
