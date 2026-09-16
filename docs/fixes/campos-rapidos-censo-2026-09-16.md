# Campos rápidos del censo — 2026-09-16

## Contexto

El usuario mandó una lista de 13 pedidos por WhatsApp. Antes de
construir se auditó cada uno contra el código real (informe completo
en el chat) para confirmar qué ya existía, qué faltaba y qué estaba a
medias. De esos 13, se priorizó el grupo "campos rápidos" -- los que
no requieren un módulo nuevo (salud, disciplina) ni infraestructura
nueva (subida de archivos/firma).

## Construido

`supabase/modulos/censo_datos_ampliados.sql` (confirmado ejecutado):

**En `personas`** (censo de creyentes):
- `tipo_documento` (catálogo: cédula, tarjeta de identidad, cédula de
  extranjería, pasaporte, registro civil, otro) + `numero_documento`.
- `nivel_educativo` (catálogo de 9 niveles, desde "Ninguno" hasta
  "Posgrado").
- `ocupacion` (texto libre -- decisión explícita del usuario delegada:
  una lista cerrada de profesiones no tiene sentido, son demasiado
  variadas).
- `telefono_tipo` (celular/fijo/ambos), `tiene_whatsapp`,
  `telefono_alterno`, `red_social`.
- `pais_bautismo`, `municipio_bautismo`, `congregacion_bautismo_id`
  (FK a `congregaciones`, opcional) + `congregacion_bautismo_nombre`
  (texto manual, para cuando la sede no aparece en el buscador -- tal
  como se pidió) y `pastor_bautizo` (texto libre, no un `pastor_id`,
  porque puede ser un bautismo antiguo o de otra congregación/país que
  ya no existe en el sistema).

**En `amigos`** (simpatizantes en ruta evangelística): el mismo
contacto ampliado (`telefono_tipo`, `tiene_whatsapp`,
`telefono_alterno`, `red_social`) -- el usuario pidió explícitamente
que esto aplicara "tanto al creyente como a los amigos".

**"Cantidad de hijos" -- deliberadamente NO se agregó como columna.**
Se calcula en el frontend contando otras personas de la misma familia
con `parentesco_familiar='hijo'`. Guardarlo aparte habría creado un
dato que se desactualiza solo con agregar o quitar un hijo de la
familia más adelante.

### Frontend

`src/pages/FeligresiaAdmin.jsx`: nueva sección plegable "Datos
adicionales del censo" en la ficha de persona (no se mezcló con los
campos principales para no saturar un formulario que ya es largo).
Incluye buscador de congregación de bautismo (reutiliza la RPC
`buscar_congregaciones` que ya usa el flujo de traslados) con
fallback a nombre manual. La sección de bautismo (país/municipio/
congregación/pastor) solo aparece si la persona está marcada como
bautizada.

`src/pages/Amigos.jsx`: contacto ampliado en el formulario de
registro Y en el de edición de un amigo existente.

`src/lib/contacto.js` (nuevo): `TELEFONO_TIPO_LABELS` compartido
entre los dos archivos, para no duplicar el catálogo.

## Alcance NO cubierto en esta pieza (de los 13 pedidos originales)

Quedan pendientes de retomar si se piden explícitamente: matrimonio
(ya estaba resuelto de antes), módulo de salud/EPS, disciplina/
suspensión de cargos, consentimiento de datos con archivo/firma,
familias con composición mixta (creyentes + amigos), y acudiente
obligatorio/vinculado en Escuela Dominical. Ver el resumen completo
de la auditoría de los 13 puntos en el historial de la conversación
del 2026-09-16.

## Verificación

- `npm run build` sin errores en cada paso.
- Playwright + consulta directa con la cuenta real: creada una
  persona de prueba con TODOS los campos nuevos llenos (documento,
  nivel educativo, ocupación, contacto ampliado, y bautismo con
  congregación real encontrada por el buscador) -- confirmado que se
  guardó exactamente como se llenó, incluido que al elegir una
  congregación real del buscador, `congregacion_bautismo_nombre`
  queda en null (no se duplica el dato). Formulario de Amigos
  verificado visualmente con los 4 campos de contacto nuevos.
  Registro de prueba eliminado de la base real al terminar, cero
  residuo.
- Cero errores de consola.
