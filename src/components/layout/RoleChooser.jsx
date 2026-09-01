import { CheckCircle2 } from 'lucide-react'

const NIVEL_LABEL = {
  super_admin: 'Super Admin',
  nacional: 'Nivel Nacional',
  distrital: 'Nivel Distrital',
  local: 'Congregación',
}

export function describirAlcance(role) {
  if (role.nivel === 'local') return role.congregaciones?.nombre || 'Sin congregación asignada'
  if (role.nivel === 'distrital') {
    const numero = role.distritos?.numero
    return numero ? `Distrito ${numero} · ${role.distritos?.nombre}` : role.distritos?.nombre || 'Sin distrito asignado'
  }
  return 'Acceso general'
}

export default function RoleChooser({ roles, onElegir }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2 text-center">SIGA</p>
        <h1 className="text-2xl font-semibold text-center">¿Cómo quieres ingresar hoy?</h1>
        <p className="text-sm text-secondary mt-2 text-center">Tu cuenta tiene más de un rol activo. Elige con cuál quieres trabajar; puedes cambiarlo después desde el menú.</p>

        <div className="mt-6 flex flex-col gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onElegir(role.id)}
              className="card p-4 text-left flex items-center justify-between gap-3 hover:border-accent transition-colors"
            >
              <div>
                <p className="font-medium">{NIVEL_LABEL[role.nivel] || role.nivel}</p>
                <p className="text-sm text-secondary mt-0.5">{describirAlcance(role)}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-muted flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
