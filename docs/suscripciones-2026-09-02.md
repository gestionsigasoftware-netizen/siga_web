# Suscripciones — cobro por congregación (2026-09-02)

## Contexto

El usuario preguntó por Debora IPUC (software con planes de pago) y pidió
que SIGAP hiciera lo mismo. Aclaró varias decisiones antes de construir
(algunas en una segunda vuelta, corrigiendo el diseño inicial):

1. **Cobro por congregación**, no un plan único para toda la IPUC — la
   negociación comercial con la junta nacional de la IPUC todavía no ha
   pasado, así que el modelo tiene que poder facturar a cada congregación
   de forma independiente.
2. **Sin pasarela de pagos todavía, pero el diseño ya la anticipa** — los
   términos comerciales no están definidos, así que v1 es pago manual
   (Nequi o cuenta bancaria). El flujo completo (estados, RPC de pago)
   queda igual el día que haya pasarela: lo único que cambiaría es
   *quién* llama a `registrar_pago_suscripcion` (un webhook en vez de
   super_admin).
3. **Bloqueo con aviso primero** (elegido explícitamente sobre bloqueo
   inmediato): al vencer la fecha de pago hay **5 días de gracia** con
   aviso; solo después se bloquea el acceso.
4. **Dominio exclusivo de super_admin, no de nacional** — corrección
   explícita del usuario: "nacional no controla más de lo que le toca,
   super admin está por encima incluso de nacional". `nacional` es un
   rol pastoral de la IPUC (cliente de SIGAP); `super_admin` es quien
   administra el negocio SIGAP. Por eso configurar suscripciones,
   registrar pagos y desbloquear una congregación vencida es exclusivo
   de super_admin — nacional no tiene ningún control sobre esto, ni
   siquiera de solo lectura.
5. **La congregación debe ver dónde pagar** — al estar en gracia o
   bloqueada, se le muestra el método de pago vigente (número de Nequi
   o cuenta bancaria) configurado por super_admin, para que sepa
   exactamente a dónde transferir.

## Diseño clave: nadie se bloquea por sorpresa

Una congregación **sin fila en `suscripciones`** se trata como
**sin restricción** — el bloqueo solo aplica a quien nacional/super_admin
decida empezar a facturar explícitamente desde `/suscripciones`. Esto
evita que activar esta función bloquee de golpe a las congregaciones que
ya usan SIGAP hoy.

El estado (`activa` / `en_gracia` / `bloqueada`) **nunca se guarda** —
se calcula siempre a partir de `fecha_proximo_pago + dias_gracia`
comparado con la fecha de hoy (`estado_suscripcion()` en SQL,
`calcularEstadoSuscripcion()` en `src/lib/suscripciones.js` en el
frontend). Así nunca queda desactualizado sin necesitar un cron job.

Solo el nivel **local** puede bloquearse. Distrital, nacional y
super_admin nunca pierden acceso por esto, sin importar la congregación
con la que estén asociados.

## Backend — `supabase/suscripciones.sql` (nuevo, pendiente de ejecutar)

- Tabla `suscripciones` (una fila por congregación, `unique
  (congregacion_id)`): `plan` (`mensual`/`anual`), `monto`,
  `fecha_proximo_pago`, `dias_gracia` (default **5**), y el rastro del
  último pago (`ultimo_pago_en/_metodo/_registrado_por`).
- Función `estado_suscripcion(fecha_proximo_pago, dias_gracia)` —
  calcula el estado en el momento, nunca se guarda.
- RLS: cualquiera ve el estado de su propia congregación (para saber si
  debe pagar) o todas si es super_admin; **solo super_admin** puede
  crear o editar filas — nacional no tiene ningún permiso aquí.
- Función `registrar_pago_suscripcion(congregacion_id, metodo, notas)`
  (`security definer`, exclusiva de **super_admin**): mueve
  `fecha_proximo_pago` un mes o un año hacia adelante según el plan,
  desde la fecha que sea mayor entre la fecha ya registrada y hoy (para
  no "perder" tiempo ya pagado si se registra el pago antes de la fecha
  límite). Esta es la función que "desbloquea" una congregación vencida.
- Tabla `metodos_pago_sigap` (fila única/singleton): número y titular de
  Nequi, banco/número/titular de cuenta, notas. Cualquiera autenticado
  puede leerla (para saber a dónde pagar); solo super_admin la edita.

## Frontend

- **`src/pages/Suscripciones.jsx`** (nuevo) — exclusiva de
  **super_admin** (`/suscripciones`, entrada nueva en el Sidebar visible
  solo para ese rol). Incluye:
  - Formulario para configurar el método de pago vigente (Nequi/banco),
    el mismo que ven las congregaciones en gracia o bloqueadas.
  - Lista de todas las congregaciones con su estado, búsqueda por
    nombre, contador por estado.
  - Formulario para configurar/editar plan y fecha de pago por
    congregación, y botón "Registrar pago" que llama a
    `registrar_pago_suscripcion`.
- **`src/lib/suscripciones.js`** (nuevo) — `calcularEstadoSuscripcion()`
  compartida entre la página de administración y el bloqueo de acceso,
  para no duplicar la lógica de fechas en dos lugares.
- **`src/components/layout/MainLayout.jsx`** — para roles `local` con
  congregación asociada, consulta su suscripción y:
  - **`en_gracia`**: muestra un aviso persistente arriba del contenido
    (fecha de vencimiento, días de gracia restantes, y el método de pago
    vigente), pero deja usar la app con normalidad.
  - **`bloqueada`**: reemplaza el contenido por una pantalla de bloqueo
    ("Acceso bloqueado por falta de pago") con el método de pago vigente
    y enlaces a Soporte y Mi perfil. Deja claro que solo super_admin
    puede reactivar el acceso. Las rutas `/perfil`, `/soporte`,
    `/manual`, `/legal` y `/ayuda` quedan exceptuadas del bloqueo para
    que la persona siempre pueda pedir ayuda o cerrar sesión.

## Acción requerida del usuario

1. Ejecutar `supabase/suscripciones.sql` en el SQL Editor de Supabase.
2. Entrar a `/suscripciones` (solo visible con rol super_admin) y
   configurar el método de pago (Nequi y/o cuenta bancaria) antes de
   activar el cobro de cualquier congregación.
3. Nada queda facturando por defecto — para activar el cobro de una
   congregación hay que configurarla explícitamente desde esa misma
   pantalla.
