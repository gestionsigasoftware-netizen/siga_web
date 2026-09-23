# Feligresía: "Atender" no cerraba el ciclo de la alerta de asistencia -- 2026-09-23

## Contexto

Un directivo nacional de la IPUC preguntó (via el usuario) cómo
SIGAP detecta a tiempo que un feligrés está menguando en su asistencia,
para poder actuar antes de que se convierta en desertor. Al revisar el
mecanismo que ya existe (`personas.fecha_ultima_asistencia` + la
alerta "Persona sin asistencia reciente" en `vw_alertas_pastorales`,
tipo `asistencia_persona`, 90 días sin actualizar), se encontró que el
botón "Atender" que ya está en pantalla **no soluciona el problema de
fondo**.

## Diagnóstico

`attendPastoralAlert`/`saveAlertAttention` en `FeligresiaAdmin.jsx`
(el único lugar del código que "atiende" alertas): al hacer clic en
"Atender", solo (1) inserta una nota en `seguimientos_pastorales` y
(2) marca la fila en `estados_alerta_pastoral` como `atendida`.
**Nunca actualiza `personas.fecha_ultima_asistencia`.**

La clave de la alerta (`congregacion_id:asistencia_persona:persona_id:YYYY-MM`)
incluye el mes en curso. Como "atendida" solo aplica a esa clave
exacta, y el mes cambia cada vez que se recalcula la vista, "Atender"
en realidad solo silencia la alerta por lo que queda del mes -- al mes
siguiente la clave cambia, la comparación contra `estados_alerta_pastoral`
ya no coincide, y como el dato real (`fecha_ultima_asistencia`) nunca
cambió, la misma alerta reaparece sola. Es decir: el mecanismo
existente nunca cerraba el ciclo, solo lo posponía un mes.

## Corrección

`src/pages/FeligresiaAdmin.jsx`:
- Nuevo botón **"Confirmar contacto hoy"**, junto al "Atender"
  existente, visible solo para alertas `tipo === 'asistencia_persona'`
  (esas ya traen `persona_id`).
- Nuevo handler `confirmarContactoHoy()`: sin abrir ningún formulario,
  hace directo `update personas set fecha_ultima_asistencia = hoy
  where id = persona_id`. Como la alerta se genera comparando ese
  mismo campo contra `current_date - 90`, al quedar en hoy la alerta
  deja de generarse sola en la siguiente carga -- ya no depende de la
  clave mensual de `estados_alerta_pastoral`.
- El botón "Atender" original queda intacto (sigue sirviendo para
  dejar una nota pastoral completa cuando aplica) -- cambio puramente
  aditivo, sin quitar nada.
- Sin cambios de SQL/RLS: `personas_feligresia_write` ya usa
  `puede_administrar_feligresia(congregacion_id)`, la misma función
  que protege `estados_alerta_pastoral_write`.

## Verificación

- `npm run build` sin errores.
- No se pudo probar con clics reales contra un feligrés con la alerta
  activa en producción (crear/limpiar un caso de prueba con una fecha
  vieja queda pendiente si el usuario quiere confirmarlo en vivo) --
  verificado por código contra la lógica exacta de
  `vw_alertas_pastorales` (comparación directa con
  `fecha_ultima_asistencia`).

Ver también `docs/fixes/vista-ultimo-contacto-amigos-2026-09-23.md`
(la pieza equivalente para amigos/ruta evangelística, mismo pedido del
directivo).
