# Monitoreo de errores y alertas — 2026-09-11

## Contexto

Último punto pendiente del checklist de producción del 2026-09-10.
El usuario pidió dos cosas explícitamente:

1. Construir algo propio dentro de SIGAP, sin depender de terceros.
2. Además, dejar preparados los servicios externos (Sentry para
   errores en tiempo real, UptimeRobot para avisar si el sitio se
   cae), con instrucciones paso a paso.
3. **Regla importante de acceso**: esto es un dominio exclusivo de
   `super_admin` -- el rol `nacional` es un rol pastoral de la IPUC
   (cliente) y NO debe ver ni intervenir en la salud técnica de
   SIGAP. Solo super_admin.

## Parte 1 — Construido: monitoreo propio dentro de SIGAP

### Por qué no existía nada de esto

La app no tenía ningún `ErrorBoundary` de React -- un error de render
en cualquier pantalla dejaba al usuario viendo una página en blanco,
sin mensaje ni forma de recuperarse salvo adivinar que debía recargar.
Tampoco había ningún registro de errores de JavaScript en el navegador
(`window.onerror`, promesas rechazadas sin manejar).

### Diseño

Mismo patrón exacto que `suscripciones.sql` (dominio exclusivo de
super_admin, comentado explícitamente para que quede claro que
`nacional` no aplica aquí):

- `supabase/schema/monitoreo_errores_frontend.sql` -- tabla
  `errores_frontend` (mensaje, stack, contexto, url, user_agent,
  usuario_id, revisado, created_at). Insert abierto a `anon` +
  `authenticated` a propósito (un error puede pasar en la landing
  pública o en Login, antes de que exista sesión) -- es un log de
  solo escritura para quien lo genera. Select/update/delete
  exclusivos de `es_super_admin()`.
- `src/lib/errorLogging.js` -- `logClientError()` (best-effort,
  nunca lanza, trunca mensaje/stack a 4000 caracteres) y
  `instalarCapturaGlobalDeErrores()` (engancha `window.onerror` y
  `unhandledrejection`).
- `src/components/ErrorBoundary.jsx` -- nuevo, envuelve toda la app
  en `main.jsx`. Si algo revienta en render, muestra "Algo salió mal"
  con un botón de recargar en vez de pantalla en blanco, y registra
  el error.
- `src/pages/ErroresSistema.jsx` -- nueva pantalla ("Errores del
  sistema" en el sidebar, solo visible si `nivel === 'super_admin'`,
  mismo patrón que "Suscripciones"): lista los últimos 200 errores,
  filtro "solo sin revisar", ver stack completo, marcar revisado,
  eliminar.

### Limitación reconocida (no resuelta a propósito)

Esto detecta errores de JavaScript que sí llegan a ejecutarse en un
navegador. NO detecta "el sitio está completamente caído" (DNS,
Cloudflare, o el propio bundle no carga) -- para eso se necesita un
monitor externo que revise `sigap.com.co` desde afuera (Parte 2).

## Parte 2 — Servicios externos (requieren que el usuario cree las cuentas)

No puedo crear cuentas de terceros en nombre del usuario. Ya quedó
todo preparado en el código para que activarlos sea solo configurar,
sin tocar código de nuevo.

### Sentry (errores de frontend en tiempo real, con notificación)

Ya está instalado (`@sentry/react`) y conectado
(`src/lib/sentry.js`, llamado desde `main.jsx` y desde
`ErrorBoundary.jsx`) -- pero apagado mientras no exista
`VITE_SENTRY_DSN`. El CSP (`public/_headers`) ya permite
`https://*.sentry.io` en `connect-src`.

**Pasos para activarlo:**

1. Crear cuenta gratis en https://sentry.io (plan Developer, gratis
   hasta 5,000 errores/mes -- de sobra para el tamaño actual de
   SIGAP).
2. Crear un proyecto nuevo, plataforma "React".
3. Sentry muestra un DSN (una URL tipo
   `https://xxxx@oNNNN.ingest.us.sentry.io/NNNN`). Copiarlo.
4. En Cloudflare, ir al Worker `siga-web` -> Settings -> Variables and
   Secrets -> agregar `VITE_SENTRY_DSN` con ese valor (como variable
   de build, no secreto de runtime -- Vite la necesita en tiempo de
   build).
5. Volver a desplegar (un push nuevo a `main`, o "Retry deployment"
   en Cloudflare) para que el build recoja la variable.
6. Listo -- desde ese momento, Sentry avisa por correo cuando ocurre
   un error nuevo, sin que nadie tenga que entrar a revisar SIGAP.

### UptimeRobot (avisar si sigap.com.co deja de responder)

Esto no toca código -- es 100% configuración externa.

1. Crear cuenta gratis en https://uptimerobot.com (plan Free, hasta
   50 monitores, chequeo cada 5 minutos).
2. "Add New Monitor" -> tipo "HTTP(s)" -> URL `https://sigap.com.co`.
3. En "Alert Contacts", agregar el correo (y opcionalmente WhatsApp
   vía su integración, si el plan gratis la permite) donde se deba
   avisar si el sitio deja de responder.
4. Guardar. Empieza a monitorear de inmediato.

## Corrección durante la verificación

Al probar `ErroresSistema.jsx` con una cuenta que NO es super_admin
(rol local), la pantalla se quedaba en "Cargando..." para siempre --
el `useEffect` que carga los datos estaba condicionado a
`nivel === 'super_admin'`, así que `loading` nunca pasaba a `false`
para ningún otro rol. Corregido siguiendo el mismo patrón que ya usa
`Suscripciones.jsx`: la carga se dispara siempre que `roleLoading`
termine (RLS ya devuelve vacío para quien no es super_admin), y el
mensaje de "vista exclusiva de super_admin" se evalúa después.

## Verificación

1. `npm run build` sin errores.
2. Playwright contra `npm run dev`, con la cuenta local
   `pueba691@gmail.com` (rol `local`, NO super_admin):
   - El enlace "Errores del sistema" NO aparece en su sidebar.
   - Navegar directo a `/errores-sistema` muestra el mensaje de
     acceso exclusivo de super_admin, sin quedarse cargando.
   - Se disparó una promesa rechazada real en el navegador
     (`Promise.reject(...)`) y se confirmó por red que sí se envía un
     `POST` a `errores_frontend` con el mensaje, stack, contexto,
     url, user_agent y usuario_id correctos (falló con 404 porque la
     tabla real todavía no existe -- ver pendiente abajo -- pero
     confirma que la captura global funciona de punta a punta).

## Cierre (2026-09-11) — todo confirmado en producción

- `supabase/schema/monitoreo_errores_frontend.sql`: **ejecutado por
  el usuario**.
- Sentry: el usuario creó cuenta y el primer proyecto/DSN, pero ese
  proyecto no aparecía en el dashboard ("You need at least one
  project to use this view") pese a que un error de prueba disparado
  contra producción sí devolvía `200 OK` en el envelope de Sentry --
  no se confirmó la causa exacta (posible proyecto huérfano de un
  asistente no finalizado del todo), pero en vez de seguir
  diagnosticando a ciegas se optó por lo más simple y confiable: crear
  un proyecto nuevo dentro de la misma organización
  (`o4512071311818752`, org `jormelia-soft`), reemplazar
  `VITE_SENTRY_DSN` en Cloudflare con el DSN nuevo y redesplegar.
  **Confirmado funcionando de punta a punta**: error de prueba real
  disparado contra `sigap.com.co` en producción, `200 OK` del envelope
  de Sentry, y el usuario lo vio aparecer en "Issues" del proyecto
  nuevo.
- UptimeRobot: el usuario ya creó el monitor HTTP(s) para
  `https://sigap.com.co`, chequeo cada 5 minutos, estado "Up".

Con esto, monitoreo/alertas/logs queda completamente cerrado -- no
queda ninguna acción pendiente de este punto.
