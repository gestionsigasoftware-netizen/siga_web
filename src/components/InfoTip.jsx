import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const ANCHO_TOOLTIP = 224; // w-56
const MARGEN_VIEWPORT = 8;

/**
 * Icono de ayuda contextual -- un circulo pequeno que muestra un mensaje
 * corto al pasar el mouse (o al tocarlo, en pantallas tactiles). Para
 * campos o acciones que no son evidentes por si solos para alguien sin
 * experiencia tecnica.
 *
 * El mensaje se dibuja con un portal a document.body y se posiciona con
 * "fixed" -- si se dibujara como hijo normal, cualquier tarjeta o tabla
 * con scroll horizontal (overflow-x-auto, que tambien recorta el eje
 * vertical por como funciona overflow en CSS) lo cortaba a la mitad en
 * vez de dejarlo salir por encima.
 */
export default function InfoTip({ texto, className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const botonRef = useRef(null);
  const id = useId();

  function calcularPosicion() {
    const rect = botonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centroX = rect.left + rect.width / 2;
    const left = Math.max(MARGEN_VIEWPORT, Math.min(centroX - ANCHO_TOOLTIP / 2, window.innerWidth - ANCHO_TOOLTIP - MARGEN_VIEWPORT));
    const cabeArriba = rect.top > 130;
    setPosicion({
      left,
      top: cabeArriba ? rect.top - 8 : rect.bottom + 8,
      arriba: cabeArriba,
    });
  }

  function abrir() {
    calcularPosicion();
    setAbierto(true);
  }
  function cerrar() {
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return undefined;
    // capture:true para enterarse tambien del scroll dentro de tablas con
    // overflow-x-auto, no solo del scroll de la ventana.
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    function alHacerClicFuera(event) {
      if (botonRef.current && !botonRef.current.contains(event.target)) cerrar();
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, [abierto]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={botonRef}
        type="button"
        aria-label="Más información"
        aria-describedby={abierto ? id : undefined}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={(event) => { event.preventDefault(); abierto ? cerrar() : abrir(); }}
        className="w-[18px] h-[18px] rounded-full border border-accent/30 bg-accent-bg text-accent hover:bg-accent hover:text-white hover:border-accent focus:bg-accent focus:text-white focus:border-accent flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>
      {abierto && posicion && createPortal(
        <span
          id={id}
          role="tooltip"
          style={{ position: "fixed", left: posicion.left, top: posicion.top, transform: posicion.arriba ? "translateY(-100%)" : "none" }}
          className="z-[100] block w-56 max-w-[70vw] rounded-card border border-border bg-surface-2 text-ink text-xs font-normal normal-case tracking-normal leading-relaxed p-2.5 shadow-[0_14px_34px_rgba(21,27,34,0.12)]"
        >
          {texto}
        </span>,
        document.body
      )}
    </span>
  );
}
