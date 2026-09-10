# PDF exportado con muchas columnas se veía amontonado — 2026-09-10

## Contexto

El usuario reportó que el PDF descargado desde Feligresía "se ve
horrible, no está acomodado, no se entiende para nada".

## Hallazgo

El censo de feligresía exporta **15 columnas** (Nombres, Apellidos,
Teléfono, Fecha nacimiento, Género, Estado civil, Estado, Bautizado,
Fecha bautismo, Sellado con el Espíritu Santo, Fecha sellado, Fecha
ingreso, Última asistencia, Familia, Parentesco). El generador
compartido `descargarPdf()` (`src/lib/reportExport.js`, usado también
por Reportes, Auditoría, etc.) usaba un tamaño de letra y relleno fijo
(9pt, 4mm de relleno) sin importar cuántas columnas hubiera -- pensado
para tablas de pocas columnas. Con 15 columnas y encabezados largos
("Sellado con el Espíritu Santo") en una página carta horizontal, el
resultado se veía amontonado e ilegible.

## Construido

`descargarPdf()` ahora reduce progresivamente el tamaño de letra, el
relleno de celda y el margen lateral según el número de columnas de la
tabla (9pt/4mm hasta 6 columnas -- sin cambios --, hasta 6pt/1.5mm con
más de 14), y activa explícitamente el ajuste de línea
(`overflow: 'linebreak'`) para que los encabezados largos se acomoden
en varias líneas en vez de desbordar. Es un cambio en la función
compartida, así que beneficia a cualquier pantalla que exporte tablas
anchas a PDF, no solo al censo de feligresía.

## Verificación

`npm run build` sin errores. Se probó de extremo a extremo con
Playwright contra la app real (`localhost:5173`, cuenta de prueba): se
inició sesión, se exportó el censo real de Puerto Tejada Cauca
Central a PDF, y se renderizó cada página del PDF resultante a imagen
(usando `pdfjs-dist` cargado temporalmente en el navegador de la
prueba -- no quedó ninguna dependencia nueva instalada) para
inspeccionarlas visualmente. La tabla de 15 columnas quedó ordenada,
con los encabezados largos en dos líneas, sin texto encimado ni
cortado.
