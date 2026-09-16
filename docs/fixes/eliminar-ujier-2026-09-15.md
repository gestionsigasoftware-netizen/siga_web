# Botón para eliminar un ujier — 2026-09-15

## Contexto

El usuario confirmó lo que sospechaba: el botón de encendido/apagado
junto a cada ujier sí es "Desactivar" (correcto), pero no había forma
de eliminar de verdad un ujier -- solo editar el nombre o
desactivarlo. Esto era un problema real al corregir errores de tipeo
o duplicados al pegar una lista (ver
`pegar-lista-ujieres-separador-2026-09-15.md`, misma sesión).

## Construido

`src/pages/Modulos.jsx`, sección Ujieres: nuevo botón de papelera
(`Trash2`) junto a Editar/Desactivar. Reutiliza el mismo patrón ya
usado en `Configuracion.jsx` para categorías demográficas, etapas de
seguimiento y tipos de comité: `useUndoDelete` + `UndoToast` -- borra
de inmediato (no un `window.confirm()` que no protege de nada una vez
aceptado) y muestra un aviso "Eliminado: [nombre] · Deshacer" por 8
segundos, que vuelve a insertar la fila exacta si se hace clic.

**Nota dejada en el código para quien mantenga esto después**:
`registros_actividad.ujier_responsable_id` referencia
`ujieres_congregacion(id) on delete set null` -- si un ujier ya tomó
asistencia antes y se elimina, esos registros de asistencia NO se
borran, solo dejan de decir quién fue el responsable (queda en null).
Es el mismo comportamiento ya aceptado en el resto de catálogos de
esta pantalla, no una protección especial nueva.

El texto del botón deja claro cuándo usar cada uno: "Eliminar (usa
esto para corregir un error al escribirlo, no para alguien que ya no
presta el servicio -- para eso, desactívalo)".

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real: creado un ujier de prueba, eliminado
  con el botón nuevo (confirmado que desaparece de la lista), aviso
  "Deshacer" visible, clic en "Deshacer" restaura el mismo registro.
  Segunda prueba: eliminado sin deshacer, confirmado que no reaparece.
  Ambos registros de prueba limpiados de la base real al terminar,
  cero residuo.
- Cero errores de consola.
