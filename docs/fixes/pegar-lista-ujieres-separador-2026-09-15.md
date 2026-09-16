# "Pegar una lista" de ujieres — separador confuso — 2026-09-15

## Contexto

El usuario (pastor de Agua Bonita Suárez Cauca) pegó una lista de
ujieres separados por punto y coma en el campo "Agregar varios a la
vez" del módulo Ujieres (Módulos y actividades), y todos quedaron
guardados como UN SOLO nombre gigante en vez de separarse. Preguntó
qué separador debía usar: ¿coma o punto y coma?

## Causa real

`src/pages/Modulos.jsx` -- `agregarUjieresEnBloque()` solo dividía el
texto por salto de línea (`bulkUjieres.split('\n')`). El placeholder
sí decía "un nombre por línea", pero:
1. Era solo un placeholder -- desaparece apenas se empieza a escribir,
   así que no queda visible como recordatorio.
2. No aceptaba ningún separador dentro de una misma línea, así que
   cualquiera que pegara una lista con punto y coma o coma (un formato
   muy común al copiar de WhatsApp o Excel) terminaba con todo pegado
   en una sola entrada -- exactamente lo que le pasó al usuario.

## Corregido

- El separador ahora acepta **salto de línea O punto y coma**
  (`bulkUjieres.split(/[\n;]+/)`), así que las dos formas de pegar una
  lista funcionan.
- **Deliberadamente no se agregó la coma como separador**: un nombre
  real puede venir escrito "Apellido, Nombre" (formato común al
  exportar de Excel) -- si se dividiera por coma, ese nombre se
  partiría en dos entradas rotas. Punto y coma es seguro porque nunca
  aparece dentro de un nombre.
- El texto de ayuda ahora es un párrafo fijo arriba del textarea (no
  solo un placeholder que desaparece), con el ejemplo explícito:
  "Juan Pérez; Pepito Pérez" -- deja claro que cada línea/entrada es el
  nombre COMPLETO (nombre y apellido juntos, sin coma entre ellos),
  porque `ujieres_congregacion.nombre` es un solo campo de texto, no
  nombre y apellido separados.

## Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real: pegado
  "PRUEBA_A Uno; PRUEBA_B Dos; PRUEBA_C Tres" en una sola línea →
  quedaron 3 ujieres separados correctamente, no uno solo. Los 3
  registros de prueba se eliminaron de la base real al terminar, cero
  residuo.
- Cero errores de consola.
