# Lista fija de ujieres + ujier responsable (2026-09-04)

## El pedido

Existe una lista fija de ~42 personas que prestan el servicio de ujier
en la congregación (se ninguna está en el censo de feligresía todavía --
verificado antes de construir, 0 de 42 coinciden con `personas`). El
usuario pidió poder elegir, al capturar la asistencia de Ujieres, cuál
de esas personas fue la responsable de ese culto específico -- sin
depender de qué cuenta esté usando el celular ese día (puede ser una
cuenta compartida entre varios ujieres).

Se confirmaron dos decisiones explícitas: (1) esta lista es un catálogo
propio, **no** se dan de alta como feligreses completos en el censo; (2)
**no** se guardan dos ujieres por culto -- solo uno, ya que uno solo de
los dos que están de turno es quien llena la asistencia en la PWA.

## Diseño

- **`supabase/ujieres_congregacion.sql`** (nuevo, ejecutar después de
  `rls_cargo_pwa.sql`): tabla `ujieres_congregacion` (congregación,
  nombre, activo) -- mismo patrón que `caracteres_culto`: administrable
  solo por quien administra módulos, lectura adicional para
  capturadores solo-cargo. Se agregó
  `registros_actividad.ujier_responsable_id` (FK opcional, distinto de
  `responsable_persona_id` -- ese sigue siendo quien capturó vía login;
  este es cuál de los 42 ujieres fue el responsable real del culto).
- **`src/pages/Modulos.jsx`** (web): nueva sección "Ujieres" -- alta
  individual, **alta masiva** (un `<textarea>` para pegar varios
  nombres de una vez, uno por línea, con detección de duplicados),
  editar nombre, activar/desactivar. Mismo patrón visual que
  "Caracteres de culto".

## PWA (`siga-pwa-nacional`)

- **`src/lib/modulos.js`**: `esModuloUjieres(nombreModulo)`.
- **`src/lib/supabase.js`**: `getUjieresCongregacion(congregacionId)`;
  `registrarActividad()` acepta y guarda `ujierResponsableId`.
- **`src/pages/CapturaActividad.jsx`**: nuevo selector **"Ujier
  responsable"** -- a diferencia del carácter de culto (opcional para
  cualquier módulo), este es **obligatorio y solo aparece cuando el
  módulo activo es Ujieres** y la congregación ya tiene ujieres
  configurados. Se valida antes de confirmar el guardado, igual que el
  culto y la fecha.

## Verificación

`npm run build` corre limpio en ambos proyectos. Pendiente verificación
de punta a punta una vez el usuario ejecute
`supabase/ujieres_congregacion.sql` y cargue los 42 nombres desde la
sección "Ujieres" en `/modulos` (alta masiva, pegando la lista
completa de una vez).

## Acción requerida del usuario

1. Ejecutar `supabase/ujieres_congregacion.sql` en Supabase.
2. En `/modulos` → sección "Ujieres" → "Agregar varios a la vez" →
   pegar los 42 nombres (uno por línea) y guardar.
