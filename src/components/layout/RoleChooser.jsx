import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

export function nivelLabel(nivel) {
  return i18n.t(`sidebar.levels.${nivel}`, nivel)
}

export function describirAlcance(role) {
  if (role.nivel === 'local') return role.congregaciones?.nombre || i18n.t('sidebar.noCongregacion')
  if (role.nivel === 'distrital') {
    const numero = role.distritos?.numero
    return numero ? i18n.t('sidebar.district', { numero }) : i18n.t('sidebar.noDistrito')
  }
  return i18n.t('sidebar.generalAccess')
}

export default function RoleChooser({ roles, onElegir }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <p className="text-xs uppercase tracking-[0.16em] text-accent mb-2 text-center">SIGAP</p>
        <h1 className="text-2xl font-semibold text-center">{t('roleChooser.titulo')}</h1>
        <p className="text-sm text-secondary mt-2 text-center">{t('roleChooser.subtitulo')}</p>

        <div className="mt-6 flex flex-col gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onElegir(role.id)}
              className="card p-4 text-left flex items-center justify-between gap-3 hover:border-accent transition-colors"
            >
              <div>
                <p className="font-medium">{nivelLabel(role.nivel)}</p>
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
