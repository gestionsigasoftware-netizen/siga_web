# Carácter de culto configurable (2026-09-04)

## El pedido

Un mismo tipo de culto recurrente (ej. "Culto Martes") puede tener un
carácter distinto según la semana (Enseñanza una vez, Alabanza otra),
sin que eso sea parte del nombre fijo del tipo de culto. Se pidió una
lista de caracteres administrable desde la web, elegida al capturar la
asistencia desde la PWA -- no texto libre por congregación consistente
(para no terminar con "Alabanza", "alabanza", "Alavanza" como entradas
distintas).

## Diseño

- **`supabase/caracteres_culto.sql`** (nuevo, ejecutar después de
  `rls_cargo_pwa.sql` -- depende de `mis_congregaciones_via_cargo()`):
  tabla `caracteres_culto` (congregación, nombre, activo), administrable
  solo por quien administra módulos (pastor/distrital/nacional/
  super_admin -- mismo alcance que `modulos`/`tipos_actividad`), con
  lectura adicional para capturadores solo-cargo (necesitan VER la
  lista para elegir, aunque no puedan crear ni editar). Se agregó
  `registros_actividad.caracter_id` (FK opcional) -- el carácter
  elegido queda en el REGISTRO de asistencia, no en el tipo de culto, así
  el mismo tipo puede variar de carácter cada vez sin editarse.
- **`src/pages/Modulos.jsx`** (web): nueva sección "Caracteres de
  culto", a nivel de congregación (no por módulo específico) -- crear,
  editar el nombre, activar/desactivar. Mismo patrón visual que el resto
  de la pantalla.

## PWA (`siga-pwa-nacional`)

- **`src/lib/supabase.js`**: `getCaracteresCulto(congregacionId)`;
  `registrarActividad()` ahora acepta y guarda `caracterId`.
- **`src/pages/CapturaActividad.jsx`**: nuevo selector "Carácter del
  culto (opcional)", debajo de la elección del culto -- **solo aparece
  si la congregación tiene al menos un carácter configurado**, para no
  ensuciar el formulario de quienes no usan esta función. Se muestra
  también en la confirmación antes de guardar si se eligió alguno.

## Alcance explícito

Solo se agregó a la PWA y al formulario genérico (Ujieres/Evangelismo/
Misión Juvenil vía `CapturaActividad.jsx`) -- no se tocó
`RegistrarAsistencia.jsx` (el formulario de contingencia de la web) ni
Obra Carcelaria (que no usa este motor genérico). Si se necesita ahí
también, es una extensión aparte.

## Verificación

`npm run build` corre limpio en ambos proyectos (web y PWA). Pendiente
verificación de punta a punta una vez el usuario ejecute
`caracteres_culto.sql` en Supabase.

## Acción requerida del usuario

Ejecutar `supabase/caracteres_culto.sql` en el SQL Editor de Supabase
(después de `rls_cargo_pwa.sql`, ya aplicado).
