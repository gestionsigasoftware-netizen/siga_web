# 3 hallazgos reportados sobre una congregación real recién creada (2026-09-10)

El usuario compartió una captura de la congregación real "AGUA BONITA
SUAREZ CAUCA" (pastor Carlos Andrés Sánchez Mina), recién creada, con
tres observaciones. Los tres eran comportamientos reales, no percepción
-- ninguno requería más información del usuario para diagnosticarse.

## 1. El sidebar mostraba "Distrito 6 · Pto Tejada"

**Causa real**: la tabla `distritos` nació (antes de que existiera la
columna `numero`) con `nombre text not null unique` como único
identificador. Cuando se agregó `numero` después
(`gestion_pastoral_distrital_v2.sql`), `nombre` quedó como campo legado
-- pero seguía siendo obligatorio para guardar un distrito, así que en
la práctica se llenó con el nombre de una congregación del distrito
(en este caso, "Pto Tejada"). El Distrito 6 tiene además OTRA
congregación (Agua Bonita) -- por eso el nombre mostrado no
correspondía a la congregación que el usuario tenía abierta.

**Confirmado con el usuario**: los distritos de la IPUC no tienen
nombre propio, solo número -- los nombres son siempre de las
congregaciones.

**Corregido (solo frontend, sin migración de datos)**: se dejó de
mostrar `distritos.nombre` en absolutamente todas las pantallas que lo
usaban -- ahora se muestra únicamente `Distrito {numero}`. Archivos
tocados: `Sidebar.jsx`, `RoleChooser.jsx`, `GlobalSearch.jsx`,
`Dashboard.jsx` (2 lugares), `Aprobaciones.jsx`, `Configuracion.jsx`,
`ComitesNacional.jsx`, `GestionDistritos.jsx`,
`GestionPastoralNacional.jsx`, `PastoralDistrital.jsx`,
`SaludDatos.jsx`, `Solicitudes.jsx`, `Suscripciones.jsx`,
`FeligresiaAdmin.jsx` (buscador de traslado).

**Se corrigió también la causa raíz, no solo el síntoma**: el
formulario "Catálogo de distritos" (`GestionDistritos.jsx`, exclusivo
nacional/super_admin) pedía un campo "Nombre" obligatorio al crear o
editar un distrito -- así fue como se pobló mal el Distrito 6, y
volvería a pasar con cualquiera de los 30 distritos que aún no se han
dado de alta. Se quitó el campo del formulario; ahora solo se pide
`numero` (1-36) y `nombre` se autocompleta como `Distrito {numero}` en
el backend (la columna sigue siendo `not null unique` en el esquema,
así que no se puede omitir sin una migración -- pero como ya no se
muestra en ninguna parte, no importa qué valor tenga).

No fue necesario tocar la base de datos real: los 36 registros
existentes de `distritos.nombre` (con nombres de congregaciones)
quedan igual, simplemente ya no se leen en ninguna pantalla.

## 2. El pastor recién creado disparaba 3 "Alertas pastorales" de una vez

Al crear una congregación con `crear_congregacion_con_pastor()`, el
pastor se inserta en `personas` sin `fecha_ingreso` y sin historial --
es la única persona activa de la congregación, así que de inmediato
cumplía las 3 condiciones de `vw_alertas_pastorales`: sin familia, sin
bautismo, sin asistencia reciente.

**No es un comportamiento correcto** -- es el mismo bug de "ausencia de
dato se interpreta como riesgo real" ya corregido antes en
`Conquistadores.jsx`/`DamasDorcas.jsx` ("sin seguimiento reciente"
comparado contra `fecha_ingreso` en vez de marcar automáticamente).
Aquí no se había aplicado ese mismo criterio, y afecta a CUALQUIER
persona recién registrada, no solo al pastor de esta creación
automática -- un feligrés cualquiera dado de alta hoy por un pastor
local también saldría con las 3 alertas de inmediato.

**Corregido** en `supabase/reportes/fix_alertas_pastorales_gracia_ingreso.sql`
(reemplaza la vista `vw_alertas_pastorales` completa): cada una de las
3 alertas de ficha ahora exige que hayan pasado ciertos días desde
`coalesce(fecha_ingreso, created_at)` antes de dispararse:

- Sin familia: 30 días de gracia.
- Pendiente de bautismo: 90 días de gracia.
- Sin asistencia reciente: además de los 90 días sin asistencia que ya
  exigía, ahora también exige 90 días desde el ingreso (antes bastaba
  con no tener `fecha_ultima_asistencia`, sin importar si la persona
  llevaba una semana en la congregación).

No se excluyó al pastor específicamente -- la corrección es general y
correcta para cualquier persona nueva, que es la interpretación
correcta de lo que preguntó el usuario.

**Pendiente de ejecutar por el usuario**: correr
`fix_alertas_pastorales_gracia_ingreso.sql` en el SQL Editor de
Supabase.

## 3. "Ver ficha" desde una alerta cerró la sesión inesperadamente

Se auditó cada lugar del código donde se llama `supabase.auth.signOut()`
-- es una sola línea, en el botón de logout del Sidebar. El clic en
"Ver ficha" navega con `<Link>` (sin recargar la página) a
`/feligresia?persona=<id>`, así que no hay forma de que ese clic en
particular dispare un cierre de sesión desde el código de la app.

**Diagnóstico**: el cierre de sesión real casi con toda seguridad vino
de Supabase mismo -- el token de acceso expira (por defecto 1 hora) y
si el refresco automático falla justo cuando `FeligresiaAdmin.jsx`
dispara varias consultas nuevas al montar (como al abrir una ficha
recién creada), el SDK cierra la sesión (evento `SIGNED_OUT`) sin que
el código de SIGAP haga nada explícito. Es coherente con que el
usuario dijera que pasó "una vez, hace un rato" -- depende del momento
exacto del token, no del botón en sí.

**El bug real no era el cierre de sesión en sí (eso es seguridad
esperada), sino que ocurría en silencio**: `ProtectedRoute` mandaba a
`/login` sin ninguna explicación, y el usuario lo vivió como "la app me
sacó sin razón" -- exactamente la pregunta que hizo.

**Corregido**:
- `src/components/layout/ProtectedRoute.jsx`: ahora recuerda (con un
  `ref`) si hubo un usuario autenticado en algún momento de esta
  sesión del navegador. Si la sesión desaparece después de haber
  existido, la redirección a `/login` lleva
  `state={{ reason: 'session_expired' }}` -- una entrada sin sesión
  previa (primera visita) no lleva ese estado.
- `src/pages/Login.jsx`: si llega con `location.state.reason ===
  'session_expired'`, muestra de entrada "Tu sesión expiró por
  seguridad. Inicia sesión de nuevo." en el mismo cajón de error rojo
  que ya usa el formulario. El estado se limpia del historial
  (`window.history.replaceState`) para que un refresh de `/login` no
  lo repita.

Esto no evita la expiración de sesión (es un control de seguridad
esperado y deseable, no algo a "arreglar" quitándolo) -- corrige que
fuera invisible para quien la vive.

## Verificación

`npm run build` sin errores tras los cambios de frontend. El fix de
alertas es solo SQL (una vista) -- se verifica visualmente cuando el
usuario lo ejecute y confirme que el pastor recién creado deja de
mostrar las 3 alertas de inmediato.
