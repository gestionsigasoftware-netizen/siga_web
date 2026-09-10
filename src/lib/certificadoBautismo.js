// SIGA - Certificado de bautismo descargable.
//
// El usuario aprobó el diseño en una vista previa HTML (2026-09-09):
// tamaño carta horizontal, sin marco dorado, marco azul corporativo, marca
// de agua "EN TUS MANOS" / "Job 12:10", tipografías reales (Cormorant
// Garamond, EB Garamond, Parisienne de Google Fonts). Un primer intento
// dibujando el certificado con las primitivas de texto de jsPDF (fuentes
// integradas tipo "times") se veía visiblemente distinto a la vista previa
// aprobada -- jsPDF no trae fuentes decorativas. Por eso este módulo en
// cambio renderiza el certificado como HTML/CSS real (fuera de pantalla,
// con las mismas fuentes) y lo captura con html2canvas (ya es dependencia
// de jsPDF, viene instalada) para insertarlo como imagen de página completa
// en el PDF -- así el PDF se ve idéntico a lo que se aprobó.
import { cargarLogo } from './reportExport'

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Parisienne&display=swap"

// 11in x 8.5in a 96dpi -- coincide exactamente con el tamaño carta
// horizontal de la página del PDF (792 x 612 pt), sin distorsión.
const PAGE_WIDTH_PX = 1056
const PAGE_HEIGHT_PX = 816

function asegurarFuenteGoogle() {
  if (document.querySelector('link[data-certificado-bautismo-fuentes]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_HREF
  link.setAttribute('data-certificado-bautismo-fuentes', 'true')
  document.head.appendChild(link)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function formatearFechaLarga(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

// congregaciones.nombre se guarda en MAYUSCULAS en la base de datos (ej.
// "PUERTO TEJADA CAUCA CENTRAL") -- se ve bien en tablas/listas, pero
// gritado dentro del certificado no coincide con el diseño aprobado. Se
// pasa a Título Case solo para esta vista impresa, sin tocar el dato real.
const CONECTORES_MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
function formatearTitulo(value) {
  if (!value) return ''
  return value
    .toLowerCase()
    .split(' ')
    .map((palabra, index) => (index > 0 && CONECTORES_MINUSCULA.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)))
    .join(' ')
}

// Nombres largos (frecuentes: dos nombres + dos apellidos) no deben
// desbordar la firma en script -- se reduce el tamaño según el largo en
// vez de dejar un tamaño fijo pensado solo para nombres cortos.
function tamanoNombre(nombreCompleto) {
  const largo = (nombreCompleto || '').trim().length
  if (largo <= 18) return 66
  if (largo <= 26) return 54
  if (largo <= 34) return 44
  return 36
}

function nombreArchivo(nombreCompleto) {
  const base = (nombreCompleto || 'persona')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `certificado-bautismo-${base}.pdf`
}

function construirHtml({ logoDataUrl, nombreCompleto, congregacionNombre, fechaTexto, generadoTexto, pastorNombre }) {
  return `
    <div id="certificado-sheet" style="width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;position:relative;background:#ffffff;border:10px solid #1c3f66;box-sizing:border-box;font-family:'EB Garamond',Georgia,serif;overflow:hidden;">
      <div style="position:absolute;inset:14px;border:1.5px solid #1c3f66;"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
        <span style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:92px;letter-spacing:0.13em;color:rgba(28,63,102,0.05);white-space:nowrap;">EN TUS MANOS</span>
        <span style="font-family:'EB Garamond',serif;font-style:italic;font-size:21px;letter-spacing:0.08em;color:rgba(28,63,102,0.1);">Job 12:10</span>
      </div>
      <div style="position:relative;z-index:2;display:flex;flex-direction:column;height:100%;padding:34px 72px 26px;box-sizing:border-box;">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;">
          <img src="${logoDataUrl}" style="height:118px;width:auto;" />
          <p style="font-family:'Cormorant Garamond',serif;font-weight:700;font-size:46px;letter-spacing:0.015em;color:#22201b;margin:6px 0 0;">Iglesia Pentecostal Unida de Colombia</p>
          <p style="font-family:'EB Garamond',serif;font-style:italic;font-size:21px;color:#55504a;margin:0;">Sede ${escapeHtml(formatearTitulo(congregacionNombre))}</p>
          <p style="font-family:'EB Garamond',serif;font-size:15px;letter-spacing:0.05em;color:#6d7f92;margin:2px 0 0;">Personería Jurídica 1032</p>
          <div style="width:110px;height:1px;background:#d9d4c8;margin:7px auto 0;"></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;padding:6px 0;">
          <p style="font-family:'EB Garamond',serif;font-size:15px;letter-spacing:0.22em;text-transform:uppercase;color:#6d7f92;margin:0;">Certificado de</p>
          <h1 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:46px;letter-spacing:0.03em;color:#22201b;margin:0;">Bautismo</h1>
          <p style="font-family:'Parisienne',cursive;font-size:${tamanoNombre(nombreCompleto)}px;color:#1c3f66;margin:2px 0 0;line-height:1.15;white-space:nowrap;">${escapeHtml(nombreCompleto)}</p>
          <div style="width:340px;max-width:70%;height:1px;background:#d9d4c8;margin:2px auto;"></div>
          <p style="font-family:'EB Garamond',serif;font-size:20px;line-height:1.6;color:#55504a;max-width:540px;margin:0;">Recibió el bautismo por inmersión en el nombre del Señor Jesucristo el día <b style="color:#22201b;font-weight:500;">${escapeHtml(fechaTexto)}</b>, en la congregación antes mencionada.</p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:2px;">
          <p style="font-family:'EB Garamond',serif;font-style:italic;font-size:15.5px;color:#55504a;margin:0 0 14px;">Certificado generado el ${escapeHtml(generadoTexto)}</p>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="width:240px;height:1.5px;background:#22201b;margin-bottom:6px;"></div>
            <p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:#22201b;margin:0;">${escapeHtml(pastorNombre)}</p>
            <p style="font-family:'EB Garamond',serif;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;color:#6d7f92;margin:2px 0 0;">Pastor local</p>
          </div>
        </div>
      </div>
    </div>
  `
}

// La fecha de bautismo (histórica, de la ficha de la persona) y la fecha de
// generación (siempre "hoy") son intencionalmente independientes -- un
// certificado se puede descargar días o meses después del bautismo por
// logística, y debe seguir mostrando la fecha real del bautismo.
export async function descargarCertificadoBautismo({ nombreCompleto, fechaBautismo, congregacionNombre, pastorNombre }) {
  asegurarFuenteGoogle()

  const [{ jsPDF }, { default: html2canvas }, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
    cargarLogo(),
  ])

  await Promise.all([
    document.fonts.load('700 46px "Cormorant Garamond"'),
    document.fonts.load('600 46px "Cormorant Garamond"'),
    document.fonts.load('italic 400 20px "EB Garamond"'),
    document.fonts.load('400 20px "EB Garamond"'),
    document.fonts.load('400 66px "Parisienne"'),
  ]).catch(() => {})
  await document.fonts.ready

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-10000px'
  wrapper.style.top = '0'
  wrapper.innerHTML = construirHtml({
    logoDataUrl,
    nombreCompleto,
    congregacionNombre,
    fechaTexto: formatearFechaLarga(fechaBautismo) || 'fecha no registrada',
    generadoTexto: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    pastorNombre: pastorNombre?.trim() || 'Sin pastor asignado',
  })
  document.body.appendChild(wrapper)

  try {
    const sheet = wrapper.querySelector('#certificado-sheet')
    const canvas = await html2canvas(sheet, { scale: 2.2, backgroundColor: '#ffffff' })
    // JPEG en vez de PNG: el fondo blanco solido de todo el certificado no
    // necesita transparencia, y JPEG comprime muchisimo mejor este tipo de
    // contenido (texto + lineas finas sobre blanco) -- un PNG sin perdida
    // de esta imagen pesaba mas de 16 MB, JPEG a calidad alta se ve igual
    // de nitido con un archivo mucho mas liviano.
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    doc.addImage(imgData, 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight())
    doc.save(nombreArchivo(nombreCompleto))
  } finally {
    document.body.removeChild(wrapper)
  }
}
