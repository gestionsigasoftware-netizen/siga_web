# Exportación con membrete IPUC real (2026-09-02)

## Contexto

El usuario pidió construir una exportación "profesional, con el logo de la
IPUC", pidiendo explícitamente investigar cómo son los comunicados
oficiales de la IPUC (membrete, cuánta información llevan) antes de
construir nada. Se investigó el sitio oficial `ipuc.org.co` en vez de
inventar una identidad.

## Investigación real (no inventada)

- **Logo real**, descargado de `ipuc.org.co`: círculo con globo terráqueo
  + libro abierto, texto en anillo "IGLESIA PENTECOSTAL UNIDA DE
  COLOMBIA", lema **"Un Señor, una fe, un bautismo."**. Guardado en
  `src/assets/ipuc-logo.png` (versión color) y
  `src/assets/ipuc-logo-blanco.png` (versión blanca, sin usar todavía).
- **Azul institucional real**, tomado del propio CSS de `ipuc.org.co`
  (degradado de su pantalla de carga): `#003366` → `#0066cc`. Se usó
  `#0b4a8c` (muestreado directamente de los píxeles del logo) como azul
  de marca en tablas y encabezados — es el mismo azul del logo, no un
  azul inventado.
- **Límite honesto**: no existe un manual de identidad corporativa
  público descargable, ni se pudo recuperar un comunicado oficial en PDF
  para confirmar el formato exacto de membrete interno (el único enlace
  indexado murió al migrar el sitio de WordPress a la SPA actual, y
  Wayback Machine no fue accesible). El membrete que se construyó usa
  convenciones profesionales estándar (logo + nombre + lema + línea +
  título + metadatos + tabla + pie de página numerado), no un formato
  interno de la IPUC que no se pudo verificar.

## Qué se construyó

- **`src/lib/reportExport.js`**: módulo compartido con 3 funciones —
  `descargarCsv()`, `descargarExcel()` (usa `exceljs`, ya instalado, con
  el logo incrustado como imagen real) y `descargarPdf()` (usa `jspdf` +
  `jspdf-autotable`, nuevos, con membrete completo: logo, nombre, lema,
  línea divisoria, título, metadatos, tabla con encabezado en azul
  institucional, pie de página con "IPUC · SIGAP" y numeración).
- **`src/components/ExportButtons.jsx`**: grupo de 3 botones (CSV /
  Excel / PDF) reutilizado en las 3 pantallas que exportan datos.
- **Se corrigió un bug real** encontrado al auditar los exports
  existentes: `AuditoriaFeligresia.jsx` separaba las columnas del CSV
  con `,` en vez de `;` — en Excel con configuración regional
  Colombia/español, `,` es el separador decimal, así que el CSV se abría
  con las columnas mal separadas. Ahora usa el mismo estándar que los
  demás (`;`, BOM, `\r\n`).
- **Se unificaron los 3 puntos de exportación existentes** (antes cada
  uno tenía su propio CSV hecho a mano, con delimitador y nombre de
  archivo distintos entre sí):
  - `AuditoriaFeligresia.jsx` — exportación de la auditoría filtrada.
  - `ReportesOptimizado.jsx` — exportación de la página de detalle.
  - `FeligresiaAdmin.jsx` — exportación del censo local y del análisis
    de comités. El análisis de comités antes mezclaba en un mismo CSV la
    tabla de comités y un fragmento del historial de auditoría; se dejó
    solo la tabla de comités (la auditoría completa ya tiene su propia
    exportación dedicada en Auditoría de Feligresía).

## Explícitamente no incluido en esta ronda

- No se construyó una vista nueva de "Informe Estadístico" — el usuario
  eligió rediseñar los exports existentes, no agregar una pantalla
  nueva.
- No se aplicó el membrete a los ~13 módulos de comité individuales
  (Escuela Dominical, Damas Dorcas, etc.) porque ninguno tenía su propio
  botón de exportación antes de esta ronda — solo se tocaron los 3
  puntos que ya exportaban datos.

## Acción requerida del usuario

Ninguna migración SQL. Sí se agregaron 2 dependencias nuevas al
`package.json` (`jspdf`, `jspdf-autotable`) — quedan instaladas en
`package-lock.json`, no requiere pasos manuales adicionales más allá de
`npm install` si se clona el repo en otra máquina.
