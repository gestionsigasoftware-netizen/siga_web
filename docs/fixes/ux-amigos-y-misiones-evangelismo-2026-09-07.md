# UX: Amigos en ruta y Misiones y Evangelismo — 2026-09-07

## La pregunta del usuario

Tras el fix del badge de Etapa/Estación, el usuario pidió una
revisión de UX más amplia de "Amigos en ruta" y "Misiones y
Evangelismo", incluyendo si el módulo debería llamarse "Amigos en
ruta" o solo "Amigos". Pedido explícito: "que recomiendes, haz lo que
recomiendes".

## Sobre el nombre

Se recomendó **mantener "Amigos en ruta"** -- desde el fix de ayer el
nombre ya es preciso (la tarjeta muestra la estación real de la Ruta
Evangelística). El problema real no era el nombre sino que la
navegación no reflejaba que es parte de Misiones y Evangelismo
(aparecían como módulos hermanos en el Sidebar, y la pantalla de
Misiones y Evangelismo no lo enlazaba directamente). Eso es lo que se
corrigió, en vez de renombrar.

## Cambios aplicados

**`src/pages/Amigos.jsx`**:

- El KPI "Etapas configuradas" (contaba cuántas etapas *existen en el
  catálogo* -- un dato de configuración, no operativo) se reemplazó
  por **"Sin ruta iniciada"**: cuántos amigos sin bautizar todavía no
  tienen una fila activa/pausada en `ruta_procesos`. Es accionable --
  le dice al pastor a quién falta arrancar en alguna estación.
  Calculado sobre el listado completo de la congregación (no solo la
  página visible), cruzando `amigos` con `ruta_procesos` congregación
  por congregación.
- El campo "Etapa inicial" del formulario de alta se movió al final
  (justo antes del botón "Guardar amigo"), para bajarle prioridad
  visual frente a los campos que sí importan hoy (zona, metodología).
- Se quitó el `InfoTip` que explicaba la diferencia entre "etapa" y
  "estación" -- estaba parchando una confusión que el fix del badge ya
  resolvió de raíz.

**`src/pages/MisionesEvangelismo.jsx`**:

- Se agregó una tarjeta destacada "Amigos en ruta" (listado maestro)
  enlazando a `/amigos`, **separada** de la grilla de las 6 estaciones
  -- a propósito no se mezcló como una estación más, porque no lo es
  (es donde se administra a cada persona, no un paso de la ruta), y
  mezclarla habría contradicho el indicador "6 estaciones · una ruta"
  que ya tiene la cabecera.

## Verificación

`npm run build` sin errores. Se verificó contra la base de datos real
que el cálculo de "Sin ruta iniciada" es correcto: de 2 amigos sin
bautizar en la congregación de prueba, ninguno tenía fila activa en
`ruta_procesos`, por lo que el contador mostró 2 (el único registro
con ruta "activa" en esa congregación pertenece a un amigo ya
convertido -- un residuo histórico ya documentado en un fix anterior,
correctamente excluido del conteo por estar `convertido`).

## Lo que no se tocó (y por qué)

- El catálogo de Etapa en Configuración, el filtro por etapa, y la
  columna `amigos.etapa_id` siguen intactos -- no se pudo confirmar si
  la PWA (repo no disponible en este entorno) todavía depende de
  Etapa para capturar amigos en campo.
- La inconsistencia menor entre el eyebrow "Ruta Evangelística" y el
  título "Misiones y Evangelismo" en la misma cabecera se identificó
  pero se dejó como está -- es un matiz de bajo impacto comparado con
  los dos cambios anteriores, y tocarlo no aportaba una mejora clara
  frente al riesgo de reescribir texto ya usado como término técnico
  en el resto de la documentación.
