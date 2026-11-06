# Vulnerabilidad crítica en dependencias + exploración de ofuscación — 2026-11-06

## Contexto

Surgió de una pregunta del usuario sobre protección del código fuente
("¿alguien puede descompilar el frontend para construir algo como
SIGAP?"). Se le explicó con honestidad: el código del navegador nunca
es 100% secreto en ninguna app web — la protección real ya es del
servidor (RLS, funciones `security definer`, Edge Functions, nada de
eso se envía al navegador). El usuario pidió explorar ofuscación
igual, como capa adicional.

## Vulnerabilidad real encontrada (y corregida)

`npm audit` reveló una vulnerabilidad **crítica**: XSS en `dompurify`
(dependencia transitiva de `jspdf`, usado para generar certificados y
reportes en PDF), más 3 vulnerabilidades altas (`vite`, `zod`,
`source-map-js`/`brace-expansion`).

**Investigación del alcance real antes de alarmar**: se confirmó que
SIGAP nunca llama a `jsPDF.html()` (el único método que invoca la
parte vulnerable de `dompurify`) — los certificados (bautismo,
defunción) usan `html2canvas` + `jsPDF` para fidelidad visual, un
camino completamente distinto (ver
`docs/fixes/certificado-bautismo-2026-09-09.md`). Riesgo real de
explotación hoy: bajo.

**Corrección aplicada igual**: `npm audit fix` (sin forzar cambios
mayores, cero cambios de comportamiento) — resolvió la crítica de
`dompurify` y las 3 altas. Quedan 4 vulnerabilidades **moderadas**
sin resolver a propósito (`react-router`/`react-router-dom` exigen
subir de v6 a v7, `exceljs`/`uuid` exigen una versión mayor) porque el
único fix disponible es un cambio mayor con riesgo real de romper
rutas o la exportación a Excel — no se toca sin plan y verificación
aparte.

Commit `8b44704`, pusheado.

## Ofuscación del JavaScript: probada, medida, revertida

1. Primer intento: `vite-plugin-javascript-obfuscator` enganchado al
   pipeline de Vite — falló en silencio, solo procesó 1 de 70+
   módulos (`src/main.jsx`) por cómo Vite transforma JSX antes de que
   el hook del plugin viera el código.
2. Segundo intento, funcionó de verdad: correr `javascript-obfuscator`
   como paso aparte DESPUÉS de `vite build`, directo sobre
   `dist/assets/*.js` ya compilado. 93 de 103 archivos propios
   procesados; las 10 librerías externas (react, supabase-js, Chart.js,
   Leaflet, html2canvas, ExcelJS, jsPDF) excluidas a propósito —ya son
   código abierto público, ofuscarlas no protege nada.
3. **Costo real medido antes de decidir** (no una suposición): el
   chunk principal que descarga cualquier visitante, sin importar a
   qué pantalla entre, pasó de 319 KB a 489 KB comprimidos (+53%) —
   el código con los strings codificados comprime mucho peor que el
   minificado normal.
4. **Decisión del usuario con el número real en la mano**: no vale el
   costo, dado que la app se usa también desde celulares/tablets con
   conexiones no siempre rápidas, y dado que la protección real ya es
   del servidor. Se revirtió por completo: `vite.config.js` y
   `package.json` quedaron exactamente iguales al estado original
   (confirmado con `git diff` vacío en ambos), sin ningún rastro en
   el repositorio.

## Si se retoma la ofuscación en el futuro

No repetir el experimento desde cero — el costo del método completo
(con `stringArray` activado) ya está medido: +53% en el chunk
principal. La opción intermedia que no se probó es ofuscar solo los
nombres de variables/funciones (`identifierNamesGenerator:
'hexadecimal'`, `stringArray: false`), con costo casi nulo en tamaño
pero protección bastante menor (los strings literales -- nombres de
tablas, columnas, mensajes -- quedarían visibles igual). Esa es la
pregunta real pendiente si se quiere reconsiderar.
