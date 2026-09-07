# "Vincular a la Ruta" desde la entrada inicial de Obra Carcelaria — 2026-09-07

## Contexto

Tercer ítem del plan de cierre del rediseño Ruta Evangelística +
comités. El botón "Vincular" (`vincularRutaEvangelistica`) solo
existía en la pestaña **Reinserción** (post-liberación). El usuario
mencionó explícitamente que también debería existir desde el ingreso
inicial -- un interno que se bautiza o decide estando aún preso no
tenía forma de entrar a la Ruta Evangelística sin esperar a su
liberación.

## Diseño

`vincularRutaEvangelistica` recibía un `item` de `obra_carcelaria_reinsercion`
(`item.interno_id`, `item.congregacion_destino_id`) -- se refactorizó
para recibir directamente `(interno, congregacionDestinoId)`, ya que
la única diferencia real entre los dos puntos de entrada es de dónde
sale la congregación destino:

- **Reinserción**: `item.congregacion_destino_id` (la congregación
  receptora tras liberar).
- **Internos** (nuevo): `congregacionId` (la congregación actual que
  administra Obra Carcelaria -- el interno sigue preso ahí).

La función en sí (crear el `amigo`, decidir bautizado-listo-para-Feligresía
vs. no-bautizado-a-BIS) no cambió en absoluto.

## Construido

`src/pages/ObraCarcelaria.jsx`:
- `vincularRutaEvangelistica(interno, congregacionDestinoId)` --
  firma nueva, misma lógica interna.
- Pestaña Reinserción: único ajuste, pasa `interno` (ya estaba
  resuelto en el `.find()` existente) y `item.congregacion_destino_id`
  explícitamente en las dos llamadas existentes.
- Pestaña Internos: nueva badge "Vinculado a la Ruta" (usa el mismo
  Set `internosVinculados`, indexado por `interno.id`, que ya
  funcionaba para ambas pestañas) y nuevo botón "Vincular a la Ruta"
  dentro del bloque de acciones que ya existía (`canEdit && item.estado
  === "activo"`), con el mismo patrón de selector inline de
  responsable + confirmar que ya usaba Reinserción.

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`:

1. Interno activo, aún preso, no bautizado → se creó el `amigo`
   enlazado y quedó en BIS con responsable, sin ninguna fila en
   `obra_carcelaria_reinsercion` de por medio.
2. La consulta `internosVinculados` lo detecta igual que si viniera de
   Reinserción.
3. Interno activo, aún preso, ya bautizado → `amigo` listo para
   Feligresía, sin fila en `ruta_procesos`.
4. Limpieza completa, sin residuos.

`npm run build` sin errores.

## Pendiente

Queda un único ítem del plan de cierre: botón "Reasignar comité"
independiente del traslado.
