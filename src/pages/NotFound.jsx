import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function NotFound() {
  return <main className="min-h-screen bg-[#f4f1eb] text-ink px-5 sm:px-8 py-6 flex flex-col">
    <div className="max-w-md mx-auto flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
      <div className="w-14 h-14 rounded bg-ink text-white flex items-center justify-center"><Compass className="w-6 h-6" /></div>
      <p className="eyebrow">Error 404</p>
      <h1 className="text-3xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-secondary">La dirección a la que intentaste entrar no existe o cambió de lugar. Verifica el enlace o vuelve al inicio.</p>
      <div className="flex gap-3 mt-2">
        <Link to="/" className="btn-primary">Ir al inicio</Link>
        <Link to="/login" className="btn-secondary">Iniciar sesión</Link>
      </div>
    </div>
    <Footer />
  </main>
}
