# Conquistadores administra convertidos y no convertidos (2026-09-11)

## Contexto: los dos tipos de comité de la IPUC

El usuario explicó el modelo real de comités de la congregación:

1. **Comités que administran población** (Escuela Dominical, Jóvenes/
   Conquistadores, Damas Dorcas, Caballeros, DEFAM/Red de Familias): dan
   seguimiento a feligreses convertidos Y a personas no convertidas de
   esa misma franja de edad/género -- los que están en la Ruta
   Evangelística, los que apenas van a iniciar, o los que están en pura
   prospección (sin ninguna relación con la iglesia todavía). Doble
   carga de trabajo, a propósito.
2. **Comités de servicio local** (Ujieres, Música, Educación Artística,
   Educación Teológica): solo administran servidores que YA son
   feligreses -- un no convertido no puede participar ahí.

También confirmó una regla ya construida: los cargos de comité pueden
exigir estar sellado con el Espíritu Santo o solo bautizado, y **es
decisión del pastor local de cada congregación**, no una regla fija
del sistema (`cargos_comite.requiere_sellado`, configurable por cargo).

## El hueco real encontrado

Revisando el esquema, **Conquistadores Pentecostales** (jóvenes adultos
18-40) estaba construido como comité de servicio (`persona_id not
null` -- exigía que ya fuera un feligrés bautizado), cuando por ser uno
de los ejes nacionales de la IPUC debería administrar población, igual
que Misión Juvenil, Escuela Dominical, Damas Dorcas y Obra Carcelaria
(que sí ya soportan personas no convertidas, cada uno con su propio
censo independiente y un enlace opcional a `personas`).

Música, Educación Artística y Educación Teológica sí están bien como
están -- son comités de servicio, correctamente exigen persona ya
bautizada. No se tocaron.

## Corregido

`supabase/modulos/fix_conquistadores_no_convertidos.sql`:
- `conquistadores_miembros` gana censo propio (`nombres`, `apellidos`,
  `telefono`) y sus propios `bautizado`/`fecha_bautismo`/`sellado`/
  `fecha_sellado` -- mismo patrón que `mision_estudiantes`.
- Los miembros que ya existen (todos tenían `persona_id`, era
  obligatorio) se rellenan automáticamente desde `personas` antes de
  que `nombres`/`apellidos` pasen a ser obligatorios.
- `persona_id` pasa a ser opcional -- se completa solo si en algún
  momento se decide vincular manualmente, igual que en los demás
  módulos de este tipo.
- `amigos.conquistadores_miembro_id` nuevo, mismo patrón que
  `mision_juvenil_estudiante_id`/`obra_carcelaria_interno_id`.

`src/pages/Conquistadores.jsx`:
- El formulario "Nuevo miembro" ya no pide elegir una persona del
  censo -- se captura el nombre directamente, exactamente como Misión
  Juvenil. No hace falta que la persona esté convertida para entrar.
- Columna "Hitos" en la tabla de miembros: marcar Bautizado/Sellado
  (independientes entre sí, igual que en el resto de la app).
- Columna "Ruta" con el mismo botón **Vincular** que ya tienen Misión
  Juvenil y Obra Carcelaria: conecta al miembro con el seguimiento
  individual real (`amigos` + Ruta Evangelística) -- si no está
  bautizado, entra a BIS con un responsable; si ya está bautizado,
  queda listo para incorporar a Feligresía desde Amigos.

## Importante -- orden de despliegue

Este cambio **rompe la pantalla de Conquistadores hasta que se ejecute
el SQL**: el frontend ya consulta columnas nuevas
(`nombres`/`apellidos`/`bautizado`/`sellado`) que no van a existir en
la base real hasta correr el archivo. A diferencia de otros fixes de
esta sesión, aquí no se puede desplegar el código primero y el SQL
después con calma -- hay que correr
`supabase/modulos/fix_conquistadores_no_convertidos.sql` cuanto antes
tras el deploy.

## Verificación

`npm run build` sin errores. No se pudo probar contra la base real
porque requiere que el usuario ejecute la migración primero (ninguna
sesión de este proyecto ejecuta SQL directo contra producción).
Pendiente que el usuario confirme tras correr el script.
