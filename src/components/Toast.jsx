import { createPortal } from 'react-dom'

// Confirmaciones tipo "guardado con exito" migradas de un banner en linea
// (que empujaba el contenido y podia quedar fuera de vista si la pagina
// era larga) a un toast flotante -- posicion fija, no mueve el layout, se
// ve sin importar el scroll. Los errores de validacion NO pasan por aqui
// a proposito: deben seguir fijos y cerca del campo que hay que corregir.
const TONE_CLASS = {
  success: 'text-success bg-success-bg border-success/20',
  danger: 'text-danger bg-danger-bg border-danger/20',
}

export default function Toast({ children, tone = 'success' }) {
  if (!children) return null
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[200] max-w-[calc(100vw-2.5rem)] sm:max-w-sm pointer-events-none">
      <p role="status" className={`toast-success pointer-events-auto text-sm rounded-card border px-4 py-3 shadow-[0_12px_28px_rgba(21,27,34,0.16)] ${TONE_CLASS[tone] || TONE_CLASS.success}`}>
        {children}
      </p>
    </div>,
    document.body
  )
}
