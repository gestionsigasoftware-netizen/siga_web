# Descarga en PDF del informe trimestral — 2026-09-10

## Contexto

Al construir el informe trimestral (Local → Distrital → Nacional) no
se agregó ninguna forma de descargarlo -- solo se veía en pantalla. El
usuario lo notó y pidió que cada nivel pudiera descargarlo, ya que el
objetivo original era justamente reemplazar el reporte manual.

## Construido

Botón "Descargar PDF" agregado en los 3 niveles, reutilizando
`descargarPdf()` de `src/lib/reportExport.js` (el mismo generador
compartido, con membrete IPUC, que se corrigió esta semana para tablas
de muchas columnas):

- **Local** (`FeligresiaAdmin.jsx`, `InformeTrimestralLocal`): un PDF
  de una página con las 4 tarjetas KPI (Bautizados, Sellados,
  Reconciliados, Entregados) más una tabla de detalle con columnas
  "Antes de este trimestre / Nuevos este trimestre / Total actual"
  por indicador, y el desglose "Entregados hoy por estación" como
  línea de meta.
- **Distrital** (`PastoralDistrital.jsx`): tabla en orientación
  horizontal con una fila por congregación (respeta el orden actual
  del selector "Ordenar por"), más tarjetas KPI con la suma de todo el
  distrito. Se extrajo el cálculo de filas ordenadas a un `useMemo`
  (`filasInformeOrdenadas`) para que la tabla en pantalla y la
  exportación usen exactamente los mismos datos, sin duplicar el
  `sort()`.
- **Nacional** (`GestionPastoralNacional.jsx`): mismo patrón, una fila
  por distrito, con el total país como KPIs.

## Verificación

`npm run build` sin errores. Verificado con Playwright contra la app
real (nivel local, único con cuenta de prueba disponible en esta
sesión): se descargó el PDF real generado por el botón, y se
renderizaron sus 2 páginas a imagen (misma técnica de `pdfjs-dist`
temporal usada para verificar el fix de columnas del PDF) para
inspeccionarlas -- membrete correcto, KPIs correctos, tabla de detalle
ordenada y legible. Los niveles distrital y nacional no se pudieron
probar con clics reales (mismo motivo que el resto del informe
trimestral: no hay cuenta de prueba de esos roles), pero reutilizan la
misma función `descargarPdf()` ya verificada y siguen el mismo patrón
de construcción de `headers`/`rows` que el nivel local.
