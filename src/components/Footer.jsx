import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Footer reutilizado en Ayuda, Legal, NotFound y dentro de la app
// (MainLayout). InicioPublico.jsx tiene su propia copia inline (por el
// tema oscuro/claro de esa pagina) -- mismo contenido, mantener los dos
// sincronizados si cambia el texto o los enlaces.
export default function Footer({ variant = 'public' }) {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className={`max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${variant === 'app' ? 'border-t border-border mt-4' : ''}`}>
      <div className="text-muted">
        <p className="text-secondary">SIGAP — {t('common.footer.line')}</p>
        <p className="mt-1">© {year} {t('common.footer.rights')} · {t('common.footer.by')} <a href="https://jormeliasoft.com" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Jormelia Soft</a></p>
      </div>
      <span className="flex gap-4 flex-shrink-0 text-muted">
        <Link to="/legal" className="hover:text-ink">{t('common.footer.privacy')}</Link>
        <Link to="/ayuda" className="hover:text-ink">{t('common.footer.help')}</Link>
      </span>
    </footer>
  )
}
