import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotificationCenter from './NotificationCenter'
import { Link } from 'react-router-dom'
import { Bell, UserRound } from 'lucide-react'
import { useMiRol } from '../../hooks/useMiRol'

export default function MainLayout() {
  const { loading: roleLoading } = useMiRol()

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="app-main md:ml-[248px] min-h-screen p-4 md:p-6">
        <header className="main-header sticky top-0 z-20 mb-6 border-b border-border">
          <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-3 py-3.5">
            <div>
              <p className="eyebrow">Panel de control</p>
              <p className="text-sm text-secondary">SIGA · Sistema Integrado</p>
            </div>

            <div className="toolbar">
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-secondary">
                <Bell className="w-4 h-4" />
                <span>Notificaciones</span>
              </div>
              <NotificationCenter />
              <Link to="/perfil" aria-label="Abrir mi perfil" title="Mi perfil" className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-secondary hover:bg-surface-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/20">
                <UserRound className="w-[18px] h-[18px]" />
                <span>Perfil</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1220px]">
          <Suspense fallback={<div className="module-loading" role="status"><span className="loading-dot" />Cargando módulo...</div>}>
            {roleLoading ? <div className="module-loading" role="status"><span className="loading-dot" />Preparando tu espacio...</div> : <Outlet />}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
