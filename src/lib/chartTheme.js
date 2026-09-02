// Tema compartido de graficos (Chart.js) para todos los modulos.
// Un solo lugar para colores, tooltips y ejes evita que cada modulo
// reinvente su propio estilo y que las fechas se amontonen cuando un
// grupo acumula muchas sesiones/actividades con el tiempo.

// Misma paleta ya validada con el usuario en Dashboard.jsx, derivada de
// los tokens de marca (accent/success/danger/warning en tailwind.config.js)
// mas 3 tonos complementarios para cuando hay mas de 4 categorias.
export const PALETTE = [
  { line: '#2a78d6', soft: 'rgba(42,120,214,0.13)' }, // accent
  { line: '#e06b35', soft: 'rgba(224,107,53,0.1)' },
  { line: '#008300', soft: 'rgba(0,131,0,0.1)' }, // success
  { line: '#9a6bce', soft: 'rgba(154,107,206,0.1)' },
  { line: '#d03b3b', soft: 'rgba(208,59,59,0.1)' }, // danger
  { line: '#159a9c', soft: 'rgba(21,154,156,0.1)' },
  { line: '#c98500', soft: 'rgba(201,133,0,0.1)' }, // warning
]

export function paletteAt(index) {
  return PALETTE[index % PALETTE.length]
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '')
  const r = parseInt(value.substring(0, 2), 16)
  const g = parseInt(value.substring(2, 4), 16)
  const b = parseInt(value.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Relleno en degradado (en vez de un color plano) para que el area bajo
// la linea de tendencia se vea premium en lugar de un bloque solido.
export function gradientFill(hexColor, alphaTop = 0.28, alphaBottom = 0.02) {
  return (context) => {
    const { chart } = context
    const { ctx, chartArea } = chart
    if (!chartArea) return hexToRgba(hexColor, alphaTop)
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, hexToRgba(hexColor, alphaTop))
    gradient.addColorStop(1, hexToRgba(hexColor, alphaBottom))
    return gradient
  }
}

const TICK_COLOR = '#898781'
const GRID_COLOR = 'rgba(82,81,78,0.1)'

// Opciones base para lineas y barras. `autoSkip: true` + `maxTicksLimit`
// es la parte que importa: sin esto, cuando un grupo acumula mas de ~8
// sesiones o meses, Chart.js intenta dibujar todas las fechas en una sola
// fila y quedan amontonadas/ilegibles.
export function chartOptions({ showLegend = false, maxTicks = 8 } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: showLegend
        ? { display: true, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 16, color: '#52514e', font: { size: 11, weight: '500' } } }
        : { display: false },
      tooltip: {
        backgroundColor: '#111820',
        titleColor: '#ffffff',
        bodyColor: 'rgba(255,255,255,0.78)',
        borderColor: 'rgba(113,179,247,0.35)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        displayColors: showLegend,
        callbacks: { label: (context) => ` ${context.dataset.label}: ${context.formattedValue}` },
      },
    },
    scales: {
      y: { beginAtZero: true, border: { display: false }, grid: { color: GRID_COLOR, drawTicks: false }, ticks: { color: TICK_COLOR, precision: 0, padding: 8, font: { size: 10.5 } } },
      x: { border: { display: false }, grid: { display: false }, ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true, maxTicksLimit: maxTicks, padding: 8, font: { size: 10.5 } } },
    },
  }
}

// Serie de tendencia (linea + area en degradado), un solo color de la paleta.
export function trendDataset(labels, data, { label = 'Total', colorIndex = 0 } = {}) {
  const color = paletteAt(colorIndex)
  return {
    labels,
    datasets: [{
      label,
      data,
      borderColor: color.line,
      backgroundColor: gradientFill(color.line),
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: '#ffffff',
      pointBorderWidth: 2,
      pointBorderColor: color.line,
      borderWidth: 2.5,
    }],
  }
}

// Barras de distribucion (una por categoria), cada una con su propio
// color de la paleta en vez de un solo tono plano repetido — mas facil
// de escanear de un vistazo para quien va a tomar una decision.
export function distributionDataset(items, { labelKey = 'label', valueKey = 'total', datasetLabel = 'Total' } = {}) {
  return {
    labels: items.map((item) => item[labelKey]),
    datasets: [{
      label: datasetLabel,
      data: items.map((item) => item[valueKey]),
      backgroundColor: items.map((_, index) => paletteAt(index).line),
      borderRadius: 6,
      barThickness: 22,
      maxBarThickness: 34,
    }],
  }
}
