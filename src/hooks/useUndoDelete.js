import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Borrado con "deshacer" en vez de un window.confirm() que no protege de
// nada una vez aceptado. El borrado real ocurre de inmediato (no se
// retrasa, para no depender de que la pestaña siga abierta); "deshacer"
// vuelve a insertar exactamente la misma fila mientras el aviso sigue
// visible (8s). El llamador debe capturar la fila completa antes de
// borrar -- suficientes columnas para que el re-insert sea valido.
export function useUndoDelete(onRestored) {
  const [pending, setPending] = useState(null)

  useEffect(() => {
    if (!pending) return undefined
    const timer = setTimeout(() => setPending(null), 8000)
    return () => clearTimeout(timer)
  }, [pending])

  const registerDelete = useCallback((table, row, label) => {
    setPending({ table, row, label })
  }, [])

  const undo = useCallback(async () => {
    if (!pending) return
    const { table, row } = pending
    setPending(null)
    await supabase.from(table).insert(row)
    onRestored?.()
  }, [pending, onRestored])

  return { pending, registerDelete, undo }
}
