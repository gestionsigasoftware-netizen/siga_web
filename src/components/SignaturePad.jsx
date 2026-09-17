import { useRef } from 'react'

// Firma dibujada con el dedo (táctil) o el mouse -- alternativa al
// consentimiento con archivo/firma subido a Storage: no necesita
// ningún dispositivo externo, funciona igual en celular o computador.
export default function SignaturePad({ onGuardar, onCancelar }) {
  const canvasRef = useRef(null)
  const dibujandoRef = useRef(false)
  const ultimoPuntoRef = useRef(null)
  const tieneTrazoRef = useRef(false)

  function obtenerPunto(event) {
    const rect = canvasRef.current.getBoundingClientRect()
    const origen = event.touches?.[0] || event
    return { x: origen.clientX - rect.left, y: origen.clientY - rect.top }
  }
  function iniciar(event) {
    event.preventDefault()
    dibujandoRef.current = true
    ultimoPuntoRef.current = obtenerPunto(event)
  }
  function mover(event) {
    if (!dibujandoRef.current) return
    event.preventDefault()
    const punto = obtenerPunto(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1c1c1c'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ultimoPuntoRef.current.x, ultimoPuntoRef.current.y)
    ctx.lineTo(punto.x, punto.y)
    ctx.stroke()
    ultimoPuntoRef.current = punto
    tieneTrazoRef.current = true
  }
  function terminar() { dibujandoRef.current = false }
  function limpiar() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    tieneTrazoRef.current = false
  }
  function guardar() {
    if (!tieneTrazoRef.current) return
    onGuardar(canvasRef.current.toDataURL('image/png'))
  }

  return <div>
    <canvas
      ref={canvasRef} width={420} height={160}
      className="border border-border rounded bg-white w-full touch-none cursor-crosshair"
      onMouseDown={iniciar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
      onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={terminar}
    />
    <p className="text-xs text-muted mt-1.5">Firma aquí con el dedo o el mouse.</p>
    <div className="flex gap-2 mt-2">
      <button type="button" onClick={limpiar} className="btn-secondary text-xs">Limpiar</button>
      <button type="button" onClick={guardar} className="btn-primary text-xs">Guardar firma</button>
      <button type="button" onClick={onCancelar} className="text-xs text-secondary">Cancelar</button>
    </div>
  </div>
}
