# "Último acceso" + cierre de sesión por inactividad — 2026-09-15

## Contexto

El usuario pidió dos features de seguridad de sesión, comunes en otro
software: (1) mostrar en algún lugar visible la fecha/hora del último
inicio de sesión, y (2) cerrar la sesión automáticamente tras
inactividad, para que nadie deje SIGAP abierto horas o días sin
querer. Decisiones confirmadas con el usuario: **1 hora** de
inactividad antes de cerrar sesión, y el "último acceso" se muestra
como **un aviso al entrar que desaparece solo** (no un texto fijo).

## Diagnóstico antes de construir

- Ya existía un campo "Último acceso" en Configuración → Preferencias,
  pero con un bug real: usaba `user.last_sign_in_at` de Supabase, que
  se actualiza en el momento del login ACTUAL -- así que mostraba
  siempre la hora en la que la persona "acaba de entrar", nunca la vez
  anterior. Se corrigió como parte de esta pieza.
- No existía ningún mecanismo de inactividad/idle-timeout en el
  código.

## Construido

### "Último acceso" (acceso ANTERIOR, no el actual)

`supabase/schema/ultimo_acceso_usuario.sql` (nuevo, confirmado
ejecutado por el usuario, dos veces -- la segunda agregó una columna
que faltaba): dos columnas nuevas en `preferencias_usuario`:
- `ultimo_acceso`: el login que ACABA de ocurrir, se sobrescribe en
  cada inicio de sesión.
- `acceso_anterior`: el valor que tenía `ultimo_acceso` justo ANTES de
  sobrescribirlo -- el que se le muestra al usuario. Queda "congelado"
  con ese valor durante toda la sesión.

**Por qué dos columnas y no una**: si se guarda un solo valor y se
sobrescribe en cada login, cualquier pantalla que lo consulte más
tarde en la misma sesión (por ejemplo, visitar Configuración media
hora después de entrar) ve el valor YA sobrescrito por el login
actual -- el mismo bug que tenía `last_sign_in_at`, solo que movido de
lugar. Con `acceso_anterior` congelado, da igual cuándo se consulte
durante la sesión: siempre es el dato correcto.

`src/hooks/useAuth.js`: nueva función `registrarAcceso()` (exportada
aparte del hook `useAuth`, para llamarse una sola vez por login, no
una vez por cada uno de los 13 componentes que usan `useAuth()`). Lee
`ultimo_acceso`, lo devuelve como el acceso anterior, y en la misma
escritura mueve ese valor a `acceso_anterior` y pone la hora de ahora
en `ultimo_acceso`.

`src/pages/Login.jsx`: los 3 puntos donde se navega a `/app` tras un
login exitoso (sin MFA, con MFA, y activación de cuenta invitada)
ahora llaman `registrarAcceso()` antes de navegar, y pasan el valor
devuelto como `location.state.ultimoAccesoAnterior`.

`src/components/layout/MainLayout.jsx`: lee ese `location.state` una
vez al montar, y muestra un `Toast` (nuevo tono `info`, agregado a
`src/components/Toast.jsx`) que dice "Tu último acceso fue el..." y
desaparece solo a los 6s -- igual que el resto de avisos de la app.

`src/pages/ConfiguracionSistema.jsx`: el campo "Último acceso"
existente ahora lee `acceso_anterior` en vez de
`user.last_sign_in_at`, corrigiendo el bug original.

### Cierre de sesión por inactividad (1 hora)

`src/hooks/useIdleLogout.js` (nuevo): escucha actividad real
(mousedown, mousemove, keydown, scroll, touchstart) con un
`setInterval` de 1s que compara contra la última actividad. A los 59
minutos sin actividad muestra un aviso ("¿Sigues ahí? tu sesión se
cerrará en Ns") con cuenta regresiva y un botón "Seguir conectado"; a
la hora completa cierra sesión sola.

- **Sincronizado entre pestañas** vía `localStorage`: actividad en
  cualquier pestaña de SIGAP reinicia el conteo en todas (para no
  cerrar una pestaña activa solo porque otra quedó quieta). Los
  escritos a `localStorage` se limitan a una vez cada 5s (no en cada
  mousemove) para no ser excesivos.
- Se usa en `MainLayout.jsx` (dentro de `ProtectedRoute`), nunca en
  rutas públicas (`/`, `/ayuda`, `/legal`, `/login`).
- **Bug real encontrado y corregido durante la prueba**: al cerrar
  sesión, si se llama `signOut()` antes de navegar, `ProtectedRoute`
  reacciona al instante (vía `onAuthStateChange`) y redirige a
  `/login` con su propio motivo genérico `session_expired`,
  ganándole la carrera al motivo específico `idle_timeout` de este
  hook -- el usuario veía "tu sesión expiró" en vez de "te cerramos
  por inactividad". Se corrigió invirtiendo el orden: navegar primero,
  cerrar sesión después.
- `src/pages/Login.jsx`: nuevo mensaje distinto para `idle_timeout`
  ("Cerramos tu sesión por inactividad...") vs. el `session_expired`
  ya existente ("Tu sesión expiró por seguridad...").

### Bug real encontrado y corregido durante la prueba (consultas "lazy")

La primera versión de `registrarAcceso()` no funcionaba: el `.upsert()`
final no llevaba `await` ni `.then()`, y en supabase-js las consultas
son "lazy" -- si nunca se les llama `.then()` (directa o
indirectamente vía `await`), la petición HTTP nunca se dispara.
Confirmado con Playwright viendo el tráfico de red: la fila nunca se
creaba. Se corrigió agregando `await`.

## Verificación

- `npm run build` sin errores en cada paso.
- Playwright con la cuenta real `pueba691@gmail.com`:
  - Cierre por inactividad probado de punta a punta con tiempos
    acortados temporalmente (15s/10s en vez de 1h/60s, revertido antes
    de cada commit): aviso visible en la ventana correcta, botón
    "Seguir conectado" reinicia el conteo sin cerrar sesión, cierre
    automático al llegar a 0 con el mensaje correcto en Login.
  - "Último acceso": dos logins seguidos -- el primero no muestra
    aviso (no hay acceso anterior), el segundo muestra
    "Tu último acceso fue el [hora del login 1]", y Configuración
    muestra exactamente el mismo valor aunque se visite después de que
    el login 2 ya sobrescribió `ultimo_acceso`.
  - Cero errores de consola en todas las pruebas.

## Pendiente

Ninguno -- ambas piezas quedaron completas, probadas y confirmadas
por el usuario (ejecutó el script SQL dos veces, una por cada columna
agregada).
