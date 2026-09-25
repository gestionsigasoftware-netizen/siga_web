import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme.jsx'

// Interruptor claro/oscuro reutilizable -- llama useTheme() internamente
// para que cualquier pantalla lo pueda montar sin pasarle props.
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const esOscuro = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t(esOscuro ? 'common.theme.toLight' : 'common.theme.toDark')}
      title={t(esOscuro ? 'common.theme.toLight' : 'common.theme.toDark')}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${esOscuro ? 'border-white/20 text-white hover:bg-white/10' : 'border-border text-secondary hover:bg-surface-1'} ${className}`}
    >
      {esOscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
