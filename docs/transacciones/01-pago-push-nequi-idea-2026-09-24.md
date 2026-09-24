# Idea: pago push vía Nequi (no implementada, solo exploración)

**Fecha:** 2026-09-24
**Estado:** Idea del usuario, evaluada y documentada a pedido suyo.
**No hay código ni diseño técnico todavía -- este documento es la
discusión inicial de viabilidad, para retomarla cuando se decida
construirla.**

## De dónde salió

El usuario observó cómo funciona la recarga de saldo móvil en la app
de Tigo Shop: el cliente elige un paquete, la app dispara una
notificación push a Nequi, el cliente la confirma dentro de la app de
Nequi y el monto se debita automáticamente -- sin que el cliente
tenga que copiar un número de cuenta ni el comercio tenga que
verificar el comprobante a mano. Preguntó si SIGAP podría cobrar así
a las congregaciones, en vez del registro manual actual.

## Cómo funciona ese patrón (visto desde afuera)

No es magia de Tigo -- es el flujo estándar de "botón de pago" /
"pago persuasivo" que Nequi ofrece a comercios afiliados:

1. El comercio (Tigo, o en este caso SIGAP) genera una solicitud de
   cobro contra la API de un agregador de pagos, indicando el monto y
   el número de celular del cliente asociado a su cuenta Nequi.
2. Nequi le manda una notificación push al cliente dentro de su
   propia app, mostrando el monto y quién lo solicita.
3. El cliente la aprueba (o rechaza) desde ahí mismo -- la
   autenticación y el debito los maneja Nequi, el comercio nunca ve
   ni maneja credenciales bancarias.
4. El agregador le notifica al comercio (vía webhook) si el pago se
   confirmó, para que actualice su propio sistema.

## Viabilidad para SIGAP

**Sí es viable técnicamente.** No se necesita integrar directo con
Nequi (eso es para operadores grandes con acuerdos empresariales) --
se hace a través de un **agregador de pagos** que ya tiene ese
convenio resuelto. En Colombia, los más relevantes para este caso:

- **Wompi** (del grupo Bancolombia, dueño de Nequi): la integración
  más natural, tiene el "botón Nequi" como método de pago de primera
  clase en su API.
- **ePayco**: alternativa colombiana equivalente, también soporta
  Nequi push.

El flujo dentro de SIGAP sería: desde `Suscripciones.jsx`, en vez de
(o además de) "Registrar pago" manual, un botón "Cobrar por Nequi"
que llama a la API del agregador con el monto de esa congregación;
cuando el agregador confirma el pago por webhook, se llama
automáticamente a `registrar_pago_suscripcion()` (la misma RPC que ya
existe hoy para el registro manual) en vez de que el super_admin lo
haga a mano.

## Lo que de verdad implica construirlo

No es solo "llamar una API" -- son varias piezas reales:

1. **Afiliación como comercio**: SIGAP (la persona jurídica o natural
   que factura) tiene que registrarse como comercio ante el
   agregador elegido -- NIT, contrato, cuenta bancaria de
   liquidación. Esto es un trámite de negocio, no de código.
2. **Comisión por transacción**: los agregadores cobran un porcentaje
   por cada cobro exitoso (típicamente 2-3.5% + IVA en Colombia). Hay
   que decidir si SIGAP lo absorbe o lo traslada al precio.
3. **Webhook + conciliación**: se necesita un endpoint (Supabase Edge
   Function, como ya se usa para `invitar-usuario` u
   `otorgar-acceso-jerarquico`) que reciba la confirmación del
   agregador, valide su firma/autenticidad, y solo entonces marque el
   pago -- nunca confiar en una llamada desde el frontend sin
   verificar.
4. **Casos raros que hay que manejar**: el cliente rechaza el push,
   el push expira sin respuesta, el webhook llega duplicado, el
   agregador está caído. El flujo manual actual no tiene ninguno de
   estos problemas porque un humano lo revisa cada vez.
5. **¿Quién dispara el cobro?**: falta decidir si lo inicia el
   super_admin manualmente (equivalente a hoy, pero con push en vez
   de transferencia) o si se automatiza por completo (ej. un cron
   mensual que cobra solo en la fecha de vencimiento) -- la segunda
   opción es más ambiciosa y necesita más cuidado con reintentos y
   avisos previos.

## Recomendación

Vale la pena construirlo, pero no es urgente con el volumen de hoy
(recaudo manual de pocas congregaciones). Tiene sentido priorizarlo
cuando el número de congregaciones pagando crezca lo suficiente para
que el registro manual empiece a consumir tiempo real del
super_admin, o cuando se quiera reducir la mora por fricción de pago
(un push es más fácil de aprobar que hacer una transferencia y
avisar). Mientras tanto, el flujo manual actual sigue siendo
perfectamente funcional y sin ningún costo de transacción.

**Siguiente paso, cuando se decida construirlo**: elegir agregador
(Wompi es el candidato más fuerte por la integración directa con
Nequi), completar la afiliación como comercio, y diseñar la Edge
Function de webhook antes de tocar el frontend.
