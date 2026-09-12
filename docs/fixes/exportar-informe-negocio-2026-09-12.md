# Exportar informe de negocio (super_admin) — 2026-09-12

## Contexto

El usuario preguntó: hoy super_admin no tiene forma de descargar un
informe para tomar decisiones de negocio (ej. para pasárselo al CEO,
que es él mismo). ¿De dónde se descarga?

## Diagnóstico

La app ya tenía una librería compartida de exportación
(`src/lib/reportExport.js`, CSV/Excel/PDF con membrete) usada en 19+
pantallas -- pero **hardcodeada con la marca de la IPUC** (logo,
nombre completo, lema religioso, azul institucional). Un informe de
negocio para el CEO de SIGAP no debería llevar el logo/nombre
eclesiástico de la IPUC -- la IPUC es el cliente, no la empresa. Mismo
principio que `feedback_super_admin_vs_nacional` en memoria de
proyecto.

## Construido

### 1. `src/lib/reportExport.js` -- soporte multi-marca (sin romper nada existente)

- Nueva marca `SIGAP_BRAND` (nombre "Sistema Integrado de Gestión y
  Analítica Pastoral", lema "Panel de negocio (uso interno)", azul
  `#2a78d6` -- el mismo accent de la app --, logo
  `/email-logo.png` -- el logo horizontal de SIGAP que ya se usa como
  `og:image`, no hacía falta crear ninguno nuevo).
- `cargarLogo()` ahora acepta una URL opcional (antes memorizaba un
  único logo fijo) -- cachea por URL, así conviven el logo de IPUC y
  el de SIGAP sin pisarse.
- `descargarCsv`/`descargarExcel`/`descargarPdf` (y sus funciones
  internas `escribirMembrete`/`escribirResumen`/`agregarBarrasDatos`/
  `generarGraficoPng`) ahora aceptan un parámetro opcional `brand`
  (default `BRAND`, la marca IPUC de siempre) -- **cero cambios de
  comportamiento para los 19+ archivos existentes** que llaman estas
  funciones sin pasar `brand`.
- `BRAND`/`SIGAP_BRAND` ahora incluyen `logoBox` (ancho/alto propio
  para Excel y PDF) porque el logo de SIGAP es horizontal (1793x480,
  ratio ~3.74:1) muy distinto del logo cuadrado de IPUC -- sin esto se
  vería deformado dentro de la misma caja fija.
- `ExportButtons.jsx`: nuevo prop opcional `marca` (default `'IPUC'`)
  para el texto del botón PDF ("Exportar PDF con membrete X").

### 2. `DashboardSuperAdmin` (`src/pages/Dashboard.jsx`) -- botón de exportar

Fila "Informe de negocio" con `<ExportButtons marca="SIGAP" .../>`
justo debajo del hero. El informe incluye:

- KPIs: congregaciones totales/activas/pendientes/nuevas (30 días),
  ingreso mensual estimado, ingreso promedio por congregación.
- Desgloses (con gráfico en el PDF, barras de datos en Excel): estado
  de suscripciones, congregaciones por plan, congregaciones por etapa.
- Tabla: las congregaciones que "requieren atención pronto"
  (bloqueadas, en gracia, o vencen en 7 días) -- la misma lista que ya
  se ve en pantalla.

## Verificación

Para poder probar `DashboardSuperAdmin` (no hay cuenta de prueba con
ese nivel), se parcheó **temporalmente y solo en local** la condición
de enrutamiento para que el rol `local` también cayera en ese
componente, se verificó todo, y se revirtió el parche antes de
commitear (confirmado con `git status`/`git diff` que no quedó
ningún rastro).

Con ese parche temporal, contra la cuenta real `pueba691@gmail.com`:

1. El panel completo carga sin errores de consola.
2. Los 3 botones (CSV/Excel/PDF) descargan archivos reales.
3. **CSV**: encabezado `"SIGAP — Sistema Integrado de Gestión y
   Analítica Pastoral"` (sin ningún rastro de IPUC).
4. **PDF**: texto extraído con `pdfjs-dist` (instalado temporalmente
   con `--no-save`, sin tocar `package.json`, para esta sola
   verificación) confirma título "Sistema Integrado de Gestión y
   Analítica Pastoral", subtítulo "Panel de negocio (uso interno)", y
   pie de página "SIGAP — Panel de negocio (uso interno)" en ambas
   páginas -- sin IPUC en ningún lado.
5. **Excel**: `workbook.creator === 'SIGAP'`, hojas `Resumen` +
   `Requieren atención`, membrete con el nombre correcto, KPIs con los
   valores reales de la cuenta de prueba.
6. **Regresión**: se repitió el mismo tipo de exportación desde una
   pantalla existente (`/reportes`, CSV) para confirmar que el
   membrete de IPUC sigue exactamente igual que antes -- sin cambios.
7. `npm run build` sin errores en cada paso.

## Pendiente

Ninguna acción de base de datos. Solo frontend, ya desplegado.
