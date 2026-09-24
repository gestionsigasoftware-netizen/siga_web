# Transacciones

Carpeta dedicada a todo lo relacionado con el cobro de suscripciones
de SIGAP a las congregaciones: pasarelas de pago, automatización del
recaudo, conciliación y cualquier decisión o exploración sobre cómo
se mueve el dinero dentro del sistema. Se separa de `modelo-negocio/`
(que trata precios y el modelo comercial) porque este tema es más
técnico/operativo: cómo se ejecuta el cobro, no cuánto ni por qué.

## Estado actual (2026-09-24)

Hoy el cobro es 100% manual: la congregación paga por Nequi o
transferencia bancaria y el super_admin lo registra a mano en
`Suscripciones` (`src/pages/Suscripciones.jsx`, botón "Registrar
pago"). No hay ninguna pasarela de pago integrada. Ver
`docs/modelo-negocio/03-suscripcion-mensual-por-congregacion.md` para
el modelo de precios y el riesgo ya identificado ahí ("recaudo
fragmentado... exige una pasarela de pagos").

## Documentos

- [01 — Pago push vía Nequi/agregador (idea, no implementada)](01-pago-push-nequi-idea-2026-09-24.md)
