# Eliminar persona del censo (corrección de error de captura) — 2026-11-05

## Contexto

El usuario notó que `FeligresiaAdmin.jsx` nunca permitió borrar una
persona -- solo cambiar `estado_membresia`. Caso real identificado:
alguien quedó duplicado o se registró por equivocación y debe poder
desaparecer del todo (no aplica dar de baja a alguien real, que ya
tiene su propio camino vía estado).

## Por qué no hizo falta SQL nuevo

- `personas_feligresia_write` (`supabase/modulos/feligresia.sql:563-565`)
  ya es `for all` -- cubre DELETE, protegida por
  `puede_administrar_feligresia(congregacion_id)`, la misma función
  que ya protege editar/crear.
- `personas` tiene ~20 tablas relacionadas con `RESTRICT` por defecto
  (roles_sistema, historial_cargos, membresias_comite,
  movimientos_membresia, traslados_feligresia, etc.) -- cualquier
  persona con actividad real ya capturada bloquea el borrado sola, sin
  tener que programar ninguna validación manual. Solo una persona
  recién creada, sin nada de eso, se puede borrar.
- El trigger `personas_auditoria` (ya existente) audita el DELETE
  automáticamente en `auditoria_feligresia.antes` (columna `uuid`
  plana, sin FK -- sobrevive el borrado).

## Qué se hizo (solo frontend)

- `src/pages/FeligresiaAdmin.jsx`: botón "Eliminar (creada por error)"
  dentro de la ficha de edición, junto a Reconciliar/Registrar
  fallecimiento. Mismo patrón `AdminDialog` que ya usa
  `marcarFallecido`. Si Postgres rechaza el DELETE por `23503`
  (persona con historial real), se traduce a un mensaje claro en vez
  del error crudo de la base de datos.
- i18n en 3 idiomas, namespace `feligresiaAdmin.*`.

## Verificado con Playwright (cuenta demo, no datos reales)

- Persona fresca sin historial: se borra sin problema, aparece el
  toast de éxito, desaparece de la lista.
- "Pastor Demo" (tiene `roles_sistema` real, es la cuenta de login de
  la demo): el borrado queda bloqueado, aparece el mensaje de
  "tiene historial asociado", cero errores de consola sin manejar.

Commit `9d6e25e`, pusheado.
