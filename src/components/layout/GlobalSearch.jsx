import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMiRol } from '../../hooks/useMiRol'

const ESTADO_CONGREGACION_LABELS = { pendiente_aprobacion: 'Pendiente de aprobación', activa: 'Activa', suspendida: 'Suspendida' }

// Local busca en su propio censo (RLS ya lo limita a su congregación) y
// puede saltar directo a la ficha de la persona -- esa pantalla existe
// solo para local. Distrital/nacional/super_admin buscan congregaciones
// (RLS via mis_congregaciones() ya limita el alcance: un distrito para
// distrital, todo el país para nacional/super_admin); no hay una
// pantalla de "detalle de congregación" a la que saltar, asi que el
// resultado se muestra completo ahi mismo, sin necesitar un click más.
export default function GlobalSearch() {
  const { rolPrincipal } = useMiRol()
  const [term, setTerm] = useState('')
  const [personas, setPersonas] = useState([])
  const [congregaciones, setCongregaciones] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef(null)

  const esLocal = rolPrincipal?.nivel === 'local'

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (term.trim().length < 2 || !rolPrincipal) { setPersonas([]); setCongregaciones([]); return undefined }
    let active = true
    setSearching(true)
    const timer = setTimeout(async () => {
      const q = term.trim()
      if (esLocal) {
        const { data } = await supabase
          .from('personas')
          .select('id, nombres, apellidos')
          .eq('congregacion_id', rolPrincipal.congregacion_id)
          .or(`nombres.ilike.%${q}%,apellidos.ilike.%${q}%`)
          .order('nombres')
          .limit(8)
        if (active) { setPersonas(data ?? []); setCongregaciones([]); setSearching(false) }
      } else {
        const { data } = await supabase
          .from('congregaciones')
          .select('id, nombre, ciudad, estado, pastor_nombre, distritos(nombre, numero)')
          .or(`nombre.ilike.%${q}%,ciudad.ilike.%${q}%`)
          .order('nombre')
          .limit(8)
        if (active) { setCongregaciones(data ?? []); setPersonas([]); setSearching(false) }
      }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [term, esLocal, rolPrincipal])

  const hasResults = personas.length > 0 || congregaciones.length > 0

  return (
    <div ref={containerRef} className="relative hidden sm:block w-56 md:w-72">
      <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={term}
        onChange={(event) => { setTerm(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={esLocal ? 'Buscar persona...' : 'Buscar congregación...'}
        aria-label={esLocal ? 'Buscar persona' : 'Buscar congregación'}
        className="input-field pl-9 pr-8 py-2 text-sm"
      />
      {term.trim() && (
        <button type="button" onClick={() => { setTerm(''); setOpen(false) }} aria-label="Limpiar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && term.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-surface-2 border border-border rounded-card shadow-lg max-h-80 overflow-y-auto">
          {searching ? (
            <p className="p-3 text-xs text-muted">Buscando...</p>
          ) : !hasResults ? (
            <p className="p-3 text-xs text-muted">Sin resultados.</p>
          ) : esLocal ? (
            personas.map((persona) => (
              <Link key={persona.id} to={`/feligresia?persona=${persona.id}`} onClick={() => { setOpen(false); setTerm('') }} className="block px-3 py-2.5 text-sm hover:bg-surface-1 border-b border-border last:border-0">
                {persona.nombres} {persona.apellidos}
              </Link>
            ))
          ) : (
            congregaciones.map((congregacion) => (
              <div key={congregacion.id} className="px-3 py-2.5 text-sm border-b border-border last:border-0">
                <p className="font-medium">{congregacion.nombre}</p>
                <p className="text-xs text-muted mt-0.5">
                  {congregacion.ciudad || 'Sin ciudad'}
                  {congregacion.distritos ? ` · Distrito ${congregacion.distritos.numero ?? ''} · ${congregacion.distritos.nombre}` : ''}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Pastor: {congregacion.pastor_nombre || 'Sin asignar'} · {ESTADO_CONGREGACION_LABELS[congregacion.estado] || congregacion.estado}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
