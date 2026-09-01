# Bug crítico: Población no mostraba a nadie

Fecha: 31 de agosto de 2026

## Reporte del usuario

"No entiendo por qué en Población no aparecen registros, si ya se crearon
unos de prueba." Se verificó primero contra la base de datos real: existían
5 personas activas para la congregación de prueba, confirmando que el
problema no era de datos.

## Causa raíz

En `src/pages/FeligresiaAdmin.jsx`, el filtro de estado de la pestaña
Población usaba una variable `status`/`setStatus` que **nunca se declaró**
en el componente (existe un `statusFilter`/`setStatusFilter` correctamente
declarado, pero es una variable distinta que pertenece a otra sección de la
pantalla — "Evolución"). En el navegador, una variable no declarada dentro
de una función que coincide con una propiedad global existente (`window.status`,
una propiedad heredada y obsoleta que siempre vale `""`) no lanza un error:
simplemente se resuelve silenciosamente a esa propiedad global. Por eso no
se veía ningún error en consola.

El efecto: la consulta a `personas` siempre aplicaba
`.eq('estado_membresia', '')`, que no coincide con ningún valor real
(`activo`, `apartado`, etc.), así que la lista, el conteo y la exportación
CSV de Población **siempre devolvían cero filas**, sin importar cuántas
personas reales existieran. Los contadores de arriba (Personas activas,
Bautizados...) sí funcionaban porque se calculan con una consulta distinta,
sin este filtro roto — por eso el conteo mostraba 5 pero la lista mostraba 0.

Se encontró tambien un bloque de código duplicado y huérfano (una copia
pegada por error de la lógica de filtrado de otra sección, `FeligresiaInsights`)
dentro del componente principal, que referenciaba variables (`today`,
`statusFilter`, `ageFilter`) tampoco declaradas ahí. Ese bloque nunca llegó a
lanzar error porque, al estar `people` siempre vacío por el bug de arriba,
el `.filter()` nunca llegaba a ejecutar su función — un segundo bug real,
enmascarado por el primero.

## Alcance del bug

Afectaba tres cosas en la pestaña Población, todas con el mismo origen:

- La lista paginada de personas (siempre vacía).
- El contador "N personas encontradas" (siempre 0).
- La exportación CSV del censo (siempre exportaba un archivo vacío).

## Corrección aplicada

- Se declaró correctamente `const [personStatus, setPersonStatus] = useState('todos')`,
  específico para el filtro de la lista de Población (independiente del
  `statusFilter` que ya usa la sección de Evolución, que es un filtro
  distinto y no debía mezclarse con este).
- Se reemplazaron las 6 referencias rotas (consulta principal, dos efectos,
  exportación CSV, cálculo de la lista visible y el `<select>` del filtro).
- Se eliminó el bloque de código duplicado y huérfano.

## Validación ejecutada

- `npm run build`: correcto.
- Verificación visual con Playwright y la cuenta de producción real: la
  lista pasó de mostrar "No hay personas con estos filtros" a mostrar las 5
  personas reales; se probó cambiar el filtro a "Apartado" y mostró
  correctamente 0 resultados (coincidiendo con la tarjeta "Apartados: 0"),
  sin ningún error en consola.

## Archivos modificados

- `src/pages/FeligresiaAdmin.jsx`
- `docs/bug-critico-poblacion-2026-08-31.md`
