import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'

// Grupo de 3 botones de exportacion (CSV / Excel / PDF), reutilizado en
// las pantallas que descargan datos — antes cada una tenia su propio
// boton "Exportar" (solo CSV, con formato inconsistente entre pantallas).
export default function ExportButtons({ onCsv, onExcel, onPdf, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onCsv} disabled={disabled} className="btn-secondary px-3" title="Exportar CSV" aria-label="Exportar CSV">
        <FileText className="w-4 h-4" /> CSV
      </button>
      <button type="button" onClick={onExcel} disabled={disabled} className="btn-secondary px-3" title="Exportar Excel" aria-label="Exportar Excel">
        <FileSpreadsheet className="w-4 h-4" /> Excel
      </button>
      <button type="button" onClick={onPdf} disabled={disabled} className="btn-secondary px-3" title="Exportar PDF con membrete IPUC" aria-label="Exportar PDF con membrete IPUC">
        <FileDown className="w-4 h-4" /> PDF
      </button>
    </div>
  )
}
