import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotificationCenter from './NotificationCenter'
import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="md:ml-[220px] p-4 md:p-7 max-w-[1200px]">
        <header className="flex justify-end items-center gap-2 mb-5"><NotificationCenter /><Link to="/perfil" aria-label="Abrir mi perfil" title="Mi perfil" className="p-2 rounded text-secondary hover:bg-surface-1 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"><UserRound className="w-[18px] h-[18px]" /></Link></header>
        <Outlet />
      </main>
    </div>
  )
}
