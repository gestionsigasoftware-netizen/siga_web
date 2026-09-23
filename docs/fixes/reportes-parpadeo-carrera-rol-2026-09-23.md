# Reportes: parpadeo al cargar (condición de carrera con el rol activo) -- 2026-09-23

## Reporte original del usuario

Dos capturas casi idénticas de `/reportes`: por un instante al cargar
la pantalla aparecen 2 barras (ambas rotuladas "Ujieres", una azul y
una naranja) y cifras más altas (13 actividades, 2079 asistentes), y
un segundo después la pantalla se asienta en 1 sola barra azul y
cifras menores (12 actividades, 1887 asistentes) -- ambas capturas con
la misma vista activa (Congregación Puerto Tejada). También preguntó
si los botones "30 días/90 días/Todo" debían cambiar algo, porque no
veía diferencia entre ellos.

## Diagnóstico

**Los filtros de período están bien, no es un bug**: se verificó
contra producción real que Puerto Tejada solo tiene 12 registros de
actividad en toda su historia, y el más antiguo es del 25 de agosto de
2026 (29 días antes de la fecha de la captura) -- es decir, **todo** su
historial ya cabe dentro de los últimos 30 días. "90 días" y "Todo"
correctamente muestran lo mismo porque no existe ningún dato más
antiguo que incluir. Se espera que este comportamiento cambie por sí
solo a medida que se acumule más historial.

**El parpadeo sí era un bug real**, y resultó ser otra instancia del
mismo problema de fondo encontrado varias veces hoy (ver los demás
`docs/fixes/*multi-rol*2026-09-23.md`), pero con una variante nueva:
no era falta de filtro, sino una **condición de carrera** al montar la
pantalla.

`src/pages/ReportesOptimizado.jsx` no esperaba a que `useMiRol()`
terminara de resolver `rolPrincipal` antes de disparar la primera
carga:

```js
const { rolPrincipal } = useMiRol()
const congregacionId = rolPrincipal?.congregacion_id
...
useEffect(() => { load() }, [load])
```

En el primer render (antes de que los roles terminen de cargar),
`rolPrincipal` es `null`, así que `congregacionId` es `undefined`, y
`load()` se ejecuta igual, mandando `p_congregacion_id: null` al RPC
`resumen_reportes`. Para una cuenta con más de un rol (ej. super_admin
que también es pastor local de Puerto Tejada), ese `null` deja pasar
la RLS de `mis_congregaciones()` sin acotar nada -- el resultado de esa
primera llamada es el **país entero agregado**, no solo Puerto Tejada.
Como cada congregación tiene su propio módulo "Ujieres" (mismo nombre,
`modulo_id` distinto porque `modulos` es una tabla por congregación),
el gráfico de barras -- que agrupa por `modulo_id`, no por nombre --
mostraba una barra por cada congregación con su propio módulo
"Ujieres", ambas rotuladas igual. Una fracción de segundo después,
`rolPrincipal` termina de resolver, `congregacionId` pasa a tener el
valor real, `load` se vuelve a crear (está en sus dependencias) y la
llamada correctamente acotada reemplaza los datos -- de ahí el
"parpadeo con datos más grandes, luego se asienta en algo menor".

## Corrección

`src/pages/ReportesOptimizado.jsx`: el efecto que dispara `load()`
ahora espera a que `rolPrincipal` esté resuelto:

```js
useEffect(() => { if (rolPrincipal) load() }, [load, rolPrincipal])
```

Con esto, la primera carga real ya sale con el `congregacionId`
correcto -- no hay una llamada intermedia sin acotar que parpadee en
pantalla.

## Por qué no se detectó antes

El fix de hoy en este mismo archivo (ver
`docs/fixes/reportes-dropdown-congregaciones-multi-rol-2026-09-23.md`)
corrigió el selector de congregaciones, que SÍ tenía el patrón clásico
(sin filtro en absoluto). Esta condición de carrera es un problema
distinto -- el filtro existía, pero se aplicaba un instante tarde -- y
solo se hace visible con una cuenta multi-rol viendo la pantalla en
persona, exactamente como la reportó el usuario. La auditoría
sistemática de hoy revisó "¿filtra explícito?" en cada pantalla, no
"¿puede la primera renderización disparar la consulta antes de que el
filtro esté listo?" -- las demás pantallas revisadas hoy evitan este
problema porque, en su mayoría, hacen `if (!congregacionId) return`
(no cargan nada hasta tener el dato), algo que `ReportesOptimizado.jsx`
no podía hacer porque también debe funcionar para nacional/super_admin
(que nunca tienen `congregacion_id`).

## Verificación

- `npm run build` sin errores.
- Confirmado con datos reales que el comportamiento de "90 días/Todo"
  es correcto (no hay historial más antiguo para Puerto Tejada).
- No se pudo reproducir el parpadeo en sí con la cuenta de prueba
  (`pueba691@gmail.com` es de un solo rol, así que nunca lo sufre) --
  la corrección se basa en lectura de código y en el mismo mecanismo
  ya confirmado hoy en otros módulos. El usuario puede confirmar
  recargando `/reportes` una vez desplegado.
