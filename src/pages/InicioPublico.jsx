import { ArrowRight, BarChart3, BookOpen, CalendarClock, CalendarRange, HeartHandshake, MessageCircle, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import sigapLogo from '../assets/sigap-logo.svg'
import Footer from '../components/Footer'

const modules = [
  { icon: HeartHandshake, title: 'Feligresía con contexto', text: 'Censo, familias y ciclo de vida espiritual de cada persona, desde su ingreso hasta su cargo.' },
  { icon: BarChart3, title: 'Analítica para decidir', text: 'Pirámide poblacional, proyección de crecimiento y semáforo de salud, igual en lo local, distrital y nacional.' },
  { icon: BookOpen, title: 'Trabajo territorial', text: 'Evangelismo, Misión Juvenil y los 10 comités, con su consolidado en cada nivel.' },
]

// Numero real de SIGAP para cotizar planes -- confirmado por el usuario
// (2026-09-10). No se muestran precios a proposito: la decision de
// negocio fue vender por copywriting + asesoria directa, no por tabla
// de precios publica.
const WHATSAPP_NUMERO = '573005772967'
function enlaceWhatsapp(plan) {
  const mensaje = `Hola, quiero conocer el plan ${plan} de SIGAP para mi congregación.`
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`
}

const planes = [
  {
    icon: CalendarClock,
    nombre: 'Plan mensual',
    resumen: 'Para empezar sin ataduras y ver el cambio desde el primer cierre de mes.',
    beneficios: [
      'Acceso completo a todos los módulos, sin funciones bloqueadas.',
      'Tu congregación queda operando en SIGAP en días, no en meses.',
      'Ajustas o cancelas cuando lo necesites.',
    ],
    cta: 'Cotizar plan mensual',
    plan: 'mensual',
  },
  {
    icon: CalendarRange,
    nombre: 'Plan anual',
    resumen: 'Para la congregación que ya decidió que SIGAP es su forma de trabajar todo el año.',
    destacado: 'Mejor costo total',
    beneficios: [
      'Mismo acceso completo, con mejor costo total en el año.',
      'Acompañamiento continuo en cada trimestre de crecimiento.',
      'Prioridad en soporte y en las nuevas funciones.',
    ],
    cta: 'Cotizar plan anual',
    plan: 'anual',
  },
]

export default function InicioPublico() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/app" replace />

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-ink">
      <style>{`
        /* Fondo ambiental estatico: sin manchas/circulos animados --
           degradados radiales fijos en las esquinas con los colores de
           marca (dorado + azul). Cada esquina lleva DOS capas -- un
           nucleo pequeno y saturado (mas contraste, se nota de
           verdad) encima de un halo grande y en un tono mas oscuro
           del mismo color, que se extiende bastante mas alla de la
           esquina para que el color llegue a buena parte de la
           pantalla (no solo un punto en la punta) y de sensacion de
           profundidad/sombra en vez de un solo degradado plano. Se
           repite (mismo patron, mas suave) en la seccion de Planes
           mas abajo -- ".planes-ambient" -- para que las dos zonas
           claras de la pagina se sientan como una sola hoja, no dos
           bloques distintos con la seccion oscura de modulos en medio. */
        .inicio-ambient {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(ellipse 380px 380px at -4% -10%, rgba(240, 200, 118, 1) 0%, rgba(240, 200, 118, 0.85) 25%, rgba(240, 200, 118, 0) 62%),
            radial-gradient(ellipse 1150px 1150px at -16% -24%, rgba(160, 108, 24, 0.4) 0%, rgba(160, 108, 24, 0) 76%),
            radial-gradient(ellipse 380px 380px at 104% 114%, rgba(143, 189, 236, 1) 0%, rgba(143, 189, 236, 0.85) 25%, rgba(143, 189, 236, 0) 62%),
            radial-gradient(ellipse 1150px 1150px at 116% 128%, rgba(40, 82, 150, 0.4) 0%, rgba(40, 82, 150, 0) 76%);
        }
        .planes-ambient {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(ellipse 300px 300px at -6% -20%, rgba(240, 200, 118, 0.8) 0%, rgba(240, 200, 118, 0) 60%),
            radial-gradient(ellipse 1000px 1000px at -16% -30%, rgba(160, 108, 24, 0.3) 0%, rgba(160, 108, 24, 0) 74%),
            radial-gradient(ellipse 300px 300px at 106% 122%, rgba(143, 189, 236, 0.8) 0%, rgba(143, 189, 236, 0) 60%),
            radial-gradient(ellipse 1000px 1000px at 118% 134%, rgba(40, 82, 150, 0.3) 0%, rgba(40, 82, 150, 0) 74%);
        }
      `}</style>
      <div className="inicio-ambient min-h-svh flex flex-col">
      <svg
        className="absolute left-0 bottom-0 w-[24vw] max-w-[150px] h-auto z-0 pointer-events-none"
        viewBox="0 0 220 140"
        aria-hidden="true"
      >
        <g fill="#0B0B0B" fillOpacity="0.06">
          <rect x="20" y="86" width="22" height="40" rx="3" />
          <rect x="54" y="70" width="22" height="56" rx="3" />
          <rect x="88" y="52" width="22" height="74" rx="3" />
          <rect x="122" y="32" width="22" height="94" rx="3" />
          <rect x="156" y="10" width="22" height="116" rx="3" />
        </g>
      </svg>
      <nav className="relative z-[1] w-full max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center" aria-label="Inicio de SIGAP">
          <img src={sigapLogo} alt="SIGAP" className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/ayuda" className="text-secondary hover:text-ink">Ayuda</Link>
          <Link to="/login" className="btn-primary"><span>Ingresar</span><ArrowRight className="w-4 h-4" /></Link>
        </div>
      </nav>

      <section className="relative z-[1] w-full max-w-6xl mx-auto px-5 sm:px-8 pt-10 lg:pt-12 pb-28 flex-1 grid content-center lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center">
        <div>
          <p className="eyebrow">Inteligencia pastoral</p>
          <h1 className="text-4xl sm:text-6xl font-semibold leading-[1.05] mt-4 max-w-2xl">Cada nivel, la lectura que necesita para decidir.</h1>
          <p className="text-lg text-secondary leading-8 mt-6 max-w-xl">SIGAP convierte el censo, la asistencia y los comités en pirámide poblacional, ciclo de vida espiritual y proyección de crecimiento — con la misma claridad para el pastor local, el distrital y la dirección nacional.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link to="/login" className="btn-primary py-3"><span>Entrar a SIGAP</span><ArrowRight className="w-4 h-4" /></Link>
            <Link to="/ayuda#acceso" className="btn-secondary py-3">Solicitar acceso</Link>
          </div>
          <p className="text-xs text-muted mt-5 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-success" /> Acceso privado por invitación y perfil autorizado.</p>
        </div>
        <div className="relative min-h-[330px] bg-ink rounded-card overflow-hidden p-7 sm:p-10 text-white shadow-[0_24px_60px_rgba(21,27,34,0.18)]">
          <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_82%_12%,#2a78d6_0,transparent_35%),linear-gradient(145deg,transparent_40%,#173404_160%)]" />
          <div className="relative h-full flex flex-col justify-between">
            <div><p className="text-xs uppercase tracking-[0.18em] text-white/55">Tu congregación</p><p className="text-2xl font-medium mt-3">Una lectura compartida</p></div>
            <div className="grid grid-cols-2 gap-3 mt-10 sm:mt-16">
              <div className="rounded bg-white/10 border border-white/10 p-4">
                <p className="text-xs text-white/55">Actividad</p>
                <svg className="w-full h-9 mt-3" viewBox="0 0 80 30" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="hero-actividad-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="hero-actividad-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="27" x2="80" y2="27" stroke="#fff" strokeOpacity="0.12" strokeDasharray="1.5 3" />
                  <path d="M1,23 C10,23 13,16 21,16 C29,16 32,20 40,18 C48,16 51,7 59,6 C65,5.2 70,4.4 79,3 L79,30 L1,30 Z" fill="url(#hero-actividad-area)" />
                  <path d="M1,23 C10,23 13,16 21,16 C29,16 32,20 40,18 C48,16 51,7 59,6 C65,5.2 70,4.4 79,3" stroke="url(#hero-actividad-line)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="79" cy="3" r="4.5" fill="#fff" fillOpacity="0.16" />
                  <circle cx="79" cy="3" r="2" fill="#fff" />
                </svg>
                <p className="text-3xl font-semibold mt-3">Clara</p>
                <p className="text-xs text-white/55 mt-1">por módulo</p>
              </div>
              <div className="rounded bg-[#8fca68]/15 border border-[#8fca68]/20 p-4">
                <p className="text-xs text-white/55">Acompañamiento</p>
                <svg className="w-full h-9 mt-3" viewBox="0 0 80 30" fill="none" aria-hidden="true">
                  <defs>
                    <radialGradient id="hero-acompanamiento-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="40" cy="15" r="13.5" fill="url(#hero-acompanamiento-glow)" />
                  <circle cx="40" cy="15" r="13" stroke="#fff" strokeOpacity="0.2" />
                  <circle cx="40" cy="15" r="8.5" stroke="#fff" strokeOpacity="0.4" />
                  <circle cx="40" cy="15" r="3.5" fill="#fff" />
                </svg>
                <p className="text-3xl font-semibold mt-3">Cercano</p>
                <p className="text-xs text-white/55 mt-1">por persona</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>

      <section className="relative overflow-hidden border-t border-white/10 bg-ink text-white">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_15%_20%,rgba(42,120,214,0.28),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(42,120,214,0.2),transparent_42%)]" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 grid md:grid-cols-3 gap-4">{modules.map(({ icon: Icon, title, text }) => <article key={title} className="p-5 border border-white/10 rounded-card bg-[linear-gradient(145deg,rgba(42,120,214,0.3),rgba(42,120,214,0.12))] shadow-[0_14px_30px_rgba(5,12,20,0.18)]"><Icon className="w-5 h-5 text-[#8fc8ff]" /><h2 className="font-medium mt-5">{title}</h2><p className="text-sm text-white/65 leading-6 mt-2">{text}</p></article>)}</div>
      </section>

      <div className="planes-ambient">
      <section className="relative z-[1] max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Planes</p>
          <h2 className="text-3xl sm:text-4xl font-semibold leading-tight mt-3">El mismo SIGAP completo, al ritmo que le sirva a tu congregación.</h2>
          <p className="text-secondary leading-7 mt-4">Sin funciones recortadas ni "versión básica" -- la diferencia entre planes es el tiempo de permanencia, no lo que puedes hacer con el sistema. Escríbenos y te asesoramos con el valor exacto para el tamaño de tu congregación.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {planes.map(({ icon: Icon, nombre, resumen, destacado, beneficios, cta, plan }) => (
            <article key={plan} className="relative p-7 border border-border rounded-card bg-surface-2 flex flex-col">
              {destacado && <span className="absolute -top-3 left-7 text-[10px] uppercase tracking-[0.14em] font-medium bg-ink text-white px-2.5 py-1 rounded-full">{destacado}</span>}
              <div className="w-10 h-10 rounded bg-accent/10 text-accent flex items-center justify-center"><Icon className="w-5 h-5" /></div>
              <h3 className="text-xl font-medium mt-5">{nombre}</h3>
              <p className="text-sm text-secondary leading-6 mt-2">{resumen}</p>
              <ul className="flex flex-col gap-2.5 mt-5 flex-1">
                {beneficios.map((beneficio) => (
                  <li key={beneficio} className="text-sm text-secondary leading-6 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />{beneficio}</li>
                ))}
              </ul>
              <a href={enlaceWhatsapp(plan)} target="_blank" rel="noopener noreferrer" className="btn-primary justify-center mt-7"><MessageCircle className="w-4 h-4" /><span>{cta}</span></a>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted mt-6 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-success" /> Te respondemos por WhatsApp con el valor según el número de congregaciones y distritos que necesites gestionar.</p>
      </section>
      </div>

      <Footer />
    </main>
  )
}