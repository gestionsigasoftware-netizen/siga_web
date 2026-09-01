import { ArrowRight, BarChart3, BookOpen, HeartHandshake, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const modules = [
  { icon: HeartHandshake, title: 'Acompañamiento pastoral', text: 'Organiza la feligresía, las familias y el seguimiento de cada persona.' },
  { icon: BarChart3, title: 'Lectura para decidir', text: 'Convierte la asistencia y la actividad en señales claras para tu equipo.' },
  { icon: BookOpen, title: 'Trabajo territorial', text: 'Conecta Evangelismo y Misión Juvenil con su contexto operativo.' },
]

export default function InicioPublico() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/app" replace />

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-ink">
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" aria-label="Inicio de SIGAP">
          <span className="w-10 h-10 rounded bg-ink text-white flex items-center justify-center font-semibold">S</span>
          <span className="font-semibold tracking-wide">SIGAP</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/ayuda" className="text-secondary hover:text-ink">Ayuda</Link>
          <Link to="/login" className="btn-primary"><span>Ingresar</span><ArrowRight className="w-4 h-4" /></Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
        <div>
          <p className="eyebrow">Gestión pastoral institucional</p>
          <h1 className="text-4xl sm:text-6xl font-semibold leading-[1.05] mt-4 max-w-2xl">La información correcta para acompañar mejor.</h1>
          <p className="text-lg text-secondary leading-8 mt-6 max-w-xl">SIGAP reúne la lectura de asistencia, feligresía, Evangelismo y Misión Juvenil en un espacio de trabajo claro para cada congregación.</p>
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
            <div className="grid grid-cols-2 gap-3 mt-16"><div className="rounded bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/55">Actividad</p><p className="text-3xl font-semibold mt-3">Clara</p><p className="text-xs text-white/55 mt-1">por módulo</p></div><div className="rounded bg-[#8fca68]/15 border border-[#8fca68]/20 p-4"><p className="text-xs text-white/55">Acompañamiento</p><p className="text-3xl font-semibold mt-3">Cercano</p><p className="text-xs text-white/55 mt-1">por persona</p></div></div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 bg-ink text-white">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_15%_20%,rgba(42,120,214,0.28),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(42,120,214,0.2),transparent_42%)]" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 grid md:grid-cols-3 gap-4">{modules.map(({ icon: Icon, title, text }) => <article key={title} className="p-5 border border-white/10 rounded-card bg-[linear-gradient(145deg,rgba(42,120,214,0.3),rgba(42,120,214,0.12))] shadow-[0_14px_30px_rgba(5,12,20,0.18)]"><Icon className="w-5 h-5 text-[#8fc8ff]" /><h2 className="font-medium mt-5">{title}</h2><p className="text-sm text-white/65 leading-6 mt-2">{text}</p></article>)}</div>
      </section>
      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col sm:flex-row gap-3 justify-between text-xs text-muted"><span>IPUC · Gestión pastoral</span><span className="flex gap-4"><Link to="/legal" className="hover:text-ink">Privacidad y términos</Link><Link to="/ayuda" className="hover:text-ink">Ayuda</Link></span></footer>
    </main>
  )
}