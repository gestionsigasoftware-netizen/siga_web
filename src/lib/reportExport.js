// Exportacion compartida con membrete IPUC (CSV, Excel y PDF) para todos
// los modulos que descargan datos. Antes cada pantalla (Auditoria,
// Reportes, Feligresia) tenia su propia funcion de exportar CSV, con
// delimitador, salto de linea y nombre de archivo distintos entre si —
// incluso un bug real: AuditoriaFeligresia.jsx separaba con ',' en vez de
// ';', lo que rompe la apertura en Excel en español (usa ',' como
// separador decimal). Este modulo unifica los tres formatos con la
// identidad real de la IPUC: logo y lema tomados de ipuc.org.co, azul
// institucional tomado del propio sitio oficial.

import logoUrl from '../assets/ipuc-logo.png'

export const BRAND = {
  nombre: 'Iglesia Pentecostal Unida de Colombia',
  sigla: 'IPUC',
  lema: 'Un Señor, una fe, un bautismo.',
  colorHex: '#0b4a8c',
  colorArgb: 'FF0B4A8C',
}

let logoPromise
// Convierte el logo (bundleado por Vite como URL) a data URL una sola vez
// por sesion — tanto jsPDF como exceljs necesitan los bytes de la imagen,
// no una URL.
function cargarLogo() {
  if (!logoPromise) {
    logoPromise = fetch(logoUrl)
      .then((response) => response.blob())
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      }))
  }
  return logoPromise
}

function marcaTiempo() {
  return new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// CSV: ';' porque Excel en configuracion regional Colombia/español usa ','
// como separador decimal (con ',' como delimitador de columnas, cualquier
// celda numerica con decimales rompe las columnas). BOM para que tildes y
// "ñ" se vean bien al abrir en Excel. \r\n porque es lo que Excel espera
// en Windows.
export function descargarCsv({ filename, titulo, meta = [], headers, rows }) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const encabezado = [
    [`${BRAND.sigla} — ${BRAND.nombre}`],
    ...(titulo ? [[titulo]] : []),
    ...meta.map((linea) => [linea]),
    [`Generado: ${marcaTiempo()}`],
    [],
  ]
  const cuerpo = [headers, ...rows]
  const csv = `﻿${[...encabezado, ...cuerpo].map((row) => row.map(escape).join(';')).join('\r\n')}`
  descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

export async function descargarExcel({ filename, hoja = 'Datos', titulo, meta = [], headers, rows, anchos }) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = BRAND.sigla
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(hoja)

  try {
    const logo = await cargarLogo()
    const imageId = workbook.addImage({ base64: logo, extension: 'png' })
    sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 84, height: 59 } })
  } catch {
    // Sin logo el export sigue siendo util — no se bloquea la descarga por esto.
  }

  sheet.getColumn(1).width = 15
  sheet.mergeCells('B1:F1')
  sheet.getCell('B1').value = BRAND.nombre
  sheet.getCell('B1').font = { bold: true, size: 13, color: { argb: BRAND.colorArgb } }
  sheet.mergeCells('B2:F2')
  sheet.getCell('B2').value = titulo || hoja
  sheet.getCell('B2').font = { size: 11, color: { argb: 'FF52514E' } }

  let fila = 4
  meta.forEach((linea) => {
    sheet.getCell(`B${fila}`).value = linea
    sheet.getCell(`B${fila}`).font = { size: 9, italic: true, color: { argb: 'FF898781' } }
    fila += 1
  })
  sheet.getCell(`B${fila}`).value = `Generado: ${marcaTiempo()}`
  sheet.getCell(`B${fila}`).font = { size: 9, italic: true, color: { argb: 'FF898781' } }
  fila += 2

  const headerRow = sheet.getRow(fila)
  headers.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.colorArgb } }
    cell.alignment = { vertical: 'middle' }
  })
  headerRow.commit()

  rows.forEach((valores) => sheet.addRow(valores))

  headers.forEach((label, index) => {
    sheet.getColumn(index + 1).width = anchos?.[index] ?? Math.max(14, String(label).length + 2)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  descargarBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

export async function descargarPdf({ filename, titulo, meta = [], headers, rows, orientacion = 'portrait' }) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: orientacion, unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  try {
    const logo = await cargarLogo()
    doc.addImage(logo, 'PNG', 14, 10, 20, 14)
  } catch {
    // sin logo, el resto del membrete (texto) sigue siendo valido
  }

  doc.setFontSize(13)
  doc.setTextColor(11, 74, 140)
  doc.text(BRAND.nombre, 38, 16)
  doc.setFontSize(9)
  doc.setTextColor(137, 135, 129)
  doc.text(BRAND.lema, 38, 21)

  doc.setDrawColor(11, 74, 140)
  doc.setLineWidth(0.6)
  doc.line(14, 27, pageWidth - 14, 27)

  doc.setFontSize(12)
  doc.setTextColor(17, 24, 32)
  doc.text(titulo || 'Informe estadístico', 14, 35)

  doc.setFontSize(8.5)
  doc.setTextColor(82, 81, 78)
  let y = 41
  meta.forEach((linea) => { doc.text(linea, 14, y); y += 4.5 })
  doc.text(`Generado: ${marcaTiempo()}`, 14, y)
  y += 4

  autoTable(doc, {
    startY: y + 3,
    head: [headers],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 2.4 },
    headStyles: { fillColor: [11, 74, 140], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 248] },
    margin: { left: 14, right: 14, top: 20 },
  })

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina)
    doc.setFontSize(7.5)
    doc.setTextColor(137, 135, 129)
    doc.text(`${BRAND.sigla} · SIGAP — Sistema Integrado de Gestión y Analítica Pastoral`, 14, pageHeight - 8)
    doc.text(`Página ${pagina} de ${totalPaginas}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
  }

  doc.save(filename)
}
