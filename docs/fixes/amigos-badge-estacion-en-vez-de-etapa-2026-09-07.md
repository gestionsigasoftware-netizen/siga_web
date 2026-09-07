# Fix: la tarjeta de "Amigos en ruta" mostraba la Etapa vieja, no la Estación real — 2026-09-07

## El reporte del usuario

Revisando "Amigos en ruta", el usuario notó estados como contactado,
visitado, asistió, en seguimiento, convertido -- y que varios amigos
aparecían "sin etapa". Preguntó si eso era redundante con la Ruta
Evangelística (en la que se trabajó toda la sesión anterior) y pidió
priorizar que no fuera confuso para el usuario final.

## Diagnóstico

Confirmado: había **dos sistemas paralelos y desconectados** para el
mismo concepto (el progreso de un amigo):

1. **Etapa** (`etapas_seguimiento`: Contactado → Visitado → Asistido →
   En seguimiento → Convertido) -- el sistema original de la app, de
   antes de que existiera la Ruta Evangelística. Es opcional (por eso
   el "sin etapa"), configurable por congregación desde
   Configuración, y se guarda en `amigos.etapa_id`.
2. **Estación de la Ruta Evangelística** (Uno Más → BIS → REFAM →
   ESFOB → Discipulado, vía `ruta_procesos`/`ruta_estaciones`) -- el
   sistema realmente operativo, con traslados, lecciones, notas,
   gráficos y tasa de éxito.

El problema concreto: la **tarjeta de cada amigo en la lista mostraba
la Etapa** (`friend.etapas_seguimiento?.nombre`), mientras que la
Estación real solo aparecía si se entraba al detalle de esa persona
(`routeProcess`, cargado solo al seleccionar un amigo). Lo más visible
era el sistema menos usado y a veces vacío; lo más completo estaba
escondido un clic más adentro. Se verificó además que
`Dashboard.jsx` trae `etapa_id`/`etapas_seguimiento` en una consulta
pero nunca los renderiza -- dato muerto ahí.

No se pudo verificar si la PWA (`siga-pwa-nacional`, repo no
disponible en este entorno) sigue usando Etapa al capturar un amigo en
campo -- por eso, y porque el usuario lo confirmó, se optó por el
cambio de menor riesgo: no se tocó la base de datos, el catálogo de
Configuración ni el campo en el formulario de alta/edición.

## Arreglo

Solo en `src/pages/Amigos.jsx`, en la tarjeta de la lista:

- Se agregó una consulta por lote en `load()` (una sola consulta para
  todos los amigos de la página actual, no una por tarjeta) a
  `ruta_procesos` con su estación, filtrando `estado in
  ('activo','pausado')`, guardada en `rutaActivaPorAmigo` (mapa
  `amigo_id -> estacion`).
- El badge de la tarjeta ahora muestra la Estación real (`Uno Más`,
  `BIS`, `REFAM`, `ESFOB / EFOB`, `Discipulado`) en vez de la Etapa,
  con "Convertido" cuando `amigo.convertido` (igual que antes) y "Sin
  ruta iniciada" cuando no hay ninguna estación activa -- reemplaza al
  antiguo "Sin etapa".
- `TONO_ETAPA` (colores por `orden` de etapa) se reemplazó por
  `TONO_ESTACION` (colores por `codigo` de estación).

Nada más cambió: el filtro por Etapa, el campo "Etapa inicial" del
formulario de alta, la ficha de edición, el catálogo en Configuración
y el historial de cambios de etapa siguen intactos, por si la PWA u
otro flujo todavía dependen de Etapa.

## Verificación

Contra la base de datos real: se confirmó que la consulta por lote
(`ruta_procesos` con join a `ruta_estaciones`, filtrada por los ids de
la página actual) devuelve correctamente la estación activa de cada
amigo -- por ejemplo, el amigo de prueba "Manuel Antonio García
Rodríguez" mostró `discipulado` antes de convertirse (ahora aparecería
como "Convertido", al ser ya bautizado). `npm run build` sin errores.

## Nota para el usuario

Si en algún momento confirmas que la PWA ya no usa "Etapa" para
capturar amigos en campo, se puede simplificar más -- quitar el campo
del formulario, el filtro y el catálogo en Configuración. Por ahora
queda intacto, solo dejó de ser lo primero que se ve.
