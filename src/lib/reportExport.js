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
export function cargarLogo() {
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

// Formato humano en español (punto de miles) — se usa en el PDF, donde
// autoTable imprime el valor tal cual se lo demos (a diferencia de Excel,
// que aplica el formato de numero el mismo al mostrar la celda).
function formatoNumero(value) {
  return typeof value === 'number' ? value.toLocaleString('es-CO') : value
}

// CSV: ';' porque Excel en configuracion regional Colombia/español usa ','
// como separador decimal (con ',' como delimitador de columnas, cualquier
// celda numerica con decimales rompe las columnas). BOM para que tildes y
// "ñ" se vean bien al abrir en Excel. \r\n porque es lo que Excel espera
// en Windows. Los numeros NO se entrecomillan -- entrecomillar un numero
// hace que Excel lo trate como texto (alineado a la izquierda, sin poder
// sumarlo ni ordenarlo numericamente), justo lo contrario de lo que
// alguien espera al abrir una columna de "Asistentes".
export function descargarCsv({ filename, titulo, meta = [], headers, rows }) {
  const escape = (value) => (typeof value === 'number' ? String(value) : `"${String(value ?? '').replace(/"/g, '""')}"`)
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

// Membrete (logo + nombre + titulo + meta) compartido entre la hoja de
// Resumen y la de Datos -- antes solo existia en una hoja, esto evita
// duplicar la lógica al agregar una segunda.
function escribirMembrete(workbook, sheet, logo, { titulo, subtitulo, meta }) {
  if (logo) {
    try {
      const imageId = workbook.addImage({ base64: logo, extension: 'png' })
      sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 84, height: 59 } })
    } catch {
      // Sin logo el export sigue siendo util — no se bloquea la descarga por esto.
    }
  }
  sheet.getColumn(1).width = 15
  sheet.mergeCells('B1:F1')
  sheet.getCell('B1').value = BRAND.nombre
  sheet.getCell('B1').font = { bold: true, size: 13, color: { argb: BRAND.colorArgb } }
  sheet.mergeCells('B2:F2')
  sheet.getCell('B2').value = titulo || subtitulo
  sheet.getCell('B2').font = { size: 11, color: { argb: 'FF52514E' } }

  let fila = 4
  meta.forEach((linea) => {
    sheet.getCell(`B${fila}`).value = linea
    sheet.getCell(`B${fila}`).font = { size: 9, italic: true, color: { argb: 'FF898781' } }
    fila += 1
  })
  sheet.getCell(`B${fila}`).value = `Generado: ${marcaTiempo()}`
  sheet.getCell(`B${fila}`).font = { size: 9, italic: true, color: { argb: 'FF898781' } }
  return fila + 2
}

// Barras de datos (formato condicional nativo de Excel) sobre la
// columna de valores -- es lo mas cercano a un grafico real que soporta
// ExcelJS (no tiene API para insertar graficos de verdad), pero da una
// señal visual inmediata de magnitud relativa sin salir de la celda.
function agregarBarrasDatos(sheet, ref) {
  sheet.addConditionalFormatting({
    ref,
    rules: [{
      type: 'dataBar', priority: 1, gradient: true, showValue: true, border: false,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: { argb: BRAND.colorArgb },
    }],
  })
}

// Hoja "Resumen": tarjetas de indicadores (numero grande + etiqueta,
// como las del Dashboard de la web) y hasta varios desgloses lado a lado
// (cada uno con barras de datos) -- sin esto, un Excel exportado era
// solo columnas sueltas; con esto alguien que abre el archivo ve de
// entrada los numeros que importan, no una tabla cruda que hay que
// interpretar a mano. `desgloses` acepta un arreglo de
// { titulo, items: [{label, valor}] }; por compatibilidad tambien acepta
// un unico `desglose` (objeto, no arreglo).
function escribirResumen(sheet, resumen, filaInicio) {
  let fila = filaInicio
  if (resumen.kpis?.length) {
    resumen.kpis.forEach((kpi) => {
      sheet.getCell(`B${fila}`).value = kpi.label
      sheet.getCell(`B${fila}`).font = { size: 10, color: { argb: 'FF52514E' } }
      const celdaValor = sheet.getCell(`D${fila}`)
      celdaValor.value = kpi.value
      celdaValor.font = { bold: true, size: 16, color: { argb: BRAND.colorArgb } }
      if (typeof kpi.value === 'number') celdaValor.numFmt = '#,##0'
      celdaValor.alignment = { horizontal: 'left' }
      sheet.getRow(fila).height = 22
      fila += 1
    })
    fila += 1
  }

  const desgloses = resumen.desgloses ?? (resumen.desglose ? [resumen.desglose] : [])
  if (desgloses.length) {
    // Cada desglose ocupa un bloque de 2 columnas (etiqueta + valor) con
    // una columna de separacion -- hasta 3 por fila antes de bajar a la
    // siguiente, para que se vean como paneles uno junto al otro en vez
    // de una lista larga vertical.
    const ANCHO_BLOQUE = 4
    const POR_FILA = 3
    const filaBloqueInicio = fila
    let maxFilaUsada = fila
    desgloses.forEach((desglose, indice) => {
      const columnaBase = 2 + (indice % POR_FILA) * ANCHO_BLOQUE
      const filaBase = filaBloqueInicio + Math.floor(indice / POR_FILA) * 200 // separacion generosa entre filas de bloques
      let filaDesglose = filaBase
      const colLetra = (n) => sheet.getColumn(n).letter
      sheet.getCell(`${colLetra(columnaBase)}${filaDesglose}`).value = desglose.titulo || 'Desglose'
      sheet.getCell(`${colLetra(columnaBase)}${filaDesglose}`).font = { bold: true, size: 11, color: { argb: 'FF111820' } }
      filaDesglose += 1
      const inicioTabla = filaDesglose
      desglose.items.forEach((item) => {
        sheet.getCell(`${colLetra(columnaBase)}${filaDesglose}`).value = item.label
        sheet.getCell(`${colLetra(columnaBase)}${filaDesglose}`).font = { size: 10 }
        const celda = sheet.getCell(`${colLetra(columnaBase + 1)}${filaDesglose}`)
        celda.value = item.valor
        celda.font = { size: 10 }
        if (typeof item.valor === 'number') celda.numFmt = '#,##0'
        filaDesglose += 1
      })
      if (desglose.items.length) agregarBarrasDatos(sheet, `${colLetra(columnaBase + 1)}${inicioTabla}:${colLetra(columnaBase + 1)}${filaDesglose - 1}`)
      sheet.getColumn(columnaBase).width = 28
      sheet.getColumn(columnaBase + 1).width = 14
      maxFilaUsada = Math.max(maxFilaUsada, filaDesglose)
    })
    fila = maxFilaUsada
  }
  return fila
}

export async function descargarExcel({ filename, hoja = 'Datos', titulo, meta = [], headers, rows, anchos, resumen, resaltarFila }) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = BRAND.sigla
  workbook.created = new Date()
  const logo = await cargarLogo().catch(() => null)

  // Columnas donde TODAS las filas traen un numero real -- se les aplica
  // formato de miles y, en la tabla nativa, funcion de suma en la fila
  // de totales. Detectado solo, sin que cada pantalla tenga que declarar
  // que columna es numerica.
  const columnasNumericas = headers.map((_, index) => rows.length > 0 && rows.every((row) => typeof row[index] === 'number'))

  if (resumen) {
    const resumenSheet = workbook.addWorksheet('Resumen')
    resumenSheet.properties.tabColor = { argb: BRAND.colorArgb }
    const filaTrasMembrete = escribirMembrete(workbook, resumenSheet, logo, { titulo, subtitulo: hoja, meta })
    escribirResumen(resumenSheet, resumen, filaTrasMembrete)
  }

  const sheet = workbook.addWorksheet(hoja)
  sheet.properties.tabColor = { argb: 'FF52514E' }
  const filaMembrete = escribirMembrete(workbook, sheet, logo, { titulo, subtitulo: hoja, meta })

  // Tabla nativa de Excel (no una tabla "a mano" con estilos por celda):
  // da filtro desplegable en cada columna, bandas de color automaticas y
  // una fila de totales con suma automatica en las columnas numericas,
  // todo sin que el usuario tenga que configurar nada.
  const nombreTabla = `Tabla${hoja.replace(/[^a-zA-Z0-9]/g, '') || 'Datos'}`
  sheet.addTable({
    name: nombreTabla,
    ref: `A${filaMembrete}`,
    headerRow: true,
    totalsRow: columnasNumericas.some(Boolean),
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: headers.map((label, index) => ({
      name: label,
      filterButton: true,
      totalsRowFunction: columnasNumericas[index] ? 'sum' : undefined,
      totalsRowLabel: index === 0 && columnasNumericas.some(Boolean) ? 'Total' : undefined,
    })),
    rows,
  })

  headers.forEach((label, index) => {
    sheet.getColumn(index + 1).width = anchos?.[index] ?? Math.max(14, String(label).length + 2)
    if (columnasNumericas[index]) sheet.getColumn(index + 1).numFmt = '#,##0'
  })

  // Encabezado siempre visible al hacer scroll en reportes largos.
  sheet.views = [{ state: 'frozen', ySplit: filaMembrete }]

  if (resaltarFila) {
    rows.forEach((valores, index) => {
      if (!resaltarFila(valores, index)) return
      const fila = sheet.getRow(filaMembrete + 1 + index)
      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE9E7' } }
        cell.font = { ...(cell.font || {}), color: { argb: 'FFB3261E' } }
      })
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  descargarBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// Grafico de barras renderizado en un canvas fuera de pantalla y
// exportado a PNG -- jsPDF no dibuja graficos, pero si puede insertar
// una imagen, y Chart.js (ya usado en toda la app) puede generar esa
// imagen sin necesidad de tenerlo montado en el DOM visible.
async function generarGraficoPng(labels, valores) {
  const { Chart, BarController, BarElement, CategoryScale, LinearScale } = await import('chart.js')
  Chart.register(BarController, BarElement, CategoryScale, LinearScale)
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 380
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: BRAND.colorHex, borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 13 } } },
        y: { beginAtZero: true, ticks: { font: { size: 12 } } },
      },
    },
  })
  const dataUrl = chart.toBase64Image()
  chart.destroy()
  return dataUrl
}

export async function descargarPdf({ filename, titulo, meta = [], headers, rows, orientacion = 'portrait', resumen, resaltarFila }) {
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
  doc.line(14, 29, pageWidth - 14, 29)

  doc.setFontSize(13)
  doc.setTextColor(17, 24, 32)
  doc.text(titulo || 'Informe estadístico', 14, 39)

  doc.setFontSize(9)
  doc.setTextColor(82, 81, 78)
  let y = 46
  meta.forEach((linea) => { doc.text(linea, 14, y); y += 5.5 })
  doc.text(`Generado: ${marcaTiempo()}`, 14, y)
  y += 7

  // Tarjetas de indicadores -- el mismo "de un vistazo" que ya tiene el
  // Excel, para que el PDF no sea solo membrete + tabla cruda.
  if (resumen?.kpis?.length) {
    const kpis = resumen.kpis.slice(0, 4)
    const espacio = 4
    const anchoTarjeta = (pageWidth - 28 - espacio * (kpis.length - 1)) / kpis.length
    const altoTarjeta = 18
    kpis.forEach((kpi, index) => {
      const x = 14 + index * (anchoTarjeta + espacio)
      doc.setFillColor(245, 246, 248)
      doc.roundedRect(x, y, anchoTarjeta, altoTarjeta, 2, 2, 'F')
      doc.setFontSize(13)
      doc.setTextColor(11, 74, 140)
      doc.text(String(formatoNumero(kpi.value)), x + 4, y + 8)
      doc.setFontSize(7.5)
      doc.setTextColor(82, 81, 78)
      doc.text(doc.splitTextToSize(kpi.label, anchoTarjeta - 8), x + 4, y + 13.5)
    })
    y += altoTarjeta + 8
  }

  // Grafico embebido del primer desglose disponible -- da una lectura
  // visual inmediata que ni el Excel (barras dentro de celda) puede
  // igualar en impacto para un documento pensado para imprimir/compartir.
  // Se ajusta al espacio que realmente queda debajo de las tarjetas en
  // esta misma pagina (aunque quede mas chico) en vez de a un tamaño fijo
  // que empuje el grafico a una pagina nueva y deje un vacio enorme
  // debajo de las tarjetas.
  const primerDesglose = resumen?.desgloses?.[0] ?? resumen?.desglose
  if (primerDesglose?.items?.length) {
    try {
      const itemsGrafico = primerDesglose.items.slice(0, 8)
      const chartUrl = await generarGraficoPng(itemsGrafico.map((item) => item.label), itemsGrafico.map((item) => item.valor))
      doc.setFontSize(10)
      doc.setTextColor(17, 24, 32)
      doc.text(primerDesglose.titulo || 'Desglose', 14, y)
      y += 4
      const relacionAspecto = 380 / 900
      const anchoDisponible = pageWidth - 28
      const altoDisponible = Math.max(35, pageHeight - 20 - y)
      let anchoGrafico = anchoDisponible
      let altoGrafico = anchoGrafico * relacionAspecto
      if (altoGrafico > altoDisponible) { altoGrafico = altoDisponible; anchoGrafico = altoGrafico / relacionAspecto }
      doc.addImage(chartUrl, 'PNG', 14, y, anchoGrafico, altoGrafico)
    } catch {
      // Si el grafico falla por alguna razon, el PDF sigue siendo util sin el.
    }
  }

  // La tabla de datos siempre arranca en una hoja nueva cuando hay un
  // resumen -- separa la "hoja de un vistazo" (tarjetas + grafico) de la
  // tabla cruda, en vez de dejarlas compitiendo por espacio en la misma
  // pagina.
  if (resumen) { doc.addPage(); y = 20 }

  const filasFormateadas = rows.map((row) => row.map(formatoNumero))

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: filasFormateadas,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, lineColor: [223, 224, 226], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [11, 74, 140], textColor: 255, fontStyle: 'bold', cellPadding: 4.5 },
    alternateRowStyles: { fillColor: [247, 248, 249] },
    margin: { left: 14, right: 14, top: 22, bottom: 18 },
    didParseCell: (data) => {
      if (data.section === 'body' && resaltarFila?.(rows[data.row.index], data.row.index)) {
        data.cell.styles.fillColor = [253, 231, 227]
        data.cell.styles.textColor = [179, 38, 30]
      }
    },
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
