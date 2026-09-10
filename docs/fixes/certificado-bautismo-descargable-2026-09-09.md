# Certificado de bautismo descargable — 2026-09-09

## Contexto

El usuario pidió que, cuando una persona recibe el bautismo (estación
ESFOB de la Ruta Evangelística), se pueda generar y descargar un
certificado de bautismo -- a partir de un certificado real de ejemplo
de la IPUC (fondo dorado, marcos ornamentales, marca de agua
"PERMANECE" con Juan 15:5). Pidió explícitamente rediseñarlo (fondo
blanco puro, sin marcos, marca de agua "EN TUS MANOS" con Job 12:10) y
ver una vista previa antes de construir nada.

## Vista previa (antes de tocar código)

Se construyó una vista previa **local, no publicada** (archivo HTML
fuera del repositorio) -- deliberadamente no se publicó como Artifact
porque un certificado con el nombre real de una organización (IPUC),
su NIT y su número de personería jurídica es exactamente el tipo de
"registro fabricado que podría pasar por genuino" que no se publica en
un enlace público, sin importar el propósito. Se iteró varias rondas
sobre esa vista previa hasta la aprobación final: tamaño carta
horizontal, marco azul corporativo (no dorado), logo/nombre/lema más
grandes, "Personería Jurídica 1032" en su posición original bajo la
sede, fecha de generación de descarga separada de la fecha de
bautismo (a propósito: un certificado se puede descargar días o meses
después del bautismo por logística, y debe seguir mostrando la fecha
real del bautismo).

## Construido

1. **`src/lib/certificadoBautismo.js`** (nuevo) -- genera el PDF.
   Primer intento: dibujar el certificado con las primitivas de texto
   de jsPDF (fuente `times` integrada). El usuario reportó que no se
   veía fiel a la vista previa -- correcto, jsPDF no trae las fuentes
   decorativas (Cormorant Garamond, EB Garamond, Parisienne) de la
   vista previa aprobada. Se descartó ese enfoque y en su lugar el
   certificado se renderiza como HTML/CSS real (fuera de pantalla, con
   las mismas fuentes de Google Fonts) y se captura con `html2canvas`
   (ya viene instalado como dependencia de `jsPDF`) para insertarlo
   como imagen de página completa en el PDF -- así el PDF resulta
   idéntico a lo aprobado, sin reinventar el diseño en otro lenguaje.
   - La imagen se exporta como JPEG (no PNG): un PNG sin pérdida de
     esta captura pesaba más de 16 MB; JPEG a calidad alta se ve igual
     de nítido con ~300 KB.
   - `congregaciones.nombre` se guarda en MAYÚSCULAS en la base de
     datos -- se detectó al probar con datos reales (la vista previa
     usaba un nombre de ejemplo bien escrito a mano) y se agregó
     `formatearTitulo()` para mostrarlo en Título Case solo en el
     certificado, sin tocar el dato real.
   - El tamaño del nombre de la persona se ajusta según su longitud
     (nombres largos, frecuentes con dos nombres + dos apellidos, no
     deben desbordar sobre el título "Bautismo").
2. **`src/lib/reportExport.js`** -- se exportó `cargarLogo()` (antes
   privada) para reutilizar la misma carga/caché del logo de IPUC en
   vez de duplicarla.
3. **`src/pages/Amigos.jsx`** -- nuevo botón "Descargar certificado de
   bautismo" en la ficha del amigo, visible cuando
   `estado_espiritual === "bautizado"` (se queda disponible después de
   incorporar a Feligresía, para poder volver a descargarlo más
   adelante). Nueva consulta a `congregaciones` (nombre, pastor_nombre)
   cargada una vez junto con el resto de catálogos de la pantalla.

## Verificación

`npm run build` sin errores en cada iteración. Verificado extremo a
extremo con Playwright contra el servidor de desarrollo real
(`localhost:5173`) y la cuenta de prueba: se creó un amigo de prueba
bautizado en Puerto Tejada Cauca Central, se inició sesión real en el
navegador, se abrió su ficha, se hizo clic en el botón y se capturó la
descarga real generada por el código de producción (sin mocks) -- sin
errores de consola. Se interceptó además la imagen intermedia que
genera `html2canvas` (antes de convertirse en PDF) para inspeccionarla
directamente como PNG y confirmar visualmente que coincide con el
diseño aprobado. Se limpiaron el amigo y los archivos de prueba
después de cada corrida, sin residuos.
