# "Pegar una lista" para Categorías demográficas — 2026-09-15

## Contexto

El usuario preguntó cómo configurar "Categorías demográficas" (tras
ver el aviso "No hay categorías demográficas configuradas para
capturar asistencia" en Corrección/contingencia), y al confirmar que
solo se podía agregar una por una, preguntó si también había modo
lista (como ya tiene Ujieres). Pidió agregarlo solo para Categorías
demográficas, no para Etapas de seguimiento ni Tipos de comité (que
usan el mismo componente compartido).

## Construido

`src/pages/Configuracion.jsx`:

- `ListaCatalogo` (componente compartido por las 3 tarjetas) ahora
  acepta una prop opcional `onAddBulk`. Si no se pasa, la tarjeta se
  ve exactamente igual que antes (Etapas de seguimiento y Tipos de
  comité no cambiaron). Si se pasa, aparece el mismo bloque
  desplegable "Agregar varias a la vez (pegar una lista)" que ya tiene
  Ujieres en Módulos y actividades.
- Nueva función `agregarCategoriasEnBloque()`: mismo separador que el
  de Ujieres -- salto de línea o punto y coma, nunca coma (para no
  partir un nombre real como "Adultos, mayores").
- Solo la tarjeta "Categorías demográficas" recibe `onAddBulk`.

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real: pegado
  "PRUEBA_CAT Uno; PRUEBA_CAT Dos; PRUEBA_CAT Tres" en una sola línea
  → 3 categorías separadas correctamente (mismo comportamiento que
  Ujieres). Eliminadas de la base real al terminar, cero residuo.
- Cero errores de consola.
