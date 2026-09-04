import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Icono de ayuda contextual -- un circulo pequeno que muestra un mensaje
 * corto al pasar el mouse (o al tocarlo, en pantallas tactiles). Para
 * campos o acciones que no son evidentes por si solos para alguien sin
 * experiencia tecnica.
 */
export default function InfoTip({ texto, className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    function alHacerClicFuera(event) {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, [abierto]);

  return (
    <span ref={contenedorRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label="Más información"
        aria-describedby={abierto ? id : undefined}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onClick={(event) => { event.preventDefault(); setAbierto((current) => !current); }}
        className="w-4 h-4 rounded-full border border-border text-muted hover:text-accent hover:border-accent focus:text-accent focus:border-accent flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <Info className="w-2.5 h-2.5" />
      </button>
      {abierto && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 max-w-[70vw] rounded-card border border-border bg-surface-2 text-ink text-xs font-normal normal-case tracking-normal leading-relaxed p-2.5 shadow-[0_14px_34px_rgba(21,27,34,0.12)]"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
