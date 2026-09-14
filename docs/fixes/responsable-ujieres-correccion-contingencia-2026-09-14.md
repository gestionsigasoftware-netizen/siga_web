# Responsable de Ujieres en Corrección/contingencia — 2026-09-14

## Contexto

El usuario reportó, probando en producción: en la pantalla web
"Corrección / contingencia de asistencia" (`RegistrarAsistencia.jsx`,
la pantalla de respaldo cuando la PWA no está disponible), al elegir
el módulo **Ujieres**, el campo "Responsable" mostraba todo el censo
de Feligresía en vez de la lista fija de ujieres que cada congregación
administra de forma autónoma en "Módulos y actividades" -- la misma
lista que sí usa la PWA para ese mismo módulo.

## Diagnóstico

Confirmado en código y esquema real:

- `ujieres_congregacion` (creada en `supabase/modulos/ujieres_congregacion.sql`,
  2026-09-04) es un catálogo propio por congregación, independiente
  del censo (`nombre` en texto plano, sin `persona_id`) -- "no depende
  de qué cuenta esté usando el celular".
- Esa misma migración agregó
  `registros_actividad.ujier_responsable_id` (FK a
  `ujieres_congregacion`), justamente para que la asistencia de
  Ujieres capturada desde la PWA guarde ahí el responsable.
- `RegistrarAsistencia.jsx` nunca se actualizó tras ese cambio:
  seguía usando la columna vieja `responsable_persona_id` (FK a
  `personas`) y cargando el "Responsable" siempre desde el censo
  completo (`personas` con `estado_membresia = 'activo'`), sin
  importar el módulo elegido.

## Corregido

`src/pages/RegistrarAsistencia.jsx`:
- Nuevo estado `ujieresCongregacion`, cargado junto con el resto de
  datos iniciales (`ujieres_congregacion` activos de la congregación).
- `esModuloUjieres` -- se calcula comparando el `nombre_modulo` del
  módulo seleccionado contra `'ujieres'` (mismo patrón ya usado por
  `esModuloSistema` en `Modulos.jsx` para identificar módulos por
  nombre).
- El `<select>` de "Responsable" ahora muestra la lista fija de
  ujieres cuando el módulo elegido es Ujieres, y el censo para
  cualquier otro módulo (igual que antes).
- Al cambiar de módulo se limpia el responsable elegido (para no
  arrastrar un id de una lista distinta a la otra).
- Al guardar, escribe en `ujier_responsable_id` (Ujieres) o
  `responsable_persona_id` (cualquier otro módulo), nunca ambos.
- La tabla "Registros recientes" y su consulta también se
  actualizaron para mostrar el nombre correcto sin importar en cuál
  de las dos columnas quedó guardado el responsable.

## Verificación

Contra la base real (Puerto Tejada Cauca Central,
`pueba691@gmail.com`):
1. Con el módulo **Evangelismo** seleccionado, "Responsable" muestra
   el censo (9 personas reales de la congregación).
2. Con el módulo **Ujieres** seleccionado, "Responsable" cambia a la
   lista fija de `ujieres_congregacion` (42 nombres, orden
   alfabético) -- confirmado que es una lista completamente distinta
   a la del censo, no una coincidencia.
3. Guardado real de una corrección para Ujieres: se confirmó por
   consulta directa a la base que el registro quedó con
   `ujier_responsable_id` apuntando al ujier elegido y
   `responsable_persona_id` en `null`. Registro de prueba eliminado
   después, sin residuo.
4. `npm run build` sin errores.

## Pendiente

Ninguna acción de base de datos -- la columna `ujier_responsable_id`
ya existía desde el 2026-09-04. Solo frontend, ya desplegado.
